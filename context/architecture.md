# Architecture

## The big picture

Sec-Pulse is a static site. There is no server of our own and no database. Three moving parts:

```
┌──────────────────────── GitHub Actions (scheduled) ─────────────────────────┐
│ fetch-news.yml   every 3h   → scripts/fetch_news.py → commit data/news.json │
│ morning-brief.yml 7:25 AEST → fetch_news.py + commit → scripts/send_brief.py│
│ weekly-digest.yml Sun 6pm  → fetch_news.py + commit → scripts/send_digest.py│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ git push → Pages rebuild
                                       ▼
                     GitHub Pages serves the repo root as static files
                                       │
                 ┌─────────────────────┴───────────────────┐
                 ▼                                         ▼
     index.html (the whole app)                 ntfy.sh → ntfy app on phone
     fetches data/news.json + data/cysa.json    (push notification, tap opens app)
     progress saved in localStorage (sp_*)
```

### Why the scheduled Action exists

Browsers block a page on `github.io` from reading most news feeds directly (CORS): the feed servers don't send `Access-Control-Allow-Origin`. Server-side code has no such restriction, so a GitHub Action fetches the feeds and writes the result into the repo as a same-origin JSON file. This also means:
- The app loads instantly and works offline (it's one small JSON file, cached by the service worker).
- Scoring and deduplication happen once per fetch, not on every phone.
- No API keys or third-party proxy are needed.

### Why there is no backend for study progress

It's a single-user personal tool, and `localStorage` is enough. The cost is that progress is per-device; Settings → Export/Import backup covers moving phones. If cross-device sync is ever wanted, see [roadmap.md](roadmap.md).

## Files

| Path | What it is | Deep dive |
|---|---|---|
| `index.html` | The entire app: inline CSS + JS, four tabs + a Settings sheet | [app.md](app.md) |
| `data/news.json` | Generated news data. **Never hand-edit**: the next Action run overwrites it | [news-pipeline.md](news-pipeline.md) |
| `data/cysa.json` | Hand-written study content (domains, lessons, quizzes, flashcards) | [study-content.md](study-content.md) |
| `scripts/sources.json` | Feed list + keyword groups for relevance scoring | [news-pipeline.md](news-pipeline.md) |
| `scripts/fetch_news.py` | Fetch, parse, score, dedupe, write `news.json` | [news-pipeline.md](news-pipeline.md) |
| `scripts/send_brief.py` | Build and send the morning ntfy notification (helpers reused by `send_digest.py`) |
| `scripts/send_digest.py` | Build and send the Sunday weekly digest | [morning-brief.md](morning-brief.md) | [morning-brief.md](morning-brief.md) |
| `.github/workflows/*.yml` | The three schedules | [news-pipeline.md](news-pipeline.md), [morning-brief.md](morning-brief.md) |
| `sw.js` | Network-first service worker (offline fallback) | [app.md](app.md#service-worker) |
| `manifest.json`, `assets/icons/` | PWA install metadata and icons | [app.md](app.md#pwa--install) |
| `.nojekyll` | Tells Pages to skip Jekyll | - |

## Logic duplicated on purpose

There's no shared module system between the Python scripts and the browser JS, so a few rules exist in two places. **Change both together:**

| Rule | Python | JavaScript (`index.html`) |
|---|---|---|
| Ranking: `score - age_hours / 12` | `send_brief.py` `rank()` (also imported by `fetch_news.py` to pick a cluster's primary story, so a break in `send_brief.py` breaks the fetch too) | `rank()` |
| Score breakdown: source weight + keyword groups (+1 in title) + 2 for AU + 2 for non-KEV EPSS ≥ 0.5 | `fetch_news.py` `score()` / `add_epss()` | `explainScore()` (display only) |
| Lesson of the day: `lessons[ordinal(today_brisbane) % len]` | `send_brief.py` (`date.toordinal()`) | `ordinal()` (Unix days + 719163) |
| Timezone: Australia/Brisbane, UTC+10, no daylight saving | `BRISBANE` constant | `TZ` constant |

## Time zones

Everything user-facing uses **Australia/Brisbane** (UTC+10 all year; Queensland has no daylight saving). GitHub cron is UTC, so 7:25am Brisbane = `25 21 * * *` (the previous UTC day). If the user ever moves to a daylight-saving state, the cron and `BRISBANE` offset need revisiting.
