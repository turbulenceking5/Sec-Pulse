# Privacy and OPSEC

Sec-Pulse is built and used by a working security analyst, and **the repo and the site are both public**. Free GitHub Pages requires a public repo, and anyone can read every file, commit and Action log. These rules keep it from becoming a reconnaissance gift.

## Never commit

- The employer's real **domains, IP ranges, tenant names, hostnames or email formats**.
- Names of the employer's **security vendors, EDR/SIEM products, internal tools or versions**. A public "what this analyst watches for" list reveals the stack. (Generic product terms in keyword groups, like "Microsoft 365" or "Fortinet", are fine: they describe common technology, not this organisation.)
- Anything from a **real incident**: IoCs, timelines, affected systems, people involved.
- **Colleagues' names** or internal team structure.
- **Secrets** of any kind. The only secret, `NTFY_TOPIC`, lives in GitHub Actions secrets, never in files.

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

The app makes no requests except to its own origin (the JSON files) and to news links the user taps. No analytics, no third-party scripts or fonts.

## Work-device considerations

- Check that using a personal study/news app on a work phone or network fits the employer's acceptable-use policy.
- News links go to third-party sites. Treat them like any other browsing.
- Don't upload work files or screenshots to public sandboxes while "practising" lesson techniques (lesson 1.4 covers why).
