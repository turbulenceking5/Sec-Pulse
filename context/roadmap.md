# Roadmap

Ideas for what to build next, roughly in priority order. Move items to [CHANGELOG.md](../CHANGELOG.md) when shipped.

## Study

- [ ] **Domain 4 flashcards** (still only 6): dwell time, KPI vs metric, out-of-band communication, report structure.
- [ ] **Rebalance the card deck**: Domain 1 has 43 of 93 cards.

- [x] **More Domain 4 content** (Reporting & Communication, 17% of the exam, only 2 lessons and 6 questions). Candidates: 4.3 metrics and KPIs deep-dive, 4.4 stakeholder communication scenarios, 4.5 writing an incident report.
- [ ] **Performance-based question (PBQ) practice.** The real exam includes PBQs. Ideas: a log snippet with "pick the malicious line"; an email header with "which check failed"; a scan output with "order these by priority"; drag-to-order IR phases. Needs a new question `type` in `cysa.json` and a renderer in `renderQuiz`.
- [x] **Weak-area review**: a quiz mode drawing from questions previously answered wrong (needs per-question history; today only per-domain totals are kept in `sp_qstats`).
- [ ] **Scaled score estimate** after practice exams, with a clear "rough guide" disclaimer.
- [x] **Exam countdown**: set an exam date in Settings, show days left on the Brief, and suggest daily targets.
- [x] **More flashcards** for tools and ports (Nmap flags, common ports, Windows event IDs such as 4624/4625/4688/4720/1102).
- [x] **XP and analyst rank**: RPG-style levels, rank titles and per-domain skills, earned from quizzes, cards, lessons and reading news.
- [x] **Video help per lesson**: a YouTube search link on every lesson.
- [x] **Udemy link** in Settings, shown on Learn and in lessons (stored on-device only).
- [ ] **Category lessons for common security tooling**: generic EDR, vulnerability-scanner and secure-email-gateway workflows (triaging an EDR detection, reading a scan report, releasing a quarantined email). Keep them vendor-neutral, see [opsec.md](opsec.md).
- [ ] **XP quests**: optional daily goals ("answer 10 questions", "read 3 Australian stories") worth bonus XP.
- [ ] **Version check**: when CompTIA announces the CS0-003 successor, update `exam.code`, domains and weights (see [study-content.md](study-content.md#accuracy)).

## News

- [ ] **Weekly digest notification** (Sunday evening): top 10 of the week plus study stats. Needs a third workflow and either a week-scoped `send_brief.py` mode or study stats exported somewhere the Action can read (they're only in localStorage today).
- [x] **"Why this ranked"**: tap the score or tags on a story to see which keyword groups matched.
- [x] **Mute a source or tag** from the app (stored locally, filtered client-side).
- [x] **EPSS enrichment for KEV/CVE items** via FIRST's public EPSS API in `fetch_news.py`.
- [x] **Story clustering**: group the same incident reported by several outlets (the title dedupe only catches identical headlines).
- [ ] Revisit the ACSC direct feeds if a working route appears (see [news-pipeline.md](news-pipeline.md#known-feed-issues)).

## App

- [x] **In-app What's new and Roadmap** (Settings), rendered from CHANGELOG.md and this file.
- [x] **Refresh button feedback**: spins and reports new stories or when the next fetch is due.
- [ ] **Pull-to-refresh** on News.
- [ ] **Light theme** option.
- [ ] **Read-later list separate from Saved**, or notes on saved stories.
- [ ] **Cross-device progress sync** (optional, only if needed). It would need a backend such as a Supabase row or a GitHub Gist with a token. The public repo means no secrets in the page, so this needs real auth. Export/Import covers moving phones today.

## Won't do (and why)

- **Anything that stores employer-internal data** (internal alert feeds, asset lists, incident notes). The repo and site are public; see [opsec.md](opsec.md).
- **A shared or multi-user version.** It's a personal tool.
- **Lessons named after the employer's actual security vendors.** A public deck for exactly those products reveals the stack. Use the vendors' own training portals privately; generic category lessons are on the list above.
- **Triggering a news fetch from the ↻ button.** It would need a GitHub token in a public page. The Action runs every 3 hours, and **Actions → Fetch news → Run workflow** forces one.
