# Morning brief

A daily push notification with the top stories and the day's CySA+ lesson, plus a Sunday-evening [weekly digest](#weekly-digest).

## Schedule
`.github/workflows/morning-brief.yml` sends at **7:25am Brisbane** (21:25 UTC; AEST, UTC+10, no daylight saving). It's scheduled four times from 4:25am and the first run to start waits until 7:25 (see [notifications.md](notifications.md#starting-early-and-waiting-why-its-on-time)). It can also be run on demand from **Actions → Morning brief → Run workflow**.

GitHub's cron is best-effort and has run hours late (3h19m, 2h17m) or not at all, hence the early starts. An external trigger (cron-job.org POSTing to `workflow_dispatch` with `inputs.once = true`, [SETUP.md](../SETUP.md#optional-on-time-brief-with-cron-joborg)) is an optional extra.

**Send once a day:** scheduled runs and `once` dispatches skip if today's brief already went out. See [notifications.md](notifications.md#send-once-a-day).

## Steps
1. **Fetch fresh news**: runs `fetch_news.py` first so the brief isn't up to 3 hours stale.
2. **Commit** `news.json` if it changed, so tapping the notification shows the same stories in the app.
3. **Install** `pywebpush` (allowed to fail; only Web Push needs it).
4. **Send**: `scripts/send_brief.py` (with `--once` for scheduled/external runs), which also writes `data/brief.json`. Env: the notification secrets (see [secrets.md](secrets.md)) and `APP_URL` (`https://<owner>.github.io/<repo>/`).
5. **Commit** `data/brief.json` and `data/brief-sent.txt`.

## Message content
`send_brief.py` builds:

```
Title: Sec-Pulse brief - Tue 13 Oct

• 🇦🇺 <title> (<source> +2)     ← top 5 by rank, from the last 30 hours
• …

Last 30h: 41 items, 3 Australian, 0 new CISA KEV entries.
CySA+ focus: 2.2 Reading scan output and CVSS
❓ Which Nmap flag … ? (answer in the app)
```

- **Top 5**: items published in the last 30h, sorted by `score - age_hours/12` (same `rank()` as the app). 30h rather than 24h covers late-evening overseas stories. The app's own Brief tab widens to 72h if fewer than 5 items are found; the notification does not.
- 🇦🇺 marks `region == "AU"` items.
- Because `fetch_news.py` clusters the same story from several outlets into one item (see [news-pipeline.md](news-pipeline.md#story-clustering)), the top 5 are 5 different stories. `+N` after the source is the number of other outlets folded into that item's `also`; it's omitted when there are none. "Last 30h: N items" counts clustered stories, not raw reports.
- **CySA+ focus**: `lessons[today.toordinal() % len(lessons)]` using Brisbane's date. The app computes the same index, so "Today's CySA+ lesson" on the Brief tab matches the notification.
- **Question of the day** (`qotd_for()`): the app's question of the day (lesson quiz questions then the question bank, `[(ordinal * 7) % n]`), cut to 240 chars (`MAX_Q`). Only the question goes in the notification; the options and answer are in the app.
- If nothing is recent: `• Quiet night - no new high-relevance items.`

## Delivery
How the message reaches the phone (Web Push to the Home Screen app, optional ntfy, the tap-to-read "This morning's brief" screen, and the send-once rule) is in [notifications.md](notifications.md).

## Testing locally
```bash
python3 scripts/send_brief.py --dry-run         # print, don't send
NTFY_TOPIC=your-topic python3 scripts/send_brief.py   # really send via ntfy (also writes data/brief.json)
python3 scripts/send_digest.py --dry-run        # the weekly digest, same flags/env
```

## Weekly digest
`.github/workflows/weekly-digest.yml`: cron `0 8 * * 0` = **Sunday 08:00 UTC = Sunday 6pm Brisbane**, also runnable from **Actions → Weekly digest → Run workflow**. Same steps as the morning brief (fetch, commit `news.json` if changed, send), same `news-data` concurrency group, same notification secrets and `APP_URL`. It has no send-once rule and no tap-to-read screen; its Web Push tag is `digest`.

`scripts/send_digest.py` imports its helpers from `send_brief.py` (`load_data`, `published`, `lesson_for`, `headline`, `notify`) rather than copying them, so `send_brief.py` must stay importable without side effects (it already is, because `fetch_news.py` imports `rank()` from it).

```
Title: Sec-Pulse weekly - week to Sun 18 Oct      (Tags: shield,calendar → 🛡️📅)

• 🇦🇺 <title> (<source> +2)     ← top 10 stories of the last 7 days
• …

This week: 141 stories, 7 Australian, 7 new CISA KEV entries.
Highest EPSS: 99.5% - <title>

CySA+ lessons this week (quiz yourself in the app):
  1.2 Indicators of malicious activity: network
  …                              ← the 7 lessons of the day, Mon-Sun
Tomorrow: 2.1 Asset discovery and vulnerability scanning
```

- **Window**: items published in the last 7×24h (`WINDOW_DAYS`). `news.json` keeps 14 days, so the whole week is always there.
- **Ranking (`weekly_key`)**: `rank()` loses 2 points a day, which over a week would just surface the newest stories, so the digest sorts by **raw `score`**, ties broken by **coverage** (`len(also)`, more outlets first), then newest. `rank()` itself is unchanged. Clustering already makes each item one story, so the top 10 are 10 different stories, with the same `+N` and 🇦🇺 markers as the brief.
- **Stats**: clustered stories in the window, how many are `region == "AU"`, how many carry the `KEV` tag (new CISA KEV entries), and the single highest-`epss` item (line omitted if no item has `epss`).
- **Study nudge**: study progress lives only in the browser's `localStorage`, so the digest can't report quiz scores. Instead it lists the week's lessons of the day (`lesson_for()` for each of the last 7 Brisbane dates, de-duplicated) and tomorrow's lesson, matching the app's "Today's CySA+ lesson".
- **Size**: titles are cut to 140 chars (`MAX_TITLE`) and, if the body still exceeds 3,900 bytes (`MAX_BODY`, under ntfy's 4,096), the lowest-ranked stories are dropped; the stats and study lines always stay. A typical digest is ~1.6 KB.
- If nothing was collected all week: `• Quiet week - no items collected.`

## Privacy
Web Push is encrypted end to end. ntfy.sh topics are public to anyone who knows the name. The message only contains public headlines and a lesson title, so this is fine, but **never add anything internal or work-related to the brief**. If that's ever needed, move to an authenticated self-hosted ntfy server (see [SETUP.md](../SETUP.md#optional-self-hosted-or-authenticated-ntfy)).
