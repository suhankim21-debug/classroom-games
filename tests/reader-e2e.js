// 독자 맞춤 편집국 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~5단계를 끝까지 해 봐요.
// 실행: node tests/reader-e2e.js   (다른 주소: URL=http://localhost:8000/reader/ node tests/reader-e2e.js)
// 선생님이 시작을 누르기 전에는 학생이 대기하는지, 관심 온도계, 여러 개 고르기, 글 배달·글쓰기 과정 나누기,
// 짧은 글 올리기와 TV 편집국(독자 가리기/공개), 선생님 화면의 문제별 정답률·틀린 학생 이름, 구독자 퀴즈·시상식을 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/reader/';
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
  const C = await T.evaluate(() => ({ ITEMS, QUIZ, KEEP, POSTS, READERS, PCARDS, PROC }));
  const ans = Object.fromEntries(C.ITEMS.map(x => [x.id, x.a]));
  C.READERS.forEach(x => { ans[x.id] = C.POSTS[x.a].k; });
  C.PCARDS.forEach(x => { ans[x.id] = C.PROC[x.a]; });
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
  const multiAns = async (p, list, partialFirst) => {
    await p.waitForSelector('.chips button');
    if (partialFirst) {
      await p.click(`.chips button[data-o="${list[0]}"]`); await p.click('#chk'); await p.waitForSelector('#pm.bad');
      const m = await p.textContent('#pm'); if (!/더 골라야/.test(m)) fail('여러 개 고르기 안내 이상: ' + m);
      for (const w of list.slice(1)) await p.click(`.chips button[data-o="${w}"]`);
    } else for (const w of list) await p.click(`.chips button[data-o="${w}"]`);
    await p.click('#chk'); await sleep(1200);
  };
  await sleep(1500);
  for (const p of S) if (!(await p.locator('text=선생님 설명을 들어요').count())) fail('시작 전인데 학생 화면이 대기하지 않음');
  await T.click('#go');
  // 1단계: 관심 온도계 (1번 학생은 i1을 틀림)
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.lvl button');
    await p.click(`.lvl button[data-k="${k === 3 ? 1 : 3}"]`);
    await pickAns(p, 'i1', k === 0);
    await pickAns(p, 'i2', false);
    await p.waitForSelector('text=1단계 끝', { timeout: 8000 });
  }));
  await sleep(1000);
  const m1 = await T.textContent('#meter');
  if (!/4\/4명/.test(m1) || !/3명/.test(m1) || !/1명/.test(m1)) fail('관심 온도계 이상: ' + m1);
  await T.click('#wrongT');
  const r1 = await T.textContent('#qstat');
  if (!/75%/.test(r1) || !/1 학생1/.test(r1)) fail('1단계 정답률/틀린 학생 이름 표시 이상: ' + r1.slice(0, 300));
  await shot(T, 'tv1');
  // 2단계: 독자 탐정
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 });
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await multiAns(p, ['어려운 낱말이 있어요', '독자가 궁금한 내용(놀이 방법)이 없어요'], k === 2);
    await multiAns(p, ['쉬운 낱말로 썼어요', '독자가 궁금해하는 놀이 방법을 썼어요'], false);
    await pickAns(p, 'd3', false);
    for (const id of ['m1', 'm2', 'm3', 'm4']) await pickAns(p, id, k === 1 && id === 'm2');
    await p.waitForSelector('text=2단계 끝', { timeout: 8000 });
  }));
  await shot(S[1], 's2-done');
  await sleep(800);
  const r2 = await T.textContent('#qstat');
  if (!/75%/.test(r2) || !/2-/.test(r2)) fail('2단계 정답률 표시 이상: ' + r2.slice(0, 300));
  await S[2].reload();
  try { await S[2].waitForSelector('text=2단계 끝', { timeout: 30000 }); } catch (e) { fail('새로고침 뒤 2단계 끝 화면으로 돌아오지 않음'); }
  // 3단계: 글쓰기 과정
  await T.click('#tsteps button[data-s="3"]');
  await sleep(1500);
  if (!(await S[0].locator('text=선생님 설명을 들어요').count())) fail('3단계 시작 전 대기 화면 없음');
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    for (const x of C.PCARDS) await pickAns(p, x.id, k === 3 && x.id === 'g2');
    await pickAns(p, 'c1', false);
    await multiAns(p, C.KEEP.a, false);
    await pickAns(p, 'c3', false);
    await p.waitForSelector('text=3단계 끝', { timeout: 8000 });
  }));
  await shot(S[0], 's3-done');
  // 4단계: 맞춤 편집자
  await T.click('#tsteps button[data-s="4"]');
  await sleep(1200);
  await T.click('#go');
  await Promise.all(S.map(async (p, k) => {
    await pickAns(p, 'w1', k === 0);
    await pickAns(p, 'w2', false);
    await p.waitForSelector('#send');
    if (k === 1) { await p.click('#wh button[data-k="family"]'); await p.click('#tp button[data-k="food"]'); }
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    if (k === 0) {
      if (!(await p.$('.tf-btn[disabled]'))) fail('실마리 단추가 처음에 잠겨 있지 않음');
      if (/복도에서 뛰면/.test(await p.getAttribute('#tx', 'placeholder'))) fail('글 칸에 예시 답이 보임');
      await p.fill('#ti', '복도 이야기'); await p.fill('#tx', '복도에서 뛰면 친구와 부딪힐 수 있어요. 그러니까 조심해요.');
      await p.click('#send');
      if (!/예시와 거의 같아요/.test(await p.textContent('#wm'))) fail('예시를 베낀 글을 막지 않음: ' + await p.textContent('#wm'));
    }
    if (k === 1) {
      await p.waitForSelector('.tf-btn:not([disabled])', { timeout: 6000 });
      await p.click('.tf-btn'); await p.waitForSelector('.tf-hint[data-lv="1"]');
    }
    await p.fill('#ti', `동생들아, 복도에서는 사뿐사뿐 ${k}`);
    await p.fill('#tx', '복도에서 뛰면 친구와 부딪혀서 다칠 수 있어요. 고양이처럼 사뿐사뿐 걸어 볼까요?');
    await p.click('#send'); await p.waitForSelector('#wm.bad');
    const m = await p.textContent('#wm'); if (!/두 개 이상/.test(m)) fail('독자를 위해 한 일 안내 이상: ' + m);
    await p.click('#dd button[data-i="0"]'); await p.click('#dd button[data-i="2"]');
    await p.click('#send');
    await p.waitForSelector('text=글이 TV에 올라갔어요', { timeout: 8000 });
  }));
  await shot(S[0], 's4-done');
  await sleep(1000);
  const g = await T.textContent('#tvmid');
  if (!/올린 글 4\/4개/.test(g) || !/할머니·부모님 1/.test(g)) fail('TV 편집국 이상: ' + g.slice(0, 200));
  if (/읽을 사람: 🧒/.test(g)) fail('TV 목록에서 독자가 가려지지 않음');
  if (!/스스로 3명 · 💡 질문 실마리 1명/.test(g)) fail('선생님 화면 실마리 사용 집계 이상');
  await T.click('#gal button[data-n="2"]');
  await T.waitForSelector('#bigWho');
  await T.click('#bigWho');
  await sleep(300);
  if (!/할머니·부모님/.test(await T.textContent('.tvbig'))) fail('독자 공개 이상');
  await shot(T, 'tv4');
  await S[3].click('#edit'); await S[3].waitForSelector('#send'); await S[3].fill('#ti', '고친 제목입니다'); await S[3].click('#send');
  await S[3].waitForSelector('text=글이 TV에 올라갔어요');
  await sleep(800);
  if (!/고친 제목입니다/.test(await T.textContent('#tvmid'))) fail('고친 글이 TV에 반영되지 않음');
  // 5단계: 구독자 퀴즈 (학생 k는 k번째 문제까지 틀려요)
  await T.click('#tsteps button[data-s="5"]');
  await sleep(1200);
  await T.click('#go');
  const QUIZ = C.QUIZ;
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < QUIZ.length; i++) {
      await p.waitForSelector(`text=구독자 퀴즈 ${i + 1}/${QUIZ.length}`, { timeout: 10000 });
      await p.waitForSelector('.opts button:not([disabled])');
      const Q = QUIZ[i];
      await p.click(`.opts button[data-o="${i < k ? Q.o[0] : Q.a}"]`);
      await p.waitForSelector('#nx');
      if (k === 1 && i === 4) { await p.reload(); await p.waitForSelector(`text=구독자 퀴즈 ${i + 2}/${QUIZ.length}`, { timeout: 30000 }); continue; }
      await p.click('#nx'); await sleep(300);
    }
    await p.waitForSelector('text=구독자 퀴즈 끝');
    const t = await p.textContent('.big');
    if (!t.includes(`${QUIZ.length - k}문제`)) fail(`${k + 1}번 퀴즈 점수 이상: ${t}`);
    await sleep(150 * k);
  }));
  await shot(S[3], 's5-done');
  await sleep(1000);
  const avg = Math.round((QUIZ.length * 4 - 6) * 10 / 4);
  const c = await T.textContent('#channel');
  if (!new RegExp(`평균 ${avg}명`).test(c) || !/끝 4\/4명/.test(c)) fail('우리 반 구독자 표시 이상: ' + c.slice(0, 200));
  const r5 = await T.textContent('#qstat');
  if (!/5-1/.test(r5) || !/25%/.test(r5)) fail('퀴즈 문제별 정답률 표시 이상: ' + r5.slice(0, 300));
  await shot(T, 'tv5');
  await T.click('#awT');
  const aw = await T.textContent('#award');
  if (!/1 학생1/.test(aw)) fail('시상식 1등 이상: ' + aw);
  await shot(T, 'tv5-award');
  const fb = await T.evaluate(async c => { await firebase.database().ref('rooms/' + c).remove(); await firebase.database().ref('rooms/' + c + '_watch').remove(); return 'ok'; }, code);
  console.log('방 지움', fb);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
