// 과녁 넓이 연구소 자동 테스트: 교사 화면 1개 + 학생 8명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/target-e2e.js   (다른 주소: URL=http://localhost:8000/target/ node tests/target-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/target/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', hasTouch: label === '1번' });
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
  await T.click('.cw-go'); // ▶ 학생 활동 시작 (누르기 전에는 학생 화면이 기다려요)
  console.log('방 번호', code);
  const ANS = await T.evaluate(() => Object.fromEntries(GAME.map(q => [q.q, q.a])));
  const Q6 = await T.evaluate(() => quarterCells(6));
  if (Q6.inn.length * 4 !== 88 || (Q6.inn.length + Q6.cross.length) * 4 !== 132) fail(`반지름 6 cm 모눈 수가 교과서(88, 132)와 다름: ${Q6.inn.length * 4}, ${(Q6.inn.length + Q6.cross.length) * 4}`);
  const stage = async n => { await T.click(`#tsteps button[data-s="${n}"]`); };
  const pickRight = async (p, sel, a) => { await p.waitForSelector(`${sel} .opts button[data-o="${a}"]:not([disabled])`, { timeout: 10000 }); await p.click(`${sel} .opts button[data-o="${a}"]`); };
  const fill = async (p, vals, box = '#work') => { await p.waitForSelector(box + ' #chk:not([disabled])', { timeout: 10000 }); for (const [id, v] of Object.entries(vals)) await p.fill(box + ' #' + id, String(v)); await p.click(box + ' #chk'); };
  const paint = async (p, keys) => { for (const k of keys) await p.click(`#gb rect[data-k="${k}"]`); };
  const S = {};
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('#work #eye', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 눈 어림 → 마름모 방법 → 72 → 144 → 범위 → 2배와 4배 사이. 2번은 ÷2를 빠뜨리고, 3번은 반지름으로 계산
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.fill('#eye', String([0, 100, 50, 150, 120, 90, 200, 110, 130][n])); await p.click('#chk');
      await pickRight(p, '#work', '마름모처럼 (대각선) × (대각선) ÷ 2');
      if (n === 2) { await fill(p, { a: 12, b: 12, c: 144 }); if (!/2로 나눠요/.test(await p.textContent('#wm'))) fail('÷2를 빠뜨렸을 때 안내가 안 나옴'); await p.click('#chk'); if (!/풀이/.test(await p.textContent('#wm'))) fail('두 번 틀리면 풀이가 안 나옴'); }
      if (n === 3) { await fill(p, { a: 6, b: 6, c: 18 }); if (!/지름/.test(await p.textContent('#wm'))) fail('반지름으로 계산했을 때 안내가 안 나옴'); }
      await fill(p, { a: 12, b: 12, c: 72 });
      await p.waitForSelector('#work h2:has-text("원 밖")', { timeout: 10000 });
      await fill(p, { a: 12, b: 12, c: 144 });
      await p.waitForSelector('#work h2:has-text("두 정사각형")', { timeout: 10000 });
      await fill(p, { a: 72, b: 144 });
      const okTxt = await p.textContent('#wm');
      if (n === 1 && !/범위 안/.test(okTxt)) fail('눈 어림 100이 범위 안이라고 안 나옴');
      if (n === 2 && !/작았어요/.test(okTxt)) fail('눈 어림 50이 범위보다 작다고 안 나옴');
      await pickRight(p, '#work', '2배보다 크고 4배보다 작아요');
      await p.waitForSelector('text=1단계 끝', { timeout: 10000 });
      if (n <= 2) { await fill(p, { a: 180, b: 240 }, '#hex'); await p.waitForSelector('#wm.ok', { timeout: 5000 }); }
    }));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent) && document.querySelectorAll('#tveye circle').length === 8, null, { timeout: 15000 }).catch(() => fail('1단계 TV에 8명 끝/눈 어림 점 8개가 안 보임'));
    await T.waitForFunction(() => /정육각형 도전 성공 2명/.test(document.querySelector('#tv1stat').textContent), null, { timeout: 8000 }).catch(() => fail('정육각형 도전 수가 TV에 안 맞음'));
    await T.click('#tsel button[data-k="inS"]'); await T.click('#tsel button[data-k="outS"]');
    await shot(T, 't1'); await shot(S[1], 's1');
    console.log('1단계 OK');

    // 2단계: 사분원 칠하기(초록 22 → ×4 = 88, 주황 11 → 132), 범위, 더 정확한 방법
    await stage(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('#gb rect[data-k]', { timeout: 10000 });
      if (n === 4) { // 걸친 칸까지 초록으로 칠하는 실수, 두 번 틀리면 표시
        await paint(p, [...Q6.inn, Q6.cross[0]]); await p.click('#chk');
        if (!/걸친 칸은 빼요/.test(await p.textContent('#wm'))) fail('걸친 칸을 초록으로 칠했을 때 안내가 안 나옴');
        await p.click('#chk'); if (await p.locator('#gb .mk path').count() < 1) fail('두 번 틀리면 ✕ 표시가 안 나옴');
        await paint(p, [Q6.cross[0]]);
      } else if (n === 1) { // 터치 화면: 끌어서 한 줄 칠하기
        const box = await p.locator(`#gb rect[data-k="0,0"]`).boundingBox(), box2 = await p.locator(`#gb rect[data-k="3,0"]`).boundingBox();
        await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
        for (let s = 1; s <= 8; s++) await p.mouse.move(box.x + box.width / 2 + (box2.x - box.x) * s / 8, box.y + box.height / 2);
        await p.mouse.up();
        const c = +(await p.textContent('#cn')); if (c !== 4) fail(`끌어서 칠하기가 4칸이 아님: ${c}`);
        await paint(p, Q6.inn.filter(k => !['0,0', '1,0', '2,0', '3,0'].includes(k)));
      } else await paint(p, Q6.inn);
      await p.click('#chk');
      await p.waitForSelector('#work h2:has-text("원 안쪽 모눈의 수")', { timeout: 10000 });
      await fill(p, { a: 4, b: 88 });
      await p.waitForSelector('#work h2:has-text("주황")', { timeout: 10000 });
      if (n === 5) { await p.reload(); await p.waitForSelector('#work h2:has-text("주황")', { timeout: 15000 }).catch(() => fail('새로고침 뒤 2단계 이어 하기 안 됨')); }
      await paint(p, Q6.cross); await p.click('#chk');
      await p.waitForSelector('#work h2:has-text("걸친 칸까지")', { timeout: 10000 });
      if (n === 6) { await fill(p, { a: 44 }); if (!/초록 칸도/.test(await p.textContent('#wm'))) fail('주황 칸만 4배 했을 때 안내가 안 나옴'); }
      await fill(p, { a: 132 });
      await p.waitForSelector('#work h2:has-text("모눈으로 원의 넓이")', { timeout: 10000 });
      await fill(p, { a: 88, b: 132 });
      await pickRight(p, '#work', '모눈 (범위가 더 좁아요)');
      await p.waitForSelector('text=2단계 끝', { timeout: 10000 });
    }));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('2단계 8명 끝이 안 보임'));
    await T.click('#gsel button[data-s="both"]'); await T.click('#gsel button[data-u="0.5"]');
    if (!/98 &lt;|98 </.test(await T.innerHTML('#tvrng'))) fail('0.5 cm 모눈 범위(98~121)가 안 보임');
    await shot(T, 't2'); await shot(S[1], 's2');
    console.log('2단계 OK');

    // 3단계: 물건 고르기·지름 재기·눈 어림 → 칠하기 → 범위. 7번은 너무 큰 지름, 8번은 직접 쓰기, 1번은 두 개
    await stage(3);
    const DS = { 1: 10, 2: 12, 3: 15, 4: 8, 5: 20, 6: 7.5, 7: 12, 8: 9 };
    const doObj = async (p, n, k, d, eye) => {
      await p.waitForSelector('#ob button', { timeout: 10000 });
      await p.click(`#ob button[data-k="${k}"]`);
      if (k === 8) await p.fill('#own', '훌라후프 뚜껑');
      await p.fill('#dd', String(d)); await p.fill('#eye', String(eye)); await p.click('#go');
      const R = await p.evaluate(dd => { const q = quarterCells(dd / 2); return { inn: q.inn, cross: q.cross }; }, d);
      await p.waitForSelector('#gb rect[data-k]', { timeout: 10000 });
      await paint(p, R.inn); await p.click('#chk');
      await p.waitForSelector('#work h2:has-text("②")', { timeout: 10000 });
      await paint(p, R.cross); await p.click('#chk');
      await p.waitForSelector('#work h2:has-text("③")', { timeout: 10000 });
      const lo = R.inn.length * 4, hi = (R.inn.length + R.cross.length) * 4;
      if (n === 3) { await fill(p, { a: R.inn.length, b: hi }); if (!/4배/.test(await p.textContent('#wm'))) fail('4배를 안 했을 때 안내가 안 나옴'); }
      await fill(p, { a: lo, b: hi });
      await p.waitForSelector('#more', { timeout: 10000 });
      return { lo, hi };
    };
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      if (n === 7) { await p.waitForSelector('#ob button'); await p.click('#ob button[data-k="4"]'); await p.fill('#dd', '30'); await p.fill('#eye', '700'); await p.click('#go'); if (!/더 작은 물건/.test(await p.textContent('#wm'))) fail('지름이 너무 클 때 안내가 안 나옴'); }
      const r = await doObj(p, n, n === 8 ? 8 : n % 8, DS[n], Math.round(3 * (DS[n] / 2) ** 2));
      if (n === 2 && !(r.lo === 88 && r.hi === 132)) fail('지름 12 cm 물건 범위가 88~132가 아님');
      if (n === 1) { await p.click('#more'); await doObj(p, n, 2, 22, 380); if (await p.locator('#mine tbody tr').count() !== 2) fail('내가 어림한 물건 표에 2개가 안 보임'); }
    }));
    await T.waitForFunction(() => document.querySelectorAll('.rangebar').length === 9 && /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('3단계 TV 표에 9줄/8명이 안 보임'));
    if (!/훌라후프 뚜껑/.test(await T.textContent('#main'))) fail('직접 쓴 물건 이름이 TV에 안 보임');
    await shot(T, 't3'); await shot(S[1], 's3');
    console.log('3단계 OK');

    // 4단계: 과녁 맞히기 12문제, 5번은 중간 새로고침
    await stage(4);
    const solve = async (p, k, wrongFirst) => {
      for (let i = 0; i < k; i++) {
        await p.waitForSelector('#gz .opts button:not([disabled])', { timeout: 10000 });
        const q = (await p.textContent('#gz .q')).trim(); const a = ANS[q];
        if (!a) { fail('문제 정답을 못 찾음: ' + q); return; }
        if (wrongFirst && i === 0) { const w = await p.$(`#gz .opts button:not([data-o="${a}"])`); await w.click(); }
        await p.click(`#gz .opts button[data-o="${a}"]`);
        await p.waitForFunction(q0 => { const e = document.querySelector('#gz .q'); return !e || e.textContent.trim() !== q0 || /끝/.test(document.body.textContent); }, q, { timeout: 10000 });
      }
    };
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      if (n === 5) {
        await solve(p, 4, false);
        await p.reload();
        await p.waitForSelector('#gz .q', { timeout: 15000 });
        if (!/5\/12/.test(await p.textContent('#gz .score'))) fail('새로고침 뒤 이어 풀기 안 됨');
        await solve(p, 8, false);
      } else await solve(p, 12, n % 3 === 0);
      await p.waitForFunction(() => /과녁 맞히기 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.lane').length === 8 && /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 과녁 레인 8명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /target-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
