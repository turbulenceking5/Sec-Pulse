# Changelog

## 2026-10-21: 172 new exam questions
- **Question bank:** 172 new CySA+ questions across all four domains (weighted like the exam), each tagged with its CS0-003 objective. Quick quizzes, practice and timed exams, domain drills, Review mistakes and the question of the day now draw from 253 questions instead of 81.
- **Practice exams use questions you haven't seen first**, then ones you got wrong, so the score reflects what you know rather than what you remember.
- **Exam objectives** on your profile: questions seen and the share right for each of the 15 CS0-003 objectives.

## 2026-10-20: Fixes and polish from a full review
- **Fixed:** after **Reset** or **Import**, levelling up stopped until you restarted the app. Import now replaces your progress properly and refuses files that aren't backups.
- **Fixed:** Cards could say "All caught up" while cards were still due (missed cards, or a new day with the app left open).
- **Fixed:** coming back to the app could wipe a note you were typing or an answered question of the day.
- **Fixed:** a timed exam kept the clock running after the last answer, which could block the "Beat the clock" achievement.
- **Faster on bad signal:** if the network is slow, the app shows your saved copy after 4 seconds instead of a blank screen.
- **Brief:** "Top for you" becomes "More for you" once this morning's brief is in, so it doesn't repeat the same stories. The lesson and question of the day now sit above events.
- **News:** the score now sits in the tag row, so cards are shorter. Scoring no longer mistakes "flaws" for AWS, "Central Ohio" for Microsoft Entra or "San Francisco" for Cisco, and US privacy stories are no longer tagged Australian.
- **Study content:** clearer answers for the executive-summary, intel-levels, order-of-volatility, MTTR and ATT&CK cards, and better wrong options on three quiz questions.
- **Also:** quiz answers are marked ✓/✗ (not just by colour), wide PBQ exhibits say they scroll, Esc closes screens, and the morning brief can no longer double-send or stall in rare failure cases.

## 2026-10-19: Upcoming events
- **Upcoming events** on the Brief: the next cyber security conferences in Australia (BSides, CrikeyCon, AUSCERT, CyberCon, Gartner and more), with Queensland events marked "Near you". **See all** lists every event by month plus Brisbane meetups, and **+ Calendar** adds an event to your phone's calendar.

## 2026-10-17: Morning brief on time
- GitHub was starting the 7:25 brief up to 2-3 hours late. It now starts several times from 4:25am, and the first run waits until exactly 7:25 to send. You still get one notification.

## 2026-10-16: Read the whole brief
- **How to use** guide in Settings: a quick tour of every tab and feature.
- Tapping the morning notification now opens **This morning's brief**: the same 5 stories with full summaries and links, the overnight stats, today's lesson and the question of the day. It works the moment the notification arrives. It's also on the Brief tab ("📰 This morning's brief") for the rest of the day.

## 2026-10-15: Notifications that open the app
- **Turn on notifications in Settings** (open Sec-Pulse from its Home Screen icon first). The morning brief and weekly digest then arrive as notifications from Sec-Pulse itself, and tapping one opens the app on the Brief instead of Safari. One-time setup: copy the code it shows into GitHub (steps in Settings and SETUP.md). ntfy keeps working if you want both.
- The morning brief can be started at exactly 7:25am by a free external scheduler (cron-job.org; steps in SETUP.md), with GitHub's own schedule as a backup. You never get two briefs in one day: whichever runs first sends it.

## 2026-10-14: Achievements, timed exam, streak freezes and more
- **Achievements**: 17 badges on your profile (streaks, questions and cards answered, each domain cleared, a perfect PBQ round, a 750+ practice exam, beating the clock…), +25 XP each. Ones you'd already earned are credited quietly.
- **Study activity and accuracy trend** on your profile: a 17-week heatmap of the days you studied, and a chart of your last 20 quiz rounds against the 80% mark.
- **Streak freezes** 🧊: finish all the daily quests to earn one (hold up to 2). A freeze automatically covers a single missed day.
- **Focus area** on the Brief: your weakest exam domain (accuracy weighted by exam weight), with a 10-question drill that puts your past misses first.
- **Timed practice exam**: 30 questions in 58 minutes, the real exam's pace. Unanswered questions count as wrong when time runs out.
- **Acronym drill** on Cards: 32 new acronym cards (EDR, XDR, TTP, TLP, SCAP, OWASP, BIA, RACI…), run as a 10-card drill.
- **Question of the day in the morning notification**. The answer is in the app.
- **CVE links**: CVE numbers in a story link to their NVD page, and CISA KEV stories show the remediation deadline ("Fix by 16 Oct").
- **Protect your progress**: the app asks the browser not to clear its storage, and reminds you to export a backup once a month.
- **Morning brief moved to 7:25am** Brisbane time (was 6:30am). GitHub sometimes runs it a little late.
- Levelling stays at the original pace: a steeper curve was tried briefly and reverted.

## 2026-10-14: PBQs, quests, light theme and weekly digest
- **PBQ practice** (Learn): 15 performance-based scenarios - read an exhibit (logs, email headers, scan output, firewall rules, process trees) and pick the answer, or put steps in order. Missed ones join Review mistakes.
- **Scaled score estimate** after a practice exam (rough guide only - CompTIA doesn't publish its conversion).
- **Daily quests** on the Brief: answer 10 questions, review 10 cards, read 3 Australian stories, finish a lesson - bonus XP once a day.
- **Light theme**: Settings → Appearance (System / Dark / Light).
- **Pull to refresh** on News.
- **Read later** list (separate from Saved) and **notes** on saved stories.
- **Weekly digest**: Sunday 6pm push with the week's top 10 stories, stats and the week's lessons.
- New content: 3 vendor-neutral tooling lessons (EDR triage, email gateway, scan reports), 38 more flashcards (Domain 4 reporting, vulnerability management, IR and forensics) to balance the deck by exam weight.
- Real estate news no longer picks up property-market headlines ("mortgage rates breach 7%").

## 2026-10-13: No more paywalls
- Stories from paywalled outlets (e.g. Newcastle Herald, The Australian, SMH/The Age/AFR, WSJ, FT, Bloomberg) are no longer included, and don't appear in "+N more sources" either. The list lives in `scripts/sources.json` (`paywalled`).

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
