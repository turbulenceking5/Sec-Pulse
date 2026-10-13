#!/usr/bin/env python3
"""Fetch security news feeds, score them for relevance, and write data/news.json.

Standard library only, so the GitHub Action needs no pip install.
Run locally with:  python3 scripts/fetch_news.py
"""
import concurrent.futures
import datetime as dt
import email.utils
import hashlib
import html
import json
import math
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from send_brief import rank  # noqa: E402  (one copy of rank() in Python; index.html has the JS twin)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "scripts", "sources.json")
OUT = os.path.join(ROOT, "data", "news.json")
KEEP_DAYS = 14
MAX_ITEMS = 400
UA = "Mozilla/5.0 (compatible; Sec-Pulse/1.0; personal news reader)"
NOW = dt.datetime.now(dt.timezone.utc)

EPSS_API = "https://api.first.org/data/v1/epss?cve="
EPSS_BATCH = 50          # CVEs per request (the API pages at 100)
EPSS_MAX_CVES = 300      # hard cap per run, so a CVE-heavy day can't cause dozens of calls
EPSS_TIMEOUT = 15
EPSS_BUMP_AT = 0.5       # non-KEV items mentioning a CVE this likely to be exploited get +EPSS_BUMP
EPSS_BUMP = 2
CVE_RE = re.compile(r"CVE-\d{4}-\d{4,7}", re.I)

CLUSTER_TITLE_HOURS = 72     # reworded-headline matches must be published this close together
CLUSTER_CVE_HOURS = 7 * 24   # shared-CVE matches may be further apart
CLUSTER_SIM = 0.35           # IDF-weighted title overlap needed to merge (plus 2+ shared distinctive words)


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def strip_ns(tree):
    for el in tree.iter():
        if isinstance(el.tag, str) and "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return tree


def clean(text, limit=None):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    if limit and len(text) > limit:
        text = text[: limit - 1].rsplit(" ", 1)[0] + "…"
    return text


def parse_date(s):
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
    except (TypeError, ValueError):
        d = None
    if d is None:
        try:
            d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(dt.timezone.utc)


def text_of(el, *names):
    for n in names:
        child = el.find(n)
        if child is not None and (child.text or "").strip():
            return child.text
    return ""


def parse_feed(raw, src):
    root = strip_ns(ET.fromstring(raw))
    out = []
    entries = root.findall(".//item") or root.findall(".//entry")
    for e in entries:
        title = clean(text_of(e, "title"))
        link = text_of(e, "link").strip()
        if not link:
            le = e.find("link[@rel='alternate']")
            if le is None:
                le = e.find("link")
            if le is not None:
                link = le.get("href", "")
        published = parse_date(text_of(e, "pubDate", "published", "updated", "date"))
        summary = clean(text_of(e, "description", "summary", "content", "encoded"), 300)
        source = src["name"]
        pub_el = e.find("source")
        if "news.google.com" in src["url"]:
            # Google News titles end in " - Publisher"; show the publisher as the source.
            publisher = (pub_el.text if pub_el is not None else "") or ""
            if publisher and title.endswith(" - " + publisher):
                title = title[: -len(publisher) - 3]
            source = publisher or source
            summary = ""  # Google's description is just the title again plus links
        if len(title) >= 12 and link and not title.startswith("-"):
            out.append({"title": title, "link": link, "published": published,
                        "summary": summary, "source": source})
    return out


def parse_kev(raw, src):
    data = json.loads(raw)
    out = []
    for v in data.get("vulnerabilities", []):
        added = parse_date(v.get("dateAdded", "") + "T00:00:00Z")
        if not added or (NOW - added).days > KEEP_DAYS:
            continue
        ransom = v.get("knownRansomwareCampaignUse", "").lower() == "known"
        summary = clean(v.get("shortDescription", ""), 260)
        summary += f" CISA remediation due {v.get('dueDate', '?')}."
        if ransom:
            summary += " Known ransomware use."
        out.append({
            "title": f"{v['cveID']}: {v.get('vendorProject', '')} {v.get('product', '')} — {v.get('vulnerabilityName', '')}",
            "link": f"https://nvd.nist.gov/vuln/detail/{v['cveID']}",
            "published": added,
            "summary": summary,
            "source": src["name"],
            "extra_tags": ["Actively exploited", "KEV"] + (["Ransomware"] if ransom else []),
        })
    return out


def score(item, src, keywords):
    hay = " " + (item["title"] + " " + item["summary"]).lower() + " "
    total = src.get("weight", 0)
    tags = list(item.pop("extra_tags", []))
    why = matched_groups(item, keywords)
    for group in keywords:
        if group["tag"] in why:
            # Title hits count more than summary-only hits.
            in_title = any(t in " " + item["title"].lower() + " " for t in group["terms"])
            total += group["weight"] + (1 if in_title else 0)
            if group["tag"] not in tags:
                tags.append(group["tag"])
    # "AU" sources are Australian publishers (always local). "auto" sources are
    # Google News searches that also return overseas stories, so they only count
    # as Australian when the text itself mentions Australia.
    region = src.get("region", "Global")
    if region == "auto":
        region = "AU" if "Australia" in tags else "Global"
    if region == "AU":
        total += 2
        if "Australia" not in tags:
            tags.append("Australia")
    return total, tags, region, why


def matched_groups(item, keywords):
    """Keyword group tags whose terms appear in the title or summary (the `why` field)."""
    hay = " " + (item["title"] + " " + item.get("summary", "")).lower() + " "
    return [g["tag"] for g in keywords if any(t in hay for t in g["terms"])]


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", t.lower())[:80]


# ---------------------------------------------------------------- EPSS ----

def item_cves(it):
    """CVE IDs an item is *about*: those in its title, else its summary if it names
    at most two (roundups that list a dozen CVEs aren't about any one of them)."""
    found = {c.upper() for c in CVE_RE.findall(it["title"])}
    if not found:
        found = {c.upper() for c in CVE_RE.findall(it.get("summary", ""))}
        if len(found) > 2:
            found = set()
    return sorted(found)


def fetch_epss(cves):
    """Look up EPSS probabilities from FIRST. Returns ({CVE: float}, error or None).
    Stops at the first failed batch: if the API is down the rest would only time out too."""
    scores = {}
    for i in range(0, len(cves), EPSS_BATCH):
        batch = cves[i:i + EPSS_BATCH]
        try:
            data = json.loads(fetch(EPSS_API + ",".join(batch), timeout=EPSS_TIMEOUT))
            if str(data.get("status", "OK")).upper() != "OK":
                raise ValueError(f"API status {data.get('status')}")
            for row in data.get("data", []):
                scores[row["cve"].upper()] = float(row["epss"])
        except Exception as e:  # EPSS is a nice-to-have; never fail the run over it
            return scores, f"{type(e).__name__}: {e}"[:200]
    return scores, None


def add_epss(items, fresh_ids):
    """Set `epss` (max probability over the item's CVEs) and return a feed-health row.
    Fresh non-KEV items with a very likely-exploited CVE get a small score bump."""
    wanted = []
    for it in items:  # newest first, so the cap drops the oldest CVEs
        for c in item_cves(it):
            if c not in wanted:
                wanted.append(c)
    wanted = wanted[:EPSS_MAX_CVES]
    scores, err = fetch_epss(wanted) if wanted else ({}, None)
    for it in items:
        probs = [scores[c] for c in item_cves(it) if c in scores]
        if probs:
            it["epss"] = round(max(probs), 4)
        elif err is None:
            it.pop("epss", None)  # lookup worked but EPSS has no score (yet) for these CVEs
        # On error, keep whatever epss a stored item already had.
        if (id(it) in fresh_ids and it.get("epss", 0) >= EPSS_BUMP_AT
                and "KEV" not in it["tags"]):
            it["score"] += EPSS_BUMP
    return {"name": "FIRST EPSS", "ok": err is None, "count": len(scores), "error": err}


# ---------------------------------------------------------- Clustering ----

STOPWORDS = set("""a an the and or but of in on at to for from by with as is are was were be been
it its this that these those after before over under into out up new how why what who when
via amid says said warns warn report reports than more most just now about against""".split())
SYNONYMS = {
    "flaw": "vuln", "vulnerability": "vuln", "vulnerabilitie": "vuln", "bug": "vuln",
    "exploited": "exploit", "exploiting": "exploit", "exploitation": "exploit",
    "cyberattack": "attack", "attacked": "attack",
    "arrested": "arrest", "patched": "patch", "breached": "breach",
    "hacked": "hack", "hacker": "hack", "hacking": "hack",
    "zeroday": "0day",
}
# Headline template words. They still count toward similarity (at half weight) but
# never as "distinctive", so "<X> hit by ransomware attack" and "<Y> hit by
# ransomware attack" don't merge just because the template matches.
GENERIC = set("""attack vuln exploit breach hack arrest patch fix data record customer user people
million billion critical severe hit system offline expose impact firm company group gang actor
threat malware ransomware phishing security cyber cybersecurity government agency police fbi
cisa researcher attacker campaign target targeted steal stolen leak account device update warn
alert confirm disclose disclosure claim week day year month report service""".split())


def title_tokens(title):
    t = re.sub(r"(?<=\w)['’\-](?=\w)", "", title.lower())  # cyber-attack -> cyberattack, it's -> its
    out = set()
    for w in re.findall(r"[a-z0-9]+", t):
        if len(w) > 4 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        w = SYNONYMS.get(w, w)
        if w not in STOPWORDS and (len(w) >= 3 or any(ch.isdigit() for ch in w)):
            out.add(w)
    return out


def _hours_apart(a, b):
    return abs((parse_date(a["published"]) - parse_date(b["published"])).total_seconds()) / 3600


def _merge_also(primary, dup):
    seen = {primary["link"]} | {a["url"] for a in primary.get("also", [])}
    also = list(primary.get("also", []))
    for a in [{"source": dup["source"], "url": dup["link"]}] + dup.get("also", []):
        if a["url"] not in seen:
            seen.add(a["url"])
            also.append(a)
    primary["also"] = also[:10]
    if dup.get("epss", -1) > primary.get("epss", -1):
        primary["epss"] = dup["epss"]


def cluster(items):
    """Fold reports of the same story from different outlets into one item.

    Conservative on purpose: two items merge only if they come from different
    publishers, neither is a CISA KEV entry, and either
      - they're about the same CVE (see item_cves) and published within 7 days, or
      - their titles are similar and published within 72h. "Similar" means at
        least 3 shared title words (after stopwords and light stemming), at least
        2 of them distinctive (not a GENERIC headline word, and in at most
        max(3, n/50) titles), and an IDF-weighted overlap (shared weight / the
        smaller title's weight) >= CLUSTER_SIM. One shared name alone ("Ivanti
        EPMM flaw exploited" vs "Ivanti Connect Secure flaw exploited") never
        merges two stories.
    An item joins the cluster whose primary or existing member it best matches
    (so a third outlet matching the second, not the first, still joins). The
    highest-ranked item stays as the primary; the others go into its `also`.
    """
    toks = {id(it): title_tokens(it["title"]) for it in items}
    df = {}
    for ts in toks.values():
        for w in ts:
            df[w] = df.get(w, 0) + 1
    n = max(len(items), 1)
    idf = {w: math.log(1 + n / c) * (0.5 if w in GENERIC else 1) for w, c in df.items()}
    rare = max(3, n // 50)  # "uncommon" = in at most this many titles

    def distinctive(w):
        if w in GENERIC or df[w] > rare:
            return False
        if w.isdigit():  # "2 million", "CVSS 10", "2026" are template-ish; "135 attempts" isn't
            return len(w) >= 3 and not re.fullmatch(r"(19|20)\d\d", w)
        return True

    def weight(ws):
        return sum(idf[w] for w in ws)

    def similar(a, b):
        if a["source"] == b["source"] or "KEV" in a["tags"] or "KEV" in b["tags"]:
            return 0.0
        hours = _hours_apart(a, b)
        ca, cb = set(item_cves(a)), set(item_cves(b))
        if ca & cb and hours <= CLUSTER_CVE_HOURS:
            return 1.0
        if ca and cb:  # both name CVEs, and different ones: different bugs
            return 0.0
        if hours > CLUSTER_TITLE_HOURS:
            return 0.0
        ta, tb = toks[id(a)], toks[id(b)]
        shared = ta & tb
        if len(shared) < 3:
            return 0.0
        n_distinct = sum(1 for w in shared if distinctive(w))
        if n_distinct < 2:
            return 0.0
        sim = weight(shared) / min(weight(ta), weight(tb))
        return sim if sim >= CLUSTER_SIM else 0.0

    clusters = []  # [primary, *merged members]
    for it in sorted(items, key=rank, reverse=True):
        best, best_sim = None, 0.0
        for members in clusters:
            s = max(similar(m, it) for m in members)
            if s > best_sim:
                best, best_sim = members, s
        if best is None:
            clusters.append([it])
        else:
            best.append(it)
            _merge_also(best[0], it)
    primaries = [members[0] for members in clusters]
    for p in primaries:
        if not p.get("also"):
            p.pop("also", None)  # optional field: absent rather than []
    return primaries


def run_source(src, keywords):
    try:
        raw = fetch(src["url"])
        items = parse_kev(raw, src) if src.get("type") == "kev" else parse_feed(raw, src)
        if not items and src.get("type") != "kev":
            raise ValueError("feed returned no entries")
        items.sort(key=lambda i: i["published"] or NOW, reverse=True)
        items = items[: src.get("max", 25)]
        result = []
        for it in items:
            pub = it["published"] or NOW
            if (NOW - pub).days > KEEP_DAYS:
                continue
            s, tags, region, why = score(it, src, keywords)
            # Searches match loosely; drop results with no security keyword at all.
            if src.get("requireMatch") and not [t for t in tags if t != "Australia"]:
                continue
            result.append({
                "id": hashlib.sha1(it["link"].encode()).hexdigest()[:12],
                "title": it["title"],
                "link": it["link"],
                "source": it["source"],
                "feed": src["name"],
                "region": region,
                "published": pub.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "summary": it["summary"],
                "score": s,
                "tags": tags,
                "why": why,
            })
        return src["name"], result, None
    except Exception as e:  # one broken feed must never break the rest
        return src["name"], [], f"{type(e).__name__}: {e}"[:200]


def main():
    with open(CONFIG) as f:
        cfg = json.load(f)
    keywords = cfg["keywords"]

    previous = []
    if os.path.exists(OUT):
        try:
            with open(OUT) as f:
                previous = json.load(f).get("items", [])
        except (ValueError, OSError):
            previous = []

    health, fresh = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(run_source, s, keywords) for s in cfg["sources"]]
        for fut in futures:
            name, items, err = fut.result()
            health.append({"name": name, "ok": err is None, "count": len(items), "error": err})
            fresh.extend(items)
            print(f"{'OK ' if err is None else 'ERR'} {name}: {len(items)} {err or ''}", file=sys.stderr)

    # Fresh copies win over older stored ones; keep older items until they age out.
    # A skipped copy's `also` list is carried over, and an identical headline from
    # a different publisher is recorded in `also` rather than silently dropped.
    merged, by_id, by_title = [], {}, {}
    for it in fresh + previous:
        key_t = norm_title(it["title"])
        kept = by_id.get(it["id"]) or by_title.get(key_t)
        if kept is not None:
            if "epss" in it and "epss" not in kept:
                kept["epss"] = it["epss"]  # fallback if this run's EPSS lookup fails
            if it.get("also"):
                _merge_also(kept, {**it, "link": kept["link"]})  # carry `also` only
            if it["link"] != kept["link"] and it["source"] != kept["source"]:
                _merge_also(kept, {**it, "also": []})
            continue
        if (NOW - parse_date(it["published"])).days > KEEP_DAYS:
            continue
        if "why" not in it:  # stored before `why` existed
            it["why"] = matched_groups(it, keywords)
        by_id[it["id"]] = it
        by_title[key_t] = it
        merged.append(it)
    merged.sort(key=lambda i: i["published"], reverse=True)

    epss_health = add_epss(merged, {id(i) for i in fresh})
    health.append(epss_health)
    print(f"{'OK ' if epss_health['ok'] else 'ERR'} FIRST EPSS: {epss_health['count']} {epss_health['error'] or ''}",
          file=sys.stderr)

    before = len(merged)
    merged = cluster(merged)
    merged.sort(key=lambda i: i["published"], reverse=True)
    print(f"Clustered {before - len(merged)} duplicate reports into {sum(1 for i in merged if i.get('also'))} stories",
          file=sys.stderr)
    merged = merged[:MAX_ITEMS]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"generated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "sources": health, "items": merged},
                  f, ensure_ascii=False, indent=1)
    print(f"Wrote {len(merged)} items ({len(fresh)} fresh) to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
