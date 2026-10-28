// 무역 실험실 자동 테스트: 교사 화면 1개 + 학생 10명(5나라, 짝 2명씩)이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/tradelab-e2e.js   (다른 주소: URL=http://localhost:8000/tradelab/ node tests/tradelab-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/tradelab/';
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
  const ANS = await T.evaluate(() => Object.fromEntries([...IFS, ...QUIZ].map(q => [q.q, q.a])));
  const NAT = await T.evaluate(() => NATIONS);
  const GOODS = await T.evaluate(() => GOODS.map(g => g.id));
  const best = x => Object.entries(x.r).sort((a, b) => b[1] - a[1])[0][0];
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
  const allocate = async (p, alloc) => {
    for (const [g, k] of Object.entries(alloc)) for (let i = 0; i < k; i++) await p.click(`[data-p="${g}"]`);
  };
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#nm', `${n} 학생${n}`);
      await p.click(`#nat button[data-n="${nationOf(n).id}"]`);
      await p.click('#enter');
      await p.waitForSelector('#qz .q', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 만약에 카드 4장 → 까닭 쓰기 (짝수 번호는 보기에서 고르기)
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      await solve(p, '#qz', 4, n === 2);
      await p.waitForSelector('#why', { timeout: 10000 });
      if (n % 2) await p.fill('#why', '한 나라에서 모든 것을 다 구할 수 없기 때문이에요.');
      else { await p.click('details summary'); await p.click('.chips button >> nth=1'); }
      await p.click('#send');
      await p.waitForFunction(() => /보냈어요/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent) && document.querySelectorAll('.list div').length === 10, null, { timeout: 15000 }).catch(() => fail('1단계 끝 10명 / 까닭 10개가 TV에 안 보임'));
    await shot(S[1], 's1-done'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: 1라운드 자급자족. 상품마다 2개 이상 되게 나누고 남는 일손은 특기에
    await stage(2);
    await Promise.all(NAT.map(async (x, i) => {
      const p = S[i * 2 + 1];
      await p.waitForSelector('#make', { timeout: 10000 });
      if (await p.$('[data-to]')) fail('1라운드에 무역 화면이 보임');
      const a = {}; let used = 0;
      for (const g of GOODS) if (x.r[g] > 0) { a[g] = Math.ceil(2 / x.r[g]); used += a[g]; }
      a[best(x)] += 10 - used;
      if (x.r.rice === 0 && !(await p.$eval('[data-p="rice"]', b => b.disabled))) fail('사막나라 쌀 + 버튼이 눌림');
      await allocate(p, a);
      await p.click('#make');
      await p.waitForFunction(() => /1라운드 결과/.test(document.body.textContent), null, { timeout: 10000 });
      // 짝 화면도 결과로 바뀌어야 해요
      await S[i * 2 + 2].waitForFunction(() => /1라운드 결과/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail(x.n + ' 짝 화면이 결과로 안 바뀜'));
    }));
    await T.waitForFunction(() => RD.c && NATIONS.every(x => RD.c[x.id] && RD.c[x.id].r1), null, { timeout: 10000 }).catch(() => fail('TV에 1라운드 결과가 다 안 옴'));
    const r1 = await T.evaluate(() => NATIONS.map(x => sets((RD.c[x.id].r1 || {}).inv)));
    if (JSON.stringify(r1) !== '[2,2,0,2,2]') fail('1라운드 꾸러미가 예상과 다름: ' + r1);
    await T.waitForFunction(() => /우리반꾸러미8/.test(document.querySelector('.bigsum').textContent.replace(/\s/g, '')), null, { timeout: 10000 }).catch(() => fail('TV 1라운드 합계 8이 안 보임'));
    await shot(S[5], 's2'); await shot(T, 't2');
    console.log('2단계 OK', r1.join(','));

    // 3단계: 모두 특기에 일손 10명. 들판나라는 짝 둘이 동시에 생산 버튼을 눌러 봐요
    await stage(3);
    await Promise.all(NAT.map(async (x, i) => {
      const p = S[i * 2 + 1], q = S[i * 2 + 2];
      await p.waitForSelector('#make', { timeout: 10000 });
      await allocate(p, { [best(x)]: 10 });
      if (i === 0) {
        await q.waitForSelector('#make'); await allocate(q, { rice: 10 });
        await Promise.all([p.click('#make'), q.click('#make')]);
      } else await p.click('#make');
      await p.waitForSelector('#steps + .panel .inv', { timeout: 10000 });
    }));
    await T.waitForFunction(() => NATIONS.every(x => RD.c[x.id].r2), null, { timeout: 10000 }).catch(() => fail('TV에 2라운드 생산이 다 안 옴'));
    const r2start = await T.evaluate(() => NATIONS.map(x => JSON.stringify(RD.c[x.id].r2.inv)));
    if (!/"rice":40/.test(r2start[0])) fail('동시 생산 뒤 들판나라 쌀이 40이 아님: ' + r2start[0]);
    // 나라끼리 특기 상품 8개씩 바꿔요 (10번)
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
      const p = S[i * 2 + 1], q = S[j * 2 + (j % 2 ? 2 : 1)];
      const gi = best(NAT[i]), gj = best(NAT[j]);
      await p.click(`[data-to="${NAT[j].id}"]`);
      await p.click(`[data-give="${gi}"]`); await p.click(`[data-get="${gj}"]`);
      for (let k = 0; k < 4; k++) { await p.click('#gp'); await p.click('#tp'); }
      await p.click('#propose');
      await q.waitForSelector('[data-ok]', { timeout: 10000 });
      await q.click('[data-ok]');
      await T.waitForFunction(k => Object.keys(RD.log || {}).length >= k, (i * (9 - i)) / 2 + (j - i), { timeout: 10000 }).catch(() => fail(`무역 ${NAT[i].n}↔${NAT[j].n} 기록이 안 남음`));
    }
    // 한 번은 거절, 한 번은 창고보다 많이 달라는 제안
    {
      const p = S[1], q = S[3];
      await p.click('[data-to="n2"]'); await p.click('[data-give="rice"]'); await p.click('[data-get="cloth"]'); await p.click('#propose');
      await q.waitForSelector('[data-no]'); await q.click('[data-no]');
      await p.waitForFunction(() => !document.querySelector('[data-cancel]'), null, { timeout: 8000 }).catch(() => fail('거절한 제안이 남아 있음'));
      await p.click('[data-to="n2"]'); await p.click('[data-give="rice"]'); await p.click('[data-get="cloth"]');
      for (let k = 0; k < 36; k++) await p.click('#tp');
      await p.click('#propose');
      await q.waitForSelector('[data-ok]');
      if (!(await q.$eval('[data-ok]', b => b.disabled))) fail('창고에 모자란 제안을 수락할 수 있음');
      await q.click('[data-no]');
    }
    const r2 = await T.evaluate(() => NATIONS.map(x => sets(RD.c[x.id].r2.inv)));
    if (JSON.stringify(r2) !== '[8,8,8,8,8]') fail('2라운드 꾸러미가 예상과 다름: ' + r2);
    await T.waitForFunction(() => /2라운드꾸러미40/.test(document.querySelector('.bigsum').textContent.replace(/\s/g, '')), null, { timeout: 10000 }).catch(() => fail('TV 2라운드 합계 40이 안 보임'));
    const exim = await T.evaluate(() => NATIONS.map(x => `${RD.c[x.id].r2.ex}/${RD.c[x.id].r2.im}`));
    if (exim.some(v => v !== '32/32')) fail('수출/수입 집계가 다름: ' + exim);
    await shot(S[1], 's3'); await shot(S[2], 's3-partner'); await shot(T, 't3');
    console.log('3단계 OK', r2.join(','));

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
      await p.waitForFunction(() => /무역 박사 완료/.test(document.body.textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(() => document.querySelectorAll('.rank .r').length === 10 && /이 단계 끝 10명/.test(document.querySelector('#cnt').textContent), null, { timeout: 15000 }).catch(() => fail('4단계 순위표 10명이 안 보임'));
    await shot(T, 't4');
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 나옴'));
    await shot(T, 't4-award'); await shot(S[1], 's4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /tradelab-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    await T.evaluate(c => firebase.database().ref('rooms/' + c).remove(), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
