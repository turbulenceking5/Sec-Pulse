# Roadmap

Ideas for what to build next, roughly in priority order. Move items to [CHANGELOG.md](../CHANGELOG.md) when shipped.

## Study

- [ ] **More Domain 4 content** (Reporting & Communication, 17% of the exam, only 2 lessons and 6 questions). Candidates: 4.3 metrics and KPIs deep-dive, 4.4 stakeholder communication scenarios, 4.5 writing an incident report.
- [ ] **Performance-based question (PBQ) practice.** The real exam includes PBQs. Ideas: a log snippet with "pick the malicious line"; an email header with "which check failed"; a scan output with "order these by priority"; drag-to-order IR phases. Needs a new question `type` in `cysa.json` and a renderer in `renderQuiz`.
- [ ] **Weak-area review**: a quiz mode drawing from questions previously answered wrong (needs per-question history; today only per-domain totals are kept in `sp_qstats`).
- [ ] **Scaled score estimate** after practice exams, with a clear "rough guide" disclaimer.
- [ ] **Exam countdown**: set an exam date in Settings, show days left on the Brief, and suggest daily targets.
- [ ] **More flashcards** for tools and ports (Nmap flags, common ports, Windows event IDs such as 4624/4625/4688/4720/1102).
- [ ] **Version check**: when CompTIA announces the CS0-003 successor, update `exam.code`, domains and weights (see [study-content.md](study-content.md#accuracy)).

## News

- [ ] **Weekly digest notification** (Sunday evening): top 10 of the week plus study stats. Needs a third workflow and either a week-scoped `send_brief.py` mode or study stats exported somewhere the Action can read (they're only in localStorage today).
- [ ] **"Why this ranked"**: tap the score or tags on a story to see which keyword groups matched.
- [ ] **Mute a source or tag** from the app (stored locally, filtered client-side).
- [ ] **EPSS enrichment for KEV/CVE items** via FIRST's public EPSS API in `fetch_news.py`.
- [ ] **Story clustering**: group the same incident reported by several outlets (the title dedupe only catches identical headlines).
- [ ] Revisit the ACSC direct feeds if a working route appears (see [news-pipeline.md](news-pipeline.md#known-feed-issues)).

## App

- [ ] **Pull-to-refresh** on News.
- [ ] **Light theme** option.
- [ ] **Read-later list separate from Saved**, or notes on saved stories.
- [ ] **Cross-device progress sync** (optional, only if needed). It would need a backend such as a Supabase row or a GitHub Gist with a token. The public repo means no secrets in the page, so this needs real auth. Export/Import covers moving phones today.

## Won't do (and why)

- **Anything that stores employer-internal data** (internal alert feeds, asset lists, incident notes). The repo and site are public; see [opsec.md](opsec.md).
- **A shared or multi-user version.** It's a personal tool.
