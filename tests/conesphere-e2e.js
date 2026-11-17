// 원뿔·구 연구소 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/conesphere-e2e.js   (다른 주소: URL=http://localhost:8000/conesphere/ node tests/conesphere-e2e.js)
// 시작 전 대기, 많이 하는 실수 안내(높이·모선 바꿔 쓰기, 반지름을 지름으로), 비교 표, 선생님 화면의 문제별 정답률·틀린 학생 이름, 순위·시상식을 확인해요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/conesphere/';
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
  await shot(T, 'tv0');
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
  const next = async p => { await p.click('#nx'); await sleep(300); };
  const turn = async (p, k, id) => {
    await p.waitForSelector('text=돌리기 전에 예상해 봐요', { timeout: 8000 });
    await p.click('.opts button >> nth=' + (k % 4));
    await p.waitForSelector('#spin:not([disabled])');
    if (k === 2) { await p.$eval('#rs', el => { el.value = 360; el.dispatchEvent(new Event('input', { bubbles: true })); }); } else await p.click('#spin');
    await pickAns(p, id, false);
  };
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계 원뿔
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.shapes button');
    if (k === 0) { await p.click('.shapes button[data-k="나"]'); await p.click('.shapes button[data-k="가"]'); await p.click('#chk'); await p.waitForSelector('#wm.bad');
      if (!/원기둥이 아니에요/.test(await p.textContent('#wm'))) fail('원뿔을 원기둥으로 고른 실수 안내 없음'); await p.click('.shapes button[data-k="가"]'); }
    else await p.click('.shapes button[data-k="나"]');
    await p.click('.shapes button[data-k="라"]'); await p.click('#chk'); await p.waitForSelector('#wm.ok'); await next(p);
    await pickAns(p, 'd2', false);
    await turn(p, k, 'd3');
    await p.waitForSelector('#cf .tp');
    const tapSide = async () => { const b = await p.$eval('#cf svg', el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.45 }; }); await p.mouse.click(b.x, b.y); };
    if (k === 3) { await tapSide(); await p.click('#chk'); await p.waitForSelector('#wm.bad'); if (!/굽어/.test(await p.textContent('#wm'))) fail('옆면을 고른 실수 안내 없음'); await tapSide(); }
    await p.click('#cf [data-p="bot"]', { force: true });
    await p.click('#chk'); await p.waitForSelector('#wm.ok'); await next(p);
    for (const id of ['d5', 'd6', 'd7', 'd8', 'd9']) await pickAns(p, id, k === 0 && id === 'd8');
    await p.waitForSelector('#h');
    if (k === 1) { await p.fill('#h', '15'); await p.fill('#m', '12'); await p.fill('#d', '18'); await p.click('#chk'); await p.waitForSelector('#wm.bad');
      if (!/모선/.test(await p.textContent('#wm'))) fail('높이·모선 바꿔 쓴 실수 안내 없음'); }
    await p.fill('#h', '12'); await p.fill('#m', '15'); await p.fill('#d', '18'); await p.click('#chk');
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1) || !/2 학생2/.test(r1) || !/4 학생4/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 400));
  await T.click('#tvaT');
  await shot(T, 'tv1');
  // 2단계 구
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.shapes button');
    for (const x of ['가', '나', '라']) await p.click(`.shapes button[data-k="${x}"]`);
    await p.click('#chk'); await p.waitForSelector('#wm.ok'); await next(p);
    await pickAns(p, 'e2', k === 2);
    await turn(p, k, 'e3');
    for (const id of ['e4', 'e5', 'e6']) await pickAns(p, id, false);
    await p.waitForSelector('#r');
    if (k === 1) { await p.fill('#d', '10'); await p.fill('#r', '10'); await p.click('#chk'); await p.waitForSelector('#wm.bad');
      if (!/절반/.test(await p.textContent('#wm'))) fail('지름을 반지름으로 쓴 실수 안내 없음'); }
    await p.fill('#d', '10'); await p.fill('#r', '5'); await p.click('#chk');
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/75%/.test(r2) || !/2-2/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계 비교
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  const ROWS = await T.evaluate(() => CMP_ROWS);
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.cmp select');
    for (const r of ROWS) for (let c = 0; c < 3; c++) {
      const v = (k === 0 && r.id === 'f4' && c === 1) ? '직사각형' : r.a[c];
      await p.selectOption(`#${r.id}_${c}`, v);
    }
    await p.click('#chk');
    if (k === 0) { await p.waitForSelector('#wm.bad'); if (!(await p.$('#f4_1.bad'))) fail('비교 표 틀린 칸 표시 없음'); await p.selectOption('#f4_1', '삼각형'); await p.click('#chk'); }
    await p.waitForSelector('#wm.ok'); await next(p);
    await p.click('#talked');
    await p.waitForSelector('text=3단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's3-done');
  await sleep(1000);
  const r3 = await T.textContent('#qstat');
  if (!/3-4/.test(r3) || !/75%/.test(r3)) fail('3단계 정답률 표시 이상: ' + r3.slice(0, 300));
  await T.click('#tvaT');
  await shot(T, 'tv3');
  // 4단계 퀴즈 (학생 k는 k번째 문제까지 틀려요)
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = await T.evaluate(() => QUIZ);
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=원뿔·구 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 3) { await p.reload(); await p.waitForSelector(`text=원뿔·구 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await next(p);
    }
    await p.waitForSelector('text=원뿔·구 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const rk = await T.textContent('#rankb');
  if (!/끝 4\/4명/.test(rk)) fail('순위 표시 이상: ' + rk.slice(0, 200));
  const r4 = await T.textContent('#qstat');
  if (!/4-1/.test(r4) || !/25%/.test(r4) || !/3 학생3/.test(r4)) fail('퀴즈 문제별 정답률 표시 이상: ' + r4.slice(0, 300));
  await shot(T, 'tv4');
  await T.click('#awT');
  const aw = await T.textContent('#award');
  if (!/1 학생1/.test(aw)) fail('시상식 1등 이상: ' + aw);
  await shot(T, 'tv4-award');
  await T.evaluate(async c => { await firebase.database().ref('rooms/' + c).remove(); await firebase.database().ref('rooms/' + c + '_watch').remove(); }, code);
  console.log('방 지움');
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
