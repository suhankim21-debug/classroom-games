// 세계 무역 박람회 자동 테스트: 교사 화면 1개 + 학생 10명(5나라, 짝 2명씩)이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/expo-e2e.js   (다른 주소: URL=http://localhost:8000/expo/ node tests/expo-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/expo/';
const SHOTS = process.env.SHOTS || '';
const N = 10;
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
  const NAT = await T.evaluate(() => NATIONS);
  const KINDS = await T.evaluate(() => KINDS);
  const SORTA = await T.evaluate(() => Object.fromEntries(SORT.map(x => [x.n, x.a])));
  const ANS = await T.evaluate(() => Object.fromEntries([...WHYQ, ...QUIZ, ...NATIONS.map(x => x.q)].map(q => [q.q, q.a])));
  NAT.forEach(x => { ANS[`${x.n}에서 이 무역이 발달한 까닭은 어느 쪽일까요?`] = `${KINDS[x.kind].e} ${KINDS[x.kind].n}`; });
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
  const nationOf = n => NAT[(n - 1) >> 1];
  const S = {};
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click(`#nat button[data-n="${nationOf(n).id}"]`);
      await p.click('#enter');
      await p.waitForSelector('.sortcard', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);
    await T.click('.cw-open');
    await T.waitForFunction(n => [...document.querySelectorAll('.cw-card:not(.off)')].filter(x => /\d+번 학생\d+/.test(x.textContent) && /1\/4/.test(x.textContent)).length === n, N, { timeout: 15000 })
      .catch(async () => fail('학생 화면 보기에 학생들이 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.textContent.slice(0, 30)).join(' | ')))));
    await T.click('.cw-close');

    // 1단계: 수입품·수출품 나누기 8장 (3번은 한 번 틀려 봐요) → 까닭 3문제 → 특징 쓰기
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      for (let k = 0; k < 8; k++) {
        await p.waitForSelector('.sortbtn button:not([disabled])', { timeout: 10000 });
        const nm = (await p.textContent('.sortcard .nm')).trim();
        const a = SORTA[nm]; if (!a) { fail('모르는 카드: ' + nm); return; }
        if (n === 3 && k === 0) {
          await p.click(`.sortbtn button[data-a="${a === 'in' ? 'out' : 'in'}"]`);
          if (!/다시 생각해요/.test(await p.textContent('#sm'))) fail('나누기를 틀렸을 때 안내가 안 나옴');
        }
        const on = await p.$$eval('#sb .prog span.on', e => e.length);
        await p.click(`.sortbtn button[data-a="${a}"]`);
        await p.waitForFunction(k => !document.querySelector('#sb .prog') || document.querySelectorAll('#sb .prog span.on').length > k, on, { timeout: 10000 });
      }
      await solve(p, '#qz', 3, n === 2);
      await p.waitForSelector('#feat', { timeout: 10000 });
      if (n % 2) await p.fill('#feat', '천연자원을 수입해서 기술로 상품을 만들어 수출해요.');
      else { await p.click('details summary'); await p.click('.chips button >> nth=0'); }
      await p.click('#send');
      await p.waitForFunction(() => /보냈어요/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent) && document.querySelectorAll('.list div').length === 10, null, { timeout: 15000 }).catch(() => fail('1단계 끝 10명 / 특징 10개가 TV에 안 보임'));
    if (!(await T.$('.chipz span.hard'))) fail('TV에 헷갈린 카드 표시가 없음');
    await shot(S[1], 's1-done'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: 대표 수출품(한 번 틀려 봐요) → 까닭 → 홍보 문구. 타이는 짝 둘이 동시에 홍보관 열기
    await stage(2);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n; const x = nationOf(n);
      await p.waitForSelector('.prodpick button', { timeout: 10000 });
      if (n === 1) {
        await p.click(`.prodpick button:not([data-p="${x.prod.n}"]) >> nth=0`);
        if (!/다시 읽어/.test(await p.textContent('#pm'))) fail('대표 수출품을 틀렸을 때 안내가 안 나옴');
      }
      await p.click(`.prodpick button[data-p="${x.prod.n}"]`);
      await p.waitForSelector('.kinds button', { timeout: 10000 });
      await p.click(`.kinds button[data-k="${x.kind}"]`);
      await p.waitForSelector('#sl', { timeout: 10000 });
    }));
    const opened = await Promise.all(NAT.slice(0, 5).map(async (x, i) => {
      const p = S[i * 2 + 1], q = S[i * 2 + 2];
      await p.fill('#sl', x.sl[0]);
      if (i === 1) await p.fill('#nw', '사우디아라비아 원유 수출 뉴스');
      if (i === 0) { await q.click('details summary'); await q.click('.chips button >> nth=1'); await Promise.all([p.click('#open'), q.click('#open')]); }
      else await p.click('#open');
      await p.waitForSelector('#boothDone', { timeout: 10000 });
      await q.waitForSelector('#boothDone', { timeout: 10000 }).catch(() => fail(x.n + ' 짝 화면이 홍보관 완성으로 안 바뀜'));
    }));
    await T.waitForFunction(() => tvOpen().length === 5 && document.querySelectorAll('.cols .booth').length === 5, null, { timeout: 10000 }).catch(() => fail('TV에 홍보관 5개가 안 보임'));
    const kinds = await T.evaluate(() => [...document.querySelectorAll('.cols>div')].map(d => d.querySelectorAll('.booth').length).join(','));
    if (kinds !== '2,3,0') fail('TV 세 갈래 홍보관 수가 다름: ' + kinds);
    await T.waitForFunction(() => Object.values(RD.log || {}).filter(l => /홍보관이 열렸어요/.test(l.t)).length >= 5, null, { timeout: 10000 }).catch(() => {});
    await T.waitForTimeout(1500);
    const logs = await T.evaluate(() => Object.values(RD.log || {}).filter(l => /홍보관이 열렸어요/.test(l.t)).length);
    if (logs !== 5) fail('홍보관 열림 소식이 5개가 아님 (동시 열기 중복?): ' + logs);
    await shot(S[3], 's2'); await shot(T, 't2');
    console.log('2단계 OK', kinds);

    // 3단계: 모두 다른 나라 홍보관 4곳을 방문해 도장 받기 (4번은 중간에 새로고침)
    await stage(3);
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await p.waitForSelector('[data-v]', { timeout: 10000 });
      const ids = await p.$$eval('[data-v]', b => b.map(x => x.dataset.v));
      if (ids.length !== 4) fail(`${n}번 홍보관 목록이 4개가 아님: ${ids}`);
      for (let k = 0; k < ids.length; k++) {
        if (n === 4 && k === 2) { await p.reload(); }
        await p.waitForSelector(`[data-v="${ids[k]}"]`, { timeout: 15000 });
        await p.click(`[data-v="${ids[k]}"]`);
        await solve(p, '#vq', 2, n === 5 && k === 0);
        await p.waitForSelector('#next', { timeout: 10000 });
        await p.click('#next');
      }
      await p.waitForFunction(() => /박람회 완주/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail(n + '번 완주 화면이 안 나옴'));
    }));
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('3단계 끝 10명이 아님'));
    const visits = await T.evaluate(() => tvOpen().map(x => Object.keys(RD.c[x.id].visits || {}).length).join(','));
    if (visits !== '8,8,8,8,8') fail('홍보관마다 손님 8명이 아님: ' + visits);
    const arrows = await T.$$eval('.map path[marker-end]', e => e.length);
    if (arrows !== 20) fail('지도 무역 화살표가 20개(5나라×4)가 아님: ' + arrows);
    await shot(S[1], 's3'); await shot(T, 't3');
    console.log('3단계 OK', visits);

    // 👀 단계별 화면: 지나온 단계 화면이 모였는지
    await T.click('.cw-open');
    await T.click('.cw-tabs button[data-tab="steps"]');
    await T.waitForFunction(() => document.querySelectorAll('.cw-col').length >= 8, null, { timeout: 10000 }).catch(async () => fail('단계별 화면 단계 수가 적음: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-col .cw-ch span')].map(x => x.textContent).join(' / ')))));
    console.log('단계별 화면:', await T.evaluate(() => [...document.querySelectorAll('.cw-col .cw-ch span')].map(x => x.textContent).join(' → ')));
    await shot(T, 't-watch-steps');
    await T.click('.cw-close');

    // 4단계: 5번은 새로고침 이어 풀기, 6번은 보기 2개
    await stage(4);
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
      await p.waitForFunction(() => /박람회 박사 완료/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.rank .r').length === 10 && /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 순위표 10명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /expo-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
