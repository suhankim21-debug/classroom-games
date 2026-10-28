// 문장 탑 쌓기 자동 테스트: 교사 화면 1개 + 학생 10명(5조)이 실제 Firebase 방에서 한 판을 끝까지 해 봐요.
// 실행: node tests/tower-e2e.js   (다른 주소: URL=http://localhost:8000/tower/ node tests/tower-e2e.js)
// 세 단계(낱말 카드·빈칸·문장 쓰기), 틀린 답 표시, 두 번 틀리면 따라 쓰기, 새로고침 이어 하기, 시간 끝, 시상식을 확인해요.
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/tower/';
const SHOTS = process.env.SHOTS || '';
const N = 10;
const ROUND_MS = +(process.env.ROUND_MS || 45000);
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message} ${(e.stack||'').split('\n').slice(0,4).join(' | ')}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    p.on('dialog', d => d.accept());
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 900);
  let code = '';
  const S = {};
  try {
    await T.goto(URL + '#teacher');
    await T.waitForSelector('#mk', { timeout: 20000 });
    // 직접 입력 문장 세트 확인
    await T.click('#sets button[data-k="custom"]');
    await T.fill('#ct', '🍎 | 사과 | I like [apples].\n잘못된 줄\n🐶 | 개 | It is my dog.\n⚽ | 축구 | I [can] play soccer.');
    if (!/\(3문장\)/.test(await T.textContent('#cntv'))) fail('직접 입력 미리 보기 문장 수가 다름');
    if (!/<u>dog\.?<\/u>|<u>dog<\/u>/.test(await T.innerHTML('#pv'))) fail('빈칸 표시가 없을 때 가장 긴 낱말로 빈칸을 만들지 않음');
    await T.click(`#sets button[data-k="${await T.evaluate(() => Object.keys(SETS).slice(-1)[0])}"]`);
    await T.click('#tms button[data-t="5"]');
    await shot(T, 't0-setup');
    await T.click('#mk');
    await T.waitForSelector('.roomcode', { timeout: 20000 });
    code = (await T.textContent('.roomcode')).trim();
    console.log('방 번호', code);

    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.waitForSelector('#cw-num');
      if (n === 1) {
        // 시작 안내: 무엇이 빠졌는지 보여 주고, 이름 칸에 "1 학생1"을 한꺼번에 써도 나눠 줘요
        if (!(await p.$('.cw-roomok'))) fail('QR로 들어왔는데 방 번호 확인 표시가 없음');
        if (!/번호 쓰기/.test(await p.textContent('.cw-todo'))) fail('들어가기 전 할 일 목록이 없음');
        // 이름을 안 쓴 채 도움 요청 → 선생님 학생 화면에 '이름 아직 안 씀'으로 보여야 해요
        await p.click('.cw-help');
        await T.click('.cw-open');
        await T.waitForFunction(() => { const c = document.querySelector('.cw-card.help'); return c && /이름 아직/.test(c.textContent) && /들어가기/.test(c.textContent) && /아직 안 한 것: .*이름 쓰기/.test(c.textContent); }, null, { timeout: 10000 })
          .catch(async () => fail('선생님 카드에 이름 안 쓴 학생의 도움 요청·할 일이 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.textContent).join(' | ')))));
        await shot(T, 't0-watch-help');
        await T.click('.cw-card.help');
        // 크게 보기: 기기 크기와 상관없이 태블릿 세로 폭(820px)으로 고정, 잘리지 않게 전체 높이
        await T.waitForFunction(() => { const b = document.querySelector('.cw-zoom .cw-scr'), i = b && b.firstChild; return b && i && i.style.width === '820px' && b.clientHeight >= i.scrollHeight * (b.clientWidth / 820) - 2; }, null, { timeout: 5000 }).catch(() => fail('크게 보기가 820px 고정·전체 높이가 아님'));
        await shot(T, 't0-zoom');
        await T.click('.cw-ack');
        await p.waitForFunction(() => /선생님이 확인/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('선생님이 확인한 것이 학생에게 안 보임'));
        await T.click('.cw-back'); await T.click('.cw-close');
        await p.fill('#cw-name', '1 학생1');
      } else { await p.fill('#cw-num', String(n)); await p.fill('#cw-name', '학생' + n); }
      await p.waitForFunction(n => document.querySelector('#nm').value === n + ' 학생' + n, n, { timeout: 3000 }).catch(() => fail(n + '번 번호·이름 칸이 합쳐지지 않음'));
      if (!/다 됐어요/.test(await p.textContent('.cw-todo'))) fail(n + '번 다 채웠는데 안내가 안 바뀜');
      await p.click('#enter');
      await p.waitForSelector('.teams button', { timeout: 15000 });
      await p.click(`.teams button[data-t="${Math.ceil(n / 2)}"]`);
      await p.waitForSelector('#chg', { timeout: 10000 });
    }));
    // 같은 번호 다른 이름은 막혀야 해요
    const X = await mk('중복', 800, 800);
    await X.goto(URL + '?room=' + code); await X.fill('#cw-num', '3'); await X.fill('#cw-name', '다른이름'); await X.click('#enter');
    await X.waitForFunction(() => /이미/.test(document.querySelector('#jm').textContent), null, { timeout: 10000 }).catch(() => fail('같은 번호 다른 이름을 막지 않음'));
    await X.context().close();
    await T.waitForFunction(n => new RegExp(`${n}명 · 조 고름 ${n}명`).test(document.querySelector('#cnt').textContent), N, { timeout: 15000 }).catch(() => fail('TV에 10명이 조별로 안 보임'));
    if ((await T.$$('.lobby .tm span')).length !== N) fail('대기실 조별 명단 수가 다름');
    await shot(T, 't1-lobby'); await shot(S[1], 's1-wait');
    // 👀 학생 화면: 모두 번호 이름과 '기다리기' 단계로 보이고, 작은 화면 안에 학생 화면 글자가 보여요
    await T.click('.cw-open');
    await T.waitForFunction(n => [...document.querySelectorAll('.cw-card:not(.off)')].filter(x => /\d+번 학생\d+/.test(x.textContent) && /3\/4 기다리기/.test(x.textContent) && /준비 완료/.test(x.textContent)).length === n, N, { timeout: 15000 })
      .catch(async () => fail('학생 카드에 10명의 기다리기가 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.textContent).join(' | ')))));
    if (new Set(await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.offsetHeight))).size !== 1) fail('학생 카드 크기가 서로 다름');
    await shot(T, 't1-watch');
    // 단계별 화면: 입력 글자 없이 학생 화면 모양만
    await T.click('.cw-tabs button[data-tab="steps"]');
    await T.waitForSelector('.cw-zoom .cw-scr', { timeout: 5000 }).catch(() => fail('단계별 화면이 안 보임'));
    if (await T.evaluate(() => [...document.querySelectorAll('.cw-ov [onclick], .cw-ov script, .cw-ov input[value]')].length)) fail('단계별 화면에 스크립트나 입력 글자가 남음');
    await shot(T, 't1-steps');
    await T.click('.cw-tabs button[data-tab="cards"]');
    await T.click('.cw-close');
    console.log(`${N}명 입장, 조 고르기 OK`);

    await T.click('#go');
    // 테스트는 짧게: 끝나는 시간을 당겨요
    await T.evaluate(([c, ms]) => firebase.database().ref('rooms/' + c + '/cfg/endAt').set(now() + ms), [code, ROUND_MS]);
    await Promise.all(Object.values(S).map(p => p.waitForSelector('#q .ko', { timeout: 15000 })));
    // 3·2·1 카운트다운이 끝나야 답을 받아요
    await Promise.all(Object.values(S).map(p => p.waitForFunction(() => !document.querySelector('.count') && (!RV.startAt || now() >= RV.startAt), null, { timeout: 10000 })));
    if (!(await T.evaluate(() => cfg().startAt))) fail('시작 카운트다운 시간이 저장되지 않음');
    console.log('게임 시작 OK');

    const item = p => p.evaluate(() => { const it = curItem(); return { en: it.en, plain: plain(it.en), blanks: blanksOf(it.en), lv: ME.level || 2, shown }; });
    const solved = p => p.evaluate(() => ME.solved || 0);
    const waitNext = async (p, before) => p.waitForFunction(b => (ME.solved || 0) > b && !busy && document.querySelector('#q #ok'), before, { timeout: 10000 });
    const setLevel = async (p, l) => { await p.click(`.levels button[data-l="${l}"]`); await p.waitForFunction(l => (ME.level || 2) === l, l); };
    const answer = async (p, wrong) => {
      const q = await item(p);
      if (q.shown || q.lv === 3) {
        let v = q.plain;
        if (wrong) v = v.replace(/[A-Za-z]{3,}/, w => w.slice(0, -1) + 'x');
        if (!wrong && !q.shown) v = v.toLowerCase().replace(/[.?!]$/, '').replace(/I'm/i, 'I am'); // 대문자·마침표·줄임말은 봐줘요
        await p.fill('#w', v);
      } else if (q.lv === 2) {
        const bl = await p.$$('.blank');
        for (let k = 0; k < bl.length; k++) await bl[k].fill(wrong && k === 0 ? q.blanks[k] + 'z' : q.blanks[k].toUpperCase());
      } else {
        const ws = q.plain.split(/\s+/);
        const order = wrong ? ws.slice().reverse() : ws;
        const used = new Set();
        for (const w of order) {
          const idx = ws.findIndex((x, i) => x === w && !used.has(i)); used.add(idx);
          await p.click(`#pool button[data-i="${idx}"]`);
        }
        if (wrong && ws.length < 2) { /* 한 낱말 문장은 뒤집어도 같아요 */ }
      }
      const b = await solved(p);
      await p.click('#q #ok');
      if (!wrong) await waitNext(p, b);
      else await p.waitForFunction(() => /다시|두 번/.test(document.querySelector('#qm').textContent), null, { timeout: 5000 });
    };

    const plan = async (n, p) => {
      const lv = [3, 2, 1, 3, 2, 1, 3, 2, 3, 1][n - 1];
      await setLevel(p, lv);
      if (n === 1) {
        // 3단계 한 번 틀리면 틀린 낱말이 빨갛게
        await answer(p, true);
        if (!(await p.$('#fb .x'))) fail('문장 쓰기에서 틀린 낱말 표시가 없음');
        await answer(p, false);
      }
      if (n === 2) {
        // 두 번 틀리면 정답 보고 따라 쓰기 → 블록 1
        await answer(p, true);
        if (!(await p.$('.blank.wrong'))) fail('빈칸 쓰기에서 틀린 빈칸 표시가 없음');
        await answer(p, true);
        await p.waitForSelector('.ghostans', { timeout: 5000 }).catch(() => fail('두 번 틀려도 따라 쓰기가 안 나옴'));
        const sc = await p.evaluate(() => ME.score || 0);
        await answer(p, false);
        if ((await p.evaluate(() => ME.score || 0)) - sc !== 1) fail('따라 쓰기 블록이 1개가 아님');
      }
      if (n === 3) {
        await answer(p, true);
        if (!/순서/.test(await p.textContent('#qm'))) fail('낱말 카드를 틀렸을 때 안내가 없음');
        await p.click('#clr');
        await answer(p, false);
      }
      if (n === 7) {
        // 게임 중 학생 화면: 쓰고 있는 글자까지 선생님 화면에 보여요
        await p.fill('#w', 'typing now');
        await T.click('.cw-open');
        await T.waitForFunction(() => [...document.querySelectorAll('.cw-card')].some(x => /7번/.test(x.textContent) && /4\/4 게임/.test(x.textContent) && /문장 쓰기 · /.test(x.textContent) && /✏️ typing now/.test(x.textContent)), null, { timeout: 10000 })
          .catch(async () => fail('게임 중 학생 카드에 문제·쓰는 글자가 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.textContent).join(' | ')))));
        await shot(T, 't2-watch');
        await T.click('.cw-close');
        await p.fill('#w', '');
      }
      if (n === 4) {
        // 연속 3문제 → 황금 블록
        const sc = await p.evaluate(() => ME.score || 0);
        for (let k = 0; k < 3; k++) await answer(p, false);
        if ((await p.evaluate(() => ME.score || 0)) - sc !== 10) fail('3단계 연속 3문제가 블록 10개(3+3+3+황금1)가 아님');
        await shot(p, 's4-play');
        // 새로고침해도 이어서
        const i0 = await p.evaluate(() => ME.i);
        await p.reload();
        await p.waitForSelector('#q .ko', { timeout: 15000 });
        if ((await p.evaluate(() => [ME.i, ME.level])).join() !== [i0, 3].join()) fail('새로고침 뒤 문제 위치나 단계가 이어지지 않음');
      }
      const end = Date.now() + ROUND_MS - 12000;
      while (Date.now() < end) {
        if (!(await p.$('#q #ok'))) break;
        await answer(p, Math.random() < 0.15).catch(() => {});
        await p.waitForTimeout(300 + Math.random() * 500);
      }
    };
    await Promise.all(Object.entries(S).map(([n, p]) => plan(+n, p)));
    await shot(T, 't2-play'); await shot(S[2], 's2-play');

    const tv = await T.evaluate(() => [...document.querySelectorAll('.tw .cnt')].map(e => +e.textContent));
    const db = await T.evaluate(() => teamTotals(RD.students, 5).sort((a, b) => a.t - b.t).map(x => x.s));
    if (tv.join() !== db.join()) fail(`TV 탑 숫자(${tv})와 저장된 점수(${db})가 다름`);
    if (tv.some(x => x <= 0)) fail('블록이 0개인 조가 있음: ' + tv);
    const logSum = await T.evaluate(() => Object.values(RD.log || {}).reduce((a, e) => a + e.p, 0));
    if (logSum !== db.reduce((a, b) => a + b, 0)) fail(`기록 합(${logSum})과 점수 합(${db.reduce((a, b) => a + b, 0)})이 다름`);
    console.log('조별 블록', tv.join(' / '));

    // 시간이 끝나면 저절로 끝 화면
    await T.waitForFunction(() => cfg().phase === 'end', null, { timeout: ROUND_MS + 10000 }).catch(() => fail('시간이 끝나도 게임이 끝나지 않음'));
    await Promise.all(Object.values(S).map(p => p.waitForFunction(() => /게임 끝/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면이 끝 화면으로 안 바뀜'))));
    // 끝난 뒤 낸 답은 점수가 안 올라가요
    const after = await T.evaluate(c => firebase.database().ref('rooms/' + c + '/students').get().then(s => Object.values(s.val()).reduce((a, v) => a + (v.score || 0), 0)), code);
    if (after !== db.reduce((a, b) => a + b, 0) && after < db.reduce((a, b) => a + b, 0)) fail('끝난 뒤 점수가 줄어듦');
    await T.click('#award');
    await T.waitForSelector('.podium', { timeout: 8000 }).catch(() => fail('시상식 화면이 안 나옴'));
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 조 등수가 안 나옴'));
    await shot(T, 't3-award'); await shot(S[1], 's3-end');
    console.log('끝, 시상식 OK');

    // 한 판 더: 점수는 0, 조는 그대로
    await T.click('#again');
    await T.waitForFunction(() => cfg().phase === 'lobby', null, { timeout: 8000 });
    const st = await T.evaluate(() => Object.values(RD.students).map(v => [v.score, v.team]));
    if (st.some(([s, t]) => s !== 0 || !t)) fail('한 판 더 뒤에 점수가 남거나 조가 지워짐');
    await S[5].waitForSelector('#chg', { timeout: 10000 }).catch(() => fail('한 판 더 뒤 학생이 대기 화면으로 안 감'));
    console.log('한 판 더 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message.split('\n')[0] + ' ' + (e.stack.split('\n').find(l => /tower-e2e.js:\d+/.test(l)) || '')); for (const [n, p] of Object.entries(S)) await shot(p, 'err-' + n); await shot(T, 'err-t'); }
  finally {
    if (code) await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
    console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
    process.exit(problems.length ? 1 : 0);
  }
})();
