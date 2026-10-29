// 우리 반 쿠키 증권 자동 테스트: 교사 화면 1개 + 학생 4명(🌟 쉬운 화면 1명)이 실제 Firebase 방에서
// 계좌 승인 → 쿠키 맡기기(가짜 다했니 API로 확인) → 첫 거래일 → 사고팔기 → 장부 고치기·남의 이름 주문 막기
// → 예측 → 새 날(주가 변동·예측 점수) → 쿠키로 바꾸기 → 장 마감 → 새로고침 → 프로젝트 끝(정산) → 시상식까지 해 봐요.
// 실행: node tests/stock-e2e.js   (다른 주소: URL=http://localhost:8000/stock/ node tests/stock-e2e.js)
// 다했니 API는 진짜로 부르지 않고 브라우저 안에서 가짜로 대답해요. 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/stock/';
const SHOTS = process.env.SHOTS || '';
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const ok = m => console.log('✅', m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const check = (c, m) => c ? ok(m) : fail(m);
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  // 가짜 다했니: 학생 코드마다 받은 쿠키(cookie)와 사용한 쿠키(usedCookie)
  const DH = {
    C1: { number: 1, name: '김하나', cookie: 40, usedCookie: 0 },
    C2: { number: 2, name: '이두리', cookie: 60, usedCookie: 5 },
    C3: { number: 3, name: '박세찬', cookie: 8, usedCookie: 0 },
    C4: { number: 4, name: '최네모', cookie: 12, usedCookie: 2 },
  };
  let dhCalls = 0;
  const mk = async (label, w = 1000, h = 900, ctx) => {
    if (!ctx) {
      ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', acceptDownloads: true });
      await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
      await ctx.route('https://api.dahandin.com/**', route => {
        dhCalls++;
        const u = new globalThis.URL(route.request().url());
        const key = route.request().headers()['x-api-key'];
        const s = DH[u.searchParams.get('code')];
        const body = key !== 'TESTKEY' ? { result: false, message: 'API KEY 가 올바르지 않습니다.' }
          : !s ? { result: false, message: '학생을 찾을 수 없어요' }
          : { result: true, message: 'success', data: { code: u.searchParams.get('code'), ...s, totalCookie: s.cookie - s.usedCookie, chocoChips: 0, badges: {} } };
        route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      });
    }
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    p.on('dialog', d => d.accept());
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };

  const T = await mk('교사', 1400, 1000);
  await T.goto(URL + '#teacher');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const M = () => T.evaluate(() => M);

  /* ---------- 들어가기와 승인 ---------- */
  const NAMES = ['김하나', '이두리', '박세찬', '최네모'];
  const S = [];
  for (let i = 0; i < 4; i++) {
    const p = await mk('학생' + (i + 1), 820, 1180);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-name', `${i + 1} ${NAMES[i]}`);
    if (i === 3) await p.check('#ez');
    await p.click('#enter');
    await p.waitForSelector('.fp', { timeout: 15000 });
    S.push(p);
  }
  await T.waitForFunction(() => document.querySelectorAll('[data-ok]').length === 4, null, { timeout: 15000 });
  const fps = await Promise.all(S.map(p => p.textContent('.fp')));
  const tvReq = await T.textContent('#reqs');
  check(fps.every(f => tvReq.includes(f.trim())), '선생님 화면에 학생 기기 그림이 똑같이 보임');
  await shot(S[0], 'stu-wait'); await shot(T, 'tv-approve');
  await T.click('#okAll');
  for (const p of S) await p.waitForSelector('.tabs', { timeout: 10000 });
  ok('학생 4명 계좌 승인');
  check(await S[3].evaluate(() => document.body.classList.contains('easy')), '쉬운 화면 켜짐');

  /* ---------- 설정: 마감 시간, 다했니 연결 ---------- */
  await T.click('#setBtn');
  await T.fill('#sc', '23:59');
  await T.fill('#dk', 'TESTKEY');
  await T.fill('#dc', '1 C1\n2 C2\n3 C3\n4 C4');
  await T.click('#test');
  await T.waitForFunction(() => document.querySelectorAll('#tres tr').length === 5, null, { timeout: 15000 });
  check(!(await T.textContent('#tres')).includes('이름이 달라요'), '다했니 연결 확인: 번호와 이름이 맞음');
  await shot(T, 'tv-settings');
  await T.click('#save');
  const dhStored = await T.evaluate(() => localStorage.getItem('stock-dh'));
  const pubRaw = await T.evaluate(() => JSON.stringify(PUBNOW));
  check(dhStored.includes('TESTKEY') && !pubRaw.includes('TESTKEY') && !pubRaw.includes('C1'), 'API 키·학생 코드는 선생님 컴퓨터에만 있고 서버에는 없음');

  /* ---------- 쿠키 맡기기 ---------- */
  const deposit = async (p, n) => {
    await p.click('[data-tab="cookie"]');
    for (let i = 1; i < n; i++) await p.click('#ip');
    await p.click('#inb');
    await p.waitForFunction(() => Object.values(MYO).some(o => o.r), null, { timeout: 15000 });
  };
  await deposit(S[0], 10); await deposit(S[1], 20); await deposit(S[2], 5); await deposit(S[3], 3);
  await T.waitForFunction(() => Object.values(M.ops).filter(o => o.st === 'wait' && o.snap).length === 4, null, { timeout: 15000 });
  ok('쿠키 맡기기 신청 4개, 신청할 때 다했니 쿠키를 읽어 둠');
  // 21개째는 한도(20개)를 넘어서 막혀요
  await S[1].evaluate(async () => { const ref = roomRef(me.room).child('orders/' + me.num).push(); const d = JSON.stringify({ id: ref.key, num: me.num, day: PUB.day, ts: now(), t: 'in', n: 1 }); await ref.set({ d, s: await signStr(KEYS.priv, d) }); });
  await S[1].waitForFunction(() => Object.values(MYO).filter(o => o.r).length === 2, null, { timeout: 10000 });
  check(await S[1].evaluate(() => Object.values(MYO).some(o => o.r && !o.r.ok && /최대 0개/.test(o.r.m))), '한도 20개를 넘는 맡기기는 막힘');
  await T.click('#cookieBtn');
  await T.waitForSelector('.opg');
  check((await T.textContent('#modal')).includes('보다 많아요'), '남은 쿠키의 절반을 넘는 신청(3번)에 주의 표시');
  await shot(T, 'tv-cookie');
  // 다했니에서 빼기 전에 확인을 누르면 안 돼요
  await T.click('[data-v="1|in"]');
  await T.waitForFunction(() => /덜 빠졌어요/.test(document.querySelector('#vm1in').textContent), null, { timeout: 10000 });
  ok('다했니에서 아직 안 뺐으면 확인이 안 됨');
  DH.C1.usedCookie += 10; DH.C2.usedCookie += 20; DH.C3.usedCookie += 5;
  for (const n of [1, 2, 3]) { await T.click(`[data-v="${n}|in"]`); await sleep(1200); }
  await T.click('[data-m="4|in"]'); // 4번은 직접 확인
  await T.waitForFunction(() => Object.values(M.ops).every(o => o.st === 'done'), null, { timeout: 15000 });
  await T.click('#mx');
  for (const [i, c] of [10000, 20000, 5000, 3000].entries()) await S[i].waitForFunction(c => myAcct().cash === c, c, { timeout: 10000 }).catch(() => {});
  const cash0 = await Promise.all(S.map(p => p.evaluate(() => myAcct().cash)));
  check(JSON.stringify(cash0) === JSON.stringify([10000, 20000, 5000, 3000]), '쿠키를 맡긴 만큼 투자할 돈이 들어옴: ' + cash0);

  /* ---------- 첫 거래일 ---------- */
  await T.click('#nextDay');
  await T.waitForSelector('#go');
  await shot(T, 'tv-newday');
  await T.click('#go');
  await T.waitForFunction(() => M.phase === 'open' && M.day === 1);
  for (const p of S) await p.waitForFunction(() => PUB && PUB.day === 1 && isOpen(PUB));
  ok('첫 거래일: 뉴스가 나오고 장이 열림');
  const firstNews = (await M()).today.t;
  await S[0].click('[data-tab="news"]');
  check((await S[0].textContent('#tabbox')).includes(firstNews), '학생 화면에 오늘의 뉴스');
  const effLeak = await S[0].evaluate(() => JSON.stringify(PUB));
  check(!/"eff"|"x":/.test(effLeak), '뉴스가 주가에 주는 영향은 학생에게 보이지 않음');

  /* ---------- 사고팔기 ---------- */
  const waitR = (p, k) => p.waitForFunction(k => Object.values(MYO).filter(o => o.r).length >= k, k, { timeout: 15000 });
  await S[0].click('[data-tab="market"]');
  await S[0].click('[data-co="chip"]');
  await S[0].click('#qp'); await S[0].click('#qp');
  await shot(S[0], 'stu-buy');
  await S[0].click('#buy');
  await waitR(S[0], 2);
  await S[0].waitForFunction(() => (myAcct().hold || {}).chip === 3);
  check(await S[0].evaluate(() => myAcct().cash === 4000), '1번: 반짝반도체 3주를 6,000원에 삼');
  await S[1].click('[data-tab="market"]');
  await S[1].click('[data-co="sea"]'); await S[1].click('#qmax'); await S[1].click('#buy');
  await S[1].waitForFunction(() => (myAcct().hold || {}).sea === 20);
  ok('2번: 바다해운을 살 수 있는 만큼(20주) 삼');
  await S[3].click('[data-tab="market"]');
  await S[3].click('[data-co="tteok"]');
  check(!(await S[3].$('#qp')), '쉬운 화면은 한 주씩만');
  await S[3].click('#buy');
  await S[3].waitForFunction(() => (myAcct().hold || {}).tteok === 1);
  ok('4번(쉬운 화면): 냠냠떡볶이 1주 삼');
  // 돈보다 많이 사려고 하면 막혀요 (버튼은 꺼져 있으니 직접 보내 봐요)
  await S[2].evaluate(async () => { const ref = roomRef(me.room).child('orders/' + me.num).push(); const d = JSON.stringify({ id: ref.key, num: me.num, day: PUB.day, ts: now(), t: 'buy', c: 'chip', q: 50 }); await ref.set({ d, s: await signStr(KEYS.priv, d) }); });
  await waitR(S[2], 2);
  check(await S[2].evaluate(() => Object.values(MYO).some(o => o.r && !o.r.ok && /모자라요/.test(o.r.m))), '돈이 모자란 주문은 막힘');

  /* ---------- 장부 지키기 ---------- */
  await S[2].evaluate(() => roomRef(me.room).child('pub/acct/3/cash').set(999999));
  await S[2].waitForFunction(() => myAcct().cash === 5000, null, { timeout: 10000 });
  check((await M()).tamper >= 1, '학생이 보여 주는 장부(돈)를 고쳐도 선생님 화면이 되돌림');
  await S[2].evaluate(() => roomRef(me.room).child('pub/prices/chip').set(1));
  await S[2].waitForFunction(() => PUB.prices.chip === 2000, null, { timeout: 10000 });
  ok('주가를 고쳐도 되돌림');
  // 3번이 자기 열쇠로 1번 이름의 주문을 넣어요
  await S[2].evaluate(async () => { const ref = roomRef(me.room).child('orders/1').push(); const d = JSON.stringify({ id: ref.key, num: 1, day: PUB.day, ts: now(), t: 'sell', c: 'chip', q: 3 }); await ref.set({ d, s: await signStr(KEYS.priv, d) }); });
  await S[0].waitForFunction(() => Object.values(MYO).some(o => o.r && !o.r.ok && /내 태블릿/.test(o.r.m)), null, { timeout: 10000 });
  check(await S[0].evaluate(() => myAcct().hold.chip === 3), '다른 친구 이름으로 넣은 주문은 막힘 (1번 주식 그대로)');
  // 서명 없이 가격·수량을 고친 주문
  await S[2].evaluate(async () => { const ref = roomRef(me.room).child('orders/' + me.num).push(); const d = JSON.stringify({ id: ref.key, num: me.num, day: PUB.day, ts: now(), t: 'buy', c: 'tteok', q: 1 }); const s = await signStr(KEYS.priv, d); await ref.set({ d: d.replace('"q":1', '"q":2'), s }); });
  await waitR(S[2], 3);
  check(await S[2].evaluate(() => !(myAcct().hold || {}).tteok), '서명과 내용이 다른 주문은 막힘');

  /* ---------- 예측 ---------- */
  await S[0].click('[data-tab="news"]');
  await S[0].click('.upk [data-c="volt"]'); await S[0].click('.dnk [data-c="sea"]');
  await S[0].fill('#why', '전기차가 많이 팔리면 배터리가 더 필요해요');
  await S[0].click('#psave');
  await S[1].click('[data-tab="news"]');
  await S[1].click('.upk [data-c="sea"]'); await S[1].click('.dnk [data-c="volt"]'); await S[1].click('#psave');
  await S[0].waitForFunction(() => MYP && MYP.up === 'volt');
  await T.waitForFunction(() => Object.keys(PRED).length === 2);
  ok('예측 2명 저장, TV에 예측한 친구 수');
  await shot(S[0], 'stu-news'); await shot(T, 'tv-day1');

  /* ---------- 새 날 ---------- */
  const before = await M();
  await T.click('#nextDay'); await T.waitForSelector('#go');
  await T.click('[data-own="1"]');
  await T.fill('#ne', '🏃'); await T.fill('#nt', '우리 학교 체육대회가 열려요'); await T.fill('#nb', '운동장에 사람이 많이 모여요.');
  await T.click('.seg[data-c="tteok"] [data-v="2"]');
  await T.click('#go');
  await T.waitForFunction(() => M.day === 2);
  const m2 = await M();
  const okPrice = Object.keys(m2.prices).every(k => m2.hist[k].length === 2 && m2.hist[k][1] === m2.prices[k] && m2.prices[k] % 10 === 0);
  check(okPrice, '주가가 바뀌고 그래프 기록이 늘어남: ' + JSON.stringify(m2.chg));
  const exp = p => (m2.chg[p.up] > 0 ? 1 : 0) + (m2.chg[p.down] < 0 ? 1 : 0);
  check(m2.acct[1].pt === exp({ up: 'volt', down: 'sea' }) && m2.acct[2].pt === exp({ up: 'sea', down: 'volt' }), `예측 점수가 주가 변화와 맞음 (1번 ${m2.acct[1].pt}점, 2번 ${m2.acct[2].pt}점)`);
  check(m2.today.t === '우리 학교 체육대회가 열려요' && m2.eff.tteok === 2, '선생님이 직접 쓴 뉴스가 오늘의 뉴스');
  await S[0].waitForFunction(() => PUB.day === 2 && PUB.reveal);
  check((await S[0].textContent('#tabbox')).includes(before.today.t), '학생 화면에 어제 뉴스 결과');
  const v1 = await S[0].evaluate(() => myAcct());
  check(v1.v === v1.cash + 3 * (await M()).prices.chip, '1번 자산 = 돈 + 주식 × 오늘 값');

  /* ---------- 팔기와 쿠키로 바꾸기 ---------- */
  await S[0].click('[data-tab="market"]');
  if (await S[0].$('#x')) await S[0].click('#x');
  await S[0].click('[data-co="chip"]');
  await S[0].click('#sell');
  await S[0].waitForFunction(() => (myAcct().hold || {}).chip === 2);
  const chipNow = (await M()).prices.chip;
  check(await S[0].evaluate(p => myAcct().cash === 4000 + p, chipNow), '1번: 반짝반도체 1주를 오늘 값에 팜');
  await S[0].click('[data-tab="cookie"]'); await S[0].click('#op'); await S[0].click('#outb');
  await S[0].waitForFunction(() => myAcct().res === 2000);
  check(await S[0].evaluate(p => myAcct().cash === 2000 + p, chipNow), '쿠키 2개로 바꾸기 신청: 돈 2,000원을 따로 둠');
  DH.C1.cookie += 2;
  await T.click('#cookieBtn'); await T.waitForSelector('[data-v="1|out"]');
  await T.click('[data-v="1|out"]');
  await S[0].waitForFunction(() => myAcct().wd === 2 && !myAcct().res, null, { timeout: 10000 });
  ok('다했니에서 쿠키 2개를 준 것을 확인하고 끝냄');
  await T.click('#mx');

  /* ---------- 장 마감 ---------- */
  await T.click('#closeNow');
  await S[1].waitForFunction(() => !isOpen(PUB));
  await S[1].click('[data-tab="market"]');
  if (!(await S[1].$('#sell'))) await S[1].click('[data-co="sea"]');
  check(await S[1].isDisabled('#sell'), '장이 닫히면 팔기 버튼이 꺼짐');
  await S[1].evaluate(async () => { const ref = roomRef(me.room).child('orders/' + me.num).push(); const d = JSON.stringify({ id: ref.key, num: me.num, day: PUB.day, ts: now(), t: 'sell', c: 'sea', q: 5 }); await ref.set({ d, s: await signStr(KEYS.priv, d) }); });
  await S[1].waitForFunction(() => Object.values(MYO).some(o => o.r && /닫힌 뒤/.test(o.r.m)), null, { timeout: 10000 });
  check(await S[1].evaluate(() => myAcct().hold.sea === 20), '장이 닫힌 뒤 보낸 주문은 막힘');
  await shot(S[1], 'stu-closed');

  /* ---------- 새로고침해도 그대로 ---------- */
  await S[1].reload(); await S[1].waitForSelector('.tabs', { timeout: 15000 });
  check(await S[1].evaluate(() => myAcct().hold.sea === 20), '학생 새로고침: 같은 계좌로 돌아옴');
  await T.reload(); await T.waitForSelector('#tvb', { timeout: 20000 });
  check((await T.textContent('.roomcode')).trim() === code && (await M()).day === 2, '선생님 새로고침: 같은 방, 같은 장부');
  const T2 = await mk('교사2', 1200, 800, T.context());
  await T2.goto(URL + '#teacher');
  await T2.waitForSelector('#retry', { timeout: 15000 });
  ok('같은 컴퓨터의 두 번째 창은 장부를 열지 않음');
  await T2.close();

  /* ---------- 프로젝트 끝 ---------- */
  await T.click('#endBtn');
  await T.waitForFunction(() => M.phase === 'end');
  const m3 = await M();
  const fin = Object.values(m3.ops).filter(o => o.fin);
  const allSold = Object.values(m3.acct).every(a => !Object.keys(a.hold).length && a.cash === 0);
  const rounds = Object.entries(m3.acct).every(([n, a]) => { const o = m3.ops['fin' + n]; return Math.round(a.fin.cash / 1000) === (o ? o.n : 0); });
  check(allSold && rounds && fin.length === 4, '끝: 모든 주식을 팔고 쿠키로 바꿔 돌려줄 목록을 만듦 ' + fin.map(o => `${o.num}번 ${o.n}개`).join(', '));
  await S[2].waitForFunction(() => PUB.phase === 'end');
  await S[2].click('[data-tab="cookie"]');
  check((await S[2].textContent('#tabbox')).includes('돌려받기'), '학생 화면에 돌려받을 쿠키');
  await T.click('#cookieBtn'); await T.waitForSelector('[data-v="3|out"]');
  check(!(await T.$('[data-c="3|out"]')), '마지막 정산은 취소할 수 없음');
  DH.C3.cookie += m3.ops.fin3.n;
  await T.click('[data-v="3|out"]');
  await T.waitForFunction(() => M.ops.fin3.st === 'done', null, { timeout: 10000 });
  for (const n of [1, 2, 4]) await T.click(`[data-m="${n}|out"]`);
  await T.waitForFunction(() => Object.values(M.ops).every(o => o.st !== 'wait'));
  ok('마지막 정산 쿠키를 모두 돌려줌');
  await T.click('#mx');
  const fin2 = await M();
  for (const [n, a] of Object.entries(fin2.acct)) console.log(`   ${n}번 ${a.name}: 맡김 ${a.dep}개 → 돌려받음 ${a.wd}개, 예측 ${a.pt}점`);
  await T.click('#aw');
  await T.waitForSelector('.podium');
  await shot(T, 'tv-award');
  ok('시상식');
  console.log('다했니 API 호출', dhCalls, '번');

  await T.evaluate(c => Promise.all([roomRef(c).remove(), db.ref('rooms/' + c + '_watch').remove()]), code);
  ok('테스트 방 지움');
  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
