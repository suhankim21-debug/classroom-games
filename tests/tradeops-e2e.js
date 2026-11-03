// 세계 무역 작전실 자동 테스트: 교사 화면 1개 + 학생 10명이 실제 Firebase 방에서 1~5단계를 끝까지 해 봐요.
// 실행: node tests/tradeops-e2e.js   (다른 주소: URL=http://localhost:8000/tradeops/ node tests/tradeops-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/tradeops/';
const SHOTS = process.env.SHOTS || '';
const N = 10;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
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
  const D = await T.evaluate(() => ({ PARTS, PLACES, CARDS, LOCS }));
  const ANS = await T.evaluate(() => Object.fromEntries([...S1Q, ...S2Q, ...S3PRE, ...S3POST, ...S4Q, ...QUIZ].map(q => [q.q, q.a])));
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
      await p.waitForSelector('.clue', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 부품 6개(2번은 한 번 틀림) → 문제 3개(기사) → 관계 예상 쓰기
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      for (let k = 0; k < D.PARTS.length; k++) {
        await p.waitForSelector('#pb .opts button:not([disabled])', { timeout: 10000 });
        const nm = (await p.textContent('.clue b')).trim();
        const part = D.PARTS.find(x => x.n === nm); if (!part) { fail('모르는 부품: ' + nm); return; }
        if (n === 2 && k === 0) {
          await p.click(`#pb .opts button:not([data-c="${part.c}"]) >> nth=0`);
          if (!/단서를 다시/.test(await p.textContent('#pm'))) fail('부품을 틀렸을 때 안내가 안 나옴');
        }
        await p.click(`#pb .opts button[data-c="${part.c}"]`);
        await p.waitForFunction(k => document.querySelectorAll('.phone span.on').length > k || !document.querySelector('#pb'), k, { timeout: 10000 });
      }
      await solve(p, '#qz', 3, n === 3);
      await p.waitForSelector('#pred', { timeout: 10000 });
      if (n % 2) await p.fill('#pred', '두 나라가 다른 분야에서도 함께 일할 거예요.');
      else { await p.click('details summary'); await p.click('.chips button >> nth=0'); }
      await p.click('#send');
      await p.waitForFunction(() => /보냈어요/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    if (!(await S[1].$('.phone'))) {} // 끝 화면에는 휴대폰이 없어도 돼요
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent) && document.querySelectorAll('.list div').length === 10, null, { timeout: 15000 }).catch(() => fail('1단계 끝 10명 / 예상 10개가 TV에 안 보임'));
    const arrows = await T.$$eval('.map path[marker-end]', e => e.length);
    if (arrows !== 5) fail('TV 지도 부품 화살표가 5개가 아님: ' + arrows);
    await shot(S[1], 's1-done'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: 수출이 늘면(1번은 틀린 것 포함) → 카드 6장 나누기(4번은 한 번 틀림) → 까닭
    await stage(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('.multi button', { timeout: 10000 });
      if (n === 1) {
        await p.click('.multi button[data-g="g4"]'); await p.click('#chk');
        if (!/빨간 것은/.test(await p.textContent('#gm'))) fail('수출 좋은 점 틀렸을 때 안내가 안 나옴');
        await p.click('.multi button[data-g="g4"]');
      }
      for (const g of ['g1', 'g2', 'g3']) await p.click(`.multi button[data-g="${g}"]`);
      await p.click('#chk');
      for (let k = 0; k < D.CARDS.length; k++) {
        await p.waitForSelector('#sb .comp button:not([disabled])', { timeout: 10000 });
        const t = (await p.textContent('#sb .clue')).trim();
        const c = D.CARDS.find(x => t.includes(x.t)); if (!c) { fail('모르는 카드: ' + t); return; }
        if (n === 4 && k === 0) await p.click(`#sb .comp button:not([data-k="${c.k}"]) >> nth=0`);
        const on = await p.$$eval('#sb .prog span.on', e => e.length);
        await p.click(`#sb .comp button[data-k="${c.k}"]`);
        await p.waitForFunction(k => !document.querySelector('#sb .prog') || document.querySelectorAll('#sb .prog span.on').length > k, on, { timeout: 10000 });
      }
      await solve(p, '#qz', 1, false);
      await p.waitForFunction(() => /2단계 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('2단계 끝 10명이 아님'));
    if (!(await T.$('.cards div.hard'))) fail('TV에 헷갈린 경쟁 카드 표시가 없음');
    await shot(S[2], 's2'); await shot(T, 't2');
    console.log('2단계 OK');

    // 3단계: 관세 실험실. 학생마다 다른 작전, 5번은 3년차에 새로고침, 실패한 친구는 한 번 더
    await stage(3);
    const plans = { 1: [60, 40, 20, 0, 0], 2: [50, 50, 30, 10, 0], 3: [0, 0, 0, 0, 0], 4: [60, 60, 60, 60, 60], 5: [50, 40, 30, 20, 0], 6: [30, 30, 30, 30, 30], 7: [40, 40, 40, 40, 40], 8: [60, 60, 30, 0, 0], 9: [20, 20, 20, 20, 20], 10: [60, 30, 0, 0, 0] };
    const results = {};
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await solve(p, '#qz', 2, n === 6);
      for (let y = 0; y < 5; y++) {
        if (n === 5 && y === 2) { await p.reload(); }
        await p.waitForSelector('#tar:not([disabled])', { timeout: 15000 });
        const yr = await p.textContent('#go');
        if (!yr.includes(`${y + 1}년`)) fail(`${n}번 ${y + 1}년차가 아님: ${yr}`);
        await p.$eval('#tar', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(plans[n][y]));
        await p.click('#go');
        await p.waitForFunction(() => /곳<\/b>이 우리 철강을 샀어요/.test(document.querySelector('#ym')?.innerHTML || '') || /5년 결과/.test(document.body.textContent), null, { timeout: 10000 });
      }
      await p.waitForSelector('#next', { timeout: 10000 });
      const fin = await p.$$eval('.prices b', e => e.map(x => +x.textContent));
      results[n] = fin;
      if (await p.$('#again')) {
        await p.click('#again');
        await p.waitForSelector('#tar', { timeout: 10000 });
        if (!(await p.textContent('#go')).includes('1년')) fail(n + '번 한 번 더 하기가 1년차로 안 돌아감');
        for (let y = 0; y < 5; y++) {
          await p.waitForSelector('#tar:not([disabled])', { timeout: 15000 });
          await p.$eval('#tar', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String([60, 60, 30, 0, 0][y]));
          await p.click('#go');
          await p.waitForFunction(() => /곳<\/b>이 우리 철강을 샀어요/.test(document.querySelector('#ym')?.innerHTML || '') || /5년 결과/.test(document.body.textContent), null, { timeout: 10000 });
        }
        await p.waitForSelector('#next', { timeout: 10000 });
        if (await p.$('#again')) fail(n + '번 두 번째 작전도 실패로 나옴');
      }
      await p.click('#next');
      await solve(p, '#qz', 2, false);
      await p.waitForSelector('.multi button', { timeout: 10000 });
      await p.click(`.multi button[data-o="${n % 3 ? 'down' : 'keep'}"]`);
      if (n % 2) await p.fill('#why', '공장들이 비싼 철강을 사야 하니까요.');
      await p.click('#send');
      await p.waitForFunction(() => /3단계 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    console.log('관세 작전 결과(우리 철강 값, 공장 부담):', JSON.stringify(results));
    if (results[4][1] <= results[1][1]) fail("관세를 계속 60%로 두어도 공장 부담이 더 크지 않음");
    if (results[1][0] > 100) fail('60→40→20→0→0 작전이 성공하지 않음');
    if (results[3][0] <= 100) fail('관세 0% 작전이 성공해 버림');
    if (results[9][0] <= 100) fail('관세 20% 작전이 성공해 버림');
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('3단계 끝 10명이 아님'));
    const lines = await T.$$eval('.chart polyline', e => e.length);
    if (lines !== 10) fail('TV 철강 그래프 선이 10개가 아님: ' + lines);
    await shot(S[1], 's3'); await shot(T, 't3');
    console.log('3단계 OK');

    // 4단계: 공장 자리(7번은 한 번 틀림) → 문제 3개
    await stage(4);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('.locs button', { timeout: 10000 });
      if (n === 7) { await p.click('.locs button[data-l="a"]'); if (!/다시 골라/.test(await p.textContent('#lm'))) fail('공장 자리 틀렸을 때 안내가 안 나옴'); }
      await p.click('.locs button[data-l="vn"]');
      await solve(p, '#qz', 3, n === 8);
      await p.waitForFunction(() => /4단계 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 끝 10명이 아님'));
    await shot(T, 't4');
    console.log('4단계 OK');

    // 5단계: 컨테이너 퀴즈(5번 새로고침, 6번 보기 2개) → 한 문장 → 자기 평가
    await stage(5);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector(n === 6 ? '#qe' : '#qs', { timeout: 10000 });
      await p.click(n === 6 ? '#qe' : '#qs');
      if (n === 5) {
        await solve(p, '#gz', 4, false);
        await p.reload();
        await p.waitForSelector('#gz .q', { timeout: 15000 });
        const t = await p.textContent('#gz .score');
        if (!/5\/12/.test(t)) fail('새로고침 뒤 이어 풀기 안 됨: ' + t);
        await solve(p, '#gz', 8, false);
      } else {
        if (n === 6) { await p.waitForSelector('#gz .q'); if ((await p.$$('#gz .opts button')).length !== 2) fail('보기 2개 모드가 아님'); }
        await solve(p, '#gz', 12, n % 3 === 0);
      }
      await p.waitForSelector('#cd button', { timeout: 10000 });
      if (!(await p.$eval('#send', b => b.disabled))) fail('사례를 고르기 전에 보내기가 눌림');
      await p.click(`#cd button >> nth=${n % 3}`); await p.click(`#cc button >> nth=${n % 4}`);
      if (n === 2) await p.fill('#own', '우리 집 물건도 여러 나라에서 왔을 것 같아요.');
      await p.click('#send');
      await p.waitForSelector('.stars', { timeout: 10000 });
      for (const k of ['k', 'p', 'v']) await p.click(`.stars .row[data-k="${k}"] button[data-n="${n === 9 ? 2 : 3}"]`);
      await p.click('#send');
      await p.waitForFunction(() => /작전 완료/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.lane').length === 10 && /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('5단계 트럭 10대가 안 보임'));
    const selfTxt = await T.textContent('#main');
    if (!/별 두 개 이하 <?b?>?1명|별 두 개 이하 1명/.test(selfTxt)) fail('자기 평가 별 두 개 이하 1명이 안 보임');
    if (/9번\)/.test(selfTxt)) fail('이름 가리기 전에 학생 번호가 보임');
    await T.click('#selfT');
    if (!/\(9번\)/.test(await T.textContent('#main'))) fail('선생님만 이름 보기를 눌러도 9번이 안 보임');
    await shot(T, 't5');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't5-award'); await shot(S[1], 's5');
    console.log('5단계 OK');

    await T.click('.cw-open');
    await T.click('.cw-tabs button[data-tab="steps"]');
    await T.waitForFunction(() => document.querySelectorAll('.cw-col').length >= 10, null, { timeout: 10000 }).catch(() => fail('단계별 화면 단계 수가 적음'));
    console.log('단계별 화면:', await T.evaluate(() => [...document.querySelectorAll('.cw-col .cw-ch span')].map(x => x.textContent).join(' → ')));
    await T.click('.cw-close');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /tradeops-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
