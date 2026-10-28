// 무역 왕국 자동 테스트: 교사 화면 1개 + 학생 5나라가 실제 Firebase 방에서 끝까지 플레이해요.
// 실행: node tests/trade-e2e.js   (다른 주소: URL=http://localhost:8000/trade/ node tests/trade-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/trade/';
const SENDS = { // from: [[to,res,count]]
  1: [[2,1,2],[3,1,2],[4,1,2],[5,1,2]],
  2: [[1,2,1],[3,2,2],[4,2,2],[5,2,1]],
  3: [[1,3,1],[2,3,1],[5,3,1]],
  4: [[1,4,2],[2,4,2],[5,4,2]],
  5: [[1,5,2],[3,5,2],[4,5,2]],
};
const MISSION = {1:['phone','shirt'],2:['bread','phone'],3:['bread','shirt'],4:['bread','shirt'],5:['phone','bread']};
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  const mk = async (label) => {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    // 이 클라우드 환경은 Firebase 샤드 주소를 막아서, 새로고침 때 기본 주소로 다시 붙도록 캐시를 비워요
    await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    return p;
  };
  const T = await mk('교사');
  await T.goto(URL + '#teacher');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  let ok = false;
  try {
    const S = {};
    await Promise.all([1,2,3,4,5].map(async n => {
      const p = await mk(n + '나라'); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.click(`#nl button[data-n="${n}"]`);
      await p.fill('#p1', `${n} 학생${n}`); await p.fill('#p2', `${n+10} 짝${n}`);
      await p.click('#enter');
      await p.waitForSelector('#send', { timeout: 15000 });
    }));
    console.log('5나라 참여 완료');
    // 👀 학생 화면: 모둠 나라 이름과 '무역하기' 단계로 보여요
    await T.click('.cw-open');
    await T.waitForFunction(() => [...document.querySelectorAll('.cw-tile:not(.off)')].filter(x => /\d모둠/.test(x.textContent) && /무역하기/.test(x.textContent) && x.querySelector('.cw-scr main')).length === 5, null, { timeout: 15000 })
      .catch(async () => fail('학생 화면 보기에 5나라가 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-tile')].map(x => x.textContent.slice(0, 40)).join(' | ')))));
    await T.click('.cw-close');
    // 중복 참여 확인
    const dup = await mk('중복');
    await dup.goto(URL + '?room=' + code);
    await dup.click('#nl button[data-n="1"]'); await dup.fill('#p1', '99 다른학생'); await dup.click('#enter');
    await dup.waitForFunction(() => /이미/.test(document.querySelector('#jm')?.textContent||''), null, { timeout: 10000 })
      .then(() => console.log('중복 나라 막기 OK')).catch(() => fail('같은 나라에 다른 모둠이 들어가도 막히지 않음'));
    await dup.context().close();

    // 동시에 보내기
    const t0 = Date.now();
    await Promise.all([1,2,3,4,5].map(async n => {
      const p = S[n];
      for (const [to, res, cnt] of SENDS[n]) for (let i = 0; i < cnt; i++) {
        await p.click('#send');
        await p.click(`[data-to="${to}"]`); await p.click(`[data-r="${res}"]`);
        await p.click('#go');
        await p.waitForSelector('#send, #nl, #enter, .win', { timeout: 15000 });
        if (await p.$('#nl')) { fail(`${n}나라: 보내기 후 나라 선택 화면으로 튕김`); throw new Error('bounced'); }
        const msg = await p.textContent('.msg[role=status]').catch(()=> '');
        if (!/수출했어요/.test(msg)) fail(`${n}나라 → ${to}나라 자원${res} 보내기 실패: "${msg}"`);
      }
    }));
    console.log('보내기 29번', ((Date.now()-t0)/1000).toFixed(1)+'초');
    // 상품 만들기
    for (const n of [1,2,3,4,5]) {
      const p = S[n];
      for (const prod of MISSION[n]) {
        const b = `[data-make="${prod}"]:not([disabled])`;
        try { await p.waitForSelector(b, { timeout: 10000 }); } catch { fail(`${n}나라 ${prod} 만들기 버튼이 켜지지 않음`); continue; }
        await p.dblclick(b).catch(()=>{});
        await p.waitForTimeout(600);
      }
      try { await p.waitForSelector('.win', { timeout: 10000 }); console.log(n + '나라 무역 성공 화면 OK'); }
      catch { fail(`${n}나라 성공 화면이 안 뜸`); }
    }
    // 새로고침 후 이어하기
    await S[3].reload(); 
    await S[3].waitForSelector('.win, #send', { timeout: 15000 }).then(()=>console.log('새로고침 후 이어하기 OK')).catch(()=>fail('새로고침하면 나라를 잃어버림'));
    // 남은 자원 보내러 가기
    await S[3].click('#help').catch(()=>{});
    await S[3].waitForSelector('#backWin', {timeout:5000}).then(()=>console.log('도와주기 화면 OK')).catch(()=>fail('남은 자원 보내러 가기 화면 안 뜸'));

    // 교사 화면 확인
    await T.waitForTimeout(1500);
    const tv = await T.evaluate(() => ({
      cnt: document.querySelector('#cnt').textContent,
      st: [...document.querySelectorAll('#live .lrow .st')].map(e=>e.textContent),
      won: document.querySelectorAll('#live .lrow.won').length,
      feedTrade: [...document.querySelectorAll('#feed li')].filter(l=>/→/.test(l.textContent)).length,
      feedMake: [...document.querySelectorAll('#feed li')].filter(l=>/완성/.test(l.textContent)).length,
      data: ROOMDATA,
    }));
    console.log('교사 화면:', tv.cnt, tv.st.join(','), '성공', tv.won, '| 소식: 무역', tv.feedTrade, '완성', tv.feedMake);
    const feedAll = Object.values(tv.data.feed||{});
    const trades = feedAll.filter(f=>f.k==='trade').length, makes = feedAll.filter(f=>f.k==='make').length;
    console.log('DB 소식 수: 무역', trades, '완성', makes);
    if (tv.cnt !== '5/5 나라 참여') fail('교사 화면 참여 수 이상: ' + tv.cnt);
    if (tv.won !== 5) fail('교사 화면 성공 나라 수 ' + tv.won);
    if ([...tv.st].sort().join() !== '1등,2등,3등,4등,5등') fail('순위 이상: ' + tv.st.join(','));
    if (trades !== 29) fail('DB 무역 소식 수 ' + trades + ' (기대 29)');
    if (makes !== 10) fail('DB 완성 소식 수 ' + makes + ' (기대 10)');
    // 자원 보존 확인
    const tot = {1:0,2:0,3:0,4:0,5:0,6:0}; let outS=0,inS=0;
    for (const n of [1,2,3,4,5]) { const v = tv.data.nations[n]; for (const r in v.inv) tot[r]+=v.inv[r]; outS+=v.out||0; inS+=v.in||0; }
    for (const p of Object.values(MISSION).flat()) { const need={bread:{1:2,2:1},shirt:{5:2,2:1},phone:{4:2,3:1}}[p]; for (const r in need) tot[r]+=need[r]; }
    console.log('자원 합계(쓴 것 포함):', JSON.stringify(tot), '수출합', outS, '수입합', inS);
    for (const r of [1,2,3,4,5]) if (tot[r] !== 8) fail(`자원${r} 합계 ${tot[r]} (기대 8)`);
    if (tot[6] !== 15) fail('금화 합계 ' + tot[6]);
    if (outS !== 29 || inS !== 29) fail(`수출/수입 횟수 ${outS}/${inS}`);
    // 타이머 & 시상식
    await T.click('#go'); await T.waitForTimeout(1500);
    const tm = await T.textContent('#tm'); if (!/^4:5\d$/.test(tm)) fail('타이머가 안 줄어듦: ' + tm); else console.log('타이머 OK', tm);
    await T.click('#go');
    await T.click('#award'); await T.waitForSelector('.podium');
    const pod = await T.textContent('.podium'); console.log('시상식:', pod.replace(/\s+/g,' '));
    ok = true;
  } catch (e) { fail('테스트 중단: ' + e.message); }
  finally {
    const del = await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]).then(()=> 'deleted', e => 'delete failed: ' + e.message), code);
    console.log('방 데이터 정리:', del);
    await browser.close();
    console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
