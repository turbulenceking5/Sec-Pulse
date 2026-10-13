// Headless smoke test of the app at iPhone size. Needs Playwright + Chromium.
//   python3 -m http.server 8765 &      (from the repo root)
//   node scripts/smoke-test.cjs        (NODE_PATH=$(npm root -g) if Playwright is installed globally)
// Screenshots go to ./shots/ (gitignored). Exits non-zero on any page error or failed check.
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8765/';
const fs = require('fs');

(async () => {
  fs.mkdirSync('shots', { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const errors = [], fails = [];
  const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails.push(msg); };
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(BASE + 'index.html');
  await page.waitForTimeout(1500);
  check(await page.locator('#brief-top .news-item').count() > 0, 'Brief shows top stories');

  // Review mistakes: empty state first, then answer the question of the day wrong on purpose.
  await page.click('nav button[data-view=learn]');
  await page.click('#review-quiz');
  check(await page.locator('#review-empty').count() === 1, 'Review mistakes shows empty state with no history');
  await page.click('#sheet-close');
  await page.click('nav button[data-view=brief]');
  const qotd = await page.evaluate(() => { const qs = ALL_Q(); const q = qs[(ordinal(todayKey()) * 7) % qs.length]; return { qid: q.qid, answer: q.answer }; });
  await page.click(`#brief-qotd .opt:not([data-i="${qotd.answer}"]) >> nth=0`);
  check(!(await page.locator('#brief-qotd .explain').isHidden()), 'Question of the day shows explanation');
  const hist = await page.evaluate(id => JSON.parse(localStorage.getItem('sp_qhist') || '{}')[id], qotd.qid);
  check(hist && hist.wrong === 1 && hist.ok === false, 'Wrong answer recorded in sp_qhist');
  const qs = await page.evaluate(() => JSON.parse(localStorage.getItem('sp_qstats')));
  check(qs && qs.answered === 1 && qs.byDomain && Object.keys(qs.byDomain).length === 1, 'sp_qstats per-domain totals still recorded');

  // Exam countdown: set a date 30 days out in Settings, check the Brief.
  await page.click('#exam-set');
  const exam = await page.evaluate(() => addDays(todayKey(), 30));
  await page.fill('#exam-date', exam);
  await page.dispatchEvent('#exam-date', 'change');
  await page.click('#sheet-close');
  const examTxt = await page.textContent('#brief-exam');
  check(/30\s*days left/.test(examTxt) && /Today: \d+ lesson/.test(examTxt), 'Brief shows exam countdown and daily target');
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('sp_examDate'))) === exam, 'Exam date stored in sp_examDate');
  await page.screenshot({ path: 'shots/brief.png' });

  await page.click('nav button[data-view=news]');
  check(await page.locator('#news-list .news-item').count() > 0, 'News list renders');
  await page.click('.chip[data-f=latest]');
  await page.click('#news-list .save-btn');
  await page.click('.chip[data-f=saved]');
  check(await page.locator('#news-list .news-item').count() === 1, 'Saving a story works');

  // Optional pipeline fields render when present (injected here since news.json may not have them yet).
  await page.click('.chip[data-f=latest]');
  await page.evaluate(() => { const i = NEWS.items[0]; i.epss = 0.973; i.also = [{ source: 'Outlet A', url: 'https://example.com/a' }, { source: 'Outlet B', url: 'https://example.org/b' }, { source: 'Bad', url: 'javascript:alert(1)' }]; renderNews(); });
  const first = page.locator('#news-list .news-item >> nth=0');
  check((await first.locator('.epss').textContent()).includes('EPSS 97%'), 'EPSS badge renders when present');
  check((await first.locator('.also-btn').textContent()).includes('+2 more sources'), '"+N more sources" renders (unsafe URLs dropped)');
  await first.locator('.also-btn').click();
  check(await first.locator('.also-list li').count() === 2, 'More sources list expands');
  await page.screenshot({ path: 'shots/news.png' });

  // Why this ranked + mute a source.
  const src = await first.getAttribute('data-id').then(id => page.evaluate(id => NEWS.items.find(x => x.id === id).source, id));
  await first.locator('.why.score').click();
  await page.waitForSelector('#sheet.open .mute-btn');
  check((await page.textContent('#sheet-title')) === 'Why this ranked' && await page.locator('#sheet-body table tr').count() >= 2, 'Why this ranked shows a score breakdown');
  await page.screenshot({ path: 'shots/why.png' });
  await page.click('#sheet-body .mute-btn[data-k=sources]');
  await page.click('#sheet-close');
  const shown = await page.$$eval('#news-list .news-item', (els, s) => els.filter(e => e.querySelector('.news-meta').textContent.includes(s)).length, src);
  check(shown === 0 && await page.locator('#manage-mutes').count() === 1, 'Muted source is hidden from News');
  await page.click('#manage-mutes');
  check(await page.locator('#mute-list .unmute').count() === 1, 'Settings lists the muted source');
  await page.screenshot({ path: 'shots/settings.png' });
  await page.click('#mute-list .unmute');
  check(await page.locator('#mute-list .unmute').count() === 0, 'Unmuting from Settings works');
  await page.click('#sheet-close');
  check(await page.locator('#manage-mutes').count() === 0, 'Unmuted source shows again');

  await page.click('nav button[data-view=learn]');
  await page.click('.lesson-row >> nth=0');
  for (let i = 0; i < 3; i++) { await page.click('#lesson-quiz .opt >> nth=0'); await page.click('#lesson-quiz .q-next button'); }
  check((await page.textContent('#mark-done')).includes('Completed'), 'Finishing a lesson quiz completes the lesson');
  await page.screenshot({ path: 'shots/lesson.png' });
  await page.click('#sheet-close');
  check((await page.textContent('#review-quiz')).match(/· \d+/), 'Learn shows review count');
  await page.click('#review-quiz');
  check(await page.locator('#big-quiz .opt').count() === 4, 'Review mistakes quiz starts with missed questions');
  await page.screenshot({ path: 'shots/review.png' });
  await page.click('#sheet-close');
  await page.click('#practice-exam');
  check((await page.textContent('.q-progress')).includes('of 30'), 'Practice exam has 30 questions');
  await page.click('#sheet-close');

  await page.click('nav button[data-view=cards]');
  check(await page.locator('#flash .opt').count() === 4, 'Flashcard shows 4 answer options');
  const cardId = await page.getAttribute('#flash', 'data-card');
  await page.click(`#flash .opt:not([data-id="${cardId}"])`); // answer wrong on purpose
  check(await page.locator('#flash .opt.wrong').count() === 1 && await page.locator('#flash .opt.correct').count() === 1, 'Wrong card answer is marked');
  await page.click('#card-next-btn');
  check((await page.textContent('#card-review')).includes('· 1'), 'Missed card is remembered');
  await page.click('#card-review');
  check(await page.getAttribute('#flash', 'data-card') === cardId && (await page.textContent('#flash')).includes('Missed 1×'), 'Missed-card review re-asks it');
  await page.click(`#flash .opt[data-id="${cardId}"]`);
  check((await page.textContent('#flash .explain')).includes('Improved'), 'Getting a missed card right shows improvement');
  await page.screenshot({ path: 'shots/cards.png' });

  await page.click('#settings-btn');
  check(await page.locator('#sheet table tr').count() > 0, 'Settings shows feed health');
  await page.click('#sheet-close');

  await page.click('nav button[data-view=brief]');
  check(await page.textContent('#st-streak') === '1', 'Streak is 1 after activity');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'No horizontal scroll');
  check(errors.length === 0, 'No console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
