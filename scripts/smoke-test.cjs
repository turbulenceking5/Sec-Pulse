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
  const page = await (await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark' })).newPage();
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

  // Daily quests: shown on the Brief, completed once, reset on a new Brisbane day.
  check(await page.locator('#quests .quest').count() === 4, 'Brief shows 4 daily quests');
  const qr = await page.evaluate(() => {
    const x0 = getXP().total, seen = getXP().today.q;
    const fresh = ALL_Q().filter(q => !seen.includes(q.qid)).slice(0, Math.max(0, 10 - seen.length));
    fresh.forEach(q => recordAnswer(q, true));
    const mid = getXP().total; checkQuests(); // a second check must not pay again
    return { done: getQuests().done, bonus: mid - x0 - fresh.length * XP.right, again: getXP().total - mid };
  });
  check(qr.done.includes('q10') && qr.bonus === 30 && qr.again === 0, 'Answering 10 questions completes the quest once (+30 XP)');
  check(await page.locator('#quests .quest.done[data-q=q10]').count() === 1, 'Completed quest is ticked on the Brief');
  check(await page.evaluate(() => { const s = getQuests(); s.date = addDays(todayKey(), -1); store.set('quests', s); return getQuests().done.length === 0; }), 'Quests reset on a new Brisbane day');
  await page.evaluate(() => { const s = getQuests(); s.done = ['q10']; store.set('quests', s); renderQuests(); });

  await page.click('nav button[data-view=news]');
  check(await page.locator('#news-list .news-item').count() > 0, 'News list renders');
  await page.click('.chip[data-f=latest]');
  await page.click('#news-list .save-btn');
  await page.click('.chip[data-f=saved]');
  check(await page.locator('#news-list .news-item').count() === 1, 'Saving a story works');

  // Notes on saved stories.
  await page.click('#news-list .note-btn');
  await page.fill('#news-list .note-edit textarea', 'Check our mail rules for this one');
  await page.click('#news-list .note-save');
  check((await page.textContent('#news-list .note')).includes('Check our mail rules'), 'Note shows on the saved story');
  check(Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem('sp_notes')))).length === 1, 'Note stored in sp_notes');
  await page.fill('#news-search', 'mail rules');
  check(await page.locator('#news-list .news-item').count() === 1, 'Search matches note text');
  await page.fill('#news-search', '');
  await page.screenshot({ path: 'shots/saved-note.png' });

  // Read later: separate from Saved.
  await page.click('.chip[data-f=latest]');
  await page.click('#news-list .news-item >> nth=1 >> .later-btn');
  await page.click('.chip[data-f=later]');
  check(await page.locator('#news-list .news-item').count() === 1, 'Read later list shows the story');
  check(await page.locator('#news-list .note-btn').count() === 0, 'Read later has no note editor (Saved only)');
  await page.click('#news-list .later-btn');
  await page.click('.chip[data-f=later]');
  check((await page.textContent('#news-list')).includes('Nothing in Read later'), 'Removing from Read later empties it');
  await page.click('.chip[data-f=latest]');
  await page.click('#news-list .news-item >> nth=1 >> .later-btn');
  check(await page.evaluate(() => Object.keys(localStorage).filter(k => k === 'sp_later' || k === 'sp_notes').length) === 2, 'Later and notes use sp_ keys (export/import/reset)');

  // Australian-stories quest counts AU stories opened today (popups blocked for the test).
  await page.evaluate(() => { document.addEventListener('click', e => { if (e.target.closest('.news-title')) e.preventDefault(); }, true);
    NEWS.items.slice(0, 3).forEach(i => i.region = 'AU'); newsFilter = 'au'; renderNews(); });
  for (let i = 0; i < 3; i++) await page.click(`#news-list .news-title >> nth=${i}`);
  check((await page.evaluate(() => getQuests())).done.includes('au3'), 'Reading 3 Australian stories completes a quest');
  await page.waitForTimeout(1800); // let the quest toast fire before the refresh toast check below

  // Pull to refresh: synthetic touch drag at the top of News.
  await page.click('.chip[data-f=latest]');
  await page.evaluate(() => { window.__loads = 0; const orig = loadNews; loadNews = (...a) => { window.__loads++; return orig(...a); }; scrollTo(0, 0); });
  const drag = (ys, dx = 0) => page.evaluate(([ys, dx]) => {
    const el = document.querySelector('#news-list');
    const fire = (type, y, x) => { const t = new Touch({ identifier: 1, target: el, clientX: 150 + x, clientY: y });
      el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true })); };
    fire('touchstart', ys[0], 0);
    ys.slice(1).forEach((y, i) => fire('touchmove', y, dx * (i + 1)));
    const label = document.querySelector('#ptr span').textContent, h = parseFloat(document.querySelector('#ptr').style.height) || 0;
    fire('touchend', ys[ys.length - 1], 0);
    return { label, h };
  }, [ys, dx]);
  const shortPull = await drag([100, 130, 160]);
  check(shortPull.h > 0 && shortPull.label === 'Pull to refresh', 'Short pull shows the indicator');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => window.__loads) === 0, 'Short pull does not refresh');
  await drag([100, 110, 120], 40);
  check(await page.evaluate(() => window.__loads) === 0, 'Sideways swipe is ignored');
  const longPull = await drag([100, 140, 200, 260, 320]);
  check(longPull.label === 'Release to refresh', 'Long pull says release to refresh');
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'shots/ptr.png' });
  check(await page.evaluate(() => window.__loads) === 1, 'Pull to refresh reloads news');
  await page.waitForTimeout(900);
  const ptrEnd = { toast: await page.textContent('#toast'), h: await page.evaluate(() => document.querySelector('#ptr').offsetHeight) };
  check(/new stor|Up to date|Offline/.test(ptrEnd.toast) && ptrEnd.h === 0, 'Pull to refresh reports and collapses');

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

  // PBQs: hidden without content, then run injected samples (select with a wide exhibit, order).
  await page.click('nav button[data-view=learn]');
  const realPbqs = await page.evaluate(() => { const n = Array.isArray(CYSA.pbqs) ? CYSA.pbqs.length : 0; return { n, valid: n ? CYSA.pbqs.filter(validPBQ).length : 0 }; });
  if (realPbqs.n) check(realPbqs.valid === realPbqs.n, `All ${realPbqs.n} PBQs in cysa.json are valid`);
  await page.evaluate(() => { window.__realPbqs = CYSA.pbqs; delete CYSA.pbqs; renderLearn(); });
  check(await page.locator('#pbq-practice').isHidden(), 'PBQ button hidden when cysa.json has no pbqs');
  check(await page.evaluate(() => { startPBQ(); const ok = !!document.querySelector('#pbq-empty'); closeSheet(); return ok; }), 'PBQ practice has an empty state');
  await page.evaluate(() => {
    const wide = 'Oct 14 03:12:44 web01 sshd[2211]: Failed password for invalid user admin from 203.0.113.50 port 51122 ssh2 (attempt 1 of many, very long line to force horizontal scroll)\n'
      + 'Oct 14 03:12:45 web01 sshd[2211]: Failed password for invalid user admin from 203.0.113.50 port 51123 ssh2\nOct 14 03:13:02 web01 sshd[2240]: Accepted password for deploy from 198.51.100.7 port 40022 ssh2';
    CYSA.pbqs = [
      { id: 't1', domain: 1, type: 'select', q: 'Which line shows a successful login?', exhibit: wide, options: ['Line 1', 'Line 2', 'Line 3', 'None'], answer: 2, explain: 'Line 3 is Accepted password.' },
      { id: 't2', domain: 3, type: 'order', q: 'Put the incident response phases in order.', items: ['Preparation', 'Detection and analysis', 'Containment, eradication and recovery', 'Post-incident activity'], explain: 'NIST SP 800-61 order.' },
      { id: 't3', domain: 2, type: 'select', q: 'Which port is the attacker using?', exhibit: 'src=203.0.113.50 dport=22', options: ['22', '80', '443', '3389'], answer: 0, explain: 'dport=22 is SSH.' },
      { id: 'bad', domain: 1, type: 'order', q: 'Invalid: one item', items: ['x'], explain: '' }
    ];
    renderLearn();
  });
  check((await page.textContent('#pbq-practice')).includes('3 scenarios'), 'PBQ button shows valid PBQ count');
  const samplePbqs = await page.evaluate(() => CYSA.pbqs);
  await page.click('#pbq-practice');
  for (let n = 0; n < 3; n++) {
    if (await page.locator('#big-quiz .order-list').count()) {
      check(await page.locator('#big-quiz .mv').count() === 8, 'Order PBQ shows up/down buttons');
      for (let k = 0; k < 20; k++) {
        const order = await page.$$eval('#big-quiz .order-item', els => els.map(e => +e.dataset.i));
        const p = order.findIndex((v, i) => i < order.length - 1 && v > order[i + 1]);
        if (p < 0) break;
        await page.click(`#big-quiz .mv[data-pos="${p}"][data-d="1"]`);
      }
      await page.screenshot({ path: 'shots/pbq-order.png' });
      await page.click('#big-quiz .order-check');
      check(await page.locator('#big-quiz .order-item.correct').count() === 4 && (await page.textContent('#big-quiz .explain')).includes('Correct'), 'Ordering the items correctly scores the PBQ');
    } else {
      const qtext = await page.textContent('#big-quiz .q-text');
      if (qtext.includes('successful login')) {
        const ex = await page.evaluate(() => { const e = document.querySelector('#big-quiz .exhibit'); return { scrolls: e.scrollWidth > e.clientWidth, page: document.documentElement.scrollWidth > innerWidth, sheet: document.querySelector('#sheet').scrollWidth > innerWidth }; });
        check(ex.scrolls && !ex.page && !ex.sheet, 'Wide exhibit scrolls inside its box, not the page');
        await page.screenshot({ path: 'shots/pbq.png' });
        await page.click('#big-quiz .opt:not([data-i="2"]) >> nth=0'); // wrong on purpose
      } else await page.click('#big-quiz .opt[data-i="0"]');
    }
    await page.click('#big-quiz .q-next button');
  }
  check((await page.textContent('#big-quiz')).includes('2 of 3 correct'), 'PBQ round shows a result');
  const pbqHist = await page.evaluate(() => { const h = JSON.parse(localStorage.getItem('sp_qhist')); return { t1: h['pbq:t1'], t2: h['pbq:t2'], weak: weakQuestions().some(q => q.qid === 'pbq:t1'), xp: getXP().today.q.includes('pbq:t2'), last: store.get('quizHistory', []).pop() }; });
  check(pbqHist.t1 && pbqHist.t1.ok === false && pbqHist.t2 && pbqHist.t2.ok === true, 'PBQ answers recorded in sp_qhist');
  check(pbqHist.weak, 'Missed PBQ shows in Review mistakes');
  check(pbqHist.xp && pbqHist.last.type === 'pbq', 'PBQs earn XP and log a pbq round');
  await page.click('#sheet-close');
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
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#big-quiz .order-list').count()) await page.click('#big-quiz .order-check');
    else await page.click('#big-quiz .opt >> nth=0');
    await page.click('#big-quiz .q-next button');
  }
  const scaled = await page.textContent('#scaled');
  check(/≈ \d{3}/.test(scaled) && scaled.includes('Rough guide only') && scaled.includes("doesn't publish"), 'Practice exam shows a scaled estimate with a disclaimer');
  check(await page.evaluate(() => [scaledScore(0, 30), scaledScore(30, 30), scaledScore(24, 30), scaledScore(25, 30)].join()) === '100,900,740,770', 'Scaled estimate maps 0-100% onto 100-900');
  await page.screenshot({ path: 'shots/exam-result.png' });
  await page.click('#sheet-close');

  await page.click('nav button[data-view=cards]');
  check(await page.locator('#flash .opt').count() === 4, 'Flashcard shows 4 answer options');
  const cardId = await page.getAttribute('#flash', 'data-card');
  check(await page.evaluate(() => { const g = id => CYSA.cards.find(c => c.id === id).group; const ids = [...document.querySelectorAll('#flash .opt')].map(b => b.dataset.id); return ids.every(id => g(id) === g(ids[0])); }), 'Flashcard options share one topic group');
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
  check((await page.textContent('#push-card')).trim().length > 0, 'Settings shows the notifications card');
  await page.fill('#course-url', 'https://www.udemy.com/user/example/');
  await page.dispatchEvent('#course-url', 'change');
  await page.click('#open-changelog');
  await page.waitForSelector('#sheet-body .md h3', { timeout: 5000 }).catch(() => {});
  check(await page.locator('#sheet-body .md h3').count() > 0, "What's new renders CHANGELOG.md");
  await page.click('#sheet-close');
  await page.click('#settings-btn');
  await page.click('#open-roadmap');
  await page.waitForSelector('#sheet-body .md li.todo', { timeout: 5000 }).catch(() => {});
  check(await page.locator('#sheet-body .md li.todo').count() > 0, 'Roadmap renders with checkboxes');
  await page.screenshot({ path: 'shots/roadmap.png' });
  await page.click('#sheet-close');

  // Udemy link shows on Learn; lessons link to a YouTube search.
  await page.click('nav button[data-view=learn]');
  check((await page.getAttribute('#course-link a', 'href')) === 'https://www.udemy.com/user/example/', 'Udemy link shows on Learn');
  await page.click('.lesson-row >> nth=1');
  check((await page.getAttribute('#sheet-body .links a >> nth=0', 'href')).startsWith('https://www.youtube.com/results?search_query='), 'Lesson links to a YouTube search');
  await page.click('#sheet-close');

  // XP: earned from the activity above, shown as a rank card, with a profile sheet.
  await page.click('nav button[data-view=brief]');
  const xp = await page.evaluate(() => JSON.parse(localStorage.getItem('sp_xp')));
  check(xp && xp.total > 0 && xp.bySkill && Object.keys(xp.bySkill).length > 0, 'XP is earned and split by skill');
  check((await page.textContent('#rank-card')).includes('Lv'), 'Brief shows the analyst rank card');
  await page.click('#rank-card');
  check((await page.textContent('#sheet-title')) === 'Analyst profile' && await page.locator('.skill').count() === 5, 'Analyst profile shows 5 skills');
  await page.screenshot({ path: 'shots/profile.png' });
  await page.click('#sheet-close');
  // The same question twice in a day earns XP only once.
  const twice = await page.evaluate(() => { const seen = getXP().today.q; const q = ALL_Q().find(x => !seen.includes(x.qid)); const a = recordAnswer(q, true), b = recordAnswer(q, true); return [a, b]; });
  check(twice[0] === 10 && twice[1] === 0, 'A question earns XP once per day');

  // Refresh: spins, then reports instead of silently re-rendering.
  await page.click('#refresh-btn');
  await page.waitForTimeout(900);
  check(/new stor|Up to date|Offline/.test(await page.textContent('#toast')), 'Refresh reports what it found');

  // Light theme: Settings picker, applied before scripts on reload, System follows the OS.
  await page.click('#settings-btn');
  await page.click('#theme-seg button[data-t=light]');
  const th = await page.evaluate(() => ({ t: document.documentElement.dataset.theme, meta: document.querySelector('meta[name=theme-color]').content, k: localStorage.getItem('sp_theme'), bg: getComputedStyle(document.body).backgroundColor }));
  check(th.t === 'light' && th.meta === '#f3f6fa' && th.k === '"light"' && th.bg === 'rgb(243, 246, 250)', 'Light theme applies and is stored in sp_theme');
  await page.screenshot({ path: 'shots/settings-light.png' });
  await page.click('#sheet-close');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.documentElement.dataset.theme) === 'light', 'Light theme survives a reload');
  await page.screenshot({ path: 'shots/brief-light.png' });
  await page.screenshot({ path: 'shots/brief-light-full.png', fullPage: true });
  await page.click('nav button[data-view=news]');
  await page.screenshot({ path: 'shots/news-light.png' });
  await page.click('nav button[data-view=learn]');
  await page.screenshot({ path: 'shots/learn-light.png' });
  await page.evaluate(s => { if (!ALL_PBQ().length) { CYSA.pbqs = s; renderLearn(); } }, samplePbqs);
  await page.click('#pbq-practice');
  await page.screenshot({ path: 'shots/pbq-light.png' });
  if (await page.locator('#big-quiz .order-check').count()) await page.click('#big-quiz .order-check'); else await page.click('#big-quiz .opt >> nth=0');
  await page.screenshot({ path: 'shots/pbq-light-answered.png' });
  await page.click('#sheet-close');
  await page.click('nav button[data-view=cards]');
  await page.screenshot({ path: 'shots/cards-light.png' });
  await page.click('#settings-btn');
  await page.click('#theme-seg button[data-t=system]');
  await page.emulateMedia({ colorScheme: 'light' }); await page.waitForTimeout(150);
  const sysLight = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForTimeout(150);
  const sysDark = await page.evaluate(() => document.documentElement.dataset.theme);
  check(sysLight === 'light' && sysDark === 'dark' && await page.evaluate(() => localStorage.getItem('sp_theme')) === null, 'System theme follows the OS setting');
  await page.click('#sheet-close');
  await page.click('nav button[data-view=brief]');

  check(await page.textContent('#st-streak') === '1', 'Streak is 1 after activity');

  // CVE links and KEV due dates on news cards.
  const card = await page.evaluate(() => newsCard({ id: 'cvetest', title: 'CVE-2026-1111: Example product flaw', link: nvdUrl('CVE-2026-1111'), source: 'CISA KEV', region: 'Global',
    published: new Date().toISOString(), score: 5, tags: ['Actively exploited', 'KEV'], summary: 'Chained with cve-2026-2222. CISA remediation due ' + addDays(todayKey(), 2) + '.' }));
  check(card.includes('https://nvd.nist.gov/vuln/detail/CVE-2026-2222') && !card.includes('>CVE-2026-1111 ↗') && /kev-due[^>]*>Fix by/.test(card) && /pill danger kev-due/.test(card), 'News card links CVEs to NVD and shows the KEV due date');

  // Weakest-domain drill from the Brief.
  check(await page.locator('#focus-card').count() === 1, 'Brief shows the weakest-domain focus card');
  const fd = await page.evaluate(() => focusDomain().d.id);
  await page.click('#focus-card');
  check((await page.textContent('#sheet-title')) === 'Drill · Domain ' + fd && (await page.textContent('#big-quiz .q-progress')).includes('lesson ' + fd + '.'), 'Focus card opens a drill from that domain');
  await page.click('#sheet-close');

  // Timed exam: countdown in the title, auto-finish at zero, abandoned if closed.
  check(await page.evaluate(() => !!$('#timed-exam')), 'Learn has a timed practice exam button');
  await page.evaluate(() => startQuiz(30, true, 3));
  check(/Timed exam · 0:0\d left/.test(await page.textContent('#sheet-title')), 'Timed exam shows a countdown');
  await page.click('#big-quiz .opt >> nth=0');
  await page.waitForTimeout(3600);
  const timedRec = await page.evaluate(() => store.get('quizHistory', []).pop());
  check((await page.textContent('#time-used')).includes("29 unanswered") && timedRec.timed && timedRec.expired && timedRec.t === 30, "Timed exam ends at zero and logs a timed, expired round");
  await page.click('#sheet-close');
  const nHist = await page.evaluate(() => store.get('quizHistory', []).length);
  await page.evaluate(() => startQuiz(30, true, 2)); await page.click('#sheet-close'); await page.waitForTimeout(2600);
  check(await page.evaluate(() => store.get('quizHistory', []).length) === nHist, 'Closing a timed exam abandons it');

  // Acronym drill on Cards: doesn't touch the schedule.
  await page.click('nav button[data-view=cards]');
  await page.click('#card-acro');
  const acroId = await page.getAttribute('#flash', 'data-card');
  check((await page.textContent('#cards-area')).includes('· acronyms') && await page.evaluate(id => CYSA.cards.find(c => c.id === id).group, acroId) === 'acronym', 'Acronym drill runs acronym cards');
  const hadSched = await page.evaluate(id => !!store.get('cards', {})[id], acroId);
  await page.click('#flash .opt >> nth=0');
  check(await page.evaluate(id => !!store.get('cards', {})[id], acroId) === hadSched, "Acronym drill doesn't change the card schedule");
  await page.evaluate(() => { cardQueue = null; cardRound = null; renderCards(); });
  await page.click('nav button[data-view=brief]');

  // Achievements, heatmap and accuracy trend on the profile.
  check(await page.evaluate(() => !!(getBadges() || {})['first-q']), 'First-answer achievement is earned');
  await page.click('#rank-card');
  check(await page.locator('#badges .badge-tile').count() === await page.evaluate(() => BADGES().length), 'Profile lists achievements');
  const heat = await page.evaluate(() => ({ n: document.querySelectorAll('#heatmap i').length, today: getDays()[todayKey()] > 0 }));
  check(heat.n === 17 * 7 && heat.today, 'Profile heatmap shows 17 weeks with today active');
  check(await page.locator('#trend circle').count() >= 2, 'Profile shows the quiz accuracy trend');
  await page.screenshot({ path: 'shots/profile-history.png', fullPage: true });
  await page.click('#sheet-close');

  // Streak freeze: earned once a day, covers exactly one missed day.
  const fz = await page.evaluate(() => {
    const t = todayKey(), saved = store.get('streak'), savedF = store.get('freeze', null);
    store.set('freeze', { n: 0, used: [] });
    const e1 = earnFreeze(), e2 = earnFreeze();
    store.set('streak', { last: addDays(t, -2), count: 5, best: 5 });
    const shown = currentStreak(); markActivity();
    const after = { s: store.get('streak'), f: getFreeze() };
    store.set('streak', { last: addDays(t, -3), count: 5, best: 5 }); store.set('freeze', { n: 1, used: [] });
    const gap2 = currentStreak();
    store.set('streak', saved); if (savedF) store.set('freeze', savedF); else store.del('freeze');
    return { e1, e2, shown, count: after.s.count, n: after.f.n, used: after.f.used.includes(addDays(t, -1)), gap2 };
  });
  check(fz.e1 === 'earned' && fz.e2 === '' && fz.shown === 5 && fz.count === 6 && fz.n === 0 && fz.used && fz.gap2 === 0, 'Streak freeze is earned once a day and covers one missed day');

  // Backup nudge: shown with no backup, snoozes, export records the date.
  await page.evaluate(() => { store.del('backup'); const x = getXP(); if (x.total < 100){ x.total = 150; store.set('xp', x); } renderBrief(); });
  check(await page.locator('#backup-nudge').count() === 1, 'Brief nudges a backup when none has been made');
  await page.click('#backup-later');
  check(await page.locator('#backup-nudge').count() === 0 && await page.evaluate(() => getBackup().snooze > todayKey()), 'Remind me later snoozes the backup nudge');
  await page.evaluate(() => { store.del('backup'); exportBackup(); renderBrief(); });
  check(await page.evaluate(() => getBackup().last === todayKey()) && await page.locator('#backup-nudge').count() === 0, 'Export records the backup date');

  // This morning's brief: the pushed copy (from the service worker's cache) opens from #today, with links filled from news.json.
  await page.evaluate(async () => {
    const items = NEWS.items.slice(0, 3).map(i => ({ id: i.id, title: i.title, source: i.source, region: i.region, published: i.published }));
    const b = { date: todayKey(), generated: new Date().toISOString(), title: 'test', items, stats: { recent: 9, au: 1, kev: 0 }, lesson: { id: CYSA.lessons[0].id, title: CYSA.lessons[0].title } };
    await (await caches.open('sec-pulse-push')).put('push-brief.json', new Response(JSON.stringify(b)));
    location.hash = '#today';
  });
  await page.waitForTimeout(800);
  const tb = await page.evaluate(() => ({ title: $('#sheet-title').textContent, n: document.querySelectorAll('#today-brief .news-item').length,
    links: [...document.querySelectorAll('#today-brief .news-title')].every((a, k) => a.href === NEWS.items[k].link), lesson: !!$('#today-lesson-btn'), qotd: !!$('#today-qotd .opt'), hash: location.hash }));
  check(tb.title === "This morning's brief" && tb.n === 3 && tb.links && tb.lesson && tb.qotd && tb.hash === '#brief', "#today opens This morning's brief with the pushed stories, links, lesson and question");
  await page.screenshot({ path: 'shots/today-brief.png' });
  await page.click('#sheet-close');
  await page.evaluate(() => renderTodayLink()); await page.waitForTimeout(300);
  check(await page.locator('#today-open').count() === 1, "Brief tab links to this morning's brief");
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'No horizontal scroll');
  check(errors.length === 0, 'No console/page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));

  await browser.close();
  process.exit(fails.length ? 1 : 0);
})();
