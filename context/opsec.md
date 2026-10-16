# Privacy and OPSEC

Sec-Pulse is built and used by a working security analyst, and **the repo and the site are both public**. Free GitHub Pages requires a public repo, and anyone can read every file, commit and Action log. These rules keep it from becoming a reconnaissance gift.

## Never commit

- The employer's real **domains, IP ranges, tenant names, hostnames or email formats**.
- Names of the employer's **security vendors, EDR/SIEM products, internal tools or versions**. A public "what this analyst watches for" list reveals the stack. (Generic product terms in keyword groups, like "Microsoft 365" or "Fortinet", are fine: they describe common technology, not this organisation.)
- Anything from a **real incident**: IoCs, timelines, affected systems, people involved.
- **Colleagues' names** or internal team structure.
- **Secrets** of any kind. `NTFY_TOPIC`, `WEBPUSH_SUBSCRIPTION` and `VAPID_PRIVATE_KEY` live in GitHub Actions secrets, never in files. The VAPID *public* key in `index.html` is meant to be public.

## Fine to commit

- Generic keyword groups (BEC, phishing, ransomware, M365, real estate, Australia).
- Public news sources and public regulatory facts.
- Study content using `example.com`-style placeholders.

## Where the data goes

| Data | Where it lives | Who can see it |
|---|---|---|
| News items | `data/news.json` in the public repo | Anyone |
| Study progress, saved/read stories | `localStorage` on the user's phone | Only that device; never sent anywhere |
| Morning brief text | ntfy.sh topic | Anyone who knows or guesses the topic name |
| `NTFY_TOPIC` | GitHub Actions secret | Repo admins; masked in logs |
| Morning brief via Web Push | Encrypted end to end from the Action to the phone (Apple's push service relays it but can't read it) | Only the subscribed phone |
| Blog drafts (`blog/drafts/`) | Public repo, then WordPress drafts | Anyone can read the repo copy before it's published; the user reviews every post |
| `WP_CLIENT_ID`, `WP_CLIENT_SECRET`, `WP_USERNAME`, `WP_APP_PASSWORD` | GitHub Actions secrets | Repo admins; masked in logs. Revoke the application password in WordPress.com → Me → Security if it leaks |
| `WEBPUSH_SUBSCRIPTION`, `VAPID_PRIVATE_KEY` | GitHub Actions secrets | Repo admins; masked in logs. Both are needed to send to the phone; regenerate the key pair (new public key in `index.html`) if the private key leaks |

The app makes no requests except to its own origin (the JSON and Markdown files) and to links the user taps: news stories, the lesson YouTube searches and the user's own Udemy link. No analytics, no third-party scripts or fonts.

## Personal links and vendor-specific study

- **Udemy (or any profile) link**: stored only in the phone's `localStorage` (`sp_courseUrl`), entered in Settings. Never hard-code it in `index.html`: a public profile ties a real name to "the analyst who watches for X".
- **Vendor platform training** (the specific EDR, SIEM/vulnerability-management or email-security products used at work): don't add lessons, flashcards or keyword groups for them here. A public study deck for exactly those products is a map of the employer's stack. Keep vendor-specific study in the vendors' own training portals or a private repo. Generic lessons on the *categories* (EDR, vulnerability management, secure email gateways) are fine.

## Work-device considerations

- Check that using a personal study/news app on a work phone or network fits the employer's acceptable-use policy.
- News links go to third-party sites. Treat them like any other browsing.
- Don't upload work files or screenshots to public sandboxes while "practising" lesson techniques (lesson 1.4 covers why).
