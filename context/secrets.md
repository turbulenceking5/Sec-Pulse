# Secrets

All secrets are **GitHub Actions repository secrets** (repo **Settings → Secrets and variables → Actions**). None are in any file in this public repo, and Actions masks them in logs. GitHub never shows a secret's value again after it's saved; to change one, open it and choose **Update**.

| Secret | Used by | What it is | Where it comes from |
|---|---|---|---|
| `WEBPUSH_SUBSCRIPTION` | brief, digest | The phone's Web Push subscription JSON | App → Settings → Notifications on this phone → **Copy code** |
| `VAPID_PRIVATE_KEY` | brief, digest | Private half of the app's Web Push key pair (base64url) | Generated once for the user; `scripts/gen_vapid_keys.py` makes a new pair |
| `NTFY_TOPIC` | brief, digest | ntfy topic name (optional; removed by the user on 2026-10-16) | Any long random string, subscribed to in the ntfy app |
| `NTFY_SERVER` | brief, digest | Optional custom ntfy server (not set; needs adding to the workflows' `env:`) | Self-hosted ntfy |
| `WP_CLIENT_ID`, `WP_CLIENT_SECRET` | blog drafts | The "Sec-Pulse drafts" WordPress.com app | https://developer.wordpress.com/apps/ → the app → OAuth Information |
| `WP_USERNAME` | blog drafts | WordPress.com username | The user's account |
| `WP_APP_PASSWORD` | blog drafts | WordPress.com **application password** (the account has two-step authentication, so the normal password is rejected) | https://wordpress.com/me/security/two-step → Application passwords |
| `WP_SITE` | blog drafts | Optional site override (not set; default `cybersecuritydoom.wordpress.com`) | - |

Not a secret: `VAPID_PUBLIC` in `index.html` (the public key, meant to be public) and `APP_URL` (built in the workflows from the repo name).

## Rotating
- **Web Push key pair** (only if `VAPID_PRIVATE_KEY` leaks or is lost):
  ```bash
  python3 -m venv /tmp/v && /tmp/v/bin/pip install cryptography
  /tmp/v/bin/python scripts/gen_vapid_keys.py
  ```
  Put the printed public key in `VAPID_PUBLIC` in `index.html` and deploy, save the private key as `VAPID_PRIVATE_KEY`, then in the app turn notifications **off and on** and update `WEBPUSH_SUBSCRIPTION` with the new code. Old subscriptions stop working with a new key.
- **Phone subscription**: after reinstalling the app or toggling notifications, copy the new code into `WEBPUSH_SUBSCRIPTION`.
- **WordPress application password**: revoke it at https://wordpress.com/me/security/two-step, create a new one, update `WP_APP_PASSWORD`. The app's **Reset key** on developer.wordpress.com rotates `WP_CLIENT_SECRET`.
- **ntfy topic**: pick a new topic, subscribe to it in ntfy, update `NTFY_TOPIC`.

## If a secret leaks
Anyone with `VAPID_PRIVATE_KEY` **and** `WEBPUSH_SUBSCRIPTION` can send notifications to the phone, so rotate the key pair. Anyone with the WordPress app details and application password can create or edit posts on the blog, so revoke the application password first (that alone cuts off access). See also [opsec.md](opsec.md).
