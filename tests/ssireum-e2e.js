// 씨름장 넓이 연구소 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~3단계를 끝까지 해 봐요.
// 실행: node tests/ssireum-e2e.js   (다른 주소: URL=http://localhost:8000/ssireum/ node tests/ssireum-e2e.js)
// 틀린 답을 일부러 골라 선생님 화면의 문제별 정답률·틀린 학생 이름이 맞게 나오는지 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/ssireum/';
const SHOTS = process.env.SHOTS || '';
const N = 4;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
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
  const ITEMS = await T.evaluate(() => ITEMS);
  const ans = Object.fromEntries(ITEMS.map(x => [x.id, x.a]));
  const S = [];
  for (let i = 1; i <= N; i++) {
    const p = await mk(i + '번', i === 1 ? 390 : 820, 900);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-name', `${i} 학생${i}`);
    await p.click('#enter');
    await p.waitForSelector('#steps button', { timeout: 15000 });
    S.push(p);
  }
  // 학생 1은 처음에 틀린 답을 고르고 다시 맞혀요
  const pickAns = async (p, id, wrongFirst) => {
    await p.waitForSelector('.opts button:not([disabled])');
    const btn = p.locator('.opts button').filter({ has: p.locator('xpath=self::*') });
    const all = await p.$$eval('.opts button', bs => bs.map(b => b.dataset.o));
    if (wrongFirst) { const w = all.find(o => o !== ans[id]); await p.click(`.opts button[data-o="${w}"]`); await p.waitForSelector('#pm.bad'); }
    await p.click(`.opts button[data-o="${ans[id]}"]`);
    await sleep(800);
  };
  const fill = async (p, vals, wrong) => {
    await p.waitForSelector('#chk:not([disabled])');
    let msg = '';
    if (wrong) { for (const [k, v] of Object.entries(wrong)) await p.fill('#' + k, String(v)); await p.click('#chk'); await p.waitForSelector('#wm.bad'); msg = await p.textContent('#wm'); }
    for (const [k, v] of Object.entries(vals)) await p.fill('#' + k, String(v));
    await p.click('#chk'); await p.waitForSelector('#wm.ok');
    return msg;
  };
  // 1단계
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'a1', k === 0);
    for (const n of [16, 32]) { await p.click(`#nsel button[data-n="${n}"]`); await sleep(200); }
    await pickAns(p, 'a2', false);
    await pickAns(p, 'a3', k === 0);
    await pickAns(p, 'a4', false);
    await pickAns(p, 'a5', false);
    await p.waitForSelector('text=1단계 끝');
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 200));
  await shot(T, 'tv1');
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('text=직사각형의 세로는', { timeout: 10000 });
    await pickAns(p, 'b1', false);
    await pickAns(p, 'b2', k <= 1);
    for (const id of ['b3', 'b4', 'b5', 'b6']) await pickAns(p, id, false);
    const m2 = await fill(p, { a: 31.4, b: 10, c: 314 }, k === 0 ? { a: 62.8, b: 10, c: 628 } : null);
    if (k === 0 && !/1\/2/.test(m2)) fail('가로를 원주로 쓴 실수 안내 없음: ' + m2);
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[1], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/2-7/.test(r2) || !/50%/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 200));
  await T.click('#tvl'); await T.click('#tvl'); await T.click('#tvl');
  await shot(T, 'tv2');
  // 새로고침 뒤 이어 하기
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { await shot(S[2], 'reload'); fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계
  await T.click('#tsteps button[data-s="3"]');
  const P = await T.evaluate(() => PROBS.map(p => ({ r: p.r, d: p.r * 2 })));
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < P.length; i++) {
      await p.waitForSelector(`text=${i + 1}/${P.length}`, { timeout: 10000 });
      const { r, d } = P[i];
      const A = Math.round(r * r * 314) / 100;
      const m3 = await fill(p, { a: r, b: r, c: A }, k === 0 && i === 1 ? { a: d, b: d, c: Math.round(d * d * 314) / 100 } : null);
      if (k === 0 && i === 1 && !/지름/.test(m3)) fail('지름으로 계산한 실수 안내 없음: ' + m3);
      await p.click('#nx');
    }
    await p.waitForSelector('text=⭐ 빨리 끝낸 친구 도전 1');
    await fill(p, { a: 10, b: 5, c: 78.5 });
    await pickAns(p, 'c6', k === 3);
    await p.waitForSelector('text=⭐ 도전 모두 성공');
  }));
  await shot(S[0], 's3-done');
  await sleep(800);
  await T.click('#tvaT'); await T.click('#tvsT'); await T.click('#allT');
  const r3 = await T.textContent('#qstat');
  if (!/모든 단계/.test(r3) || (r3.match(/틀린 학생 없음/g) || []).length < 10) fail('모든 단계 정답률 표시 이상');
  if (!/4 학생4/.test(r3)) fail('⭐ 도전 틀린 학생 이름 없음');
  await shot(T, 'tv3');
  // 정리
  const fb = await T.evaluate(async c => { await firebase.database().ref('rooms/' + c).remove(); await firebase.database().ref('rooms/' + c + '_watch').remove(); return 'ok'; }, code);
  console.log('방 지움', fb);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
