# Setup

Step-by-step guide to getting Sec-Pulse running from a fresh copy of this repo. The live copy (turbulenceking5/Sec-Pulse) has already been through all of these steps.

## 1. GitHub Pages

**Settings → Pages → Build and deployment**
- Source: **Deploy from a branch**
- Branch: **`main`**, folder **`/ (root)`**

The site appears at `https://<user>.github.io/<repo>/` a minute or two later. `.nojekyll` is in the repo root so Pages serves the files as-is, without Jekyll processing.

## 2. Let the Actions push commits

**Settings → Actions → General → Workflow permissions → Read and write permissions → Save**

All three workflows commit `data/news.json` back to `main`. Without write permission they fail at the `git push` step with a 403.

## 3. First news fetch

**Actions → Fetch news → Run workflow** (branch `main`).

After that it runs on its own every 3 hours (`17 */3 * * *` UTC). Each run commits `data/news.json`, which triggers a Pages rebuild automatically.

## 4. Install on your phone

- **iPhone (Safari):** open the Pages URL → Share → **Add to Home Screen**.
- **Android (Chrome):** open the URL → ⋮ menu → **Install app** / **Add to Home screen**.

The app shows an install hint on iOS Safari until you dismiss it or open it from the home screen.

## 5. Morning brief push notification

1. Install **ntfy** (search "ntfy" in the App Store or Google Play; the publisher is Philipp Heckel).
2. Choose a long, random topic name, e.g. `secpulse-k3j9x2m8q7w1`. The app's ⚙️ Settings screen generates a suggestion.
3. In ntfy tap **+** and subscribe to that topic. Keep the server as `ntfy.sh`.
4. On GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `NTFY_TOPIC`
   - Secret: your topic name
5. Test: **Actions → Morning brief → Run workflow**. A notification should arrive within a minute.

It then runs daily at 20:30 UTC (6:30am Brisbane). GitHub's scheduler can run it 5–30 minutes late at busy times.

The **Weekly digest** workflow (Sundays 08:00 UTC = 6pm Brisbane) uses the same `NTFY_TOPIC` secret, so there's nothing extra to set up. To test it: **Actions → Weekly digest → Run workflow**.

> **Security:** ntfy.sh topics have no password. Anyone who knows the topic name can read the messages and post to it. That's acceptable here because the brief only contains public headlines, but keep the name long and unguessable. Never reuse it for anything sensitive.

### Optional: self-hosted or authenticated ntfy

`scripts/send_brief.py` reads `NTFY_SERVER` (default `https://ntfy.sh`). To use your own server, add an `NTFY_SERVER` secret and pass it through in the `env:` block of `.github/workflows/morning-brief.yml` and `weekly-digest.yml`. If you need access tokens, add an `Authorization` header in `send_brief.py`'s `notify()` (the digest uses it too).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Site shows the old placeholder README | Pages not enabled, or deploying from the wrong branch/folder (step 1). |
| Workflow fails at `git push` with 403 | Workflow permissions are read-only (step 2). |
| "Morning brief" / "Weekly digest" ran but no notification | `NTFY_TOPIC` secret missing or misspelled. The run log says `NTFY_TOPIC not set - skipping`. Also check you subscribed to the exact same topic in ntfy. |
| News in the app is stale | Check **Actions → Fetch news** for failures. GitHub disables scheduled workflows after 60 days without repo activity; re-enable it from the workflow page. |
| A feed shows ⚠️ in Settings → Feed health | That source failed this run. Other feeds are unaffected. See [context/news-pipeline.md](context/news-pipeline.md#known-feed-issues). |
| Home-screen app shows an old version | Fully close the app (swipe it away) and reopen it. The service worker is network-first, so any fresh load picks up the new version. The ↻ button only refreshes news, not the app itself. |
| Study progress disappeared | Progress lives in browser storage on that device only. Clearing Safari website data or using a different browser starts fresh. Use Settings → Export backup regularly. |
