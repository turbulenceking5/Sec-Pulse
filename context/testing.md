# Testing

There's no CI test suite. Before pushing a change, run whichever of these apply.

## 1. Data and scripts (always, if you touched them)

```bash
# Study content is valid and every question has 4 options
python3 -c "import json;d=json.load(open('data/cysa.json'));qs=[q for l in d['lessons'] for q in l['quiz']];assert all(len(q['options'])==4 and 0<=q['answer']<4 for q in qs);print(len(d['lessons']),'lessons',len(qs),'questions',len(d['cards']),'cards')"

# sources.json is valid and the fetcher runs (prints OK/ERR per source)
python3 scripts/fetch_news.py

# The brief and weekly digest build
python3 scripts/send_brief.py --dry-run
python3 scripts/send_digest.py --dry-run
```

The smoke test also validates every entry in `cysa.json`'s `pbqs` array against the schema in [study-content.md](study-content.md).

`fetch_news.py` overwrites `data/news.json`. That's fine to commit (the Action would overwrite it anyway), but a sandbox that blocks some feeds produces a thinner file than GitHub would. Either commit it or `git checkout data/news.json` afterwards.

## 2. Automated smoke test (UI changes)

```bash
python3 -m http.server 8765 &
node scripts/smoke-test.cjs            # NODE_PATH=$(npm root -g) node … for a global Playwright
```

It drives the app at iPhone 13 size (dark system theme) with about 98 checks covering: top stories, question of the day, exam countdown, save/filter, read later and notes, EPSS and "+N more sources", why-ranked and mutes, pull to refresh, lesson quiz completion, Review mistakes, PBQ practice (select and order, exhibit scrolling, history, XP), the 30-question practice exam and its scaled estimate, multiple-choice flashcards and missed-card review, daily quests (completion, paid once, daily reset), XP, CVE links and KEV due dates, the weakest-domain drill, the timed exam (countdown, expiry, abandon), the acronym drill, achievements, the activity heatmap and accuracy trend, streak freezes, the backup nudge, this morning's brief (#today), the How to use guide, upcoming events (order, past hidden, Queensland marked, .ics), Settings feed health, the light/dark/system theme, the streak, no horizontal scroll, and no console errors. Screenshots land in `shots/` (gitignored). **Look at them.** The script can't judge layout.

Set `CHROMIUM_PATH` to use a specific Chromium binary, or `BASE_URL` to test the live site (`BASE_URL=https://turbulenceking5.github.io/Sec-Pulse/`). Note that testing the live site leaves no progress behind, because each run uses a fresh browser profile.

## 3. Manual checklist on a real phone (after deploying)

- [ ] Home-screen app opens full-screen, with header and nav clear of the notch and home indicator.
- [ ] "updated Xh ago" is under 3–4 hours.
- [ ] Tapping a story opens it, and returning shows it dimmed.
- [ ] Settings → Feed health: only the known ⚠️ entries (see [news-pipeline.md](news-pipeline.md#known-feed-issues)).
- [ ] A lesson, a quiz and a few cards still save progress after force-closing and reopening.
- [ ] Airplane mode: the app still opens and shows the last news.
- [ ] After changing workflows: **Actions → Morning brief → Run workflow** delivers a notification.

## 4. Workflows

YAML mistakes only show up when the workflow runs. After editing `.github/workflows/*.yml`, trigger it with **Run workflow** and check that the run is green and (for fetch) that a "Update news feed" commit appears.
