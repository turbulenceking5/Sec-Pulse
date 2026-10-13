# The app (`index.html`)

One self-contained HTML file: inline `<style>` and `<script>`, no framework, no build step, no external scripts or fonts. It works opened from GitHub Pages or `python3 -m http.server`. Opening the file directly via `file://` doesn't work, because `fetch()` of the JSON files fails there.

## Layout
- **Header** (sticky, respects `env(safe-area-inset-top)`): logo, "updated Xh ago" (from `news.json.generated`), ↻ refresh news, ⚙️ Settings.
- **↻ Refresh** re-fetches `news.json`, spins while it does, and always toasts the result: "N new stories", or "Up to date · fetched 2h ago, next in ~40m" (`nextFetchIn()`, from the `17 */3 * * *` cron in `fetch-news.yml`; keep it in sync if the schedule changes). It also asks the service worker to check for a new app version. It **can't** fetch the feeds itself: there's no backend, and only the GitHub Action runs `fetch_news.py`. Before this, an unchanged `news.json` made the button look broken.
- **Four views** in `<main>`, switched by the bottom **nav** (fixed, respects `safe-area-inset-bottom`). The current view is kept in the URL hash (`#news`, `#learn`, …) so reopening lands on the same tab.
- **Sheet** (`#sheet`): a full-screen overlay used for lessons, quizzes and Settings. Closing it re-renders Learn and Brief so ticks and stats update.
- **Toast** (`#toast`, z-index 80): above the sheet (50) and nav (30). Any new overlay must stay below 80.

## Tabs

### Brief
- Greeting by Brisbane hour, date, and three stats: day streak, cards due, lessons done.
- **Analyst rank card** (`renderRank()`): level, rank title, XP bar, XP earned today. Tap it for the profile sheet. See [XP and analyst rank](#xp-and-analyst-rank).
- **Exam countdown** (`renderExam()`): with `sp_examDate` set, a card shows days left (`ordinal(exam) - ordinal(today)`, both Brisbane dates) and a suggested target for today: `ceil(unfinished lessons / days left)` lessons, plus cards due and up to 10 review-mistakes questions. All lessons done → suggests a practice exam. Day 0 → "Exam day"; past date → asks to update it. With no date, a small link opens Settings at the date field. Tapping the card does the same.
- **Top for you**: 5 highest-`rank()` items from the last 30h (falls back to 72h if fewer than 5), excluding muted sources/tags.
- Pills: items in 24h, Australian count, actively-exploited count, feeds OK.
- **Today's CySA+ lesson**: same pick as the notification (see [morning-brief.md](morning-brief.md)).
- **Question of the day**: `ALL_Q()[(ordinal(today) * 7) % n]`. Each answer counts toward stats. It re-renders whenever the Brief re-renders (e.g. returning to the app), so it can be answered more than once a day.

### News
Filter chips (the last choice is remembered in `sp_filter`):

| Chip | Logic | Sort |
|---|---|---|
| For you | `score >= 5` and < 7 days old | `rank()` |
| Latest | everything | newest |
| 🇦🇺 Australia | `region == "AU"` | newest |
| Exploited | tag `Actively exploited` or `KEV` | newest |
| Real estate & BEC | tag `Real estate` or `BEC / payment fraud` | newest |
| Microsoft 365 | tag `Microsoft 365` | newest |
| ★ Saved | from `sp_saved` (survives the story ageing out of news.json) | newest |

Search filters on title + summary + source + tags. The list paginates 40 at a time ("Show more"). Opening a story marks it read (dimmed, unread dot removed); ☆ saves it.

**Why this ranked** (`openWhy()` / `explainScore()`): each card shows a `score N` pill; tapping it or the tag row opens a sheet with the score breakdown. news.json items don't store which terms matched, so the app fetches `scripts/sources.json` (lazily, once) and re-runs `fetch_news.py`'s `score()` logic client-side: source weight (by `feed` name) + each keyword group whose terms appear in title/summary (weight, +1 if in the headline, matched terms listed) + 2 if `region == "AU"`. Tags not explained by a keyword match (e.g. KEV's `Actively exploited`/`KEV`) show as "tagged by the feed itself, +0". If the rebuilt total differs from the stored `score` (keywords edited since the fetch), a note says so. Offline / fetch failure falls back to listing the tags. **If `score()` or the EPSS bump in `fetch_news.py` changes, update `explainScore()` to match** (it's display-only; `rank()` is untouched).

**Mute** (`sp_muted`): the Why sheet has Mute/Unmute buttons for the story's `source` (the outlet name shown on the card, not the `feed`) and each of its tags. Muted items are filtered out of Brief's Top for you and every News filter except ★ Saved; News shows "N hidden by mutes · Manage" when anything was filtered. Settings lists mutes as tappable pills to unmute.

**Optional fields** (forward-compatible; rendered only if present and valid):
- `epss` (number 0–1): a pill `EPSS 97%` in the meta row (`<1%` below 1%), red at ≥ 50%.
- `also` (array of `{source, url}`): a "+N more sources" toggle under the summary expanding to links. Entries whose `url` isn't `http(s)://` are dropped; a missing `source` falls back to the URL's hostname.

Tag colours: red (`hot`) for Actively exploited / KEV / Ransomware, teal (`re`) for Real estate / BEC. The `Australia` tag is hidden on cards because the AU pill already shows it.

### Learn
- Exam card: lessons done / total, overall quiz accuracy, progress bar.
- **Quick quiz**: 10 random questions from all lessons.
- **Practice exam**: 30 questions spread across domains by exam weight (33/30/20/17% → 10/9/6/5 questions). Results go to `sp_quizHistory`.
- **Review mistakes** (`startReview()` / `weakQuestions()`): up to 10 questions from `sp_qhist` whose latest answer was wrong or that have been missed more often than answered right. Ordered latest-wrong first, then most net misses, then most recent; the picked 10 are shuffled. A question drops off once right outnumbers wrong and the latest answer was right. The button shows the count; with no history it opens an empty-state card. Results go to `sp_quizHistory` with `type: "review"`. Question IDs (`<lesson id>#<index>`) that no longer exist in cysa.json are ignored.
- **Udemy link** (`sp_courseUrl`): an "Open my Udemy" button under Review mistakes once set in Settings, otherwise a link to set it. Only `https://` URLs are accepted. It's stored on the device, never in the repo (see [opsec.md](opsec.md)).
- Lessons grouped by domain, with ✓ when done and the lesson-quiz score.
- **Lesson sheet**: summary, key points, Exam tip box (teal), On the job box (amber), **▶ Videos on this topic** (a YouTube *search* for "CompTIA CySA+ CS0-003 <lesson title>", via `ytSearch()`; deliberately not hand-picked videos, which get deleted or go stale), 🎓 My Udemy if set, and a 3-question quiz. Finishing the quiz or tapping **Mark as complete** marks the lesson done.

### Cards
Multiple choice on top of Leitner spaced repetition:
- Each card shows its `front` and 4 answers: its own `back` plus 3 other cards' backs (`cardOptions()`). Distractors come from the same topic `group` in cysa.json (e.g. `models` for Kill Chain / Diamond / STRIDE / NIST IR, or `port`, `event-id`, `nmap`), so all four options are the same kind of answer. Only if a group has fewer than 4 cards does it fall back to the same domain (excluding the `nmap`/`port`/`event-id` groups, `ID_GROUPS`), then anywhere. `maskBack()` blanks each option's own identifiers (port numbers, flags, event IDs, acronyms from its front) as `___`, so an option can't be matched just by spotting the number. The full, unmasked back shows as the explanation after answering.
- Boxes 1-5 with review intervals `[_, 1, 3, 7, 14, 30]` days (`INTERVALS[box]`). **Right** → box +1. **Wrong** → box 1, due today, and re-asked once at the end of the current round (with fresh options).
- **Missed cards** (`sp_cardhist`, `missedCards()`): every answer (scheduled, cram or review) is recorded per card. A card counts as missed while its latest answer was wrong or it's been wrong more often than right (the same rule as Review mistakes). **Review missed cards · N** runs up to 10 of them without touching the schedule. The card shows "Missed N× before"; getting a previously-missed card right shows **Improved! ✓**. The Brief's exam target includes missed cards.
- **8 new cards per day** (`NEW_PER_DAY`), tracked in `sp_newToday`. Cards are introduced in `cysa.json` order.
- When caught up: a **Cram 10** button runs random cards without touching the schedule. Finishing a review or cram round returns to the scheduled queue.
- The nav badge shows the number of due cards.

### Settings sheet
**What's new** and **Roadmap** buttons (`openDoc()`) fetch `CHANGELOG.md` and `context/roadmap.md` and render them with `miniMd()`: `##` headings, `-` bullets, `[ ]`/`[x]` checkboxes, `**bold**` and `` `code` ``. Links show as plain text, since the docs' relative links point at other `.md` files. It works because `.nojekyll` makes Pages serve `.md` files raw. Keep both files to that simple subset. Then: exam date (`<input type="date">` + Clear, saved on change to `sp_examDate`), Udemy link (`sp_courseUrl`), muted sources/tags (tap to unmute), ntfy setup steps (with a random topic suggestion), feed health table, Export / Import / Reset progress, About. `openSettings('exam-date')` scrolls to the date field.

## Quiz engine: `renderQuiz(root, questions, opts)`
- One question at a time. **Option order is shuffled on every render**, so the `answer` index in the JSON can be anything.
- After answering: correct/incorrect highlight, explanation, Next / See result.
- `opts.single`: no Next button (question of the day).
- `opts.onDone(correct, total)`: called after the result screen.
- Every answer → `recordAnswer()` updates `sp_qstats` (overall and per-domain), `sp_qhist` (per question, when the question has a `qid`, which all three quiz entry points set) and the streak.
- Result messages: ≥80% "Exam-ready territory", ≥65% "Close", else "Keep going". These are rough guides; the real exam is scaled 100–900, with 750 to pass.

## XP and analyst rank
An RPG-style layer over the existing study features: everything earns XP, XP sets a level, levels unlock rank titles.

- **Earning** (`XP` constants, `gainXP(n, skill, once)`): quiz answer +10 right / +3 wrong; flashcard +5 / +1; lesson completed for the first time +50; finishing a practice exam +25 or a quick/review round +10; opening a news story +2 (first open of that story, up to `READ_CAP` = 25 a day); first study activity of a Brisbane day +10 +2 per streak day (max +30, awarded in `markActivity()`).
- **Anti-grind**: each question (`qid`) and card (`id`) earns XP once per Brisbane day, tracked in `today.q`/`today.c`. That covers the question of the day re-rendering, cram rounds and the in-round retry of a wrong card. Repeats still count for stats and spaced repetition, just not XP.
- **Levels**: going from level L to L+1 costs 100×L XP (`levelOf()`, `xpForLevel()`), so Lv 10 needs 4,500 XP and Lv 20 needs 19,000. A steady day (≈10 cards, 10 questions, a few stories) is about 150–200 XP.
- **Ranks** (`RANKS`): Trainee Analyst (1), SOC Analyst Tier 1 (3), Tier 2 (6), Incident Responder (10), Threat Hunter (15), Senior Analyst (20), Detection Engineer (25), SOC Lead (30), Security Architect (40), Cyber Legend (50). Level-ups toast, and a new rank says "promoted to …".
- **Skills**: XP is also credited to the CySA+ domain of the question/card/lesson (`"1"`-`"4"`) or to `intel` for news reads. Skill levels use the same curve at 25 XP per step. Shown on the **Analyst profile** sheet (`openProfile()`), along with the earning table and rank ladder.
- **Seeding** (`seedXP()`, runs once after `cysa.json` loads when `sp_xp` doesn't exist): credits progress made before XP existed from `sp_lessons`, `sp_qhist`, `sp_cardhist` and `sp_read` at the same rates, so existing users don't restart at level 1. No daily or round bonuses are back-dated.
- Quiz and card explanations show `+N XP` when XP was awarded.

## Streak
Any study activity (answering a question, completing a lesson, grading a card) on a Brisbane calendar day calls `markActivity()`. Consecutive days increment the streak, and a missed day resets it to 1. The streak is shown as 0 once more than one day has passed since the last activity.

## localStorage keys
All keys are prefixed `sp_` (Export, Import and Reset rely on the prefix). Every access goes through `store.get`/`store.set`/`store.del`, which wrap `JSON.parse`/`stringify` in try/catch so private browsing can't crash the app.

| Key | Shape | Purpose |
|---|---|---|
| `sp_streak` | `{last: "YYYY-MM-DD", count, best}` | Day streak |
| `sp_lessons` | `{"1.5": {date, score}}` | Completed lessons |
| `sp_qstats` | `{answered, correct, byDomain: {"1": {a, c}}}` | Quiz accuracy |
| `sp_qhist` | `{"1.5#0": {right, wrong, last: "YYYY-MM-DD", ok}}` | Per-question history for Review mistakes (`ok` = latest answer correct) |
| `sp_quizHistory` | `[{date, c, t, type: "quick"\|"exam"\|"review"}]` (last 100) | Quiz results |
| `sp_cards` | `{"c01": {box, due: "YYYY-MM-DD"}}` | Flashcard schedule |
| `sp_newToday` | `{date, n}` | New cards introduced today |
| `sp_cardhist` | `{"c01": {right, wrong, last: "YYYY-MM-DD", ok}}` | Per-card answer history for Review missed cards (`ok` = latest answer right) |
| `sp_read` | `[id, …]` (last 1,500) | Read stories |
| `sp_saved` | `{id: item}` | Saved stories (full item copy) |
| `sp_filter` | `"foryou"` etc. | Last news filter |
| `sp_hintDismissed` | `true` | iOS install hint dismissed |
| `sp_examDate` | `"YYYY-MM-DD"` (Brisbane date) | Exam countdown; removed when cleared |
| `sp_muted` | `{sources: [name, …], tags: [tag, …]}` | Muted news sources/tags |
| `sp_xp` | `{total, bySkill: {"1": n, …, "intel": n}, today: {date, xp, reads, q: [qid…], c: [cardId…]}}` | XP, skills and today's per-item XP caps (`today` resets on a new Brisbane day) |
| `sp_courseUrl` | `"https://…"` | Udemy profile/course link; removed when cleared |

**Never rename a key or change its shape without a migration.** Existing progress on the phone would silently reset.

## Data loading
- `data/cysa.json` and `data/news.json` are fetched with `?_=Date.now()` to bypass the GitHub Pages CDN cache (max-age 600).
- News reloads on the ↻ button and whenever the app comes back to the foreground (`visibilitychange`).
- If the fetch fails (offline), the app keeps whatever it last loaded, and the service worker serves the cached copy.

## Service worker
`sw.js` is **network-first**: every same-origin GET tries the network, caches a successful response, and falls back to the cache when offline (finally to `index.html`). The `?_=` cache-buster is stripped from the cache key so offline lookups still match. There's no precache list to maintain. Bump `CACHE_NAME` only if the caching strategy itself changes, since activation deletes all other caches.

## PWA / install
- `manifest.json`: `display: standalone`, theme `#0b1220`, 192/512 icons (`purpose: any maskable`).
- iOS uses `apple-touch-icon` (`icon-180.png`) and the `apple-mobile-web-app-*` meta tags. The status bar is `black-translucent`, which is why the header pads with `safe-area-inset-top`.
- Icons are referenced with `?v=1`. **If the icon art changes, bump `v` everywhere** (index.html ×3, manifest ×2) and re-add the home-screen icon. iOS caches icons aggressively.
- Icons were drawn with Pillow: a teal shield with a pulse line on navy. Regenerate at 1024px and downscale.

## Theme tokens
Dark navy UI with CSS variables on `:root`: `--bg #0b1220`, `--surface #121c2e`, `--surface2 #17243a`, `--border #22314a`, `--text #e6edf7`, `--muted #8da2c0`, `--accent #38e1c8` (teal), `--warn/--au #f5b84b` (amber), `--danger #ff6b6b`, `--ok #5ad08a`. Reuse these rather than adding new colours.

## Gotchas
- **`[hidden]{display:none!important}`** is at the top of the CSS on purpose. `.btn.block` and `.grade` set `display`, which would otherwise override the `hidden` attribute. This caused a real bug where "Show answer" and the grade buttons showed at the same time.
- Everything inserted as HTML goes through `esc()`. News titles and summaries come from third-party feeds, so treat them as untrusted.
- News links use `target="_blank" rel="noopener noreferrer"`.
