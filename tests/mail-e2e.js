// 섭외 메일 작업실 자동 테스트: 교사 화면 1개 + 학생 5명(1~4조, 1조는 짝 2명)이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/mail-e2e.js   (다른 주소: URL=http://localhost:8000/mail/ node tests/mail-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/mail/';
const SHOTS = process.env.SHOTS || '';
const N = 5;
const TEAM = [1, 2, 3, 4, 1];
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
  const S = [];
  for (let n = 1; n <= N; n++) {
    const p = await mk('학생' + n, 900, 1200);
    await p.goto(URL + '?room=' + code + '&tfwait=1');
    await p.fill('#cw-name', `${n} 학생${n}`);
    await p.click('#enter');
    S.push(p);
  }
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 30000 })
    .catch(async () => fail(`끝난 학생 수가 ${n}명이 안 됨: ${await T.textContent("#cnt")} (단계 ${await T.evaluate(() => RD.stage)})`));
  await S[0].waitForSelector('text=선생님 설명을 들어요', { timeout: 15000 }).catch(() => fail('시작 전 대기 화면이 안 보임'));
  if (await T.$('.cw-ans')) {
    const hidden = await T.evaluate(() => document.documentElement.classList.contains('cw-hide'));
    if (!hidden) fail('선생님 화면 답이 처음부터 가려져 있지 않음');
  }
  const go = async () => { await T.click('#go'); await T.waitForTimeout(400); };
  const answer = async (p, list, wrong) => {
    await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
    const qt = (await p.textContent('.q')).trim();
    const it = list.find(x => x.q === qt);
    if (!it) { fail('문제를 찾지 못함: ' + qt); return; }
    const btns = await p.$$('.opts button');
    for (const b of btns) { const o = await b.getAttribute('data-o'); if (wrong ? o !== it.a : o === it.a) { await b.click(); break; } }
    if (wrong) { await p.waitForTimeout(200); return answer(p, list, false); }
    await p.waitForFunction(q => { const e = document.querySelector('.q'); return !e || e.textContent.trim() !== q; }, qt, { timeout: 8000 }).catch(() => {});
  };
  const Q1 = await T.evaluate(() => QUIZ1), Q3 = await T.evaluate(() => QUIZ3), FIELDS = await T.evaluate(() => FIELDS.map(f => f.k));
  // 1단계
  await go();
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < Q1.length; i++) await answer(p, Q1, k === 0 && i === 1); }));
  await cnt(N);
  await T.click('#wrongT');
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('1단계 틀린 학생 이름이 안 보임');
  await shot(S[0], 's1-done'); await shot(T, 't1');
  // 2단계: 조 고르고 함께 쓰기
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('text=선생님 설명을 들어요', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await go();
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.lvl button', { timeout: 10000 });
    await p.click(`.lvl button[data-t="${TEAM[k]}"]`);
    await p.waitForSelector('#fform', { timeout: 10000 });
  }));
  // 1조: 학생1이 앞 4칸, 학생5가 뒤 4칸 → 짝 화면에 보여야 함
  const fillF = async (p, ks, t) => { for (const kk of ks) { await p.fill(`#f-${kk}`, `${t}조 ${kk} 칸에 쓴 우리 조 문장입니다`); await p.press(`#f-${kk}`, 'Tab'); } };
  await S[0].click('#fin');
  await S[0].waitForFunction(() => /빈 칸/.test(document.querySelector('#fm').textContent), null, { timeout: 8000 }).catch(() => fail('빈 칸 안내가 안 나옴'));
  await fillF(S[0], FIELDS.slice(0, 4), 1);
  await fillF(S[4], FIELDS.slice(4), 1);
  await S[0].waitForFunction(() => /1조 qs 칸/.test(document.querySelector('#prev').textContent), null, { timeout: 10000 }).catch(() => fail('짝이 쓴 칸이 내 화면 미리 보기에 안 보임'));
  // 베낀 글 막기
  const ex = await T.evaluate(() => MAIL_B.body.split('\n')[2]);
  await S[1].fill('#f-hello', ex); await S[1].press('#f-hello', 'Tab');
  if (!/예시 메일과 거의 같아요/.test(await S[1].textContent('[data-m="hello"]'))) fail('예시를 베낀 글 안내가 안 나옴');
  await Promise.all([1, 2, 3].map(k => fillF(S[k], FIELDS, TEAM[k])));
  await Promise.all(S.map(async (p, k) => { await p.click('#fin'); await p.waitForFunction(() => /저장했어요/.test(document.querySelector('#fm').textContent), null, { timeout: 10000 }).catch(async () => fail(`학생${k + 1} 다 썼어요 실패: ${await p.textContent('#fm')} / ${await p.evaluate(() => JSON.stringify(domF()))}`)); }));
  await cnt(N);
  if (!/2조 hello 칸/.test(await T.textContent('#main'))) fail('TV에 조별 초안이 안 보임');
  await shot(S[0], 's2-write'); await shot(T, 't2');
  // 3단계: 높임말 퀴즈 + 다른 조 점검
  await T.click('#tsteps button[data-s="3"]');
  await go();
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < Q3.length; i++) await answer(p, Q3, k === 2 && i === 0);
    await p.waitForSelector('#send', { timeout: 10000 });
    if (k === 0) { await p.click('#send'); if (!/한 가지씩/.test(await p.textContent('#sm'))) fail('점검 빈 칸 안내가 안 나옴'); }
    await p.check('.chks input[data-c="0"]'); await p.check('.chks input[data-c="3"]');
    await p.fill('#good', `학생${k + 1}: 까닭이 분명해요`); await p.fill('#fix', `학생${k + 1}: 날짜를 고를 수 있게 써요`);
    await p.click('#send');
    await p.waitForSelector('text=메일 점검 끝', { timeout: 10000 }).catch(() => fail(`학생${k + 1} 점검 보내기 실패`));
  }));
  await cnt(N);
  if (!/학생3/.test(await T.textContent('#qstat'))) fail('3단계 틀린 학생 이름이 안 보임');
  await shot(T, 't3');
  // 4단계: 받은 점검 보기 → 확인 요청 → 선생님 확인
  await T.click('#tsteps button[data-s="4"]');
  await go();
  await S[1].waitForSelector('#revs .card2', { timeout: 10000 }).catch(() => fail('2조에 1조가 보낸 점검이 안 보임'));
  if (!/학생1: 까닭이 분명해요/.test(await S[1].textContent('#revs'))) fail('받은 점검 내용이 다름');
  await Promise.all([0, 1, 2, 3].map(async k => { await S[k].fill('#f-end', `${TEAM[k]}조 감사합니다. 12월 9일까지 답장 주시면 기쁘겠습니다.`); await S[k].press('#f-end', 'Tab'); await S[k].click('#ask'); }));
  await T.waitForFunction(() => (document.querySelector('#main').textContent.match(/🙋 확인 요청/g) || []).length === 4, null, { timeout: 10000 }).catch(() => fail('TV에 확인 요청이 안 보임'));
  await T.fill('#bk-3', '날짜를 두 개 이상 주세요');
  await T.click('[data-back="3"]');
  await S[2].waitForSelector('.backbox', { timeout: 10000 }).catch(() => fail('3조에 고쳐 와요 안내가 안 감'));
  for (const t of [1, 2, 4]) await T.click(`[data-ok="${t}"]`);
  await S[0].waitForSelector('.okbox', { timeout: 10000 }).catch(() => fail('1조에 확인 완료가 안 보임'));
  await S[4].waitForSelector('.okbox', { timeout: 10000 }).catch(() => fail('1조 짝에게 확인 완료가 안 보임'));
  await S[2].click('#ask');
  await T.waitForTimeout(800);
  await T.click('[data-ok="3"]');
  await cnt(N);
  if (!(await T.$('[data-copy="1"][data-what="body"]'))) fail('본문 복사 버튼이 없음');
  await shot(S[0], 's4-ok'); await shot(T, 't4');
  await T.click('#allT');
  const all = await T.textContent('#qstat');
  if (!/1-1/.test(all) || !/3-3/.test(all)) fail('모든 단계 정답률이 안 보임');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
