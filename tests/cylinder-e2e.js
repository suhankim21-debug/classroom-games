// 원기둥 연구소 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/cylinder-e2e.js   (다른 주소: URL=http://localhost:8000/cylinder/ node tests/cylinder-e2e.js)
// 시작 전 대기, 많이 하는 실수 안내(원이 있는 도형을 각기둥으로, 반지름을 지름으로), 생각 먼저 쓰기(실마리 잠금·틀 베끼기 막기),
// 선생님 화면의 문제별 정답률·틀린 학생 이름, 까닭 모음, 순위·시상식을 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/cylinder/';
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
    await p.goto(URL + '?room=' + code + (i === 2 ? '&tfwait=2' : ''));
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
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계: 기억 소환 9문제 (1번은 첫 문제, 2번은 7번째 문제를 먼저 틀려요)
  const S1 = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'a9'];
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < S1.length; i++) {
      await p.waitForSelector(`text=기억 소환 ${i + 1}/9`, { timeout: 10000 });
      await pickAns(p, S1[i], (k === 0 && i === 0) || (k === 1 && i === 6));
    }
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1) || !/2 학생2/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await T.click('#tvaT');
  await shot(T, 'tv1');
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.shapes button');
    if (k === 0) { await p.click('.shapes button[data-k="나"]'); await p.click('.shapes button[data-k="가"]'); await p.click('#chk'); await p.waitForSelector('#wm.bad');
      if (!/각기둥이 아니에요/.test(await p.textContent('#wm'))) fail('원이 있는 도형을 고른 실수 안내 없음'); await p.click('.shapes button[data-k="가"]'); }
    else await p.click('.shapes button[data-k="나"]');
    await p.click('.shapes button[data-k="라"]'); await p.click('#chk'); await p.waitForSelector('#wm.ok'); await next(p);
    await pickAns(p, 'b2', false);
    await p.waitForSelector('text=돌리기 전에 예상해 봐요', { timeout: 8000 });
    await p.click('.opts button >> nth=' + (k % 3));
    await p.waitForSelector('#spin:not([disabled])');
    if (k === 2) { await p.$eval('#rs', el => { el.value = 360; el.dispatchEvent(new Event('input', { bubbles: true })); }); } else await p.click('#spin');
    await pickAns(p, 'b3', false);
    await p.waitForSelector('#h');
    if (k === 1) { await p.fill('#h', '5'); await p.fill('#r', '3'); await p.fill('#d', '3'); await p.click('#chk'); await p.waitForSelector('#wm.bad');
      if (!/반지름/.test(await p.textContent('#wm'))) fail('반지름을 지름으로 쓴 실수 안내 없음'); }
    await p.fill('#h', '5'); await p.fill('#r', '3'); await p.fill('#d', '6'); await p.click('#chk');
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/75%/.test(r2) || !/2-1/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#cf .tp');
    if (k === 3) { await p.click('#cf [data-p="top"]'); await p.click('#chk'); await p.waitForSelector('#wm.bad'); }
    else await p.click('#cf [data-p="top"]');
    await p.click('#cf [data-p="bot"]', { force: true });
    await p.click('#chk'); await p.waitForSelector('#wm.ok'); await next(p);
    for (const id of ['c2', 'c3', 'c4', 'c5']) await pickAns(p, id, k === 0 && id === 'c3');
    await pickAns(p, 'c6', false);
    await p.waitForSelector('#why');
    if (k === 1) {
      if (!(await p.$('.tf-btn[disabled]'))) fail('실마리 단추가 처음에 잠겨 있지 않음');
      await p.waitForSelector('.tf-btn:not([disabled])', { timeout: 6000 }); await p.click('.tf-btn');
      await p.waitForSelector('.tf-btn:not([disabled])', { timeout: 20000 }); await p.click('.tf-btn');
      await p.fill('#why', '원기둥은 두 밑면이 …해야 하는데, 이 입체도형은 두 밑면이 … 원기둥이 아니에요.');
      await p.click('#send'); const m = await p.textContent('#fm'); if (!/내 말로/.test(m)) fail('시작 틀을 그대로 낸 글을 막지 않음: ' + m);
    }
    await p.fill('#why', `위의 원이 아래 원보다 작아서 두 밑면이 합동이 아니에요 ${k}`);
    await p.click('#send');
    await p.waitForSelector('text=3단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's3-done');
  await sleep(1000);
  const w3 = await T.textContent('#whys');
  if (!/4명/.test(w3) || !/✏️ 시작 틀 1명/.test(w3)) fail('까닭 모음·실마리 사용 표시 이상: ' + w3.slice(0, 200));
  const r3 = await T.textContent('#qstat');
  if (!/3-1/.test(r3) || !/4 학생4/.test(r3)) fail('3단계 정답률 표시 이상: ' + r3.slice(0, 300));
  await shot(T, 'tv3');
  // 4단계 퀴즈 (학생 k는 k번째 문제까지 틀려요 → 8, 7, 6, 5)
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = await T.evaluate(() => QUIZ);
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=원기둥 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=원기둥 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await next(p);
    }
    await p.waitForSelector('text=원기둥 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const rk = await T.textContent('#rankb');
  if (!/끝 4\/4명/.test(rk)) fail('순위 표시 이상: ' + rk.slice(0, 200));
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
