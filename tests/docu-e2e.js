// 다큐 감상실 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/docu-e2e.js   (다른 주소: URL=http://localhost:8000/docu/ node tests/docu-e2e.js)
// 선생님이 시작을 누르기 전에는 학생이 대기하는지, 영상 내용·낱말·OX, 장면별 표현 방법과 여러 개 고르기,
// 인상 깊었던 장면 쓰기(TV 모음), 선생님이 보낸 영상 제목과 영상 분석 카드(TV 표현 요소 막대),
// 문제별 정답률·틀린 학생 이름, 정리 퀴즈·스스로 점검·시상식이 맞게 나오는지 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/docu/';
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
  await T.goto(URL);
  await shot(T, 'start');
  await T.goto(URL + '#teacher');
  await T.reload();
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
    if (!all.includes(ans[id])) fail(`${id} 보기에 정답이 없음: ${all}`);
    if (wrongFirst) { const w = all.find(o => o !== ans[id]); await p.click(`.opts button[data-o="${w}"]`); await p.waitForSelector('#pm.bad'); }
    await p.click(`.opts button[data-o="${ans[id]}"]`);
    await sleep(800);
  };
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await shot(S[0], 'wait');
  await T.click('#go');
  // 1단계: 영상 탐정 (1번 학생은 OX x4를 틀림)
  const ids1 = ITEMS.filter(x => x.st === 1).map(x => x.id);
  await Promise.all(S.map(async (p, k) => {
    for (const id of ids1) { await pickAns(p, id, k === 0 && id === 'x4'); if (k === 1 && id === 'w2') await shot(p, 's1-word'); }
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await T.waitForFunction(() => /이 단계 끝 4명/.test(document.querySelector('#cnt').textContent), null, { timeout: 10000 });
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await T.click('#tvaT');
  await shot(T, 'tv1');
  // 2단계: 장면 탐정
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  const ELS = await T.evaluate(() => ELS);
  await Promise.all(S.map(async (p, k) => {
    for (const id of ['c1', 'c2', 'c3', 'c4', 'c5']) { await pickAns(p, id, k === 1 && id === 'c3'); if (k === 1 && id === 'c1') await shot(p, 's2-scene'); }
    await p.waitForSelector('.chips button');
    if (k === 2) {
      await p.click(`.chips button[data-o="${ELS.a[0]}"]`); await p.click('#chk'); await p.waitForSelector('#pm.bad');
      const m = await p.textContent('#pm'); if (!/더 골라야/.test(m)) fail('여러 개 고르기 안내 이상: ' + m);
      for (const w of ELS.a.slice(1)) await p.click(`.chips button[data-o="${w}"]`);
    } else for (const w of ELS.a) await p.click(`.chips button[data-o="${w}"]`);
    await p.click('#chk'); await sleep(1200);
    await pickAns(p, 'm2', false);
    await p.waitForSelector('#send');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    await p.click(`#sc button[data-k="${k % 5}"]`);
    await p.click('#stt button[data-k="0"]');
    await p.fill('#txt', await p.inputValue('#txt') + '해설자의 말을 쉽게 이해할 수 있어서 인상 깊었어.');
    if (k === 0) await shot(p, 's2-write');
    await p.click('#send');
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[1], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/75%/.test(r2) || !/2-/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  const im = await T.textContent('#imp');
  if (!/4\/4명/.test(im) || !/자막이 있어서/.test(im)) fail('TV 인상 깊었던 장면 모음 이상: ' + im.slice(0, 200));
  await shot(T, 'tv2');
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계: 내 영상 분석
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.fill('#vidIn', '사회 2단원 우리나라의 무역');
  await T.click('#vidSet');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'k1', k === 0);
    await p.waitForSelector('#send');
    await p.waitForFunction(() => /우리나라의 무역/.test(document.querySelector('#vidT').textContent), null, { timeout: 8000 });
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    await p.fill('#what', '우리나라의 수출품을 알려 주는 내용');
    await p.click('#kd button[data-i="0"]'); await p.click(`#kd button[data-i="${1 + (k % 3)}"]`);
    await p.click('#ef button[data-i="0"]');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    const m = await p.textContent('#wm'); if (!/바꿔 써요/.test(m)) fail('… 그대로 둔 경우 안내 이상: ' + m);
    await p.fill('#txt', '수출품 이름을 자막으로 보여 주어서 이해하기 쉬웠어요.');
    if (k === 1) await shot(p, 's3-card');
    await p.click('#send');
    await p.waitForSelector('text=분석 카드가 TV에 올라갔어요', { timeout: 8000 });
  }));
  await sleep(1000);
  const g = await T.textContent('#cards');
  if (!/4\/4명/.test(g) || !/음성 언어 \(해설·대사\)4명/.test(g.replace(/\s+/g, ''))) {
    if (!/4\/4명/.test(g)) fail('TV 영상 분석 카드 이상: ' + g.slice(0, 200));
  }
  await shot(T, 'tv3');
  await S[3].click('#edit'); await S[3].waitForSelector('#send'); await S[3].fill('#txt', '고친 문장: 연도를 자막으로 보여 주어서 쉬웠어요.'); await S[3].click('#send');
  await S[3].waitForSelector('text=분석 카드가 TV에 올라갔어요');
  await sleep(800);
  if (!/고친 문장/.test(await T.textContent('#cards'))) fail('고친 카드가 TV에 반영되지 않음');
  // 4단계: 정리 퀴즈 (학생 k는 k번째 문제까지 틀려요 → 점수 8, 7, 6, 5) + 스스로 점검
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = await T.evaluate(() => QUIZ);
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=정리 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 0 && i === 2) await shot(p, 's4-quiz');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=정리 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await p.click('#nx'); await sleep(300);
    }
    await p.waitForSelector('text=오늘 영상을 어떻게 시청했나요?');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    for (let j = 0; j < 3; j++) await p.click(`.seg[data-k="${j}"] button[data-n="${k === 0 ? 3 : 2}"]`);
    if (k === 0) await shot(p, 's4-self');
    await p.click('#send');
    await p.waitForSelector('text=정리 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const c = await T.textContent('#climb');
  if (!/퀴즈 끝 4\/4명/.test(c)) fail('수월봉 탐사 표시 이상: ' + c.slice(0, 200));
  const sb = await T.textContent('#selfbox');
  if (!/4명/.test(sb) || !/2\.3/.test(sb)) fail('스스로 점검 평균 이상: ' + sb.slice(0, 200));
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
