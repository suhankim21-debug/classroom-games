// 인구 피라미드 탐험대 자동 테스트: 교사 화면 1개 + 학생 3명(1명은 🌟 쉬운 화면)이 실제 Firebase 방에서 1~2단계를 끝까지 해 봐요.
// 실행: node tests/pyramid-e2e.js   (다른 주소: URL=http://localhost:8000/pyramid/ node tests/census-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/pyramid/';
const SHOTS = process.env.SHOTS || '';
const N = 3;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
let showOn = false;
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
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 30000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  // 답은 페이지 데이터에서 찾아요. wrongK번 학생은 두 번째 문제를 일부러 한 번 틀려요.
  const play = async (st, total, wrongK) => Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < total; i++) {
      await p.waitForSelector('.opts button:not([disabled]), .wmap button:not([disabled])', { timeout: 10000 });
      if (k === 0 && i === 0) await shot(p, `s${st}-q`);
      const info = await p.evaluate(st => { const q = document.querySelector('.q').textContent; const x = SETS[st].find(z => z.q === q); return { map: !!x.map, a: x.a }; }, st);
      if (k === 2 && !info.map && (await p.$$('.opts button')).length !== 2) fail('쉬운 화면 보기가 2개가 아님');
      if (k === 2 && info.map && (await p.$$('.wmap button:not([disabled])')).length !== 2) fail('쉬운 화면 지도 대륙이 2개가 아님');
      const sel = info.map ? `.wmap button[data-c="${info.a}"]` : `.opts button[data-o="${info.a}"]`;
      const bad = info.map ? `.wmap button:not([data-c="${info.a}"]):not([disabled])` : `.opts button:not([data-o="${info.a}"])`;
      if (k === wrongK && i === 1) { await p.click(bad); await p.waitForTimeout(200); }
      await p.click(sel);
      await p.waitForTimeout(2300);
    }
  }));
  const plan = [[1, 7, 0], [2, 8, 1]];
  for (const [st, total, wk] of plan) {
    if (st > 1) { await T.click(`#tsteps button[data-s="${st}"]`); await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail(`${st}단계에서 대기 화면이 안 보임`)); }
    await T.click('.cw-go');
    await S[0].waitForSelector('.cw-wait', { state: 'detached', timeout: 10000 }).catch(() => fail('시작 뒤에도 대기 화면'));
    await play(st, total, wk);
    await cnt(N);
    if (!showOn) { await T.click('#wrongT'); showOn = true; }
    if (!new RegExp('학생' + (wk + 1)).test(await T.textContent('#qstat'))) fail(`${st}단계 틀린 학생 이름이 안 보임`);
    await shot(S[0], `s${st}-done`); await shot(T, `t${st}`);
  }
  await T.click('#award');
  if (!/시상식/.test(await T.textContent('#main'))) fail('시상식이 안 보임');
  await shot(T, 't2-award');
  await T.click('#allT');
  if ((await T.$$('#qstat .qrow')).length !== 15) fail("모든 단계 문제 수가 15개가 아님");
  await T.evaluate(c => { const r = firebase.database().ref('rooms/' + c); return r.set(null).then(() => firebase.database().ref('rooms/' + c + '_watch').set(null)); }, code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
