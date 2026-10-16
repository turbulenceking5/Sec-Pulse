# Sec-Pulse

A personal cyber security news brief and CySA+ study app that installs on your phone's Home Screen. No build step, no server, no accounts.

- **Brief:** this morning's brief, top stories, your rank and daily quests, exam countdown, weakest-domain drill, today's lesson and question of the day.
- **News:** Australian + global security news scored for relevance (real estate / BEC, Australia, M365, actively exploited, ransomware…), with filters, search, saved and read-later lists, notes, mutes, CVE links and KEV deadlines.
- **Learn:** CySA+ (CS0-003) lessons for all four domains, quizzes, practice exams (also timed), PBQ scenarios, review mistakes, plus Australian bonus lessons.
- **Cards:** multiple-choice spaced-repetition flashcards, missed-card review and an acronym drill.
- **Levelling up:** XP, analyst ranks, skills, achievements, streak freezes, a study calendar and an accuracy trend.
- **Morning notification** at ~7:25am Brisbane: sent straight to the Home Screen app (Web Push), and tapping it opens the full brief. Plus a Sunday weekly digest.
- **Blog drafts:** posts written for the owner's WordPress blog arrive as drafts to review and publish.

New to the app? **[GUIDE.md](GUIDE.md)** (also in the app: Settings → How to use).

## How it works

```
GitHub Action (every 3h)    → fetch_news.py → data/news.json → GitHub Pages → your phone
GitHub Action (7:25am AEST) → fetch + send_brief.py → Web Push → tap opens "This morning's brief"
GitHub Action (Sun 6pm)     → send_digest.py → Web Push
Push of blog/drafts/*.md    → post_draft.py → WordPress.com drafts
```

Browsers can't read most news feeds directly (CORS), so a scheduled Action fetches them server-side and commits the result. Study progress lives in your browser's `localStorage` only; the app reminds you to export a backup monthly.

## Setup

Full guide with troubleshooting: [SETUP.md](SETUP.md). Short version:

1. **GitHub Pages:** **Settings → Pages → Deploy from a branch → `main` / `(root)`**. The app is at `https://<you>.github.io/Sec-Pulse/`.
2. **Let Actions push:** **Settings → Actions → General → Workflow permissions → Read and write**.
3. **Fetch news now:** **Actions → Fetch news → Run workflow** (then every 3 hours by itself).
4. **Install:** open the Pages URL in Safari → Share → **Add to Home Screen**.
5. **Notifications:** add the `VAPID_PRIVATE_KEY` secret, turn on notifications in the app's Settings, and save the code it shows as `WEBPUSH_SUBSCRIPTION` ([details](SETUP.md#5-morning-brief-notifications)).
6. **Blog drafts (optional):** four `WP_*` secrets ([details](SETUP.md#6-blog-drafts-wordpresscom)).

## Docs

| Doc | Covers |
|---|---|
| [GUIDE.md](GUIDE.md) | Using the app, day to day |
| [SETUP.md](SETUP.md) | Setting it up and troubleshooting |
| [CHANGELOG.md](CHANGELOG.md) | What changed, newest first |
| [context/architecture.md](context/architecture.md) | How the pieces fit, file map, logic shared between Python and JS |
| [context/app.md](context/app.md) | The app: tabs, quiz engine, flashcards, storage keys, service worker |
| [context/gamification.md](context/gamification.md) | XP, ranks, quests, achievements, streak and freezes |
| [context/news-pipeline.md](context/news-pipeline.md) | Feeds, scoring, clustering, `news.json` |
| [context/morning-brief.md](context/morning-brief.md) | What's in the brief and the weekly digest |
| [context/notifications.md](context/notifications.md) | Web Push, ntfy, the tap-to-read brief, send-once |
| [context/workflows.md](context/workflows.md) | Every GitHub Action: schedules, commits, failures |
| [context/secrets.md](context/secrets.md) | Every secret, where it comes from, how to rotate it |
| [context/blog.md](context/blog.md) | WordPress blog drafts |
| [context/study-content.md](context/study-content.md) | `cysa.json` schema and rules |
| [context/testing.md](context/testing.md) | Checks to run before pushing |
| [context/opsec.md](context/opsec.md) | What must never go in this public repo |
| [context/roadmap.md](context/roadmap.md) | Planned work |

## Customising

- **Feeds and keywords:** [`scripts/sources.json`](scripts/sources.json). `weight` controls how much a keyword group or source boosts the score.
- **Study content:** [`data/cysa.json`](data/cysa.json): lessons, quizzes, flashcards and PBQs.
- **Run locally:** `python3 scripts/fetch_news.py && python3 -m http.server`, then open http://localhost:8000. `python3 scripts/send_brief.py --dry-run` prints the brief; `python3 scripts/post_draft.py --dry-run` shows blog drafts as HTML.

## A note on this repo being public

Free GitHub Pages needs a public repo. Keep keywords and content generic: don't add your employer's real vendors, internal tool names, domains or incident details. A public watch-list is free reconnaissance for an attacker. Secrets live only in GitHub Actions secrets ([context/secrets.md](context/secrets.md)).

Unofficial personal project. Not affiliated with CompTIA, ASD/ACSC or any employer. CySA+ content follows the CS0-003 objectives; check comptia.org for the current exam version.
