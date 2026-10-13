# Changelog

## 2026-10-13: Documentation
- Added `SETUP.md` and the `context/` docs (architecture, news pipeline, morning brief, app, study content, testing, roadmap, OPSEC).
- Added `scripts/smoke-test.cjs`, a headless Playwright smoke test at iPhone size.

## 2026-10-13: Launch
- Installable PWA with Brief, News, Learn and Cards tabs, plus a Settings sheet.
- News pipeline: 15 sources (Australian + global + CISA KEV), keyword relevance scoring, 14-day history, refreshed every 3h by GitHub Actions.
- Morning brief: daily ntfy push at 6:30am Brisbane with the top 5 stories and the CySA+ lesson of the day.
- CySA+ CS0-003 content: 21 lessons (including AU bonus lessons on Essential Eight, BEC/payment redirection and Australian reporting obligations), 63 quiz questions, 60 flashcards.
- Quick quiz, weighted 30-question practice exam, Leitner spaced-repetition flashcards, day streak, and progress export/import.
