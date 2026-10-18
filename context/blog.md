# Blog drafts (WordPress.com)

Claude writes posts for the user's blog, https://cybersecuritydoom.wordpress.com/ ("Cyber Security DOOM", a free WordPress.com site). The user reviews and publishes every one. **Nothing is ever published automatically.**

## Flow
1. A post is written as Markdown in `blog/drafts/YYYY-MM-DD-slug.md`.
2. Pushing it (any branch) runs `.github/workflows/blog-drafts.yml`, which runs `scripts/post_draft.py`.
3. The script gets a fresh OAuth token (password grant, app owner's own site) and creates the post with `status: draft` through the WordPress.com REST API v1.1 (`/sites/<site>/posts/new`).
4. It records the file in `blog/posted.json` (`{file: {id, url, date}}`), committed back by the workflow, so each file is sent once.
5. The user edits and publishes in WordPress (Posts → Drafts), or deletes it.

Editing a file after it was sent does **not** update WordPress, because the user may already have edited the draft there. To resend, rename the file or remove its entry from `posted.json`.

## File format
```
---
title: What is EPSS?
category: Learning          # existing categories: Learning, News, Career
tags: cybersecurity, vulnerability, epss
---
Simple Markdown: ## / ### headings, paragraphs, - and 1. lists, **bold**, *italic*, `code`,
[links](https://...), ``` code blocks, > quotes.
```
`to_blocks()` converts it to block-editor HTML (`<!-- wp:paragraph -->` etc.), so posts open as normal blocks in the WordPress editor. `python3 scripts/post_draft.py --dry-run` prints the converted HTML without sending.

## Secrets (repo Actions secrets)
`WP_CLIENT_ID`, `WP_CLIENT_SECRET` (the "Sec-Pulse drafts" app at developer.wordpress.com/apps), `WP_USERNAME`, `WP_APP_PASSWORD` (a WordPress.com application password; needs two-step authentication on). Optional `WP_SITE` overrides the site. A missing secret fails the run with "Missing secrets: …".

## Weekly routine
A Claude Code routine, **"Weekly blog draft"** (`trig_019ND4TYSTvbezziyW1V3ack`, cron `CRON_TZ=Australia/Brisbane 59 8 * * 0`), fires every Sunday at about 9am Brisbane **into the original Sec-Pulse session** (`session_01BidAp3xukDFNBTHZn5fbQk`), which has push access to the repo. It drafts a "This Week in Cyber" News post from the past 7 days of `data/news.json`, verifies facts against the original reporting, writes `blog/drafts/YYYY-MM-DD-week-in-cyber-<slug>.md` and pushes it to `claude/upbeat-planck-81qdaj` (not `main`), which triggers the Blog drafts Action. If that date's file already exists, it stops.

History: the first version (2026-10-16) started a fresh session each week, but routine sessions are created without repository access, so on 2026-10-18 it wrote the post and then got a 403 on push. That draft was recovered from the session log and sent by hand (post 121), and the routine was re-created to run in the main session. If that session is ever archived, re-create the routine from a session that has the repo attached, or add the repo to the routine in claude.ai/code → Routines.

## Writing the posts
- **Match the blog's voice**: short, plain explainers in the first person; `##` headings like "What is X?", "How it works", "Why it matters"; bold-label bullet lists; a closing takeaway. Australian spelling.
- **Categories**: Learning (explainers, CySA+ topics), News (incident and vulnerability write-ups). Leave **Career** posts to the user, since they're personal experience.
- **Sources**: Sec-Pulse's own data (`data/news.json`, the weekly digest, `data/cysa.json`). Link the original reporting for news, and never copy paywalled text.
- **Accuracy**: same bar as the study content. Check facts, CVE numbers and dates against the source.
- **OPSEC**: the posts are public under the user's name. Never mention the employer, its systems, vendors, clients or incidents, or anything from the user's work (see [opsec.md](opsec.md)). Keep examples generic.
- The repo is public, so drafts are readable here before they're approved. The user chose this over a private repo.
