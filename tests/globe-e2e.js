// 지구촌 탐험대 자동 테스트: 교사 화면 1개 + 학생 3명(1명은 🌟 쉬운 화면)이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/globe-e2e.js   (다른 주소: URL=http://localhost:8000/globe/ node tests/globe-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/globe/';
const SHOTS = process.env.SHOTS || '';
const N = 3;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 900);
  await T.goto(URL + '#teacher');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const S = [];
  for (let n = 1; n <= N; n++) {
    const p = await mk('학생' + n, 820, 1100);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(n)); await p.fill('#cw-name', `학생${n}`);
    await p.click('#enter');
    S.push(p);
  }
  await S[0].waitForSelector('.cw-wait', { timeout: 15000 }).catch(() => fail('시작 전 대기 화면이 안 보임'));
  await shot(S[0], 's-wait');
  await T.click('#ppl button[data-ez="3"]');
  await T.click('.cw-go');
  await S[0].waitForSelector('.cw-wait', { state: 'detached', timeout: 10000 }).catch(() => fail('시작 뒤에도 대기 화면'));
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 20000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  // 1단계: 단서 4개 → 대륙 → 두영이 후보 → 하는 일
  const ANS = { c1: 'af', c2: 'sa', c3: 'oc', c4: 'na', d1: 'as' };
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < 5; i++) {
      await p.waitForSelector('.wmap button:not([disabled])', { timeout: 10000 });
      const id = ['c1', 'c2', 'c3', 'c4', 'd1'][i];
      if (k === 0 && i === 0) await shot(p, 's1-map');
      if (k === 2 && (await p.$$('.wmap button:not([disabled])')).length !== 2) fail('쉬운 화면 지도 대륙이 2개가 아님');
      if (k === 0 && i === 1) { await p.click(`.wmap button:not([data-c="${ANS[id]}"]):not([disabled])`); await p.waitForTimeout(200); }
      await p.click(`.wmap button[data-c="${ANS[id]}"]`);
      if (i < 4) { await p.waitForSelector('#next', { timeout: 10000 }); if (k === 0 && i === 0) await shot(p, 's1-clue'); await p.click('#next'); }
      else await p.waitForTimeout(1200);
    }
    await p.waitForSelector('.cands button', { timeout: 10000 });
    if (k === 0) await shot(p, 's1-cands');
    if (k === 2 && (await p.$$('.cands button')).length !== 2) fail('쉬운 화면 후보가 2명이 아님');
    await p.click('.cands button[data-k="가"]');
    await p.waitForSelector('.opts button', { timeout: 10000 });
    await p.click('.opts button[data-o="사람들과 함께 나무를 심고 있어요."]');
  }));
  await cnt(N);
  await T.click('#wrongT');
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('1단계 틀린 학생 이름이 안 보임');
  if (!/두영이를 찾은 순서/.test(await T.textContent('#main'))) fail('두영이 찾은 순서가 안 보임');
  await shot(S[0], 's1-done'); await shot(T, 't1');
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < 7; i++) {
      await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
      const a = await p.evaluate(() => { const q = document.querySelector('.q').textContent; const pg = document.querySelector('.hint b').textContent; return BL.find(b => b.q === q && b.p === pg).a; });
      if (k === 1 && i === 2) { await p.click(`.opts button:not([data-o="${a}"])`); await p.waitForTimeout(200); }
      await p.click(`.opts button[data-o="${a}"]`);
      await p.waitForTimeout(1100);
    }
    await p.waitForSelector('.vote button', { timeout: 10000 });
    await p.click(`.vote button[data-k="k${k + 1}"]`);
  }));
  await cnt(N);
  if (!/\(3명\)/.test(await T.textContent('#main'))) fail('기대되는 내용 집계가 안 맞음');
  if (!/학생2/.test(await T.textContent('#qstat'))) fail('2단계 틀린 학생 이름이 안 보임');
  await shot(S[1], 's2-done'); await shot(T, 't2');
  // 3단계
  await T.click('#tsteps button[data-s="3"]');
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#send', { timeout: 10000 });
    await p.click('#wd button[data-w="인구"]'); await p.click('#wd button[data-w="대륙"]');
    if (k === 2) { await p.click('#ez button[data-i="0"]'); }
    else {
      await p.fill('#q3', '');
      await p.click('#send');
      if (!/탐구 질문을 써요/.test(await p.textContent('#fm'))) fail('빈 질문 안내가 안 나옴');
      await p.fill('#q3', k === 0 ? '대륙마다 인구가 다른 까닭은 무엇일까요' : '인구가 가장 많은 대륙은 어디일까요?');
    }
    if (k === 0) await shot(p, 's3-write');
    await p.click('#send');
    await p.waitForSelector('#edit', { timeout: 10000 });
  }));
  await cnt(N);
  await S[0].waitForFunction(() => document.querySelectorAll('.qlist button').length === 2, null, { timeout: 10000 }).catch(() => fail('친구 질문 목록이 2개가 아님'));
  await S[0].click('.qlist button[data-n="2"]');
  await S[2].waitForSelector('.qlist button[data-n="2"]', { timeout: 10000 });
  await S[2].click('.qlist button[data-n="2"]');
  await T.waitForFunction(() => /⭐ 2/.test(document.querySelector('#main').textContent), null, { timeout: 10000 }).catch(() => fail('TV 별 집계가 안 맞음'));
  if (!/까닭은 무엇일까요\?/.test(await T.textContent('#main'))) fail('물음표가 붙지 않음');
  await shot(S[0], 's3-star'); await shot(T, 't3');
  // 4단계
  await T.click('#tsteps button[data-s="4"]');
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < 7; i++) {
      await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
      const a = await p.evaluate(() => QZ.find(z => z.q === document.querySelector('.q').textContent).a);
      if (k === 0 && i === 2) { await p.click(`.opts button:not([data-o="${a}"])`); await p.waitForTimeout(200); }
      await p.click(`.opts button[data-o="${a}"]`);
      await p.waitForTimeout(2400);
    }
  }));
  await cnt(N);
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('4단계 틀린 학생 이름이 안 보임');
  await T.click('#award');
  if (!/시상식/.test(await T.textContent('#main'))) fail('시상식이 안 보임');
  await shot(S[0], 's4-done'); await shot(T, 't4-award');
  await T.click('#allT');
  if ((await T.$$('#qstat .qrow')).length !== 21) fail('모든 단계 문제 수가 21개가 아님');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
