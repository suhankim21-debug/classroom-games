// AI 자막 연구소 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/jamak-e2e.js   (다른 주소: URL=http://localhost:8000/jamak/ node tests/jamak-e2e.js)
// 테스트 브라우저에는 마이크가 없어서 '받아쓰기'로 자막을 넣어요. 끝나면 테스트 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/jamak/';
const SHOTS = process.env.SHOTS || '';
const N = 4;
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
  // 시작 전에는 기다려요
  await S[0].waitForSelector('.cw-wait', { timeout: 15000 }).catch(() => fail('시작 전 대기 화면이 안 보임'));
  await shot(S[0], 's-wait');
  await T.click('.cw-go');
  await S[0].waitForSelector('.cw-wait', { state: 'detached', timeout: 10000 }).catch(() => fail('시작 뒤에도 대기 화면'));
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 20000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  // 지금 문제의 정답(wrong이면 틀린 보기)을 눌러요
  const answer = async (p, wrong) => {
    await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
    const ok = await p.evaluate(wrong => {
      const qt = document.querySelector('.q').textContent, card = document.querySelector('.card b');
      const c = card && CARDS.find(x => x.t === card.textContent);
      const it = c ? { a: c.a } : [...ITEMS, ...QUIZ].find(x => x.q === qt);
      if (!it) return false;
      const b = [...document.querySelectorAll('.opts button')].find(b => wrong ? b.dataset.o !== it.a : b.dataset.o === it.a);
      b.click(); return true;
    }, wrong);
    if (!ok) fail('문제를 찾지 못함');
    if (wrong) { await p.waitForTimeout(200); await answer(p, false); }
    await p.waitForTimeout(2100);
  };
  // 1단계: 받아쓰기로 자막 다섯 번
  const say = ['내일 아침 9시까지 운동장에 모여 주세요', '내일 아침 운동장 모여', '음 내일 어 아침 아홉 시까지 운동장에 모여 주세요', '정말 잘했다', '정말 잘했다'];
  await Promise.all(S.map(async (p, k) => {
    for (const t of say) {
      await p.waitForSelector('#useType');
      await p.click('#useType');
      await p.fill('#typ', t);
      await p.click('#typOk');
      await p.click('#next');
      await p.waitForTimeout(400);
    }
    for (let i = 0; i < 3; i++) await answer(p, k === 0 && i === 1);
  }));
  const sim = await S[0].textContent('.tries');
  if (!/100%/.test(sim)) fail('9시를 아홉 시로 보고 100%가 나와야 함: ' + sim);
  await cnt(N);
  await shot(S[0], 's1-done');
  await T.click('#wrongT');
  const q1 = await T.textContent('#qstat');
  if (!/학생1/.test(q1)) fail('1단계 틀린 학생 이름이 안 보임');
  await shot(T, 't1');
  // 2단계: 단계를 바꾸면 다시 대기
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#wd');
    const want = await p.evaluate(() => RAW.map((w, i) => w[1] ? i : -1).filter(i => i >= 0));
    if (k === 1) { await p.click(`#wd button[data-i="${want[0]}"]`); await p.click('#tchk'); await p.waitForTimeout(200); await p.click(`#wd button[data-i="${want[0]}"]`); }
    for (const i of want) await p.click(`#wd button[data-i="${i}"]`);
    await p.click('#tchk');
    await p.waitForTimeout(1800);
    for (let i = 0; i < 3; i++) await answer(p, k === 2 && i === 0);
  }));
  await cnt(N);
  await shot(S[1], 's2-done'); await shot(T, 't2');
  // 3단계
  await T.click('#tsteps button[data-s="3"]'); await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 8; i++) await answer(p, k === 3 && i < 2); }));
  await cnt(N);
  await shot(T, 't3');
  // 4단계
  await T.click('#tsteps button[data-s="4"]'); await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 10; i++) await answer(p, k === 0 && i % 3 === 0); }));
  await cnt(N);
  await shot(S[0], 's4-done');
  const q4 = await T.textContent('#qstat');
  if (!/학생1/.test(q4)) fail('4단계 틀린 학생 이름이 안 보임');
  await T.click('#award');
  const aw = await T.textContent('#main');
  if (!/🥇/.test(aw)) fail('시상식이 안 보임');
  await shot(T, 't4-award');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
