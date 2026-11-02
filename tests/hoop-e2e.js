// 굴렁쇠 레이스 자동 테스트: 교사 화면 1개 + 학생 8명(4조, 7번은 혼자라 로봇 짝)이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/hoop-e2e.js   (다른 주소: URL=http://localhost:8000/hoop/ node tests/hoop-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/hoop/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const r2 = x => String(Math.round(x * 100 + 1e-9) / 100);
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
  const ANS = await T.evaluate(() => Object.fromEntries(GAME.map(q => [q.q, q.a])));
  const D = await T.evaluate(() => ({ H: HOOPS, P: POSTS }));
  const stage = async n => { await T.click(`#tsteps button[data-s="${n}"]`); };
  const pickRight = async (p, sel, a) => { await p.waitForSelector(`${sel} .opts button[data-o="${a}"]:not([disabled])`, { timeout: 10000 }); await p.click(`${sel} .opts button[data-o="${a}"]`); };
  const S = {};
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('#work .opts', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 굴렁쇠가 간 거리 = 원주, 식 고르기, 지름 × 3.14 세 번. 2번은 나누기 실수, 3번은 3.1로 계산
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await pickRight(p, '#work', '굴렁쇠의 원주');
      await pickRight(p, '#work', '원주율');
      for (let i = 0; i < D.H.length; i++) {
        const d = D.H[i].d;
        await p.waitForSelector('#work #chk:not([disabled])', { timeout: 10000 });
        if (i === 0 && n === 2) {
          await p.fill('#a', String(d)); await p.fill('#b', '3.14'); await p.fill('#c', r2(d / 3.14)); await p.click('#chk');
          if (!/곱해요/.test(await p.textContent('#wm'))) fail('원주를 나눠서 구했을 때 안내가 안 나옴');
          await p.click('#chk');
          if (!/풀이/.test(await p.textContent('#wm'))) fail('두 번 틀리면 풀이가 안 나옴');
        }
        if (i === 0 && n === 3) {
          await p.fill('#a', String(d)); await p.fill('#b', '3.1'); await p.fill('#c', r2(d * 3.1)); await p.click('#chk');
          if (!/3\.14/.test(await p.textContent('#wm'))) fail('원주율 3.1로 계산했을 때 안내가 안 나옴');
        }
        await p.fill('#a', String(d)); await p.fill('#b', '3.14'); await p.fill('#c', r2(d * 3.14)); await p.click('#chk');
        await p.waitForSelector('#nx', { timeout: 10000 });
        if (n === 4 && i === 1) { // 중간 새로고침: 같은 바퀴부터 이어서
          await p.reload(); await p.waitForSelector('#work #chk', { timeout: 15000 });
          if (!/자전거/.test(await p.textContent('h2'))) fail('1단계 새로고침 뒤 같은 바퀴가 아님');
          await p.fill('#a', String(d)); await p.fill('#b', '3.14'); await p.fill('#c', r2(d * 3.14)); await p.click('#chk');
          await p.waitForSelector('#nx', { timeout: 10000 });
        }
        await p.click('#nx');
      }
      await p.waitForFunction(() => /1단계 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.click('#tvgo');
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('1단계 TV 집계 안 됨'));
    await T.waitForFunction(() => /188\.4 cm/.test(document.querySelector('#tvroll').textContent), null, { timeout: 8000 }).catch(() => fail('TV 굴렁쇠가 188.4 cm를 안 보여 줌'));
    await shot(S[1], 's1'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: (지름) = (원주) ÷ (원주율). 5번은 곱하기 실수, 6번은 순서 바꾸기 실수
    await stage(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await pickRight(p, '#work', '÷');
      for (let i = 0; i < D.P.length; i++) {
        const { c, d } = D.P[i];
        await p.waitForSelector('#work #chk:not([disabled])', { timeout: 10000 });
        if (i === 0 && n === 5) {
          await p.fill('#a', String(c)); await p.fill('#b', '3.14'); await p.fill('#c', r2(c * 3.14)); await p.click('#chk');
          if (!/나눠요/.test(await p.textContent('#wm'))) fail('지름을 곱해서 구했을 때 안내가 안 나옴');
        }
        if (i === 0 && n === 6) {
          await p.fill('#a', '3.14'); await p.fill('#b', String(c)); await p.fill('#c', '0.03'); await p.click('#chk');
          if (!/순서/.test(await p.textContent('#wm'))) fail('나누는 순서를 바꿨을 때 안내가 안 나옴');
        }
        await p.fill('#a', String(c)); await p.fill('#b', '3.14'); await p.fill('#c', String(d)); await p.click('#chk');
        await p.waitForSelector('#nx', { timeout: 10000 });
        await p.click('#nx');
      }
      await p.waitForFunction(() => /2단계 끝/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.click('#tvgo');
    await T.waitForFunction(() => /지름 29 cm/.test(document.querySelector('#tvpost').textContent), null, { timeout: 8000 }).catch(() => fail('TV 기둥 지름 29 cm가 안 나옴'));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('2단계 TV 집계 안 됨'));
    await shot(S[5], 's2'); await shot(T, 't2');
    console.log('2단계 OK');

    // 3단계: 1·2, 3·4, 5·6 짝, 7번은 혼자(로봇 짝), 8번은 5조에 혼자 들어갔다가... 4조에 7·8
    await stage(3);
    const teamOf = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 5, 8: 4 };
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const p = S[n];
      await p.waitForSelector(`#tp button[data-t="${teamOf[n]}"]`, { timeout: 10000 });
      await p.click(`#tp button[data-t="${teamOf[n]}"]`);
      await p.waitForSelector('#give', { timeout: 10000 });
    }
    // 8번(4조)도 혼자라 로봇 짝. 꽉 찬 조 막기: 9번째 사람이 없으니 1조 버튼이 막혔는지 확인은 생략
    const play = async (n, rounds) => {
      const p = S[n];
      let made = 0, solved = 0, guard = 0, wrongDone = false;
      while ((made < rounds || solved < 3) && guard++ < 200) {
        // 짝 문제 풀기
        const inc = await p.$('#take .card.in #tchk:not([disabled])');
        if (inc && solved < 3) {
          const q = await p.textContent('#take .q');
          const v = parseFloat(q.match(/([\d.]+) cm/)[1]);
          const isD = q.includes('지름이');
          if (!wrongDone && n === 1) { // 식을 잘못 고르면 안내
            await p.click(`#ff button[data-f="${isD ? '/' : 'x'}"]`); await p.fill('#ta', '1'); await p.click('#tchk');
            if (!/곱해요|나눠요/.test(await p.textContent('#tm3'))) fail('짝 문제에서 식을 잘못 골랐을 때 안내가 안 나옴');
            wrongDone = true;
          }
          await p.click(`#ff button[data-f="${isD ? 'x' : '/'}"]`);
          await p.fill('#ta', r2(isD ? v * 3.14 : v / 3.14)); await p.click('#tchk');
          await p.waitForFunction(() => /맞았어요/.test(document.querySelector('#tm3')?.textContent || '') || !document.querySelector('#take .card.in'), null, { timeout: 8000 }).catch(() => fail(`${n}번 짝 문제 정답 처리 안 됨: ${q}`));
          solved++;
          await p.waitForTimeout(1000);
          continue;
        }
        // 문제 내기
        if (made < rounds && await p.$('#flip:not([disabled])')) {
          await p.click('#flip');
          await p.waitForSelector('#send', { timeout: 8000 });
          const d = 10 + n * 3 + made;
          await p.fill('#gd', String(d));
          if (await p.$('#gc')) {
            if (n === 3 && made === 0) { await p.fill('#gc', r2(d / 3.14)); await p.click('#send'); if (!/곱해요/.test(await p.textContent('#gm'))) fail('원주 계산 실수 안내가 안 나옴'); }
            await p.fill('#gc', r2(d * 3.14));
          }
          await p.click('#send');
          await p.waitForFunction(() => !document.querySelector('#send'), null, { timeout: 8000 });
          made++;
          continue;
        }
        await p.waitForTimeout(400);
      }
      if (solved < 3) fail(`${n}번이 3문제를 못 풂 (${solved})`);
    };
    await Promise.all([1, 2, 3, 4, 5, 6, 7, 8].map(n => play(n, 3)));
    await T.waitForFunction(() => /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 20000 }).catch(async () => fail('3단계 끝 8명이 TV에 안 보임: ' + await T.textContent('#cnt')));
    const tv3 = await T.textContent('#main');
    if (!/🤖/.test(tv3)) fail('TV 3단계에 로봇 짝 문제가 안 보임');
    if (!/1조/.test(tv3) || !/5조/.test(tv3)) fail('TV 3단계 조 표가 없음');
    await shot(S[1], 's3'); await shot(S[7], 's3-robot'); await shot(T, 't3');
    console.log('3단계 OK');

    // 4단계: 5번은 중간에 새로고침해서 이어 풀기
    await stage(4);
    const solve = async (p, count, wrongFirst) => {
      for (let q = 0; q < count; q++) {
        await p.waitForFunction(() => document.querySelector('#gz .q') && document.querySelector('#gz .opts button:not([disabled])'), null, { timeout: 10000 });
        const text = (await p.textContent('#gz .q')).trim();
        const a = ANS[text]; if (!a) { fail('정답을 모르는 문제: ' + text); return; }
        const on = await p.$$eval('#gz .prog span.on', e => e.length);
        if (q === 0 && wrongFirst) { const w = await p.$(`#gz .opts button:not([data-o="${a}"])`); await w.click(); }
        await p.click(`#gz .opts button[data-o="${a}"]`);
        await p.waitForFunction(k => !document.querySelector('#gz .q') || document.querySelectorAll('#gz .prog span.on').length > k, on, { timeout: 10000 });
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
      await p.waitForFunction(() => /완주/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.lane').length === 8 && /이 단계 끝 8명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 경주로 8명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /hoop-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
