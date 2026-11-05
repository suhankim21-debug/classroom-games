// 행성 차지하기 자동 테스트: 교사 1 + 학생 N명(🌟 쉬운 화면 1명)으로 1단계 8판, 2단계 정리 퀴즈(일부러 틀리기 포함), 문제별 정답률·틀린 학생, 시상식.
// 실행: node tests/space-e2e.js   (다른 주소: URL=http://localhost:8000/space/ node tests/space-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/space/';
const SHOTS = process.env.SHOTS || '';
const N = +(process.env.N || 6);
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
  const NAMES = ['김하나', '이두리', '박세찬', '최네모', '정다섯', '강여섯', '조일곱', '윤여덟'];
  const S = [];
  for (let i = 0; i < N; i++) {
    const p = await mk('학생' + (i + 1), 820, 1100);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(i + 1));
    await p.fill('#cw-name', NAMES[i]);
    await p.click('#enter');
    await p.waitForSelector('#fly', { timeout: 15000 });
    S.push(p);
  }
  ok(`학생 ${N}명 입장`);
  await T.click(`[data-ez="${N}"]`);
  await S[N - 1].waitForSelector('.board.easy', { timeout: 8000 }).then(() => ok('🌟 쉬운 화면 켜짐')).catch(() => fail('쉬운 화면이 안 켜짐'));
  await shot(S[0], '1-ask');
  // 1단계: 8판
  for (let r = 0; r < 8; r++) {
    await Promise.all(S.map(async (p, i) => {
      await p.waitForSelector('#fly:not([disabled])', { timeout: 10000 });
      await p.click('#fly');
      await sleep(300 + Math.random() * 900);
      await p.click('#fly');
      await p.waitForSelector('#after #next, #after #opts', { timeout: 5000 });
      if (await p.$('#after #opts')) {
        const ans = await p.evaluate(() => /알고 있다고/.test(document.querySelector('#after p').textContent) ? 'Yes, I know about it.' : 'No, I have no idea.');
        if (i === 0 && r < 2) { const w = await p.$(`#opts button:not([data-o="${ans}"])`); await w.click(); await sleep(300); }
        await p.click(`#opts button[data-o="${ans}"]`);
        if (i === 0 && r === 0) await shot(p, '1-answered');
      }
      await p.click('#next');
    }));
    await sleep(500);
  }
  await Promise.all(S.map(p => p.waitForSelector('text=행성', { timeout: 8000 })));
  await sleep(800);
  await T.click('#wrongT');
  await sleep(500);
  const st1 = await T.textContent('#qstat');
  if (/김하나/.test(st1)) ok('1단계 대답 정답률에 틀린 학생 이름 보임'); else fail('1단계 틀린 학생 이름 없음: ' + st1.slice(0, 200));
  await shot(T, '2-tv1');
  const done1 = await T.textContent('#cnt');
  if (new RegExp(`끝 ${N}명`).test(done1)) ok('1단계 모두 끝: ' + done1); else fail('1단계 끝 인원: ' + done1);
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await Promise.all(S.map(p => p.waitForSelector('.prog', { timeout: 10000 })));
  for (let k = 0; k < 12; k++) {
    await Promise.all(S.map(async (p, i) => {
      const a = await p.evaluate(() => { const o = ME.q.order[ME.q.i]; return QUIZ.find(q => q.id === o).a; });
      if ((i === 1 && k < 4) || (i === 2 && k === 0)) { const w = await p.$(`#opts button:not([data-o="${a.replace(/"/g, '\\"')}"])`); await w.click(); await sleep(200); }
      const n = await p.$$eval('#opts button', b => b.length);
      if (i === N - 1 && n !== 2) fail('쉬운 화면 보기 수 ' + n);
      await p.click(`#opts button[data-o="${a.replace(/"/g, '\\"')}"]`);
      await sleep(1400);
    }));
  }
  await sleep(1000);
  await shot(S[1], '3-done');
  const tv = await T.textContent('#qstat');
  if (/이두리/.test(tv) && /%/.test(tv)) ok('문제별 정답률·틀린 학생 이름 보임'); else fail('문제별 정답률 이상: ' + tv.slice(0, 300));
  await shot(T, '3-tv2');
  await T.click('#awon');
  await sleep(1500);
  if (await T.$('.podium')) ok('시상식'); else fail('시상식 없음');
  const rk = await S[0].textContent('main');
  if (/등!/.test(rk)) ok('학생 화면 등수'); else fail('학생 등수 없음');
  await shot(T, '4-award');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
