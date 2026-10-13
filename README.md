# Sec-Pulse

A personal cyber security news brief and CySA+ study app that installs on your phone's home screen. No build step, no server, no accounts.

- **Brief:** top 5 stories for you, today's lesson, question of the day, streak.
- **News:** Australian + global security news, scored for relevance (real estate / BEC, Australia, M365, actively exploited, ransomware…), with filters, search and saved stories.
- **Learn:** CySA+ (CS0-003) lessons for all four domains, quizzes, a 30-question weighted practice exam, plus Australian bonus lessons (Essential Eight, BEC playbook, NDB scheme).
- **Cards:** spaced-repetition flashcards (Leitner boxes).
- **Morning push notification** at ~6:30am Brisbane time via the free [ntfy](https://ntfy.sh) app.

## How it works

```
GitHub Action (every 3h) → scripts/fetch_news.py → data/news.json committed → GitHub Pages → your phone
GitHub Action (6:30am AEST) → fetch + scripts/send_brief.py → ntfy push notification
```

Browsers can't read most news feeds directly (CORS), so a scheduled Action fetches them server-side and commits the result. Study progress lives in your browser's `localStorage` only. Use Settings → Export backup to keep a copy.

## Setup

1. **Turn on GitHub Pages:** repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**. The app will be at `https://<you>.github.io/Sec-Pulse/`.
2. **Allow the Action to push:** **Settings → Actions → General → Workflow permissions → Read and write permissions**.
3. **Fetch news now:** **Actions → Fetch news → Run workflow** (then it runs every 3 hours by itself).
4. **Install on your phone:** open the Pages URL in Safari → Share → **Add to Home Screen**.
5. **Morning brief:**
   - Install **ntfy** (App Store / Google Play) and subscribe to a long, random topic name, e.g. `secpulse-k3j9x2m8q7w1`.
   - Add a repo secret: **Settings → Secrets and variables → Actions → New repository secret**, name `NTFY_TOPIC`, value = that topic.
   - Test: **Actions → Morning brief → Run workflow**.

   Anyone who knows an ntfy topic name can read it, so keep it long and secret. The brief only contains public headlines.

## Customising

- **Feeds and keywords:** edit [`scripts/sources.json`](scripts/sources.json). `weight` controls how much a keyword group or source boosts the relevance score.
- **Study content:** edit [`data/cysa.json`](data/cysa.json): lessons, quizzes and flashcards.
- **Run locally:** `python3 scripts/fetch_news.py && python3 -m http.server`, then open http://localhost:8000. `python3 scripts/send_brief.py --dry-run` prints the brief.

## A note on this repo being public

Free GitHub Pages needs a public repo. Keep keywords generic: don't add your employer's real vendors, internal tool names, domains or incident details. A public watch-list is free reconnaissance for an attacker.

Unofficial personal project. Not affiliated with CompTIA, ASD/ACSC or any employer. CySA+ content follows the CS0-003 objectives; check comptia.org for the current exam version.
