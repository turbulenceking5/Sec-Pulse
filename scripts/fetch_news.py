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
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG = os.path.join(ROOT, "scripts", "sources.json")
OUT = os.path.join(ROOT, "data", "news.json")
KEEP_DAYS = 14
MAX_ITEMS = 400
UA = "Mozilla/5.0 (compatible; Sec-Pulse/1.0; personal news reader)"
NOW = dt.datetime.now(dt.timezone.utc)


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
    for group in keywords:
        if any(t in hay for t in group["terms"]):
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
    return total, tags, region


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", t.lower())[:80]


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
            s, tags, region = score(it, src, keywords)
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
    merged, seen_ids, seen_titles = [], set(), set()
    for it in fresh + previous:
        key_t = norm_title(it["title"])
        if it["id"] in seen_ids or key_t in seen_titles:
            continue
        if (NOW - parse_date(it["published"])).days > KEEP_DAYS:
            continue
        seen_ids.add(it["id"])
        seen_titles.add(key_t)
        merged.append(it)
    merged.sort(key=lambda i: i["published"], reverse=True)
    merged = merged[:MAX_ITEMS]

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump({"generated": NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), "sources": health, "items": merged},
                  f, ensure_ascii=False, indent=1)
    print(f"Wrote {len(merged)} items ({len(fresh)} fresh) to {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
