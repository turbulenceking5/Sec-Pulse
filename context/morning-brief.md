# Morning brief

A daily push notification with the top stories and the day's CySA+ lesson, plus a Sunday-evening [weekly digest](#weekly-digest).

## Schedule
`.github/workflows/morning-brief.yml`: cron `25 21 * * *` = **21:25 UTC = 7:25am Brisbane** (AEST, UTC+10, no daylight saving). It can also be run on demand from **Actions → Morning brief → Run workflow**.

GitHub's cron is best-effort: runs are often 5–30 minutes late, and on 2026-10-14 one ran 3h19m late and the next didn't run at all. So the recommended setup adds an **external trigger**: cron-job.org POSTs to the `workflow_dispatch` API at 07:25 Brisbane with `inputs.once = true` (steps in [SETUP.md](../SETUP.md#recommended-on-time-brief-with-cron-joborg)). GitHub's schedule stays as a backup.

**Send once a day:** scheduled runs and `once` dispatches call `send_brief.py --once`. It skips if `data/brief-sent.txt` already holds today's Brisbane date, and writes that date after a successful send (not on dry runs or with no `NTFY_TOPIC`). The workflow commits the file. Runs share the `news-data` concurrency group, so a second run only checks out after the first has pushed the marker. A manual **Run workflow** (once unticked) always sends, and still records the date so the scheduled backup skips.

## Steps
1. **Fetch fresh news**: runs `fetch_news.py` first so the brief isn't up to 3 hours stale.
2. **Commit** `news.json` if it changed, so tapping the notification shows the same stories in the app.
3. **Send**: `scripts/send_brief.py` (with `--once` for scheduled/external runs) with `NTFY_TOPIC` (secret) and `APP_URL` (built from the repo owner/name, `https://<owner>.github.io/<repo>/`).

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
- **Question of the day** (`qotd_for()`): the app's question of the day (`lesson quiz questions flattened, [(ordinal * 7) % n]`), cut to 240 chars (`MAX_Q`). Only the question goes in the notification; the options and answer are in the app.
- If nothing is recent: `• Quiet night - no new high-relevance items.`

## Web Push (notifications from the app)
`notify()` sends through every configured channel: ntfy (`NTFY_TOPIC`) and/or Web Push (`WEBPUSH_SUBSCRIPTION` + `VAPID_PRIVATE_KEY`). On iPhone, a ntfy tap opens the link in Safari, while a Web Push notification belongs to the Home Screen app and opens it.

- **App side** (`index.html`, Settings → Notifications on this phone): `enablePush()` asks permission and calls `pushManager.subscribe()` with the public key `VAPID_PUBLIC`, then shows the subscription JSON to copy into the `WEBPUSH_SUBSCRIPTION` secret. iOS only offers push to the Home Screen app, so in Safari the card says to open it from the icon. **Test** shows a local notification; **Turn off** unsubscribes.
- **Service worker** (`sw.js`): `push` shows `{title, body, tag}`; `notificationclick` focuses an open Sec-Pulse window and navigates it to `url` (`./#brief`), or opens one.
- **Sender** (`send_webpush()` in `send_brief.py`): `pywebpush` (pip-installed in the brief and digest workflows, pinned; imported lazily so everything else stays standard library) encrypts and posts the payload with a VAPID JWT. `sub` is `https://<app host>` (the library only accepts mailto: or a bare https origin). TTL 12h. The JSON payload is capped at 3,800 bytes (`WEBPUSH_MAX`, under Web Push's ~4 KB), trimming the body if needed; the digest can hit this. Tag `brief` or `digest`, so a new one replaces the old.
- **Failures**: a 404/410 from the push service means the subscription is gone ("subscription expired" in the log; re-enable in the app and update the secret). `notify()` tries both channels before raising `NotifyError`, so one broken channel doesn't block the other. The run then fails (so GitHub e-mails you), but `brief-sent.txt` is still written if the other channel delivered.
- Tested end to end against Chromium/FCM (subscribe, send with `send_brief.py`, the service worker shows it). Apple's push service uses the same standard.

## ntfy specifics
- POST to `{NTFY_SERVER}/{NTFY_TOPIC}`. The body is the message text.
- Headers: `Title`, `Tags: shield` (shows a 🛡️ emoji), `Priority: default`, and `Click: APP_URL` (tapping opens the app).
- ntfy's message limit is 4,096 bytes. Five headlines plus two lines sits well under it. If more items are ever added, keep an eye on it (ntfy turns oversize messages into attachments).
- With no `NTFY_TOPIC` set, the script logs `NTFY_TOPIC not set - skipping notification` and exits 0, so a fresh clone doesn't fail CI.

## Testing locally
```bash
python3 scripts/send_brief.py --dry-run         # print, don't send
NTFY_TOPIC=your-topic python3 scripts/send_brief.py   # really send
python3 scripts/send_digest.py --dry-run        # the weekly digest, same flags/env
```

## Weekly digest
`.github/workflows/weekly-digest.yml`: cron `0 8 * * 0` = **Sunday 08:00 UTC = Sunday 6pm Brisbane**, also runnable from **Actions → Weekly digest → Run workflow**. Same steps as the morning brief (fetch, commit `news.json` if changed, send), same `news-data` concurrency group, same `NTFY_TOPIC` secret and `APP_URL`.

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
ntfy.sh topics are public to anyone who knows the name. The message only contains public headlines and a lesson title, so this is fine, but **never add anything internal or work-related to the brief**. If that's ever needed, move to an authenticated self-hosted ntfy server (see [SETUP.md](../SETUP.md#optional-self-hosted-or-authenticated-ntfy)).
