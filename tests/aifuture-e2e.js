// AI 미래 탐험대 자동 테스트: 교사 화면 1개 + 학생 4명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/aifuture-e2e.js   (다른 주소: URL=http://localhost:8000/aifuture/ node tests/aifuture-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/aifuture/';
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
  await S[0].waitForSelector('.cw-wait', { timeout: 15000 }).catch(() => fail('시작 전 대기 화면이 안 보임'));
  await shot(S[0], 's-wait');
  await T.click('#ppl button[data-ez="4"]');
  await T.click('.cw-go');
  await S[0].waitForSelector('.cw-wait', { state: 'detached', timeout: 10000 }).catch(() => fail('시작 뒤에도 대기 화면'));
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 30000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  // 한 문제 풀기: 장면/직업 카드(.bins) 또는 보기(.opts)
  const answer = async (p, wrong) => {
    await p.waitForSelector('.bins button:not([disabled]), .opts button:not([disabled])', { timeout: 10000 });
    const before = await p.evaluate(() => (document.querySelector('.sc b') || document.querySelector('.q')).textContent);
    const ok = await p.evaluate(wrong => {
      const sc = document.querySelector('.sc b');
      if (sc) {
        const t = sc.textContent; const it = [...SCENES, ...JOBS].find(x => x.t === t);
        if (!it) return 'no';
        const b = [...document.querySelectorAll('.bins button')].find(b => wrong ? b.dataset.k !== it.a : b.dataset.k === it.a);
        b.click(); return 'ok';
      }
      const qt = document.querySelector('.q').textContent;
      const it = [...CRIT, JQ].find(x => x.q === qt);
      if (!it) return 'no';
      const b = [...document.querySelectorAll('.opts button')].find(b => wrong ? b.dataset.o !== it.a : b.dataset.o === it.a);
      b.click(); return 'ok';
    }, wrong);
    if (ok !== 'ok') fail('문제를 찾지 못함: ' + before);
    if (wrong) { await p.waitForTimeout(200); await answer(p, false); return; }
    await p.waitForFunction(b => { const e = document.querySelector('.sc b') || document.querySelector('.q'); return !e || e.textContent !== b; }, before, { timeout: 8000 }).catch(() => {});
  };
  // 1단계
  await S[3].waitForSelector('.bins button', { timeout: 10000 });
  if ((await S[3].$$('.bins button')).length !== 2) fail('쉬운 화면 보기가 2개가 아님');
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 11; i++) await answer(p, k === 0 && i === 2); }));
  await cnt(N);
  await T.click('#wrongT');
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('1단계 틀린 학생 이름이 안 보임');
  await shot(S[0], 's1-done'); await shot(T, 't1');
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 10; i++) await answer(p, k === 1 && i === 4); }));
  await cnt(N);
  if (!/학생2/.test(await T.textContent('#qstat'))) fail('2단계 틀린 학생 이름이 안 보임');
  await shot(S[1], 's2-done'); await shot(T, 't2');
  // 3단계
  await T.click('#tsteps button[data-s="3"]');
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.fields button', { timeout: 10000 });
    await p.click(`.fields button:nth-child(${(k % 3) + 1})`);
    await p.waitForSelector('#save');
    if (k === 0) { await p.click('#save'); if (!/빈 칸/.test(await p.textContent('#fm'))) fail('빈 칸 안내가 안 나옴'); }
    for (const id of ['ai', 'hu', 'nj']) await p.click(`.chips[data-for="i${id}"] button:nth-child(${(k % 3) + 1})`);
    if (k === 1) await p.fill('#inj', 'AI 반려동물 마음 통역사');
    if (k === 0) await shot(p, 's3-write');
    await p.click('#save');
    await p.waitForSelector('#edit', { timeout: 10000 }).catch(async () => fail(`학생${k + 1} 카드 내기 실패`));
  }));
  await cnt(N);
  await T.waitForFunction(() => /마음 통역사/.test(document.querySelector('#main').textContent), null, { timeout: 10000 }).catch(() => fail('TV 카드 모음에 직접 쓴 직업이 안 보임'));
  await T.click('#main button[data-gf="f1"]');
  if ((await T.$$('#main .jc')).length !== 2) fail('분야 거르기가 맞지 않음');
  await T.click('#main button[data-gf=""]');
  await shot(T, 't3');
  // 4단계
  await T.click('#tsteps button[data-s="4"]');
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#save', { timeout: 10000 });
    if (k === 0) { await p.click('#save'); if (!/빈칸/.test(await p.textContent('#fm'))) fail('문장 빈칸 안내가 안 나옴'); }
    await p.click('.chips[data-for="ta"] button:nth-child(1)');
    await p.click('.chips[data-for="tb"] button:nth-child(1)');
    if (k === 2) { await p.click('#save'); if (!/스스로 평가/.test(await p.textContent('#fm'))) fail('스스로 평가 안내가 안 나옴'); }
    for (let i = 0; i < 5; i++) await p.click(`.stars[data-i="${i}"] button:nth-child(${k === 3 && i === 4 ? 1 : 3})`);
    if (k === 0) await shot(p, 's4-write');
    await p.click('#save');
    await p.waitForSelector('#edit', { timeout: 10000 }).catch(() => fail(`학생${k + 1} 4단계 내기 실패`));
  }));
  await cnt(N);
  const m4 = await T.textContent('#main');
  if (!/인공지능이 집안일을 대신해 주어서 내 생활이 더 편리해질 거예요/.test(m4)) fail('생각 넓히기 문장이 TV에 안 보임');
  if (!/노력 요함 1명/.test(m4)) fail('스스로 평가 노력 요함 집계가 안 맞음');
  await T.click('#selfT');
  if (!/학생4/.test(await T.textContent('#main'))) fail('노력 요함 이름이 안 보임');
  await shot(T, 't4');
  await T.click('#allT');
  const all = await T.textContent('#qstat');
  if (!/1-1/.test(all) || !/2-10/.test(all)) fail('모든 단계 정답률이 안 보임');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
