// 원주율 연구소 자동 테스트: 교사 화면 1개 + 학생 8명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/pi-e2e.js   (다른 주소: URL=http://localhost:8000/pi/ node tests/pi-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/pi/';
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
  const ANS = await T.evaluate(() => Object.fromEntries([...CONCEPT, ...GAME].map(q => [q.q, q.a])));
  const stage = async n => { await T.click(`#tsteps button[data-s="${n}"]`); };
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
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('#rollgo', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 가·나를 굴리고 (원주)÷(지름)을 소수 첫째 자리까지. 2번은 한 번 틀려요
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      if (await p.$('#in-ga')) fail('굴리기 전에 입력 칸이 열려 있음');
      for (const w of ['ga', 'na']) {
        await p.click(`#wsel button[data-w="${w}"]`); await p.click('#rollgo');
        await p.waitForSelector('#in-' + w, { timeout: 8000 });
      }
      if (n === 2) {
        await p.fill('#in-ga', '3.5'); await p.fill('#in-na', '3.1'); await p.click('#wchk');
        await p.waitForFunction(() => /다시 해 봐요/.test(document.querySelector('#wm').textContent), null, { timeout: 8000 }).catch(() => fail('틀린 계산 안내가 안 나옴'));
      }
      if (await p.$('#in-ga')) await p.fill('#in-ga', '3.1');
      if (await p.$('#in-na')) await p.fill('#in-na', '3.1');
      await p.click('#wchk');
      await p.waitForFunction(() => /발견/.test(document.querySelector('#wt').textContent), null, { timeout: 8000 });
    }));
    await T.click('#tvroll #rollgo');
    await T.waitForFunction(() => /8 \/ 8명/.test(document.querySelector('#tv1stat').textContent), null, { timeout: 15000 }).catch(() => fail('1단계 TV 집계 안 됨'));
    await T.click('[data-rv="ga"]');
    if (!/3\.1/.test(await T.textContent('#main .tbl'))) fail('TV 수레바퀴 표 보기가 안 됨');
    await shot(S[1], 's1'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: 물건을 재고 원주율을 계산해 올려요. 3번은 계산을 틀렸다가 고치고, 4번은 많이 벗어난 값도 올려요
    await stage(2);
    const objs = [['컵', 8, 25.2], ['테이프', 10, 31.5], ['동전', 2.6, 8.1], ['시계', 30, 94], ['접시', 20, 62.8], ['쓰레기통', 25, 79], ['풀 뚜껑', 3, 9.3], ['물병 뚜껑', 4, 12.6]];
    const r2 = x => (Math.round(x * 100 + 1e-9) / 100).toFixed(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('#madd', { timeout: 10000 });
      const [o, d, c] = objs[n - 1];
      await p.click(`#objs button[data-o="${o}"]`); await p.fill('#dd', String(d)); await p.fill('#cc', String(c));
      if (n === 3) {
        await p.fill('#pp', '3.1'); await p.click('#madd');
        if (!/다시 해 봐요/.test(await p.textContent('#mm'))) fail('원주율 계산 실수 안내가 안 나옴');
        await p.click('#madd');
        if (!new RegExp(r2(c / d)).test(await p.textContent('#mm'))) fail('두 번 틀리면 정답 안내가 안 나옴');
      }
      await p.fill('#pp', r2(c / d)); await p.click('#madd');
      await p.waitForFunction(() => /올렸어요/.test(document.querySelector('#mm').textContent), null, { timeout: 10000 });
      if (n === 4) {
        await p.fill('#obj', '훌라후프'); await p.fill('#dd', '70'); await p.fill('#cc', '180'); await p.fill('#pp', r2(180 / 70)); await p.click('#madd');
        await p.waitForFunction(() => /많이 달라요/.test(document.querySelector('#mm').textContent), null, { timeout: 10000 }).catch(() => fail('많이 벗어난 원주율 안내가 안 나옴'));
        await p.fill('#obj', '거울'); await p.fill('#dd', '10'); await p.fill('#cc', '8'); await p.fill('#pp', '0.8'); await p.click('#madd');
        if (!/다시 재어/.test(await p.textContent('#mm'))) fail('원주<지름을 막지 않음');
      }
      await p.waitForFunction(() => document.querySelectorAll('#mine div').length >= 1, null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /^9개/.test(document.querySelector('#t2cnt').textContent) && document.querySelector('#t2avg'), null, { timeout: 15000 }).catch(async () => fail('2단계 TV 집계가 다름: ' + (await T.textContent('#t2cnt').catch(() => ''))));
    const avg = await T.textContent('#t2avg').catch(() => '');
    if (!/^3\.1\d$/.test(avg)) fail('우리 반 평균 원주율이 이상함: ' + avg);
    if ((await T.$$('#main svg circle')).length !== 9) fail('수직선 점 수가 다름');
    await shot(S[4], 's2'); await shot(T, 't2');
    console.log('2단계 OK, 평균', avg);

    // 3단계
    await stage(3);
    await Promise.all(Object.entries(S).map(([n, p]) => solve(p, '#qz', 5, +n === 5)));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('3단계 끝 8명이 TV에 안 보임'));
    await shot(S[1], 's3'); await shot(T, 't3');
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
      await p.waitForFunction(() => /연구 완료/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.rank .r').length === 8 && /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 순위표 8명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /pi-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
