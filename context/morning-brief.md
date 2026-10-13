# Morning brief

A daily push notification with the top stories and the day's CySA+ lesson.

## Schedule
`.github/workflows/morning-brief.yml`: cron `30 20 * * *` = **20:30 UTC = 6:30am Brisbane** (AEST, UTC+10, no daylight saving). It can also be run on demand from **Actions → Morning brief → Run workflow**.

GitHub's cron is best-effort: runs are often 5–30 minutes late at busy times, and very occasionally skipped. The time is set early so the brief still arrives before a normal workday starts.

## Steps
1. **Fetch fresh news**: runs `fetch_news.py` first so the brief isn't up to 3 hours stale.
2. **Commit** `news.json` if it changed, so tapping the notification shows the same stories in the app.
3. **Send**: `scripts/send_brief.py` with `NTFY_TOPIC` (secret) and `APP_URL` (built from the repo owner/name, `https://<owner>.github.io/<repo>/`).

## Message content
`send_brief.py` builds:

```
Title: Sec-Pulse brief - Tue 13 Oct

• 🇦🇺 <title> (<source> +2)     ← top 5 by rank, from the last 30 hours
• …

Last 30h: 41 items, 3 Australian, 0 new CISA KEV entries.
CySA+ focus: 2.2 Reading scan output and CVSS
```

- **Top 5**: items published in the last 30h, sorted by `score - age_hours/12` (same `rank()` as the app). 30h rather than 24h covers late-evening overseas stories. The app's own Brief tab widens to 72h if fewer than 5 items are found; the notification does not.
- 🇦🇺 marks `region == "AU"` items.
- Because `fetch_news.py` clusters the same story from several outlets into one item (see [news-pipeline.md](news-pipeline.md#story-clustering)), the top 5 are 5 different stories. `+N` after the source is the number of other outlets folded into that item's `also`; it's omitted when there are none. "Last 30h: N items" counts clustered stories, not raw reports.
- **CySA+ focus**: `lessons[today.toordinal() % len(lessons)]` using Brisbane's date. The app computes the same index, so "Today's CySA+ lesson" on the Brief tab matches the notification.
- If nothing is recent: `• Quiet night - no new high-relevance items.`

## ntfy specifics
- POST to `{NTFY_SERVER}/{NTFY_TOPIC}`. The body is the message text.
- Headers: `Title`, `Tags: shield` (shows a 🛡️ emoji), `Priority: default`, and `Click: APP_URL` (tapping opens the app).
- ntfy's message limit is 4,096 bytes. Five headlines plus two lines sits well under it. If more items are ever added, keep an eye on it (ntfy turns oversize messages into attachments).
- With no `NTFY_TOPIC` set, the script logs `NTFY_TOPIC not set - skipping notification` and exits 0, so a fresh clone doesn't fail CI.

## Testing locally
```bash
python3 scripts/send_brief.py --dry-run         # print, don't send
NTFY_TOPIC=your-topic python3 scripts/send_brief.py   # really send
```

## Privacy
ntfy.sh topics are public to anyone who knows the name. The message only contains public headlines and a lesson title, so this is fine, but **never add anything internal or work-related to the brief**. If that's ever needed, move to an authenticated self-hosted ntfy server (see [SETUP.md](../SETUP.md#optional-self-hosted-or-authenticated-ntfy)).
