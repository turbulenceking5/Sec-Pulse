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
  await page.screenshot({ path: 'shots/brief.png' });
  check(await page.locator('#brief-top .news-item').count() > 0, 'Brief shows top stories');
  await page.click('#brief-qotd .opt');
  check(!(await page.locator('#brief-qotd .explain').isHidden()), 'Question of the day shows explanation');

  await page.click('nav button[data-view=news]');
  check(await page.locator('#news-list .news-item').count() > 0, 'News list renders');
  await page.click('.chip[data-f=latest]');
  await page.click('#news-list .save-btn');
  await page.click('.chip[data-f=saved]');
  check(await page.locator('#news-list .news-item').count() === 1, 'Saving a story works');
  await page.screenshot({ path: 'shots/news.png' });

  await page.click('nav button[data-view=learn]');
  await page.click('.lesson-row >> nth=0');
  for (let i = 0; i < 3; i++) { await page.click('#lesson-quiz .opt >> nth=0'); await page.click('#lesson-quiz .q-next button'); }
  check((await page.textContent('#mark-done')).includes('Completed'), 'Finishing a lesson quiz completes the lesson');
  await page.screenshot({ path: 'shots/lesson.png' });
  await page.click('#sheet-close');
  await page.click('#practice-exam');
  check((await page.textContent('.q-progress')).includes('of 30'), 'Practice exam has 30 questions');
  await page.click('#sheet-close');

  await page.click('nav button[data-view=cards]');
  check(await page.locator('#grade').isHidden(), 'Grade buttons hidden before reveal');
  await page.click('#reveal');
  check(await page.locator('#reveal').isHidden() && !(await page.locator('#grade').isHidden()), 'Reveal swaps buttons');
  await page.click('#grade [data-g=good]');
  await page.screenshot({ path: 'shots/cards.png' });

  await page.click('#settings-btn');
  check(await page.locator('#sheet table tr').count() > 0, 'Settings shows feed health');
  await page.screenshot({ path: 'shots/settings.png' });
  await page.click('#sheet-close');

  await page.click('nav button[data-view=brief]');
  check(await page.textContent('#st-streak') === '1', 'Streak is 1 after activity');
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'No horizontal scroll');
  check(errors.length === 0, 'No console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
