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
- **Analyst rank card** (`renderRank()`): level, rank title, XP bar, XP earned today. Tap it for the profile sheet. See [gamification.md](gamification.md).
- **Daily quests** (`renderQuests()`, under the rank card): four optional bonus goals that reset on the Brisbane date. See [gamification.md](gamification.md#daily-quests).
- **Exam countdown** (`renderExam()`): with `sp_examDate` set, a card shows days left (`ordinal(exam) - ordinal(today)`, both Brisbane dates) and a suggested target for today: `ceil(unfinished lessons / days left)` lessons, plus cards due and up to 10 review-mistakes questions. All lessons done → suggests a practice exam. Day 0 → "Exam day"; past date → asks to update it. With no date, a small link opens Settings at the date field. Tapping the card does the same.
- **Focus area** (`renderFocus()`, `focusDomain()`, under the exam card): the domain with the biggest `(1 - accuracy) × exam weight`, from `sp_qstats.byDomain`. Domains with fewer than `FOCUS_MIN` (5) answers count as 0%, so the heaviest unpractised domain comes first. Tapping it runs a **domain drill** (`startDrill()`): `DRILL_N` (10) questions from that domain, missed ones first, then unseen, then the rest; logged as `type: "drill"` with `domain` in `sp_quizHistory`, +10 XP like a quick quiz.
- **This morning's brief** (`openTodayBrief()`, opened by `#today`, which is the Web Push notification's URL, or by the "📰 This morning's brief" card `renderTodayLink()` shows on the Brief tab when today's brief exists): the 5 stories exactly as the notification listed them, as news cards with full (unclamped) summaries, plus the 30h stats, the lesson of the day and that day's question of the day. Data from `loadTodayBrief()` (see [notifications.md](notifications.md#this-mornings-brief-tap-target)). It resets the hash to `#brief`, so reopening the app doesn't reopen the sheet. `hashchange` handles the tap when the app is already open.
- **Backup nudge** (`renderBackup()`, above the rank card): once there's 100+ XP and no export in `BACKUP_DAYS` (30) days, a card offers **Export backup** or **Remind me later** (hidden for `BACKUP_SNOOZE` = 7 days). Export (here or in Settings) goes through `exportBackup()`, which records `sp_backup.last`. At boot `persistStorage()` asks for persistent storage (`navigator.storage.persist()`); Settings shows the result and the last backup date. iOS can evict a home-screen app's storage after weeks unused, which is why both exist.
- **Upcoming events**: the next Australian cyber security events (plus the next Queensland one), **See all** for the full list. See [events.md](events.md).
- **Top for you**: 5 highest-`rank()` items from the last 30h (falls back to 72h if fewer than 5), excluding muted sources/tags.
- Pills: items in 24h, Australian count, actively-exploited count, feeds OK.
- **Today's CySA+ lesson**: same pick as the notification (see [morning-brief.md](morning-brief.md)).
- **Question of the day**: `ALL_Q()[(ordinal(today) * 7) % n]`. The morning notification includes the same question (`qotd_for()` in `send_brief.py`), so keep the two picks in sync. Each answer counts toward stats. It re-renders whenever the Brief re-renders (e.g. returning to the app), so it can be answered more than once a day.

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
| ⏱ Later | from `sp_later` (read-later list, separate from Saved) | newest |
| ★ Saved | from `sp_saved` (survives the story ageing out of news.json) | newest |

Search filters on title + summary + source + tags + your note. The list paginates 40 at a time ("Show more"). Opening a story marks it read (dimmed, unread dot removed); ☆ saves it; the clock icon (`.later-btn`) toggles it in **Read later**. Both lists keep a full copy of the item, so stories survive ageing out of news.json, and neither is filtered by mutes.

**Notes on saved stories** (`drawNote()`, `sp_notes`): in the ★ Saved filter each card has "+ Add note" / "✎ Edit note" (inline textarea, max 500 chars, empty = delete). Notes are kept if the story is unsaved, so re-saving brings the note back. On-device only.

**Pull to refresh**: on News, dragging down from `scrollY` 0 grows `#ptr` ("Pull to refresh" → "Release to refresh" past 60px) and on release calls `loadNews(true)` (same toast as ↻). Listeners are on `#view-news` only; sideways swipes (filter chips) and upward scrolls are ignored, and `preventDefault` only runs once a downward pull is under way, so normal scrolling is untouched. `html.ptr-on` (News only) sets `overscroll-behavior-y: contain` so Chrome's own pull-to-reload doesn't fire too.

**Why this ranked** (`openWhy()` / `explainScore()`): each card shows a `score N` pill; tapping it or the tag row opens a sheet with the score breakdown. news.json items don't store which terms matched, so the app fetches `scripts/sources.json` (lazily, once) and re-runs `fetch_news.py`'s `score()` logic client-side: source weight (by `feed` name) + each keyword group whose terms appear in title/summary (weight, +1 if in the headline, matched terms listed) + 2 if `region == "AU"`. Tags not explained by a keyword match (e.g. KEV's `Actively exploited`/`KEV`) show as "tagged by the feed itself, +0". If the rebuilt total differs from the stored `score` (keywords edited since the fetch), a note says so. Offline / fetch failure falls back to listing the tags. **If `score()` or the EPSS bump in `fetch_news.py` changes, update `explainScore()` to match** (it's display-only; `rank()` is untouched).

**Mute** (`sp_muted`): the Why sheet has Mute/Unmute buttons for the story's `source` (the outlet name shown on the card, not the `feed`) and each of its tags. Muted items are filtered out of Brief's Top for you and every News filter except ★ Saved; News shows "N hidden by mutes · Manage" when anything was filtered. Settings lists mutes as tappable pills to unmute.

**Optional fields** (forward-compatible; rendered only if present and valid):
- `epss` (number 0–1): a pill `EPSS 97%` in the meta row (`<1%` below 1%), red at ≥ 50%.
- `also` (array of `{source, url}`): a "+N more sources" toggle under the summary expanding to links. Entries whose `url` isn't `http(s)://` are dropped; a missing `source` falls back to the URL's hostname.

**CVE links and KEV due dates** (`cvesOf()`, `kevDuePill()`): up to 3 CVE IDs found in a story's title/summary show as `CVE-… ↗` pills linking to NVD (skipping the one the headline already links to). KEV items show `Fix by 16 Oct` (red within 3 days, `· overdue` after), parsed from the `CISA remediation due YYYY-MM-DD.` sentence `fetch_news.py` writes into KEV summaries. **Keep that wording if `parse_kev()` changes.**

Tag colours: red (`hot`) for Actively exploited / KEV / Ransomware, teal (`re`) for Real estate / BEC. The `Australia` tag is hidden on cards because the AU pill already shows it.

### Learn
- Exam card: lessons done / total, overall quiz accuracy, progress bar.
- **Quick quiz**: 10 random questions from all lessons.
- **Practice exam**: 30 questions spread across domains by exam weight (33/30/20/17% → 10/9/6/5 questions). Results go to `sp_quizHistory`.
- **Timed practice exam** (`startQuiz(30, true, EXAM_SECS)`): the same exam with a 58-minute limit (the real CS0-003 allows 165 minutes for up to 85 questions; 30 at that pace ≈ 58). `renderQuiz`'s `opts.timeLimit` counts down in the sheet title via `opts.onTick`; at zero the round ends and unanswered questions count as wrong. Closing the sheet abandons the attempt (nothing is logged). The result shows time used, and history gets `timed`, `secs` and `expired`.
- **Practice exam scaled estimate** (`scaledScore()` / `scaledHtml()`): after a practice exam, a "Rough scaled estimate" box maps the percentage onto 100-900 in a straight line (0% = 100, 100% = 900, so 750 ≈ 81%), rounded to 10, green at ≥ 750. It says plainly that CompTIA doesn't publish its conversion. It isn't stored (it's derivable from `c`/`t` in `sp_quizHistory`).
- **PBQ practice** (`startPBQ()`, `ALL_PBQ()`, `validPBQ()`): runs `cysa.json`'s optional `pbqs` array, 5 per round (`PBQ_ROUND`), unseen first, then latest-wrong, then the rest. The button is hidden when there are no valid PBQs (missing/empty array), and `startPBQ()` has an empty state. Invalid entries (unknown `type`, bad `answer`, fewer than 2 items/options) are skipped. Each PBQ gets `qid` `pbq:<id>`, so answers go into `sp_qstats`/`sp_qhist` and missed PBQs appear in Review mistakes. Rounds log `type: "pbq"` in `sp_quizHistory`. See the quiz engine for how they render.
- **Review mistakes** (`startReview()` / `weakQuestions()`): up to 10 questions from `sp_qhist` whose latest answer was wrong or that have been missed more often than answered right. Ordered latest-wrong first, then most net misses, then most recent; the picked 10 are shuffled. A question drops off once right outnumbers wrong and the latest answer was right. The button shows the count; with no history it opens an empty-state card. Results go to `sp_quizHistory` with `type: "review"`. Includes PBQs (`pbq:<id>`). Question IDs (`<lesson id>#<index>` or `pbq:<id>`) that no longer exist in cysa.json are ignored.
- **Udemy link** (`sp_courseUrl`): an "Open my Udemy" button under Review mistakes once set in Settings, otherwise a link to set it. Only `https://` URLs are accepted. It's stored on the device, never in the repo (see [opsec.md](opsec.md)).
- Lessons grouped by domain, with ✓ when done and the lesson-quiz score.
- **Lesson sheet**: summary, key points, Exam tip box (teal), On the job box (amber), **▶ Videos on this topic** (a YouTube *search* for "CompTIA CySA+ CS0-003 <lesson title>", via `ytSearch()`; deliberately not hand-picked videos, which get deleted or go stale), 🎓 My Udemy if set, and a 3-question quiz. Finishing the quiz or tapping **Mark as complete** marks the lesson done.

### Cards
Multiple choice on top of Leitner spaced repetition:
- Each card shows its `front` and 4 answers: its own `back` plus 3 other cards' backs (`cardOptions()`). Distractors come from the same topic `group` in cysa.json (e.g. `models` for Kill Chain / Diamond / STRIDE / NIST IR, or `port`, `event-id`, `nmap`), so all four options are the same kind of answer. Only if a group has fewer than 4 cards does it fall back to the same domain (excluding the `nmap`/`port`/`event-id` groups, `ID_GROUPS`), then anywhere. `maskBack()` blanks each option's own identifiers (port numbers, flags, event IDs, acronyms from its front) as `___`, so an option can't be matched just by spotting the number. The full, unmasked back shows as the explanation after answering.
- Boxes 1-5 with review intervals `[_, 1, 3, 7, 14, 30]` days (`INTERVALS[box]`). **Right** → box +1. **Wrong** → box 1, due today, and re-asked once at the end of the current round (with fresh options).
- **Missed cards** (`sp_cardhist`, `missedCards()`): every answer (scheduled, cram or review) is recorded per card. A card counts as missed while its latest answer was wrong or it's been wrong more often than right (the same rule as Review mistakes). **Review missed cards · N** runs up to 10 of them without touching the schedule. The card shows "Missed N× before"; getting a previously-missed card right shows **Improved! ✓**. The Brief's exam target includes missed cards.
- **8 new cards per day** (`NEW_PER_DAY`), tracked in `sp_newToday`. Cards are introduced in `cysa.json` order.
- **Acronym drill** (`#card-acro`): 10 random cards from the `acronym` group, run like cram (mode `acronyms`, no schedule change). Shown whenever the deck has acronym cards; the acronym cards also join the normal deck as new cards.
- When caught up: a **Cram 10** button runs random cards without touching the schedule. Finishing a review or cram round returns to the scheduled queue.
- The nav badge shows the number of due cards.

### Settings sheet
**How to use**, **What's new** and **Roadmap** buttons (`openDoc()`) fetch `GUIDE.md`, `CHANGELOG.md` and `context/roadmap.md` and render them with `miniMd()`: `##` headings, `-` bullets, `[ ]`/`[x]` checkboxes, `**bold**` and `` `code` ``. Links show as plain text, since the docs' relative links point at other `.md` files. It works because `.nojekyll` makes Pages serve `.md` files raw. Keep all three files to that simple subset. Then: **Appearance** (System / Dark / Light, see [Theme](#theme-tokens)), exam date (`<input type="date">` + Clear, saved on change to `sp_examDate`), Udemy link (`sp_courseUrl`), muted sources/tags (tap to unmute), **Notifications on this phone** (Web Push: turn on, copy the subscription code for GitHub, test, turn off; see [notifications.md](notifications.md#web-push)), ntfy setup steps (with a random topic suggestion), feed health table, Export / Import / Reset progress, About. `openSettings('exam-date')` scrolls to the date field.

## Quiz engine: `renderQuiz(root, questions, opts)`
- One question at a time. **Option order is shuffled on every render**, so the `answer` index in the JSON can be anything.
- `exhibit` (optional, PBQs): rendered as `<pre class="exhibit">`, monospace, `white-space: pre`, scrolling sideways inside its own box so the page never scrolls horizontally.
- `type: "order"` (PBQs): `items` are stored in the correct order, displayed shuffled (never already solved), and moved with ▲/▼ buttons (40px, no drag library; focus follows the moved item). **Check order** marks each row right/wrong; it's correct only if every item is in place, otherwise it says "N of M in the right place" and lists the correct order under the explanation.
- After answering: correct/incorrect highlight, explanation, Next / See result.
- `opts.single`: no Next button (question of the day).
- `opts.onDone(correct, total, timing)`: called after the result screen (`timing` = `{secs, expired}` for timed rounds, else null).
- `opts.timeLimit` / `opts.onTick(secondsLeft)`: optional countdown (see Timed practice exam).
- Every answer → `recordAnswer()` updates `sp_qstats` (overall and per-domain), `sp_qhist` (per question, when the question has a `qid`, which all three quiz entry points set) and the streak.
- Result messages: ≥80% "Exam-ready territory", ≥65% "Close", else "Keep going". These are rough guides; the real exam is scaled 100–900, with 750 to pass.

## XP, ranks, quests, achievements and streak
The game layer (XP, levels, ranks, skills, daily quests, achievements, streak and streak freezes, the profile's heatmap and accuracy trend) is documented in [gamification.md](gamification.md).

## localStorage keys
All keys are prefixed `sp_` (Export, Import and Reset rely on the prefix). Every access goes through `store.get`/`store.set`/`store.del`, which wrap `JSON.parse`/`stringify` in try/catch so private browsing can't crash the app.

| Key | Shape | Purpose |
|---|---|---|
| `sp_streak` | `{last: "YYYY-MM-DD", count, best}` | Day streak |
| `sp_lessons` | `{"1.5": {date, score}}` | Completed lessons |
| `sp_qstats` | `{answered, correct, byDomain: {"1": {a, c}}}` | Quiz accuracy |
| `sp_qhist` | `{"1.5#0": {right, wrong, last: "YYYY-MM-DD", ok}}` | Per-question history for Review mistakes (`ok` = latest answer correct) |
| `sp_quizHistory` | `[{date, c, t, type: "quick"\|"exam"\|"review"\|"pbq"\|"drill"}]` (last 100); drills add `domain`, timed exams add `timed: true, secs, expired` | Quiz results |
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
| `sp_quests` | `{date, au: [storyId…], lessons: [lessonId…], done: [questId…]}` | Today's daily-quest progress (Australian stories opened, lessons finished) and quests already paid; ignored once `date` isn't today (Brisbane) |
| `sp_later` | `{id: item}` | Read-later list (full item copy), separate from Saved |
| `sp_notes` | `{id: "text"}` | Notes on saved stories (max 500 chars each) |
| `sp_theme` | `"dark"` \| `"light"` | Theme override; absent = follow the system |
| `sp_badges` | `{badgeId: "YYYY-MM-DD"}` | Achievements earned and when |
| `sp_days` | `{"YYYY-MM-DD": xp}` (last 400 days) | XP per Brisbane day for the heatmap (1 = active day seeded from older data) |
| `sp_freeze` | `{n, used: ["YYYY-MM-DD"…], earned: "YYYY-MM-DD"}` | Streak freezes held, days they covered, last day one was earned |
| `sp_backup` | `{last: "YYYY-MM-DD", snooze: "YYYY-MM-DD"}` | Last export and backup-nudge snooze |

**Never rename a key or change its shape without a migration.** Existing progress on the phone would silently reset.

## Data loading
- `data/cysa.json` and `data/news.json` are fetched with `?_=Date.now()` to bypass the GitHub Pages CDN cache (max-age 600).
- News reloads on the ↻ button and whenever the app comes back to the foreground (`visibilitychange`).
- If the fetch fails (offline), the app keeps whatever it last loaded, and the service worker serves the cached copy.

## Service worker
`sw.js` is **network-first**: every same-origin GET tries the network, caches a successful response, and falls back to the cache when offline (finally to `index.html`). The `?_=` cache-buster is stripped from the cache key so offline lookups still match. There's no precache list to maintain. Bump `CACHE_NAME` only if the caching strategy itself changes, since activation deletes all other caches. It also handles `push` and `notificationclick` for Web Push (see [notifications.md](notifications.md#web-push)).

## PWA / install
- `manifest.json`: `display: standalone`, theme `#0b1220`, 192/512 icons (`purpose: any maskable`).
- iOS uses `apple-touch-icon` (`icon-180.png`) and the `apple-mobile-web-app-*` meta tags. The status bar is `black-translucent`, which is why the header pads with `safe-area-inset-top`.
- Icons are referenced with `?v=1`. **If the icon art changes, bump `v` everywhere** (index.html ×3, manifest ×2) and re-add the home-screen icon. iOS caches icons aggressively.
- Icons were drawn with Pillow: a teal shield with a pulse line on navy. Regenerate at 1024px and downscale.

## Theme tokens
Dark navy UI with CSS variables on `:root`: `--bg #0b1220`, `--surface #121c2e`, `--surface2 #17243a`, `--border #22314a`, `--text #e6edf7`, `--muted #8da2c0`, `--accent #38e1c8` (teal), `--warn/--au #f5b84b` (amber), `--danger #ff6b6b`, `--ok #5ad08a`, plus tints `--accent-dim/--accent-line`, `--warn-dim/--warn-line`, `--danger-dim/--danger-line`, `--ok-dim`, `--on-accent` (text on teal buttons) and `--glass` (header/nav/sheet-head backdrop). **Every colour goes through these variables**, because the light theme just redefines them; don't hard-code a hex/rgba in a rule.

**Light theme**: `:root[data-theme=light]` overrides every token (white surfaces, darker teal `#077a6b`, darker amber/red/green for contrast) and `color-scheme`. A small `<script>` in `<head>` (before the stylesheet, so there's no flash) reads `sp_theme` straight from localStorage, resolves System via `prefers-color-scheme`, sets `data-theme`, the `theme-color` meta (`#f3f6fa` light / `#0b1220` dark) and `apple-mobile-web-app-status-bar-style` (`default` light / `black-translucent` dark; iOS only reads that at launch, so the status bar matches from the next open). It exposes `applyTheme()`, which Settings, Import and Reset call, and listens for system theme changes. The manifest's `theme_color` stays dark (it's fixed at install).

## Gotchas
- **`[hidden]{display:none!important}`** is at the top of the CSS on purpose. Rules like `.btn.block` set `display`, which would otherwise override the `hidden` attribute (it once caused two sets of buttons to show at once).
- Everything inserted as HTML goes through `esc()`. News titles and summaries come from third-party feeds, so treat them as untrusted.
- News links use `target="_blank" rel="noopener noreferrer"`.
