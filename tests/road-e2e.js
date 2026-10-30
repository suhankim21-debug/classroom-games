// 도서관 가는 길 자동 테스트: 교사 화면 1개 + 학생 9명(🌟 쉬운 화면 1명)이 실제 Firebase 방에서
// 탈것 고르기 → 레이스(가끔 일부러 틀리기, 다시 도전) → 도서관 도착 → 시상식·많이 틀린 문제까지 해 봐요.
// 실행: node tests/road-e2e.js   (다른 주소: URL=http://localhost:8000/road/ node tests/road-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/road/';
const SHOTS = process.env.SHOTS || '';
const N = +(process.env.N || 9);
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const ok = m => console.log('✅', m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts|ERR_/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    p.on('dialog', d => d.accept());
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 1000);
  await T.goto(URL);
  await T.click('#goTv');
  await T.waitForSelector('#mk', { timeout: 20000 });
  await shot(T, '0-setup');
  await T.click('#goals button[data-g="12"]');
  await T.click('#mk');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const NAMES = ['김하나', '이두리', '박세찬', '최네모', '정다섯', '강여섯', '조일곱', '윤여덟', '장아홉', '임열'];
  const S = [];
  for (let i = 0; i < N; i++) {
    const p = await mk('학생' + (i + 1), 820, 1100);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(i + 1));
    await p.fill('#cw-name', NAMES[i]);
    await p.click('#enter');
    await p.waitForSelector('.avs button', { timeout: 15000 });
    await p.click(`.avs button:nth-child(${(i % 12) + 1})`);
    await p.waitForSelector('#chg', { timeout: 15000 });
    S.push(p);
  }
  ok(`학생 ${N}명 탈것 고르고 기다리기`);
  await T.click(`[data-ez="${N}"]`);
  await sleep(800);
  await shot(T, '1-lobby');
  await shot(S[0], '1-wait');
  await T.click('#go');
  await Promise.all(S.map(p => p.waitForSelector('#q .band', { timeout: 15000 })));
  await sleep(3800);
  ok('레이스 시작, 학생 화면에 문제');
  const seenKinds = new Set();
  // 학생 한 명이 문제 하나 풀기 (wrong이면 일부러 틀림)
  const solve = async (p, wrong) => {
    const info = await p.evaluate(() => Q && { type: Q.type, kind: Q.kind, okI: Q.type === 'mc' ? Q.choices.findIndex(c => c.ok) : -1, n: Q.type === 'mc' ? Q.choices.length : 0, sent: Q.sent, easy: !!ME.easy, retry: !!Q.retry });
    if (!info) return null;
    await p.evaluate(() => { window.__old = Q; });
    seenKinds.add(info.kind);
    if (info.type === 'mc') {
      const i = wrong ? (info.okI + 1) % info.n : info.okI;
      await p.click(`.opts button[data-i="${i}"]`, { timeout: 8000 });
    } else if (info.type === 'order') {
      const ws = info.sent.split(/\s+/);
      const order = wrong ? ws.slice().reverse() : ws;
      const used = new Set();
      for (const w of order) {
        const idx = await p.evaluate(([w, used]) => [...document.querySelectorAll('#pool button')].findIndex((b, k) => !used.includes(k) && !b.classList.contains('used') && b.textContent === w), [w, [...used]]);
        used.add(idx);
        await p.click(`#pool button >> nth=${idx}`);
      }
      await p.click('#ok');
    } else {
      const ans = [...info.sent.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
      const inputs = await p.$$('.blank');
      for (let k = 0; k < inputs.length; k++) await inputs[k].fill(wrong ? 'xx' : ans[k]);
      await p.click('#ok');
    }
    if (wrong) { await p.waitForSelector('#nx:not([disabled])', { timeout: 5000 }); await p.click('#nx'); }
    // 다음 문제가 그려질 때까지 기다려요
    await p.waitForFunction(() => Q && Q !== window.__old && !busy, null, { timeout: 15000 });
    return info;
  };
  let easyKinds = new Set(), sawRetry = false;
  for (let round = 0; round < 16; round++) {
    await Promise.all(S.map(async (p, i) => {
      if (await p.$('.count')) await sleep(500);
      const wrong = (round === 1 && i < 4) || (round === 6 && i === 2);
      try { const info = await solve(p, wrong); if (info && info.easy) easyKinds.add(info.kind); if (info && info.retry) sawRetry = true; } catch (e) { fail(`학생${i + 1} 풀기 실패(${round}): ${e.message.split('\n')[0]}`); if (SHOTS) await p.screenshot({ path: `${SHOTS}/stuck-${i + 1}-${round}.png` }); }
    }));
    if (round === 3) { await shot(T, '2-race'); await shot(S[0], '2-student'); await shot(S[N - 1], '2-student-easy'); }
  }
  ok('나온 문제 종류: ' + [...seenKinds].join(', '));
  if (seenKinds.size < 7) fail('문제 종류가 너무 적게 나왔어요');
  if ([...easyKinds].some(k => !['word', 'trans', 'map', 'mean'].includes(k))) fail('쉬운 화면에 어려운 문제가 나왔어요: ' + [...easyKinds]);
  else ok('쉬운 화면 문제: ' + [...easyKinds].join(', '));
  sawRetry ? ok('틀린 문제가 다시 도전으로 나옴') : fail('다시 도전 문제가 안 나왔어요');
  const fins = await T.$$eval('.rank div.fin', d => d.length);
  fins > 0 ? ok(`도서관 도착 ${fins}명`) : fail('도착한 학생이 없어요');
  const avs = await T.$$eval('#avs [data-n]', d => d.length);
  avs === N ? ok('TV 지도에 탈것 ' + avs + '개') : fail(`TV 지도 탈것 ${avs}개 (기대 ${N})`);
  await shot(T, '3-race-late');
  await T.click('#stop');
  await sleep(1000);
  await T.click('#award');
  await T.waitForSelector('.podium', { timeout: 8000 });
  const miss = await T.$$eval('.miss > div', d => d.length);
  miss > 0 ? ok(`많이 틀린 문제 ${miss}개 보임`) : fail('많이 틀린 문제가 안 보여요');
  await sleep(800);
  await shot(T, '4-award');
  const endTxt = await S[2].textContent('#app');
  /틀렸던 문제/.test(endTxt) ? ok('학생 화면 내가 틀린 문제 다시 보기') : fail('학생 끝 화면에 틀린 문제가 없어요');
  await shot(S[2], '4-student-end');
  // 한 판 더
  await T.click('#again');
  await Promise.all(S.map(p => p.waitForSelector('#chg', { timeout: 10000 })));
  ok('한 판 더 → 모두 기다리기 화면');
  // 정리
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
