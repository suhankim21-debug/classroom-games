// 한국 문화 해설사 자동 테스트: 교사 1 + 학생 N명(🌟 쉬운 화면 1명)으로 카드 짝 맞추기(다른 카드·같은 카드·일부러 틀리기),
// 시작 전 대기, 문제별 정답률·틀린 학생 이름, 시상식, 한 판 더.
// 실행: node tests/culture-e2e.js   (다른 주소: URL=http://localhost:8000/culture/ node tests/culture-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/culture/';
const SHOTS = process.env.SHOTS || '';
const N = +(process.env.N || 5);
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
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 1000);
  await T.goto(URL);
  await shot(T, '0-start');
  await T.click('#goTv');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const NAMES = ['김하나', '이두리', '박세찬', '최네모', '정다섯', '강여섯'];
  const S = [];
  for (let i = 0; i < N; i++) {
    const p = await mk('학생' + (i + 1), 820, 1180);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(i + 1));
    await p.fill('#cw-name', NAMES[i]);
    await p.click('#enter');
    await p.waitForSelector('text=선생님이', { timeout: 15000 });
    S.push(p);
  }
  ok(`학생 ${N}명 입장, 모두 기다리는 화면`);
  if (await S[0].$('#cards')) fail('시작 전인데 카드가 보여요');
  await shot(S[0], '0-wait');
  await T.click(`[data-ez="${N}"]`);
  await sleep(800);
  await T.click('#startNow');
  await Promise.all(S.map(p => p.waitForSelector('#cards', { timeout: 10000 })));
  ok('선생님 시작 → 학생 화면 열림');
  const nEasy = await S[N - 1].$$eval('#cards button', b => b.length);
  if (nEasy === 8) ok('🌟 쉬운 화면 카드 8장'); else fail('쉬운 화면 카드 수 ' + nEasy);
  const play = async (p, i) => {
    let turn = 0;
    for (;;) {
      if (await p.$('#again')) return;
      await p.waitForSelector('#cards button', { timeout: 10000 });
      const st = await p.evaluate(() => ({ deck: ME.p.deck, got: ME.p.got || {} }));
      const open = st.deck.map((id, k) => k).filter(k => !st.got[k]);
      if (!open.length) { await sleep(500); continue; }
      let a = open[0], b;
      const mis = open.find(k => st.deck[k] !== st.deck[a]);
      if (turn === 0 && mis !== undefined) b = mis; else b = open.find(k => k !== a && st.deck[k] === st.deck[a]);
      await p.click(`#cards button[data-i="${a}"]`);
      if (i === 0 && turn === 0) await shot(p, '1-ask');
      await p.click(`#cards button[data-i="${b}"]`);
      await p.waitForSelector('#opts', { timeout: 5000 });
      const hit = st.deck[a] === st.deck[b];
      const ans = hit ? 'Yes, I know about it.' : 'No, I have no idea.';
      if (i === 0 && turn === 1) { await p.click(`#opts button:not([data-o="${ans}"])`); await sleep(300); }
      await p.click(`#opts button[data-o="${ans}"]`);
      if (hit) {
        await p.waitForSelector('#dopts', { timeout: 5000 });
        const d = await p.evaluate(id => ITEMS[id].d, st.deck[a]);
        const nOpt = await p.$$eval('#dopts button', x => x.length);
        if (i === N - 1 && nOpt !== 2) fail('쉬운 화면 설명 보기 수 ' + nOpt);
        if ((i === 0 || i === 1) && turn === 1) { await p.click(`#dopts button:not([data-o="${d.replace(/"/g, '\\"')}"])`); await sleep(300); }
        await p.click(`#dopts button[data-o="${d.replace(/"/g, '\\"')}"]`);
        if (i === 0 && turn === 1) await shot(p, '1-answered');
      }
      await p.click('#next');
      turn++;
      await sleep(200);
      if (turn > 30) { fail(`[학생${i + 1}] 끝나지 않아요`); return; }
    }
  };
  await Promise.all(S.map(play));
  ok('모두 짝 맞추기 끝');
  await shot(S[0], '2-done');
  await sleep(1000);
  const cnt = await T.textContent('#cnt');
  if (new RegExp(`끝 ${N}명`).test(cnt)) ok('TV 끝 인원: ' + cnt); else fail('끝 인원: ' + cnt);
  await T.click('#wrongT');
  await sleep(500);
  const st1 = await T.textContent('#qstat');
  if (/김하나/.test(st1) && /이두리/.test(st1) && /%/.test(st1)) ok('문제별 정답률·틀린 학생 이름 보임'); else fail('정답률 표 이상: ' + st1.slice(0, 300));
  await shot(T, '3-tv');
  await T.click('#awon');
  await sleep(1500);
  if (await T.$('.podium')) ok('시상식'); else fail('시상식 없음');
  const rk = await S[0].textContent('main');
  if (/등!/.test(rk)) ok('학생 화면 등수'); else fail('학생 등수 없음');
  await shot(T, '4-award');
  await S[1].click('#again');
  await S[1].waitForSelector('#cards button:not(.got)', { timeout: 8000 }).then(() => ok('한 판 더')).catch(() => fail('한 판 더 안 됨'));
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
