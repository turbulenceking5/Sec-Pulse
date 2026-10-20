# News pipeline

How headlines get from publishers into `data/news.json`.

## Flow

1. `.github/workflows/fetch-news.yml` runs at minute 17 of every 3rd hour UTC (or on demand via **Run workflow**).
2. `scripts/fetch_news.py` reads `scripts/sources.json` and fetches all sources in parallel (8 threads, 30s timeout each).
3. Each source is parsed (RSS, Atom, or the CISA KEV JSON), capped to its `max` newest items, scored and tagged.
4. Fresh items are merged with the previous `news.json` (so stories survive until they age out) and de-duplicated by link/identical title.
5. Items naming a CVE are enriched with an **EPSS** probability from FIRST's public API (see [EPSS enrichment](#epss-enrichment)).
6. Reports of the same story from different outlets are **clustered** into one item (see [Story clustering](#story-clustering)), then everything is sorted newest-first and capped at 400.
7. The workflow commits `data/news.json` only if it changed, pulling and rebasing first. If another workflow (usually the morning brief, which is in a different concurrency group) pushed `news.json` in the meantime, the rebase conflicts on `generated`; the fetch then skips its commit (exit 0) rather than failing, and the next run fetches again.

Keyword terms match at the **start of a word** (`term_in()`; `termIn()` in the app's Why-this-ranked view), so `aws` doesn't match "flaws", `entra` doesn't match "central" and `cisco` doesn't match "Francisco", while `credential` still matches "credentials". Titles are capped at 300 characters, links must be `http(s)`, future dates are clamped to now, and an undated item keeps the time it was first seen.

Standard library only, so there's no `pip install` step and nothing to pin.

## `scripts/sources.json`

```jsonc
{
  "sources": [
    {
      "name": "BleepingComputer",            // shown in the app and in feed health
      "url": "https://…/feed/",
      "type": "kev",                          // optional; only for the CISA KEV JSON
      "region": "AU" | "auto" | "Global",
      "requireMatch": true,                   // optional
      "exclude": ["^use\\b"],                  // optional; title regexes to drop
      "minTitleWords": 6,                     // optional; drop shorter titles
      "weight": 0,                            // added to every item's score
      "max": 25                               // newest N items kept per fetch
    }
  ],
  "keywords": [
    {"tag": "Phishing", "weight": 3, "terms": ["phishing", "smishing", …]}
  ]
}
```

### `region`
- **`AU`**: an Australian publisher (ACSC, iTnews). Every item is Australian: +2 score and the `Australia` tag.
- **`auto`**: a Google News search that also returns overseas stories. An item only counts as Australian if its text matched the `Australia` keyword group.
- **`Global`**: no regional bonus.

### `requireMatch`
Google News searches match loosely (e.g. a "real estate cyber" search returns plain property-auction stories). With `requireMatch: true`, an item is dropped unless it hits at least one keyword group other than `Australia`.

### `exclude` and `minTitleWords`
For search feeds that surface evergreen web pages rather than news. Google News re-indexes cyber.gov.au's guidance pages ("Use passkeys", "Event logging", product-evaluation listings like "Junos OS 23.4R1 for …") as if they were new, so **ACSC (via Google News)** drops titles matching its `exclude` regexes (case-insensitive) or shorter than `minTitleWords` words. Real ACSC alerts have long, descriptive titles, and outlets' coverage of them also arrives via **ASD / ACSC in the news**.

`passes_filters()` applies `exclude`, `minTitleWords` and `requireMatch`, both to fresh items and to items kept from the previous `news.json`. So tightening a source's filters removes already-stored junk on the next run instead of leaving it for up to 14 days.

### `paywalled`
A top-level list of publisher names (as Google News shows them in the `<source>` element / the card's source line; case-insensitive). Google News searches surface whatever outlet ran a story, including hard-paywalled ones (ACM regionals like the Newcastle Herald, News Corp mastheads, Nine's SMH/Age/AFR, WSJ, FT, Bloomberg...). `main()` drops those items from fresh results and from stored history, and strips them from `also` lists after clustering. To block another outlet, add its exact displayed name. For a quick personal-only fix, Mute the source in the app instead.

## Scoring

For each item, `score = source.weight + Σ (group.weight + title_bonus)` over every keyword group whose terms appear in the title or summary, plus 2 if the item is Australian.

- Matching is **case-insensitive substring** on `" " + title + " " + summary + " "`. The padding lets a term like `"bec "` match a whole word at the end of a sentence. Terms are substrings, not words, so `"rce"` would match "sou**rce**". Pick terms carefully and use spaces where needed.
- **title_bonus** is +1 when the group also matches the title (headline mentions are stronger signals).
- Each matching group adds its `tag` to the item's `tags`.
- KEV items get `Actively exploited` + `KEV` tags up front (and `Ransomware` if CISA marks known ransomware use). Their summary ends with `CISA remediation due YYYY-MM-DD.`, which the app parses for its "Fix by" pill, so keep that wording.
- **EPSS bump**: +2 (`EPSS_BUMP`) for a **non-KEV** item whose `epss` is ≥ 0.5 (`EPSS_BUMP_AT`, roughly the top 1-2% of all CVEs). KEV entries are excluded because they already carry the exploited signal, and old CVEs newly added to KEV score ~0.99 almost by definition, so bumping them would double-count. Only applied when an item is (re)scored from a fresh fetch, so stored items are never bumped twice.
- The keyword groups that matched are stored in the item's `why` (in `sources.json` order), for a "why this ranked" view. `why` doesn't include the source `weight`, the +2 Australian-publisher bonus, the title bonus, the EPSS bump, or the KEV extra tags.

Typical scores: 0–3 generic, 5–8 relevant, 10+ very relevant (e.g. real estate + BEC + Australia). The app's **For you** filter shows items scoring ≥ 5 from the last 7 days.

### Ranking (done in the app and in `send_brief.py`, not stored)
`rank = score - age_in_hours / 12`, so a story loses 2 points per day. A score-10 story from yesterday ties with a score-8 story from right now. `fetch_news.py` also uses it (imported from `send_brief.py`, not copied) to pick each cluster's primary.

### Tuning tips
- A story type keeps showing up that you don't care about: lower that group's weight or remove the noisy term.
- Something important is missing: add a term, or add a Google News search source with `region: "auto"` and `requireMatch: true`.
- **Keep terms generic.** The repo is public. Don't add your employer's vendors, internal product names, domains, or anything from a real incident.

## `data/news.json` shape

```jsonc
{
  "generated": "2026-10-13T00:55:22Z",     // UTC, when the fetch ran
  "sources": [                              // feed health, shown in Settings
    {"name": "CISA KEV", "ok": true, "count": 11, "error": null}
  ],
  "items": [
    {
      "id": "3f2a…",                        // first 12 hex chars of sha1(link)
      "title": "…",
      "link": "https://…",
      "source": "HousingWire",              // publisher (Google News items use the real publisher)
      "feed": "Real estate cyber news",     // which sources.json entry produced it
      "region": "AU" | "Global",
      "published": "2026-10-12T18:04:00Z",
      "summary": "…",                       // plain text, ≤ 300 chars, "" for Google News
      "score": 10,
      "tags": ["Real estate", "BEC / payment fraud"],
      "why": ["Real estate", "BEC / payment fraud"],  // keyword groups that matched (may be [])
      "epss": 0.9412,                       // OPTIONAL: 0-1 EPSS probability (max over the item's CVEs)
      "also": [                             // OPTIONAL: same story from other outlets (≤ 10)
        {"source": "The Hacker News", "url": "https://…"}
      ]
    }
  ]
}
```

Retention: 14 days (`KEEP_DAYS`), max 400 items (`MAX_ITEMS`).

Optional fields are **absent** (not `null`/`[]`) when they don't apply: `epss` only on items with a CVE that EPSS has scored, `also` only on cluster primaries. `why` is always present (backfilled for items stored before it existed).

### De-duplication
An item is skipped if its `id` (link hash) **or** its normalised title (lowercase alphanumerics, first 80 chars) was already seen. Fresh items are processed before stored ones, so the freshest copy wins. When a skipped copy is an identical headline from a *different* publisher, it's recorded in the kept item's `also` instead of vanishing; a skipped stored copy's `also` and `epss` are carried over to the fresh copy too. Reworded headlines are handled by clustering, below.

## EPSS enrichment
[EPSS](https://www.first.org/epss/) is FIRST's daily estimate of the probability a CVE is exploited in the next 30 days.

- **Which CVEs**: `item_cves()` takes the CVE IDs in the title; if there are none, those in the summary, but only if it names at most two (a roundup listing a dozen CVEs isn't *about* any of them).
- **Lookup**: one GET to `https://api.first.org/data/v1/epss?cve=CVE-…,CVE-…` per 50 CVEs (`EPSS_BATCH`), 15s timeout, at most 300 CVEs per run (newest items first). All items in the merged list are re-looked-up each run, since EPSS changes daily.
- **`epss`** = the highest probability among the item's CVEs, rounded to 4 dp. A CVE too new for EPSS gets no field.
- **Failure**: recorded as a `FIRST EPSS` row in `sources[]` (`ok: false`, error text, `count` = CVEs scored), exactly like a broken feed, and the run carries on. Items keep the `epss` they had from the last good run, so the score bump doesn't flicker. The first failed batch stops the lookup (the rest would only time out too).
- On success the `FIRST EPSS` row has `ok: true` and `count` = number of CVEs scored (0 with no CVEs to look up, and no request made).

## Story clustering
`cluster()` folds the same story from several outlets into one item. It runs over the whole merged list each run (≈1s for 400 items). The highest-`rank` report stays as the item; the others become `{"source", "url"}` entries in its `also` and are removed from `items`. Because stored primaries keep their `also`, a cluster survives after the duplicates drop off their feeds.

It's deliberately conservative (a missed merge costs a duplicate line; a false merge hides a story). Two items can only merge if they're from **different publishers** (`source`) and **neither is a CISA KEV entry** (KEV rows are distinct records and feed the brief's KEV count). Then either:

- **Same CVE**: they share a CVE from `item_cves()` and were published within 7 days. Two items naming *different* CVEs never merge by title.
- **Similar titles**, published within 72h. Titles are tokenised (lowercase, stopwords dropped, light plural stemming, a few synonyms such as flaw/bug/vulnerability → `vuln`, exploited → `exploit`, cyber-attack → `attack`). They need:
  - at least **3 shared words**,
  - at least **2 shared distinctive words**: not in the `GENERIC` headline-template list (attack, breach, ransomware, million, FBI, critical, …) and appearing in at most `max(3, n/50)` titles. Short numbers and years don't count;
  - an IDF-weighted overlap (shared weight ÷ the shorter title's weight, generic words at half weight) of at least `CLUSTER_SIM` = 0.35.

  So "Ivanti EPMM flaw exploited" vs "Ivanti Connect Secure flaw exploited", or "Acme hit by ransomware attack" vs "Globex hit by ransomware attack", stay separate.
- A new item joins the cluster whose primary **or existing member** it matches best, so a third outlet matching only the second report still joins.

Tested against two weeks of real items squeezed into one 72h window (no false merges; caught e.g. SonicWall ×3, Ledger implant ×2, AhsayCBS ×2), plus synthetic near-miss pairs. Known acceptable merge: a follow-up on the same incident within 72h ("Acme hit by ransomware" / "Acme names new CISO after ransomware attack") joins the original. If it ever merges wrongly, raise `CLUSTER_SIM` or add the offending word to `GENERIC`.

## Parsing details
- XML namespaces are stripped, so `<dc:date>`, `<content:encoded>` and Atom elements are found by local name.
- Dates: RFC 822 (`pubDate`) first, then ISO 8601. Missing dates are treated as "now".
- HTML is stripped from summaries and entities unescaped.
- Google News titles end in ` - Publisher`. That suffix is removed and the `<source>` element becomes the item's `source`. Their description is just the title plus links, so `summary` is left empty.
- Titles shorter than 12 chars or starting with `-` are dropped (Google News occasionally emits a bare publisher name).

## Error handling
Each source runs in its own `try/except`, and so does the EPSS lookup (its health row is `FIRST EPSS`). A failure is recorded in `sources[]` with `ok: false` and the error text, and the run continues. A feed that parses but contains **zero entries** is treated as an error (`feed returned no entries`), so silent breakage still shows up in feed health. The workflow itself only fails if Python crashes outright or the push fails.

## Known feed issues

| Source | Status | Notes |
|---|---|---|
| ACSC Alerts / ACSC Advisories (`cyber.gov.au/rss/…`) | ✅ intermittent | Failed from data-centre IPs at launch; by 2026-10-20 the Actions runs showed both `ok` (a cloud sandbox still gets nothing, so it may be IP-dependent). ACSC content still arrives via the **ACSC (via Google News)** and **ASD / ACSC in the news** sources. Leave them in, since they'll recover silently if ACSC changes its blocking, or remove them to clear the ⚠️. |
| ACSC (via Google News) | ✅ filtered | Without its `exclude`/`minTitleWords` filters, most of its items are evergreen guidance pages, not news (fixed 2026-10-13). If it still lets junk through, add a regex to `exclude`. |
| iTnews Security (category 37) | ✅ `requireMatch` | The "security" category feed also carries general IT business news (CIO appointments, visa policy), so it needs `requireMatch`. Expect a few items a week, not 20. |
| CISA advisories (`cisa.gov/cybersecurity-advisories/all.xml`) | not used | Returns 403 to scripts. CISA KEV JSON works fine and covers the most actionable part. |

## Adding a source
1. Check the URL returns RSS/Atom: `curl -sL '<url>' | head -c 500`.
2. Add an entry to `sources.json` with a sensible `weight` (0 for general news, 2–4 for authoritative/local) and `max`.
3. Run `python3 scripts/fetch_news.py` locally and check the stderr summary line for that source.
4. Commit. The next scheduled run picks it up.
