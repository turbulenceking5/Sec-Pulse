# Changelog

## 2026-10-13: Analyst rank, What's new and fixes
- **Level up as you study.** Quiz answers, flashcards, lessons and reading news now earn XP. Climb from Trainee Analyst through SOC Analyst, Incident Responder and Threat Hunter to Cyber Legend, with a skill bar per exam domain plus Threat Intel from news. Tap the rank card on the Brief for your profile. Progress you'd already made counts: it's converted to XP the first time you open the app.
- **What's new and Roadmap** buttons at the top of Settings.
- **Videos on this topic**: every lesson links to a YouTube search for it.
- **Udemy link**: add your profile or course link in Settings for a shortcut on Learn and in every lesson. It's saved on your phone only.
- **Refresh button fixed**: it now spins and tells you whether there are new stories, or when the next news update is due (news is fetched every 3 hours).
- **Cleaner Australian news**: cyber.gov.au guidance pages ("Use passkeys", "Event logging") and general IT business stories no longer show up as news. Coverage of ASD/ACSC alerts now comes in from Australian outlets.

## 2026-10-13: Better flashcard answers
- Flashcard wrong answers now come from the same topic as the card (e.g. Cyber Kill Chain is mixed with Diamond Model, STRIDE and NIST IR phases), instead of unrelated ports or event IDs that gave the answer away.

## 2026-10-13: Study tools and smarter news
- **Flashcards are now multiple choice.** Pick the matching answer from 4 options (wrong answers come from similar cards, with port numbers and flags blanked so you can't match by number). Cards you get wrong are remembered: they come back later in the round, and **Review missed cards** re-asks them until you've got them right more often than wrong. Getting a previously-missed card right shows "Improved!".
- **Exam countdown**: set your exam date in Settings to see days left and a daily target on the Brief.
- **Review mistakes**: a Learn quiz built from questions you've answered wrong.
- **Why this ranked**: tap a story's score or tags for the score breakdown. Mute a source or tag from there; manage mutes in Settings.
- **EPSS**: CVE stories show the FIRST EPSS exploitation probability; non-KEV stories at 50%+ get +2.
- **Story clustering**: the same story from several outlets is merged into one card with "+N more sources". The morning brief's top 5 are now 5 different stories.
- New content: Domain 4 lessons 4.3 (metrics and KPIs), 4.4 (stakeholder communication) and 4.5 (writing an incident report), and 33 flashcards on Nmap flags, common ports and Windows event IDs.

## 2026-10-13: Documentation
- Added `SETUP.md` and the `context/` docs (architecture, news pipeline, morning brief, app, study content, testing, roadmap, OPSEC).
- Added `scripts/smoke-test.cjs`, a headless Playwright smoke test at iPhone size.

## 2026-10-13: Launch
- Installable PWA with Brief, News, Learn and Cards tabs, plus a Settings sheet.
- News pipeline: 15 sources (Australian + global + CISA KEV), keyword relevance scoring, 14-day history, refreshed every 3h by GitHub Actions.
- Morning brief: daily ntfy push at 6:30am Brisbane with the top 5 stories and the CySA+ lesson of the day.
- CySA+ CS0-003 content: 21 lessons (including AU bonus lessons on Essential Eight, BEC/payment redirection and Australian reporting obligations), 63 quiz questions, 60 flashcards.
- Quick quiz, weighted 30-question practice exam, Leitner spaced-repetition flashcards, day streak, and progress export/import.
