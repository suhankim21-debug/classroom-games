// 말글 탐정단 자동 테스트: 교사 화면 1개 + 학생 8명(4조)이 실제 Firebase 방에서 1~5단계를 끝까지 해 봐요.
// 실행: node tests/malgeul-e2e.js   (다른 주소: URL=http://localhost:8000/malgeul/ node tests/malgeul-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/malgeul/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const MEDIA = { '신문 기사': 'w', '동화책': 'w', '학급 알림판': 'w', '단체 대화방 메시지': 'w', '라디오 방송': 's', '오디오북': 's', '할머니와 전화 통화': 's', '교내 방송': 's', '자막이 나오는 심폐 소생술 영상': 'b', '텔레비전 뉴스': 'b', '버스 정류장 안내': 'b' };
const FEAT = { tone: 's', gone: 's', fast: 's', keep: 'w', edit: 'w', far: 'w' };
const SH = { '동그라미': 'o', '세모': 't', '네모': 'q', '별': 'st', '하트': 'h' };
const CO = { '빨간': 'r', '파란': 'b', '노란': 'y', '초록': 'g' };
const team = n => Math.ceil(n / 2);
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    p.on('dialog', d => d.accept());
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 900);
  await T.goto(URL + '#teacher');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const S = {};
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 15000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  // 설명하는 사람 화면에서 그림을 읽어요
  const readTarget = async p => p.$$eval('.play .board:not(.pick) .c', bs => bs.map(b => b.getAttribute('aria-label')))
    .then(ls => ls.map((l, i) => { const m = l.match(/(빨간|파란|노란|초록) (동그라미|세모|네모|별|하트)$/); return m ? { i, s: m[2], c: m[1] } : null; }).filter(Boolean));
  const place = async (p, pieces) => { for (const x of pieces) { await p.click(`#pshape button[data-s="${SH[x.s]}"]`); await p.click(`#pcol button[data-c="${CO[x.c]}"]`); await p.click(`#bd .c[data-i="${x.i}"]`); } };
  const roles = async round => {
    const out = {};
    for (let t = 1; t <= N / 2; t++) {
      const a = S[2 * t - 1], b = S[2 * t];
      await a.waitForSelector(`.band:has-text("${round}단계")`, { timeout: 15000 });
      await a.waitForSelector('.role', { timeout: 15000 });
      const aEx = await a.$eval('.role', el => !el.classList.contains('draw'));
      out[t] = aEx ? { ex: a, dr: b, exN: 2 * t - 1 } : { ex: b, dr: a, exN: 2 * t };
    }
    return out;
  };
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 820 : 1100, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-num', String(n)); await p.fill('#cw-name', `학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('.medium', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);

    // 1단계: 매체 탐정
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      for (let q = 0; q < 11; q++) {
        await p.waitForSelector('.medium b', { timeout: 10000 });
        const t = (await p.textContent('.medium b')).trim();
        const a = MEDIA[t];
        if (!a) { fail('모르는 매체 카드: ' + t); return; }
        if (+n === 2 && q < 2) { // 일부러 틀려 보기
          await p.click(`.opts button[data-k="${a === 'w' ? 's' : 'w'}"]`);
          if (!/다시/.test(await p.textContent('#qm'))) fail('틀렸을 때 다시 생각해 봐요가 안 나옴');
        }
        await p.click(`.opts button[data-k="${a}"]`);
        await p.waitForFunction(t0 => { const el = document.querySelector('.medium b'); return !el || el.textContent.trim() !== t0; }, t, { timeout: 5000 });
      }
      await p.waitForSelector('#fv', { timeout: 10000 });
      await p.click(`#fv button >> nth=${+n % 3}`); await p.click('#fsave');
      await p.waitForSelector('text=한 번에 맞혔어요', { timeout: 10000 });
    }));
    console.log('1단계 매체 탐정 완료');
    await cnt(N);
    if (!/헷갈린|즐겨/.test(await T.textContent('#main'))) fail('TV 1단계 결과가 안 보임');
    await shot(T, 'tv1'); await shot(S[2], 'stu1');

    // 2단계: 말로 전해요
    await T.click('#tsteps button[data-s="2"]');
    for (let n = 1; n <= N; n++) {
      await S[n].waitForSelector('#tp button', { timeout: 10000 });
      await S[n].click(`#tp button[data-t="${team(n)}"]`);
    }
    await shot(S[1], 'stu2wait');
    let R = await roles(2);
    if (!(await R[1].dr.isVisible('text=선생님이 시작을 누르면'))) fail('시작 전 잠금 화면이 안 보임');
    await T.click('#go');
    await Promise.all(Object.entries(R).map(async ([t, r]) => {
      await r.ex.waitForSelector('.play .board', { timeout: 10000 });
      const tg = await readTarget(r.ex);
      if (tg.length !== 5) fail(`${t}조 그림 조각 수가 5가 아님: ${tg.length}`);
      await r.dr.waitForSelector('#bd', { timeout: 10000 });
      if (+t === 1) { // 하나 틀리게 놓기
        const wrong = { ...tg[0], c: tg[0].c === '빨간' ? '파란' : '빨간' };
        await place(r.dr, [wrong, ...tg.slice(1)]);
      } else await place(r.dr, tg);
      if (+t === 2) { // 놓는 중 새로고침
        await r.dr.reload();
        await r.dr.waitForSelector('#bd', { timeout: 15000 });
        const k = await r.dr.$$eval('#bd .c svg', x => x.length);
        if (k !== 5) fail('새로고침 뒤 놓은 조각이 사라짐: ' + k); else console.log('놓는 중 새로고침 OK');
      }
      await r.dr.click('#sub');
      await r.dr.waitForSelector('text=맞힌 조각', { timeout: 10000 });
      await r.ex.waitForSelector('text=맞힌 조각', { timeout: 10000 });
      const sc = +(await r.dr.textContent('.stat b'));
      if (sc !== (+t === 1 ? 4 : 5)) fail(`${t}조 점수가 맞지 않음: ${sc}`);
    }));
    console.log('2단계 말로 전해요 완료');
    await cnt(N);
    if ((await T.$$('.tteam.fin')).length !== 4) fail('TV 2단계 완료 조 수가 4가 아님');
    await shot(T, 'tv2'); await shot(R[1].dr, 'stu2result');

    // 3단계: 글로 전해요 (역할 바꾸기, 4조는 시간 끝 자동 제출)
    await T.click('#tsteps button[data-s="3"]');
    await T.waitForSelector('text=글로 전해요');
    await T.click('#minus'); await T.click('#minus');
    const R3 = await roles(3);
    for (let t = 1; t <= 4; t++) if (R3[t].exN === R[t].exN) fail(`${t}조 3단계에서 역할이 안 바뀜`);
    await T.click('#go');
    const t0 = Date.now();
    await Promise.all(Object.entries(R3).map(async ([t, r]) => {
      await r.ex.waitForSelector('#cin', { timeout: 10000 });
      const tg = await readTarget(r.ex);
      for (const x of tg.slice(0, 2)) { await r.ex.fill('#cin', `${x.i}번 칸에 ${x.c} ${x.s}`); await r.ex.press('#cin', 'Enter'); }
      await r.dr.waitForFunction(() => document.querySelectorAll('#chat div').length >= 2, null, { timeout: 10000 }).catch(() => fail(`${t}조 놓는 사람에게 메시지가 안 옴`));
      await r.dr.fill('#cin', '나머지는?'); await r.dr.click('#csend');
      await r.ex.waitForFunction(() => document.querySelectorAll('#chat div').length >= 3, null, { timeout: 10000 }).catch(() => fail(`${t}조 설명하는 사람에게 질문이 안 옴`));
      if (+t === 4) { await place(r.dr, tg.slice(0, 3)); return; }
      await place(r.dr, tg);
      await r.dr.click('#sub');
      await r.dr.waitForSelector('text=주고받은 메시지', { timeout: 10000 });
    }));
    await shot(R3[4].dr, 'stu3play'); await shot(R3[4].ex, 'stu3ex');
    console.log('3단계 3개 조 완료, 4조는 시간 끝을 기다려요');
    await R3[4].dr.waitForSelector('text=맞힌 조각', { timeout: 80000 });
    const sc4 = +(await R3[4].dr.textContent('.stat b'));
    if (sc4 !== 3) fail('시간 끝 자동 제출 점수가 3이 아님: ' + sc4); else console.log(`시간 끝 자동 제출 OK (${Math.round((Date.now() - t0) / 1000)}초)`);
    await cnt(N);
    await shot(T, 'tv3');

    // 4단계: 비교하기
    await T.click('#tsteps button[data-s="4"]');
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('.sort', { timeout: 10000 });
      if (+n === 3) { await p.click('.seg[data-k="tone"] button[data-v="w"]'); if (!/다시/.test(await p.textContent('#sm'))) fail('특징 틀렸을 때 안내가 안 나옴'); }
      for (const [k, v] of Object.entries(FEAT)) await p.click(`.seg[data-k="${k}"] button[data-v="${v}"]`);
      await p.click(`#ez button[data-e="${+n % 2 ? 's' : 'w'}"]`);
      await p.fill('#why', `${n}번 까닭`);
      await p.click('#s4save');
      await p.waitForFunction(() => /저장했어요/.test(document.querySelector('#sm').textContent), null, { timeout: 10000 });
    }));
    console.log('4단계 비교하기 완료');
    await cnt(N);
    const rows = await T.$$eval('.cmp tbody tr', r => r.length);
    if (rows !== 5) fail('TV 비교표 줄 수가 5(4조+평균)가 아님: ' + rows);
    if (!/헷갈린 특징/.test(await T.textContent('#main'))) fail('TV에 헷갈린 특징이 안 보임');
    await shot(T, 'tv4'); await shot(S[1], 'stu4');

    // 5단계: 알고 싶어요
    await T.click('#tsteps button[data-s="5"]');
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('#want', { timeout: 10000 });
      await p.click(`#rd button >> nth=${+n % 4}`);
      await p.click(`#wi button >> nth=${+n % 5}`);
      await p.click('#s5save');
      await p.waitForFunction(() => /올렸어요/.test(document.querySelector('#wm').textContent), null, { timeout: 10000 });
    }));
    await cnt(N);
    if ((await T.$$('.wall div')).length !== N) fail('TV 알고 싶어요 모음 수가 맞지 않음');
    await shot(T, 'tv5'); await shot(S[1], 'stu5');
    // 지난 단계 다시 보기
    await S[5].click('#steps button[data-s="2"]');
    await S[5].waitForSelector('text=맞힌 조각', { timeout: 5000 }).then(() => console.log('지난 단계 다시 보기 OK')).catch(() => fail('2단계로 돌아가면 결과가 안 보임'));
    // 학생 화면 보기
    await T.click('.cw-open');
    await T.waitForFunction(n => document.querySelectorAll('.cw-card').length >= n, N, { timeout: 15000 }).then(() => console.log('학생 화면 보기 OK')).catch(() => fail('학생 화면 보기 카드 수가 모자람'));
    await shot(T, 'watch');
  } catch (e) { fail('진행 중 멈춤: ' + e.message); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
  }
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모든 테스트 통과');
  process.exit(problems.length ? 1 : 0);
})();
