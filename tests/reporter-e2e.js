// 꼬마 기자단 취재국 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/reporter-e2e.js   (다른 주소: URL=http://localhost:8000/reporter/ node tests/reporter-e2e.js)
// 시작 전 대기, 기사 해부(짜임·육하원칙), 전문 쓰기·짝 점검, 조별 취재 수첩(고치기 포함), 기자 퀴즈·시상식,
// 선생님 화면의 문제별 정답률·틀린 학생 이름을 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/reporter/';
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
  const C = await T.evaluate(() => ({ ITEMS, QUIZ, PITEMS, HITEMS, JITEMS }));
  const ans = Object.fromEntries(C.ITEMS.map(x => [x.id, x.a]));
  const S = [];
  for (let i = 1; i <= N; i++) {
    const p = await mk(i + '번', i === 1 ? 390 : 820, 900);
    await p.goto(URL + '?room=' + code + (i === 2 ? '&tfwait=1' : ''));
    await p.fill('#cw-name', `${i} 학생${i}`);
    await p.click('#enter');
    await p.waitForSelector('#steps button', { timeout: 15000 });
    S.push(p);
  }
  const pickAns = async (p, id, wrongFirst) => {
    await p.waitForSelector('.opts button:not([disabled])');
    const all = await p.$$eval('.opts button', bs => bs.map(b => b.dataset.o));
    if (!all.includes(ans[id])) fail(`${id} 보기에 정답이 없음`);
    if (wrongFirst) { const w = all.find(o => o !== ans[id]); await p.click(`.opts button[data-o="${w}"]`); await p.waitForSelector('#pm.bad'); }
    await p.click(`.opts button[data-o="${ans[id]}"]`);
    await sleep(800);
  };
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계: 기사 해부 (1번 학생은 p1, 2번 학생은 h6을 틀림)
  await Promise.all(S.map(async (p, k) => {
    for (const x of C.PITEMS) await pickAns(p, x.id, k === 0 && x.id === 'p1');
    for (const x of C.HITEMS) await pickAns(p, x.id, k === 1 && x.id === 'h6');
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's1-done');
  await sleep(1000);
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1) || !/2 학생2/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await shot(T, 'tv1');
  // 2단계: 전문 쓰기 + 짝 점검
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#send');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    if (k === 0) {
      if (!(await p.$('.tf-btn[disabled]'))) fail('실마리 단추가 처음에 잠겨 있지 않음');
      await p.fill('#hd', '예술 진로 캠프'); await p.fill('#tx', '희망초등학교 1~6학년 학생들은 11월 8일부터 9일까지 이틀간 ‘전문가와 함께 하는 예술 진로 캠프’에 참여했다.');
      await p.click('#ck button[data-i="0"]');
      await p.click('#send');
      if (!/예시와 거의 같아요/.test(await p.textContent('#wm'))) fail('교과서 전문을 베낀 글을 막지 않음: ' + await p.textContent('#wm'));
    }
    if (k === 1) {
      await p.waitForSelector('.tf-btn:not([disabled])', { timeout: 6000 });
      await p.click('.tf-btn'); await p.waitForSelector('.tf-hint[data-lv="1"]');
    }
    await p.fill('#hd', `쿠키 증권 첫 거래일 ${k}`);
    await p.fill('#tx', `11월 ${10 + k}일, 6학년 학생들은 교실에서 쿠키 증권 첫 거래를 했다. 경제 공부를 하려고 학생들은 뉴스를 읽고 주식을 골랐다.`);
    if (k !== 0) { await p.click('#send'); await p.waitForSelector('#wm.bad'); if (!/육하원칙을 눌러요/.test(await p.textContent('#wm'))) fail('육하원칙 체크 안내 이상'); }
    for (const i of [1, 2, 3]) await p.click(`#ck button[data-i="${i}"]`);
    await p.click('#send');
    await p.waitForSelector('text=전문이 TV에 올라갔어요', { timeout: 8000 });
  }));
  // 1번이 2번 전문을 점검
  await S[0].click('#peer');
  await S[0].waitForSelector('#pl button[data-n="2"]');
  await S[0].click('#pl button[data-n="2"]');
  for (const i of [0, 1, 2, 3, 5]) await S[0].click(`#pk button[data-i="${i}"]`);
  await S[0].click('#psend');
  await S[0].waitForSelector('#pmsg.ok');
  if (!/어떻게/.test(await S[0].textContent('#pmsg'))) fail('짝 점검 빠진 칸 안내 이상');
  await sleep(1200);
  if (!/1 학생1/.test(await S[1].textContent('main'))) fail('짝 점검 결과가 2번 화면에 안 보임');
  await shot(S[1], 's2-done');
  const g = await T.textContent('#tvmid');
  if (!/올린 전문 4\/4개/.test(g) || !/짝 점검 1번/.test(g)) fail('TV 전문 모음 이상: ' + g.slice(0, 200));
  await T.click('#gal button[data-n="2"]');
  await T.click('#bigSix');
  await sleep(300);
  if (!/1 학생1/.test(await T.textContent('.tvbig'))) fail('TV 짝 점검 보기 이상');
  await shot(T, 'tv2');
  await S[3].click('#edit'); await S[3].waitForSelector('#send'); await S[3].fill('#hd', '고친 표제입니다'); await S[3].click('#send');
  await S[3].waitForSelector('text=전문이 TV에 올라갔어요');
  await sleep(800);
  if (!/고친 표제입니다/.test(await T.textContent('#tvmid'))) fail('고친 전문이 TV에 반영되지 않음');
  // 3단계: 취재 수첩
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.lvl button');
    await p.click(`.lvl button[data-t="${k + 1}"]`);
    for (const x of C.JITEMS) await pickAns(p, x.id, k === 2 && x.id === 'j1');
    await p.waitForSelector('#send');
    const fills = { when: '11월 18일 오전', where: k < 2 ? '영랑호 습지' : '진로교육원', who: '6학년 우리 반', ph1: '철새가 나는 모습', ph2: '해설사님 설명 장면', iwho: '해설사님', iq1: '영랑호에 철새가 많이 오는 까닭은 무엇인가요?', iq2: '습지는 어떻게 지켜야 하나요?', sq: '가장 기억에 남는 것은?' };
    for (const [f, v] of Object.entries(fills)) await p.fill('#f-' + f, v);
    await p.fill('#f-so', '새');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    if (!/두 개 이상/.test(await p.textContent('#wm'))) fail('설문 보기 안내 이상');
    await p.fill('#f-so', '새, 갈대, 호수, 다리');
    await p.click('#send');
    await p.waitForSelector('text=취재 수첩 완성', { timeout: 8000 });
  }));
  await shot(S[0], 's3-done');
  // 현장에서 이어 쓰기 (새로고침 뒤 고치기)
  await S[0].reload();
  await S[0].waitForSelector('text=취재 수첩 완성', { timeout: 30000 });
  await S[0].click('#edit'); await S[0].waitForSelector('#f-what');
  if ((await S[0].inputValue('#f-iq1')).length < 5) fail('고치기에서 저장한 내용이 사라짐');
  await S[0].fill('#f-what', '철새 관찰과 습지 생태 해설을 들었다'); await S[0].click('#send');
  await S[0].waitForSelector('text=취재 수첩 완성');
  await sleep(1000);
  const nb = await T.textContent('#nbs');
  if (!/저장 4\/4명/.test(nb) || !/철새 관찰/.test(nb) || !/3조/.test(nb)) fail('TV 조별 취재 수첩 이상: ' + nb.slice(0, 200));
  const r3 = await T.textContent('#qstat');
  if (!/3-1/.test(r3) || !/75%/.test(r3)) fail('3단계 정답률 이상: ' + r3.slice(0, 200));
  await shot(T, 'tv3');
  // 4단계: 기자 퀴즈 (학생 k는 k번째 문제까지 틀려요)
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = C.QUIZ;
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=기자 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=기자 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await p.click('#nx'); await sleep(300);
    }
    await p.waitForSelector('text=기자 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's4-done');
  await sleep(1000);
  const c = await T.textContent('#channel');
  if (!/끝 4\/4명/.test(c)) fail('우리 반 특종 표시 이상: ' + c.slice(0, 200));
  const r4 = await T.textContent('#qstat');
  if (!/4-1/.test(r4) || !/25%/.test(r4) || !/2 학생2/.test(r4)) fail('퀴즈 문제별 정답률 표시 이상: ' + r4.slice(0, 300));
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
