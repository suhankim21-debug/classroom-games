// 원주 탐험대 자동 테스트: 교사 화면 1개 + 학생 8명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/circle-e2e.js   (다른 주소: URL=http://localhost:8000/circle/ node tests/circle-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/circle/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    // 이 클라우드 환경은 Firebase 샤드 주소를 막아서, 새로고침 때 기본 주소로 다시 붙도록 캐시를 비워요
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
  const ANS = await T.evaluate(() => Object.fromEntries([...WARM, ...ROLLQ, ...GAME].map(q => [q.q, q.a])));
  const stage = async n => { await T.click(`#tsteps button[data-s="${n}"]`); };
  // 문제를 차례로 풀어요. wrongFirst면 첫 문제를 일부러 한 번 틀려요
  const solve = async (p, box, count, wrongFirst) => {
    for (let q = 0; q < count; q++) {
      await p.waitForFunction(b => { const el = document.querySelector(b + ' .q'); return el && document.querySelector(b + ' .opts button:not([disabled])'); }, box, { timeout: 10000 });
      const text = (await p.textContent(box + ' .q')).trim();
      const a = ANS[text]; if (!a) { fail('정답을 모르는 문제: ' + text); return; }
      const on = await p.$$eval(box + ' .prog span.on', e => e.length);
      if (q === 0 && wrongFirst) {
        const wrong = await p.$(`${box} .opts button:not([data-o="${a}"])`); await wrong.click();
        if (!/다시/.test(await p.textContent(box + ' #qm'))) fail('틀렸을 때 "다시 골라 봐요"가 안 나옴');
      }
      await p.click(`${box} .opts button[data-o="${a}"]`);
      await p.waitForFunction(([b, k]) => !document.querySelector(b + ' .q') || document.querySelectorAll(b + ' .prog span.on').length > k, [box, on], { timeout: 10000 });
    }
  };
  const S = {};
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#nm', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('#qz .q', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계
    await Promise.all(Object.entries(S).map(([n, p]) => solve(p, '#qz', 6, +n === 2)));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('1단계 끝 8명이 TV에 안 보임'));
    await shot(S[1], 's1-done'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계
    await stage(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('#rollgo', { timeout: 10000 });
      if (await p.$('#rq .opts')) fail('굴리기 전에 질문이 열려 있음');
      await p.click('#dsel button[data-d="1"]'); await p.click('#rollgo');
      await p.waitForSelector('#dbars rect', { timeout: 8000 });
      await p.click('#dsel button[data-d="3"]'); await p.click('#rollgo');
      await p.waitForSelector('#dbars rect', { timeout: 8000 });
      await p.click('#tHex'); await p.click('#tSq');
      await solve(p, '#rq', 2, +n === 3);
      await p.waitForFunction(() => /발견/.test(document.querySelector('#rq').textContent), null, { timeout: 8000 });
    }));
    await T.click('#tvroll #rollgo');
    await T.waitForSelector('#tvroll #dbars rect', { timeout: 8000 }).catch(() => fail('TV 원 굴리기가 안 됨'));
    await T.waitForFunction(() => /8 \/ 8명/.test(document.querySelector('#tv2stat').textContent), null, { timeout: 15000 }).catch(() => fail('2단계 TV 집계 안 됨'));
    await shot(S[2], 's2'); await shot(T, 't2');
    console.log('2단계 OK');

    // 3단계: 짝마다 물건 두 개씩, 한 개는 범위를 벗어나게
    await stage(3);
    const objs = [['컵', 8, 25.2], ['테이프', 10, 31.5], ['동전', 2.6, 8.1], ['시계', 30, 94], ['접시', 20, 62.8], ['탬버린', 25, 79], ['풀 뚜껑', 3, 9.3], ['물병 뚜껑', 4, 12.6]];
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('#madd', { timeout: 10000 });
      const [o, d, c] = objs[n - 1];
      await p.click(`#objs button[data-o="${o}"]`); await p.fill('#dd', String(d)); await p.fill('#cc', String(c)); await p.click('#madd');
      await p.waitForFunction(() => /올렸어요/.test(document.querySelector('#mm').textContent), null, { timeout: 10000 });
      if (n === 4) {
        await p.fill('#obj', '훌라후프'); await p.fill('#dd', '70'); await p.fill('#cc', '180'); await p.click('#madd');
        await p.waitForFunction(() => /벗어났어요/.test(document.querySelector('#mm').textContent), null, { timeout: 10000 }).catch(() => fail('범위 밖 측정값 안내가 안 나옴'));
        await p.fill('#obj', '거울'); await p.fill('#dd', '10'); await p.fill('#cc', '8'); await p.click('#madd');
        if (!/다시 재어/.test(await p.textContent('#mm'))) fail('원주<지름을 막지 않음');
      }
      await p.waitForFunction(() => document.querySelectorAll('#mine div').length >= 1, null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /9개 · 3배와 4배 사이 8개/.test(document.querySelector('#main').textContent), null, { timeout: 15000 }).catch(async () => fail('3단계 TV 집계가 다름: ' + (await T.textContent('#main h2 + span').catch(() => ''))));
    await shot(S[4], 's3'); await shot(T, 't3');
    await T.click('#zoom').catch(() => fail('작은 물건 크게 보기 버튼이 없음'));
    if ((await T.$$('.chart svg circle')).length !== 5) fail('작은 물건만 보기에서 점 수가 다름');
    await shot(T, 't3-zoom'); await T.click('#zoom');
    console.log('3단계 OK');

    // 4단계: 5번은 중간에 새로고침해서 이어 풀기
    await stage(4);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      if (n === 5) {
        await solve(p, '#gz', 4, false);
        await p.reload();
        await p.waitForSelector('#gz .q', { timeout: 15000 });
        const t = await p.textContent('#gz .score');
        if (!/5\/12/.test(t)) fail('새로고침 뒤 이어 풀기 안 됨: ' + t);
        await solve(p, '#gz', 8, false);
      } else await solve(p, '#gz', 12, n % 3 === 0);
      await p.waitForFunction(() => /탐험 완료/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.rank .r').length === 8 && /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 순위표 8명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /circle-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => firebase.database().ref('rooms/' + c).remove(), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
