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

It then runs daily at 21:25 UTC (7:25am Brisbane). GitHub's scheduler is best-effort, though: runs are often 5–30 minutes late and have been seen hours late or skipped. For an on-time brief, add the external trigger below.

### Recommended on iPhone: notifications from the app itself

ntfy works, but on iPhone tapping its notification opens the app link in Safari. Notifications sent straight to the Home Screen app (Web Push, iOS 16.4+) open Sec-Pulse itself.

1. Add the secret **`VAPID_PRIVATE_KEY`** (repo **Settings → Secrets and variables → Actions → New repository secret**). It's the private half of the key pair whose public half is `VAPID_PUBLIC` in `index.html`; you were given it when this was set up. To make a new pair, see "New key pair" below.
2. Open Sec-Pulse **from its Home Screen icon** → ⚙️ Settings → **Notifications on this phone** → **Turn on notifications** → Allow.
3. Tap **Copy code** and save it as the secret **`WEBPUSH_SUBSCRIPTION`**.
4. Test: **Actions → Morning brief → Run workflow**. Tapping the notification should open the app on the Brief.

Both channels can stay on (you'd get two notifications); delete the `NTFY_TOPIC` secret to use Web Push only. If you turn notifications off in the app or reinstall it, the code changes: copy the new one into `WEBPUSH_SUBSCRIPTION`. A run that fails with "subscription expired" means the same.

**New key pair** (only if the private key is lost or leaked): run `python3 -m venv /tmp/v && /tmp/v/bin/pip install cryptography` and then a short script that generates a P-256 key and prints the private value (32 bytes) and the uncompressed public point, both base64url without padding. Put the public one in `VAPID_PUBLIC` in `index.html`, the private one in the `VAPID_PRIVATE_KEY` secret, then turn notifications off and on in the app and update `WEBPUSH_SUBSCRIPTION`.

### Recommended: on-time brief with cron-job.org

[cron-job.org](https://cron-job.org) (free) starts the workflow at exactly 7:25 through GitHub's API. GitHub's own schedule stays on as a backup. Both pass "send once", so whichever runs first sends the brief and the other skips (the date of the last send is kept in `data/brief-sent.txt`). **Run workflow** from the Actions tab always sends.

**1. Create a GitHub token that can only start workflows in this repo**
1. GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name: `cron-job.org morning brief`. Expiration: the longest offered (put a reminder in your calendar to renew it).
3. **Repository access → Only select repositories →** `Sec-Pulse`.
4. **Permissions → Repository permissions → Actions: Read and write**. Leave everything else as **No access**.
5. **Generate token** and copy it (it's shown once). Don't paste it anywhere else, and never into this repo.

**2. Create the cron job**
1. Sign up at cron-job.org and choose **Create cronjob**.
2. **Title:** `Sec-Pulse morning brief`
3. **URL:** `https://api.github.com/repos/turbulenceking5/Sec-Pulse/actions/workflows/morning-brief.yml/dispatches`
4. **Execution schedule:** every day at **07:25**, and set the time zone to **Australia/Brisbane** (in the job, or in your account settings).
5. Open the **Advanced** tab:
   - **Request method:** `POST`
   - **Headers** (add three):
     - `Authorization`: `Bearer <your token>`
     - `Accept`: `application/vnd.github+json`
     - `X-GitHub-Api-Version`: `2022-11-28`
   - **Request body:** `{"ref":"main","inputs":{"once":"true"}}`
6. Save, then use **Test run**. A `204` response means the brief workflow started. Check **Actions → Morning brief** for the run; on a day the brief was already sent, the log says `already sent - skipping`.
7. Turn on cron-job.org's failure notifications (e-mail) so you hear about an expired token.

**If it stops working:** a `401` means the token expired or was revoked (make a new one and update the header); `404` means a typo in the URL or the token doesn't cover this repo; `422` means the body is wrong (check `"ref":"main"`).

The **Weekly digest** workflow (Sundays 08:00 UTC = 6pm Brisbane) uses the same `NTFY_TOPIC` secret, so there's nothing extra to set up. To test it: **Actions → Weekly digest → Run workflow**.

> **Security:** ntfy.sh topics have no password. Anyone who knows the topic name can read the messages and post to it. That's acceptable here because the brief only contains public headlines, but keep the name long and unguessable. Never reuse it for anything sensitive.

### Optional: self-hosted or authenticated ntfy

`scripts/send_brief.py` reads `NTFY_SERVER` (default `https://ntfy.sh`). To use your own server, add an `NTFY_SERVER` secret and pass it through in the `env:` block of `.github/workflows/morning-brief.yml` and `weekly-digest.yml`. If you need access tokens, add an `Authorization` header in `send_brief.py`'s `notify()` (the digest uses it too).

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Site shows the old placeholder README | Pages not enabled, or deploying from the wrong branch/folder (step 1). |
| Workflow fails at `git push` with 403 | Workflow permissions are read-only (step 2). |
| "Turn on notifications" missing in Settings | On iPhone it only appears when the app is opened from the Home Screen icon, not in Safari. If it says "blocked", allow notifications in iPhone Settings → Notifications → Sec-Pulse. |
| "Morning brief" / "Weekly digest" ran but no notification | `NTFY_TOPIC` secret missing or misspelled. The run log says `NTFY_TOPIC not set - skipping`. Also check you subscribed to the exact same topic in ntfy. |
| Brief arrives late or not at all | GitHub's scheduler runs late at busy times. Set up the cron-job.org trigger (step 5). |
| News in the app is stale | Check **Actions → Fetch news** for failures. GitHub disables scheduled workflows after 60 days without repo activity; re-enable it from the workflow page. |
| A feed shows ⚠️ in Settings → Feed health | That source failed this run. Other feeds are unaffected. See [context/news-pipeline.md](context/news-pipeline.md#known-feed-issues). |
| Home-screen app shows an old version | Fully close the app (swipe it away) and reopen it. The service worker is network-first, so any fresh load picks up the new version. The ↻ button only refreshes news, not the app itself. |
| Study progress disappeared | Progress lives in browser storage on that device only. Clearing Safari website data or using a different browser starts fresh. Use Settings → Export backup regularly. |
