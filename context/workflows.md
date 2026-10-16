# GitHub Actions workflows

Everything server-side runs as GitHub Actions in `.github/workflows/`. There is no other backend. All times below are UTC in the cron and Brisbane (UTC+10, no daylight saving) in brackets.

| Workflow | File | Runs | Does | Commits | Secrets |
|---|---|---|---|---|---|
| **Fetch news** | `fetch-news.yml` | `17 */3 * * *` (every 3h at :17) + manual | `fetch_news.py` | `data/news.json` ("Update news feed") | none |
| **Morning brief** | `morning-brief.yml` | `25 21 * * *` (7:25am) + manual (input `once`) | fetch news → commit → install `pywebpush` → `send_brief.py` | `data/news.json`, then `data/brief.json` + `data/brief-sent.txt` ("Morning brief sent") | `WEBPUSH_SUBSCRIPTION`, `VAPID_PRIVATE_KEY`, `NTFY_TOPIC` (optional) |
| **Weekly digest** | `weekly-digest.yml` | `0 8 * * 0` (Sunday 6pm) + manual | fetch news → commit → install `pywebpush` → `send_digest.py` | `data/news.json` | same as the brief |
| **Blog drafts** | `blog-drafts.yml` | push touching `blog/drafts/**` (any branch) + manual | `post_draft.py`: new drafts → WordPress **drafts** | `blog/posted.json` ("Record blog drafts sent to WordPress") | `WP_CLIENT_ID`, `WP_CLIENT_SECRET`, `WP_USERNAME`, `WP_APP_PASSWORD` |
| **pages build and deployment** | (GitHub's own) | every push to `main` | publishes the repo root to GitHub Pages, ~20-60s | - | - |

Secrets are described in [secrets.md](secrets.md).

## Shared rules
- **Permissions**: every workflow that commits has `permissions: contents: write`, and the repo setting **Settings → Actions → General → Workflow permissions** must be **Read and write** (see [SETUP.md](../SETUP.md)).
- **Concurrency**: fetch, brief and digest share the group `news-data` (`cancel-in-progress: false`), so they never write `news.json` at the same time and queue instead. Blog drafts has its own group.
- **Committing**: each commit step configures `github-actions[bot]`, skips if nothing changed, then `git pull --rebase` and `git push`. Commits made with the workflow's `GITHUB_TOKEN` don't trigger other workflows, but Pages still deploys them.
- **Python**: 3.12 via `actions/setup-python`, standard library only, except `pywebpush` (pinned `2.5.0`) for Web Push in the brief and digest. That install step has `continue-on-error: true`.
- **Timeouts**: 10 minutes (5 for blog drafts).
- **Running by hand**: **Actions → (workflow) → Run workflow**, or https://github.com/turbulenceking5/Sec-Pulse/actions. On a phone use Safari, not the GitHub app (it may hide the button).

## Scheduling caveats
- GitHub cron is **best-effort**. Runs are often 5-30 minutes late, and on 2026-10-13/14 the brief ran 3h19m late and then not at all. That's why the brief has a send-once rule and an optional external trigger ([notifications.md](notifications.md#send-once-a-day)).
- GitHub **disables scheduled workflows after 60 days with no repository activity**. The bot's own news commits count as activity, so this is unlikely, but if news stops updating, check the workflow page for a "This scheduled workflow is disabled" banner.
- Scheduled workflows only run from the **default branch (`main`)**. A change to a schedule on a feature branch does nothing until it's merged.

## Failure behaviour
- **Fetch news**: one broken feed never fails the run; errors go into `news.json`'s `sources` list (Settings → Feed health).
- **Brief/digest**: a channel that fails still lets the other send; then the run fails, so GitHub e-mails the owner. "subscription expired" means the app's notification code changed (see [notifications.md](notifications.md)).
- **Blog drafts**: missing secrets fail with "Missing secrets: …"; an OAuth error shows WordPress's message (e.g. two-step authentication needs an application password). `posted.json` is saved after each draft, so a later failure doesn't resend earlier ones.
