# Notifications

How the morning brief and weekly digest reach the phone. What goes *in* them is in [morning-brief.md](morning-brief.md).

`notify()` in `scripts/send_brief.py` (also used by `send_digest.py`) sends through **every configured channel**:

| Channel | Configured by | Tap opens | Notes |
|---|---|---|---|
| **Web Push** (recommended) | `WEBPUSH_SUBSCRIPTION` + `VAPID_PRIVATE_KEY` | The Home Screen app, on "This morning's brief" | Encrypted end to end; iOS 16.4+ Home Screen apps only |
| **ntfy** (optional) | `NTFY_TOPIC` (+ optional `NTFY_SERVER`) | The app URL; on iPhone that's **Safari** | Anyone who knows the topic can read it |

With both configured you get two notifications. The user removed `NTFY_TOPIC` on 2026-10-16 to keep only Web Push; adding it back re-enables ntfy with no code change. With neither configured the script logs `NTFY_TOPIC and WEBPUSH_SUBSCRIPTION not set - skipping notification` and exits 0.

`notify()` tries every configured channel before raising `NotifyError`, so one broken channel doesn't block the other. The run then fails (GitHub e-mails the owner), but the send-once marker is still written if any channel delivered.

## Web Push

### App side (`index.html`, Settings → Notifications on this phone)
- `renderPush()` shows one of: "open from the Home Screen icon" (iOS in Safari, where `PushManager` doesn't exist), "blocked" (permission denied: allow in iPhone Settings → Notifications → Sec-Pulse), **Turn on notifications**, or, once subscribed, the subscription code.
- `enablePush()`: `Notification.requestPermission()` must be the first `await` after the tap or iOS ignores it, then `pushManager.subscribe({userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC})`.
- The subscription JSON (`{endpoint, keys: {p256dh, auth}}`) is shown with **Copy code**. The user saves it as the `WEBPUSH_SUBSCRIPTION` secret. **Test** shows a local notification through the service worker; **Turn off** unsubscribes.
- The code changes if notifications are turned off/on or the app is reinstalled. Then the next send fails with "subscription expired" until the secret is updated.

### Service worker (`sw.js`)
- `push`: payload `{title, body, tag, url, brief?}`. Shows the notification (`tag` `brief` or `digest`, so a new one replaces the old) and, if `brief` is present, saves it to the `sec-pulse-push` cache as `push-brief.json`. That cache is exempt from the activate cleanup.
- `notificationclick`: focuses an open Sec-Pulse window and navigates it to `url`, or opens one. The brief's `url` is `./#today`; the digest's is `./#brief`.

### Sender (`send_webpush()` in `send_brief.py`)
- `pywebpush` (pinned in the brief and digest workflows; the one non-standard-library dependency, imported lazily inside the function so everything else still runs without it). If its install fails, ntfy still sends and the Web Push error fails the run.
- VAPID `sub` claim is `https://<app host>`: the library only accepts `mailto:` or a bare `https://` origin, and this keeps any e-mail address out of the repo.
- TTL 12 hours. The JSON payload is capped at `WEBPUSH_MAX` = 3,800 bytes (Web Push allows about 4 KB after encryption): the brief's story summaries are cut to 140 characters, then dropped, then the body is trimmed.
- A 404/410 from the push service means the subscription is gone: the error says to turn notifications on again and update the secret.
- Tested end to end against Chromium/FCM (subscribe, send with `send_brief.py`, the service worker shows the notification and caches the brief). Apple's push service implements the same standard; the user confirmed delivery on iOS 26 on 2026-10-16.

### Keys
`VAPID_PUBLIC` in `index.html` is the public half and is meant to be public. The private half is the `VAPID_PRIVATE_KEY` secret and is never committed. To make a new pair (only if the private key is lost or leaked), run `scripts/gen_vapid_keys.py` (see [secrets.md](secrets.md#rotating)).

## This morning's brief (tap target)
`send_brief.py` writes **`data/brief.json`**:

```jsonc
{"date": "2026-10-16", "generated": "2026-10-16T21:25:03+00:00", "title": "Sec-Pulse brief - Fri 16 Oct",
 "items": [{"id", "title", "link", "source", "region", "published", "score", "tags", "summary", "epss"?}],
 "stats": {"recent": 52, "au": 3, "kev": 1},
 "lesson": {"id": "4.2", "title": "…"}}
```

The workflow commits it with the sent marker. The push payload carries a compact copy (`shrink_brief()`): items keep only `id, title, source, region, published, summary`, because Google News links alone can be 450 characters. A typical compact brief is about 1.5 KB.

Tapping the notification opens `#today` → `openTodayBrief()` (see [app.md](app.md)). `loadTodayBrief()` takes whichever of the cached push copy and `data/brief.json` has the newer `generated`, because the commit and Pages deploy take about a minute after the notification arrives. `briefItems()` fills links, tags and longer summaries from `news.json` by id, falling back to a Google News search link.

## Send once a day
- Scheduled runs and `workflow_dispatch` with `inputs.once = true` run `send_brief.py --once`.
- `--once` skips (exit 0, "already sent") if `data/brief-sent.txt` holds today's Brisbane date. After any channel delivers, the date is written; the workflow commits it.
- Runs share the `news-data` concurrency group, so a second run only checks out after the first has pushed the marker.
- A manual **Run workflow** with *once* unticked always sends, and still records the date, so the scheduled run skips that day.
- This exists so an external scheduler (cron-job.org, see [SETUP.md](../SETUP.md#recommended-on-time-brief-with-cron-joborg)) and GitHub's own schedule can both run without double-sending. The user has **not** set up cron-job.org yet (on hold since 2026-10-15).

## ntfy
- POST to `{NTFY_SERVER}/{NTFY_TOPIC}` (default server `https://ntfy.sh`). The body is the message text.
- Headers: `Title`, `Tags: shield` (🛡️; the digest adds `calendar` 📅), `Priority: default`, `Click: APP_URL`.
- ntfy's message limit is 4,096 bytes; the brief is well under, and the digest caps itself at 3,900 (`MAX_BODY`).
- For an authenticated or self-hosted server, see [SETUP.md](../SETUP.md#optional-self-hosted-or-authenticated-ntfy).
