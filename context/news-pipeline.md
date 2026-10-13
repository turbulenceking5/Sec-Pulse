# News pipeline

How headlines get from publishers into `data/news.json`.

## Flow

1. `.github/workflows/fetch-news.yml` runs at minute 17 of every 3rd hour UTC (or on demand via **Run workflow**).
2. `scripts/fetch_news.py` reads `scripts/sources.json` and fetches all sources in parallel (8 threads, 30s timeout each).
3. Each source is parsed (RSS, Atom, or the CISA KEV JSON), capped to its `max` newest items, scored and tagged.
4. Fresh items are merged with the previous `news.json` (so stories survive until they age out), de-duplicated, sorted newest-first, capped at 400.
5. The workflow commits `data/news.json` only if it changed, pulling and rebasing first so it can't collide with the morning-brief workflow (both share the `news-data` concurrency group anyway).

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

## Scoring

For each item, `score = source.weight + Σ (group.weight + title_bonus)` over every keyword group whose terms appear in the title or summary, plus 2 if the item is Australian.

- Matching is **case-insensitive substring** on `" " + title + " " + summary + " "`. The padding lets a term like `"bec "` match a whole word at the end of a sentence. Terms are substrings, not words, so `"rce"` would match "sou**rce**". Pick terms carefully and use spaces where needed.
- **title_bonus** is +1 when the group also matches the title (headline mentions are stronger signals).
- Each matching group adds its `tag` to the item's `tags`.
- KEV items get `Actively exploited` + `KEV` tags up front (and `Ransomware` if CISA marks known ransomware use).

Typical scores: 0–3 generic, 5–8 relevant, 10+ very relevant (e.g. real estate + BEC + Australia). The app's **For you** filter shows items scoring ≥ 5 from the last 7 days.

### Ranking (done in the app and in `send_brief.py`, not stored)
`rank = score - age_in_hours / 12`, so a story loses 2 points per day. A score-10 story from yesterday ties with a score-8 story from right now.

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
      "tags": ["Real estate", "BEC / payment fraud"]
    }
  ]
}
```

Retention: 14 days (`KEEP_DAYS`), max 400 items (`MAX_ITEMS`).

### De-duplication
An item is skipped if its `id` (link hash) **or** its normalised title (lowercase alphanumerics, first 80 chars) was already seen. Fresh items are processed before stored ones, so the freshest copy wins. This catches the same story syndicated by two publishers with identical headlines, but not reworded headlines.

## Parsing details
- XML namespaces are stripped, so `<dc:date>`, `<content:encoded>` and Atom elements are found by local name.
- Dates: RFC 822 (`pubDate`) first, then ISO 8601. Missing dates are treated as "now".
- HTML is stripped from summaries and entities unescaped.
- Google News titles end in ` - Publisher`. That suffix is removed and the `<source>` element becomes the item's `source`. Their description is just the title plus links, so `summary` is left empty.
- Titles shorter than 12 chars or starting with `-` are dropped (Google News occasionally emits a bare publisher name).

## Error handling
Each source runs in its own `try/except`. A failure is recorded in `sources[]` with `ok: false` and the error text, and the run continues. A feed that parses but contains **zero entries** is treated as an error (`feed returned no entries`), so silent breakage still shows up in feed health. The workflow itself only fails if Python crashes outright or the push fails.

## Known feed issues

| Source | Status | Notes |
|---|---|---|
| ACSC Alerts / ACSC Advisories (`cyber.gov.au/rss/…`) | ⚠️ failing since launch | Correct URLs per feed directories, but cyber.gov.au returns nothing to data-centre IPs (GitHub Actions, cloud sandboxes). ACSC content still arrives via the **ACSC (via Google News)** source. Leave them in, since they'll recover silently if ACSC changes its blocking, or remove them to clear the ⚠️. |
| CISA advisories (`cisa.gov/cybersecurity-advisories/all.xml`) | not used | Returns 403 to scripts. CISA KEV JSON works fine and covers the most actionable part. |

## Adding a source
1. Check the URL returns RSS/Atom: `curl -sL '<url>' | head -c 500`.
2. Add an entry to `sources.json` with a sensible `weight` (0 for general news, 2–4 for authoritative/local) and `max`.
3. Run `python3 scripts/fetch_news.py` locally and check the stderr summary line for that source.
4. Commit. The next scheduled run picks it up.
