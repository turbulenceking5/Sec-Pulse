# Gamification

The RPG-style layer over the study features in `index.html`: everything earns XP, XP sets a level, levels unlock rank titles, and quests, achievements and the streak give daily and long-term goals. All state is in `localStorage` (keys in [app.md](app.md#localstorage-keys)).

## XP and levels
- **Earning** (`XP` constants, `gainXP(n, skill, once)`): quiz answer +10 right / +3 wrong; PBQ +20 right / +5 wrong; daily quests +20 to +40 each; achievements +25 each; flashcard +5 / +1; lesson completed for the first time +50; finishing a practice exam +25 or a quick/review round +10; opening a news story +2 (first open of that story, up to `READ_CAP` = 25 a day); first study activity of a Brisbane day +10 +2 per streak day (max +30, awarded in `markActivity()`).
- **Anti-grind**: each question (`qid`) and card (`id`) earns XP once per Brisbane day, tracked in `today.q`/`today.c`. That covers the question of the day re-rendering, cram rounds and the in-round retry of a wrong card. Repeats still count for stats and spaced repetition, just not XP.
- **Levels**: going from level L to L+1 costs 100×L XP (`levelOf()`, `xpForLevel()`), so Lv 10 needs 4,500 XP and Lv 20 needs 19,000. A steady day (≈10 cards, 10 questions, a few stories) is about 150–200 XP.
- **Ranks** (`RANKS`): Trainee Analyst (1), SOC Analyst Tier 1 (3), Tier 2 (6), Incident Responder (10), Threat Hunter (15), Senior Analyst (20), Detection Engineer (25), SOC Lead (30), Security Architect (40), Cyber Legend (50). Level-ups toast, and a new rank says "promoted to …".
- **Skills**: XP is also credited to the CySA+ domain of the question/card/lesson (`"1"`-`"4"`) or to `intel` for news reads. Skill levels use the same curve at 25 XP per step. Shown on the **Analyst profile** sheet (`openProfile()`), along with the earning table and rank ladder.
- **Seeding** (`seedXP()`, runs once after `cysa.json` loads when `sp_xp` doesn't exist): credits progress made before XP existed from `sp_lessons`, `sp_qhist`, `sp_cardhist` and `sp_read` at the same rates, so existing users don't restart at level 1. No daily or round bonuses are back-dated.
- Quiz and card explanations show `+N XP` when XP was awarded.

The **Analyst profile** (`openProfile()`, tap the rank card on the Brief) shows the level, rank, XP, streak and freezes, skills, achievements, the study-activity heatmap, the accuracy trend, the earning table and the rank ladder.

## Daily quests
Optional bonus goals, shown on the Brief under the rank card, that reset on the Brisbane date: answer 10 questions (+30), review 10 flashcards (+30), read 3 Australian stories (+20), finish a lesson (+40). Questions and cards count the *unique* ones answered today (`sp_xp.today.q`/`.c`), so repeats can't farm them. Australian stories and lessons are tracked in `sp_quests`. `checkQuests()` runs from `gainXP()` (and `questTick()`), pays each quest once a day and toasts. Tapping a quest jumps to Learn, Cards, the Australia filter or the next unfinished lesson. Defined in `QUESTS`.

Finishing **all** quests in a day also earns a streak freeze (see below) and counts toward the "Quest master" achievement.

## Achievements
One-off badges (`BADGES()`, `checkBadges()`, `sp_badges`), +25 XP each (`BADGE_XP`), listed below. Each badge's `test()` reads existing state (`badgeCtx()`), so nothing extra is tracked. `checkBadges()` runs at the end of `gainXP()` (guarded against recursion) and at boot. The first run (no `sp_badges`) credits existing progress silently, with no XP or toast.

| Badge | Condition |
|---|---|
| 🎯 First answer | Answer a quiz question |
| 🧠 Question bank | 250 quiz questions answered |
| 🃏 Card shark / 🗂️ Deck master | 100 / 500 flashcard answers |
| 🏛️ Long-term memory | 25 cards in box 5 |
| 🔥 On a roll / ☄️ Unstoppable | Best streak 7 / 30 days |
| 🛡️ Domain N cleared | Every lesson in that domain (one badge per domain) |
| 🎓 Syllabus cleared | Every lesson |
| 🧩 Hands-on hero | A PBQ round with every answer right |
| 📈 Pass mark | Estimated 750+ on a practice exam |
| ⏱️ Beat the clock | Estimated 750+ on a timed exam, inside the time |
| ✅ Quest master | Every daily quest in one day |
| 📰 Well informed | 100 news stories read |

To add one: append to `BADGES()` with a permanent `id` and a `test(c)` over `badgeCtx()`. Existing users who already meet it get it (with XP and a toast) the next time `checkBadges()` runs.

## Streak
Any study activity (answering a question, completing a lesson, grading a card) on a Brisbane calendar day calls `markActivity()`. Consecutive days increment the streak, and a missed day resets it to 1. The streak is shown as 0 once more than one day has passed since the last activity.

**Streak freezes** (`sp_freeze`, `getFreeze()`, `earnFreeze()`): finishing every daily quest earns one (once a day, up to `FREEZE_MAX` = 2 held). If the last activity was the day before yesterday and a freeze is held, `markActivity()` spends it, logs the covered day in `used`, and the streak carries on (+1 for today). Only a single missed day can be covered. `currentStreak()` keeps showing the streak during that gap while a freeze is held. The Brief's streak stat shows `🧊N` when freezes are held.

## Progress history (profile)
- **Study activity heatmap** (`heatmapHtml()`): 17 weeks × 7 days from `sp_days` (XP per Brisbane day, written by `gainXP()` via `logDay()`, last 400 days). Shades step at 1 / 50 / 120 / 200 XP; freeze days have a dashed outline. `seedDays()` (once, at boot) rebuilds active days from the streak run, lesson dates, quiz history and the `last` dates in `sp_qhist`/`sp_cardhist`, logged as 1 ("active") because per-day XP wasn't kept before.
- **Quiz accuracy trend** (`trendHtml()`): an SVG line of the last 20 `sp_quizHistory` rounds (all types), with an 80% dashed guide, a tooltip per point, and average/latest in text.

## Tuning notes
- The level curve was briefly made steeper on 2026-10-14 (100×L×(2 + L/20)) and reverted the same day: the user found it too slow. Keep 100×L unless asked.
- XP rates are deliberately small per action and capped per item per day, so rank reflects steady study, not repetition.
