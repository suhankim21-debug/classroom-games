// 스파이를 찾아라 자동 테스트: 교사 화면 1개 + 학생 4명(2개 조)이 실제 Firebase 방에서 1~3단계를 끝까지 해 봐요.
// 실행: node tests/spy-e2e.js   (다른 주소: URL=http://localhost:8000/spy/ node tests/spy-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/spy/';
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
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 20000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  const answer = async (p, wrong) => {
    await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
    const ok = await p.evaluate(wrong => {
      const qt = document.querySelector('.q').textContent;
      const it = MAP.find(x => x.q === qt);
      if (!it) return false;
      const b = [...document.querySelectorAll('.opts button')].find(b => wrong ? b.dataset.o !== it.a : b.dataset.o === it.a);
      b.click(); return true;
    }, wrong);
    if (!ok) fail('문제를 찾지 못함');
    if (wrong) { await p.waitForTimeout(200); await answer(p, false); }
    await p.waitForTimeout(1100);
  };
  // 1단계
  if ((await S[3].$$('.opts button')).length !== 2) fail('쉬운 화면 보기가 2개가 아님');
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 10; i++) await answer(p, k === 0 && i === 3); }));
  await cnt(N);
  await T.click('#wrongT');
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('1단계 틀린 학생 이름이 안 보임');
  await shot(S[0], 's1-done'); await shot(T, 't1');
  // 2단계: 1·2번 → 1조, 3·4번 → 2조
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => { await p.waitForSelector('.teams button'); await p.click(`.teams button[data-t="${k < 2 ? 1 : 2}"]`); await p.waitForSelector('#chg'); }));
  await T.waitForFunction(() => /2조/.test(document.querySelector('#main').textContent) && !/아직 조를 안 고른/.test(document.querySelector('#main').textContent), null, { timeout: 10000 }).catch(() => fail('TV 조 표가 맞지 않음'));
  await T.click('#draw');
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('#save', { timeout: 15000 });
    const cards = await p.$$eval('.scard', e => e.map(x => +x.dataset.i));
    if (!cards.length) fail(`학생${k + 1} 쓸 카드가 없음`);
    if (k === 0) { await p.click('#save'); if (!/문장을 써요/.test(await p.textContent('#fm'))) fail('빈 문장 안내가 안 나옴'); }
    for (const i of cards) {
      const spy = await p.$eval(`.scard[data-i="${i}"]`, e => e.classList.contains('spy'));
      await p.click(`.scard[data-i="${i}"] .facts button:nth-child(${(i % 3) + 1})`);
      if (spy && k !== 3) await p.fill(`#x${i}`, '바르게 고친 문장이에요.');
    }
    await p.click('#save');
    await p.waitForSelector('#edit', { timeout: 10000 }).catch(async () => fail(`학생${k + 1} 문장 내기 실패: ` + await p.textContent('#fm').catch(() => '')));
  }));
  await cnt(N);
  await T.waitForFunction(() => (document.querySelector('#main').textContent.match(/4\/4/g) || []).length === 2, null, { timeout: 10000 }).catch(() => fail('TV에 조별 4/4가 안 보임'));
  await shot(S[0], 's2'); await shot(T, 't2');
  // 3단계
  await T.click('#tsteps button[data-s="3"]');
  const spyOf = t => T.evaluate(t => +RD.teams[t].spy, t);
  for (const t of [1, 2]) {
    await T.click(`#main button[data-show="${t}"]`);
    const sp = await spyOf(t);
    const voters = t === 1 ? [2, 3] : [0, 1];
    const team = t === 1 ? [0, 1] : [2, 3];
    await S[team[0]].waitForFunction(() => /우리 조 차례/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail(`${t}조 발표 화면이 안 보임`));
    for (const v of voters) {
      const p = S[v];
      await p.waitForSelector('.vote button', { timeout: 10000 });
      const n = (await p.$$('.vote button')).length;
      if (v === 3 && n !== 2) fail('쉬운 화면 스파이 찾기 보기가 2개가 아님');
      if (v !== 3 && n !== 4) fail('스파이 찾기 카드가 4장이 아님: ' + n);
      const right = !(t === 1 && v === 2);
      const btn = right ? `.vote button[data-i="${sp}"]` : `.vote button:not([data-i="${sp}"])`;
      await p.click(btn);
      await p.waitForTimeout(400);
    }
    await T.waitForFunction(() => /고른 친구 2\/2명/.test(document.querySelector('#main').textContent), null, { timeout: 10000 }).catch(() => fail(`${t}조 투표 집계가 안 맞음`));
    await shot(S[voters[0]], `s3-vote${t}`); await shot(T, `t3-vote${t}`);
    await T.click('#reveal');
    await T.waitForSelector('#main .bc.spy', { timeout: 10000 }).catch(() => fail('정답 공개에서 스파이 카드가 안 보임'));
    await S[voters[0]].waitForSelector('.vote button.right', { timeout: 10000 }).catch(() => fail('학생 화면 정답 공개가 안 보임'));
    if (t === 1 && !/1명을 속였어요/.test(await T.textContent('#main'))) fail('속인 친구 수가 맞지 않음');
    await shot(T, `t3-reveal${t}`);
    await T.click('#endshow');
  }
  const q = await T.textContent('#qstat');
  if (!/1조 스파이 찾기/.test(q) || !/학생3/.test(q)) fail('스파이 찾기 정답률·틀린 학생 이름이 안 보임');
  await T.click('#award');
  const aw = await T.textContent('#main');
  if (!/명탐정/.test(aw) || !/1조/.test(aw)) fail('시상식이 맞지 않음');
  await shot(T, 't3-award');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
