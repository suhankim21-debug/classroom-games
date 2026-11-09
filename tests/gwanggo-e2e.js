// 공익 광고 편집실 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/gwanggo-e2e.js   (다른 주소: URL=http://localhost:8000/gwanggo/ node tests/gwanggo-e2e.js)
// 선생님이 시작을 누르기 전에는 학생이 대기하는지, 문자 언어/음성 언어 나누기와 여러 개 고르기, 광고 장면 올리기와 TV 갤러리,
// 선생님 화면의 문제별 정답률·틀린 학생 이름, 시청률 퀴즈·시상식이 맞게 나오는지 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/gwanggo/';
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
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계: 기호 탐정 (1번 학생은 기호 3을 틀림)
  await Promise.all(S.map(async (p, k) => {
    for (const id of ['p1', 'p2', 'p3', 'p4', 'p5']) await pickAns(p, id, k === 0 && id === 'p3');
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await T.click('#tvaT');
  await shot(T, 'tv1');
  // 2단계: 광고 탐정
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  const WAYS = await T.evaluate(() => WAYS);
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'a1', false);
    await pickAns(p, 'a2', k === 1);
    await p.waitForSelector('.chips button');
    if (k === 2) { // 일부만 고르고 확인 → 안내, 나머지 고르기
      await p.click(`.chips button[data-o="${WAYS.a[0]}"]`); await p.click('#chk'); await p.waitForSelector('#pm.bad');
      const m = await p.textContent('#pm'); if (!/더 골라야/.test(m)) fail('여러 개 고르기 안내 이상: ' + m);
      for (const w of WAYS.a.slice(1)) await p.click(`.chips button[data-o="${w}"]`);
    } else for (const w of WAYS.a) await p.click(`.chips button[data-o="${w}"]`);
    await p.click('#chk'); await sleep(1200);
    for (const id of ['s1', 's2', 's3', 's4', 's5']) await pickAns(p, id, k === 3 && id === 's3');
    await pickAns(p, 'a4', false);
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[1], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/75%/.test(r2) || !/2-/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계: 광고 감독
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'e1', k === 0);
    await p.waitForSelector('#send');
    if (k === 1) await p.click('#tp button[data-k="food"]');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    await p.fill('#cap', '천천히 달려요');
    await p.fill('#line', k === 2 ? '천천히 달려요' : '우리가 안전하게 건널 수 있게 지켜 주세요.');
    await p.click('#sz button[data-k="s3"]');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    if (k === 2) { const m = await p.textContent('#wm'); if (!/짧게 줄여/.test(m)) fail('자막=대사 안내 이상: ' + m); await p.fill('#line', '천천히 달리면 모두가 안전해요.'); }
    await p.click('#ef button[data-i="0"]');
    await p.click('#send');
    await p.waitForSelector('text=장면이 TV에 올라갔어요', { timeout: 8000 });
  }));
  await shot(S[1], 's3-done');
  await sleep(1000);
  const g = await T.textContent('#tvmid');
  if (!/올린 장면 4\/4개/.test(g) || !/음식 남기지 않기/.test(g)) fail('TV 광고 갤러리 이상: ' + g.slice(0, 200));
  await T.click('#gal button[data-n="2"]');
  await T.waitForSelector('#bigHear');
  await shot(T, 'tv3');
  // 고치기 → 다시 올리기
  await S[3].click('#edit'); await S[3].waitForSelector('#send'); await S[3].fill('#cap', '고친 자막'); await S[3].click('#send');
  await S[3].waitForSelector('text=장면이 TV에 올라갔어요');
  await sleep(800);
  if (!/고친 자막/.test(await T.textContent('#tvmid'))) fail('고친 장면이 TV에 반영되지 않음');
  // 4단계: 시청률 퀴즈 (학생 k는 k번째 문제까지 틀려요 → 점수 10, 9, 8, 7)
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = await T.evaluate(() => QUIZ);
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=시청률 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=시청률 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await p.click('#nx'); await sleep(300);
    }
    await p.waitForSelector('text=시청률 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const c = await T.textContent('#channel');
  if (!/평균 85%/.test(c) || !/끝 4\/4명/.test(c)) fail('우리 반 채널 표시 이상: ' + c.slice(0, 200));
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
