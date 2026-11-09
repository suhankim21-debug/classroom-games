// 꽃밭 정원사 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/garden-e2e.js   (다른 주소: URL=http://localhost:8000/garden/ node tests/garden-e2e.js)
// 선생님이 시작을 누르기 전에는 학생이 대기하는지, 많이 하는 실수(둘레를 빼기, 5 cm 두 번 빠뜨리기, 지름으로 계산)를 안내하는지,
// 선생님 화면의 문제별 정답률·틀린 학생 이름, 우리 반 꽃밭·시상식이 맞게 나오는지 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/garden/';
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
  const pickAns = async (p, id, wrongFirst) => {
    await p.waitForSelector('.opts button:not([disabled])');
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
  const next = async p => { await p.click('#nx'); await sleep(300); };
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계: 꽃밭
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'a1', k === 0);
    const m = await fill(p, { a: 62.8, b: 5, c: 31.4, d: 94.2 }, k === 0 ? { a: 62.8, b: 5, c: 31.4, d: 31.4 } : null);
    if (k === 0 && !/더해요/.test(m)) fail('둘레를 뺀 실수 안내 없음: ' + m);
    await next(p);
    await pickAns(p, 'a3', false);
    await fill(p, { a: 314, b: 78.5, c: 235.5 }, k === 1 ? { a: 314, b: 78.5, c: 392.5 } : null);
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1) || !/2 학생2/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await T.click('#tvaT');
  await shot(T, 'tv1');
  // 2단계: 색칠한 부분 + 부채
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'b1', false);
    await fill(p, { a: 40, b: 31.4, c: 71.4 }); await next(p);
    const m3 = await fill(p, { a: 100, b: 78.5, c: 21.5 }, k === 2 ? { a: 100, b: 314, c: -214 } : null);
    if (k === 2 && !/반지름/.test(m3)) fail('지름으로 원 넓이를 계산한 실수 안내 없음: ' + m3);
    await next(p);
    await pickAns(p, 'b4', k <= 1);
    const m5 = await fill(p, { a: 28.26, b: 4, c: 12.56, d: 50.82 }, k === 0 ? { a: 28.26, b: 4, c: 12.56, d: 40.82 } : null);
    if (k === 0 && !/5 cm 두 개/.test(m5)) fail('5 cm 두 번 빠뜨린 실수 안내 없음: ' + m5);
    await next(p);
    await fill(p, { a: 127.17, b: 25.12, c: 102.05 });
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[1], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/50%/.test(r2) || !/2-4/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  // 새로고침 뒤 이어 하기
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계: 모양 도전
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    const m1 = await fill(p, { a: 62.8, b: 132.8 }, k === 3 ? { a: 62.8, b: 172.8 } : null);
    if (k === 3 && !/둘레가 아니에요/.test(m1)) fail('트랙 점선을 더한 실수 안내 없음: ' + m1);
    await next(p);
    await fill(p, { a: 314, b: 700, c: 1014 }); await next(p);
    await fill(p, { a: 80, b: 62.8, c: 142.8 }); await next(p);
    await fill(p, { a: 10, b: 314 }); await next(p);
    await p.waitForSelector('text=⭐ 빨리 끝낸 친구 도전 1');
    await fill(p, { a: 1256, b: 314, c: 942 });
    await pickAns(p, 'c6', k === 3);
    await p.waitForSelector('text=3단계 끝');
  }));
  await shot(S[0], 's3-done');
  await sleep(800);
  await T.click('#tvaT');
  await shot(T, 'tv3');
  // 4단계: 꽃밭 퀴즈 (학생 k는 k번째 문제까지 틀려요 → 점수 10, 9, 8, 7)
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = await T.evaluate(() => QUIZ);
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=꽃밭 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      const pickO = i < k ? Q.o[0] : Q.a;
      await p.click(`.opts button[data-o="${pickO}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=꽃밭 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await next(p);
    }
    await p.waitForSelector('text=꽃밭 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const g = await T.textContent('#garden');
  if (!/34송이/.test(g) || !/끝 4\/4명/.test(g)) fail('우리 반 꽃밭 표시 이상: ' + g.slice(0, 200));
  const r4 = await T.textContent('#qstat');
  if (!/4-1/.test(r4) || !/25%/.test(r4)) fail('퀴즈 문제별 정답률 표시 이상: ' + r4.slice(0, 300));
  await shot(T, 'tv4');
  await T.click('#awT');
  const aw = await T.textContent('#award');
  if (!/1 학생1/.test(aw)) fail('시상식 1등 이상: ' + aw);
  await shot(T, 'tv4-award');
  const fb = await T.evaluate(async c => { await firebase.database().ref('rooms/' + c).remove(); await firebase.database().ref('rooms/' + c + '_watch').remove(); return 'ok'; }, code);
  console.log('방 지움', fb);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
