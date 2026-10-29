// 우리 반 추리 게임 자동 테스트: 교사 화면 1개 + 학생 9명(🌟 쉬운 화면 1명, 🛡 시민만 2명)이 실제 Firebase 방에서
// 라이어 게임 2판(라이어 잡고 제시어 틀리기 / 엉뚱한 친구 뽑기)과 마피아 게임 한 판을 끝까지 해 봐요.
// 실행: node tests/mystery-e2e.js   (다른 주소: URL=http://localhost:8000/mystery/ node tests/mystery-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/mystery/';
const SHOTS = process.env.SHOTS || '';
const N = +(process.env.N || 9);
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const ok = m => console.log('✅', m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', hasTouch: false });
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
  const NAMES = ['김하나', '이두리', '박세찬', '최네모', '정다섯', '강여섯', '조일곱', '윤여덟', '장아홉', '임열'];
  const S = [];
  for (let i = 0; i < N; i++) {
    const p = await mk('학생' + (i + 1), 820, 1100);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-name', `${i + 1} ${NAMES[i]}`);
    if (i === N - 1) await p.check('#ez');
    await p.click('#enter');
    await p.waitForSelector('#relog', { timeout: 15000 });
    S.push(p);
  }
  await T.waitForFunction(n => document.querySelectorAll('.plist .p').length === n, N, { timeout: 15000 });
  ok(`학생 ${N}명 입장`);
  // 마지막 두 명은 🛡 시민만 (도움반 친구처럼)
  const SAFE = [N - 1, N];
  for (const n of SAFE) { await T.click(`[data-safe="${n}"]`); await sleep(400); }
  await T.waitForFunction(() => document.querySelectorAll('[data-safe][aria-pressed="true"]').length === 2);
  if (!(await S[N - 1].evaluate(() => document.body.classList.contains('easy')))) fail('쉬운 화면이 켜지지 않음');
  await shot(T, 'tv-lobby');

  const sec = p => p.evaluate(() => SEC);
  const g = () => T.evaluate(() => RD.g);

  /* ---------- 라이어 게임 ---------- */
  await T.click('[data-game="liar"]');
  await T.click('[data-set="trade"]');
  await T.click('.seg[data-k="talkSec"] button[data-v="15"]');
  await T.click('#start');
  await T.waitForFunction(() => RD.g && RD.g.phase === 'card');
  for (const p of S) await p.waitForSelector('#hold', { timeout: 10000 });
  const secrets = await Promise.all(S.map(sec));
  const liars = secrets.map((s, i) => s.liar ? i + 1 : 0).filter(Boolean);
  const word = secrets.find(s => !s.liar).word;
  if (liars.length !== 1) fail('라이어 수가 이상함: ' + liars);
  if (liars.some(n => SAFE.includes(n))) fail('🛡 시민만 친구가 라이어가 됨');
  if (secrets.some(s => !s.liar && s.word !== word)) fail('시민 제시어가 서로 다름');
  ok(`라이어 ${liars} · 제시어 ${word}`);
  // 카드는 누르고 있을 때만 보이고, 학생 화면 보기(#app)에는 올라가지 않아요
  const L = S[liars[0] - 1];
  const box = await L.$('#hold'); const bb = await box.boundingBox();
  await L.mouse.move(bb.x + 20, bb.y + 20); await L.mouse.down();
  await L.waitForSelector('.secret.open');
  if (!/나는 라이어/.test(await L.textContent('#sec'))) fail('라이어 카드가 안 보임');
  if (/라이어!/.test(await L.textContent('#app'))) fail('라이어 정체가 학생 화면 보기 영역(#app)에 들어감');
  await shot(L, 'liar-card');
  await L.mouse.up();
  await L.waitForSelector('.secret:not(.open)');
  // 쉬운 화면: 한 번 누르면 보이고 다시 누르면 가려져요
  await S[N - 1].click('#hold'); await S[N - 1].waitForSelector('.secret.open');
  if (!(await S[N - 1].textContent('#sec')).includes(word)) fail('쉬운 화면 카드에 제시어가 없음');
  await shot(S[N - 1], 'easy-card');
  await S[N - 1].click('#hold'); await S[N - 1].waitForSelector('.secret:not(.open)');
  ok('카드 꾹 누르기 / 쉬운 화면 누르기');
  if (/라이어/.test(await T.textContent('#main')) && (await T.textContent('#main')).includes(word)) fail('TV에 제시어가 보임');

  await T.click('#go');
  const order = (await g()).order;
  for (let k = 0; k < order.length; k++) {
    const cur = S[order[k] - 1];
    await cur.waitForFunction(() => /내 차례/.test(document.querySelector('#app').textContent), null, { timeout: 8000 }).catch(() => fail(`${order[k]}번 학생 화면에 "내 차례"가 안 나옴`));
    if (k === 2) await shot(cur, 'liar-myturn');
    if (k < order.length - 1) await T.click('#next');
  }
  await shot(T, 'tv-liar-talk');
  await T.click('#vote');
  // 라이어가 아닌 친구는 모두 라이어에게, 라이어는 아무에게나
  for (let i = 0; i < N; i++) {
    const p = S[i]; await p.waitForSelector('#vp button');
    const target = liars.includes(i + 1) ? (i === 0 ? 2 : 1) : liars[0];
    await p.click(`#vp button[data-n="${target}"]`);
  }
  await T.waitForFunction(n => new RegExp(`${n} / ${n}명`).test(document.querySelector('#main').textContent), N, { timeout: 10000 });
  await shot(T, 'tv-liar-vote');
  await T.click('#res');
  await T.waitForFunction(() => RD.g.phase === 'reveal');
  await shot(T, 'tv-liar-reveal');
  await T.click('#open');
  await L.waitForSelector('#lg button', { timeout: 10000 });
  await shot(L, 'liar-guess');
  await L.click(`#lg button:not([data-w="${word}"])`);
  await T.waitForFunction(() => RD.g.phase === 'end', null, { timeout: 10000 });
  const r1 = (await g()).result;
  if (r1.win !== 'citizen') fail('라이어가 틀렸는데 시민 승리가 아님');
  await sleep(800);
  const pts1 = await T.evaluate(() => Object.fromEntries(Object.entries(RD.players).map(([n, x]) => [n, x.pt || 0])));
  if (Object.entries(pts1).some(([n, v]) => v !== (liars.includes(+n) ? 0 : 1))) fail('1판 점수가 이상함 ' + JSON.stringify(pts1));
  await S[0].waitForFunction(() => /이겼어요|다음 판/.test(document.querySelector('#app').textContent));
  await shot(T, 'tv-liar-end');
  ok('라이어 1판: 라이어 잡고 제시어 틀림 → 시민 승리, 점수');

  // 2판: 표가 엉뚱한 친구에게 → 라이어 승리
  await T.click('#again');
  await T.waitForFunction(() => RD.g.phase === 'card' && RD.g.round === 2);
  await sleep(600);
  const sec2 = await Promise.all(S.map(sec));
  const liar2 = sec2.findIndex(s => s.liar) + 1;
  const word2 = sec2.find(s => !s.liar).word;
  if (word2 === word) fail('2판 제시어가 1판과 같음');
  await T.click('#go'); await T.click('#vote');
  const wrongT = liar2 === 1 ? 2 : 1;
  for (let i = 0; i < N; i++) { const p = S[i]; await p.waitForSelector('#vp button'); await p.click(`#vp button[data-n="${i + 1 === wrongT ? (wrongT === 1 ? 3 : 1) : wrongT}"]`); }
  await T.waitForFunction(n => new RegExp(`${n} / ${n}명`).test(document.querySelector('#main').textContent), N);
  await T.click('#res'); await T.waitForFunction(() => RD.g.phase === 'reveal');
  await T.click('#open'); await T.waitForFunction(() => RD.g.phase === 'end');
  if ((await g()).result.win !== 'liar') fail('엉뚱한 친구를 뽑았는데 라이어 승리가 아님');
  ok(`라이어 2판: 엉뚱한 친구 뽑음 → 라이어 승리 (제시어 ${word2})`);

  // 새로고침해도 이어져요
  await S[3].reload(); await S[3].waitForSelector('#relog', { timeout: 15000 });
  if (!/다음 판|이겼어요/.test(await S[3].textContent('#app'))) fail('새로고침 뒤 결과 화면으로 안 돌아옴');

  /* ---------- 마피아 게임 ---------- */
  await T.click('#lobby');
  await T.waitForSelector('[data-game="mafia"]');
  await T.click('[data-game="mafia"]');
  await T.click('[data-set="circle"]');
  await T.click('#start');
  await T.waitForFunction(() => RD.g && RD.g.phase === 'role');
  await sleep(800);
  const roles = await T.evaluate(() => Object.fromEntries(Object.entries(RD.h.roles).filter(([, r]) => r)));
  const cnt = r => Object.values(roles).filter(x => x === r).length;
  if (cnt('mafia') !== 2 || cnt('doctor') !== 1 || cnt('police') !== 1) fail('역할 수가 이상함 ' + JSON.stringify(roles));
  if (SAFE.some(n => roles[n] !== 'citizen')) fail('🛡 친구가 특별 역할을 받음');
  ok('역할 ' + JSON.stringify(roles));
  const mafias = Object.keys(roles).filter(n => roles[n] === 'mafia').map(Number);
  const doctor = +Object.keys(roles).find(n => roles[n] === 'doctor');
  const police = +Object.keys(roles).find(n => roles[n] === 'police');
  const citizens = Object.keys(roles).filter(n => roles[n] !== 'mafia').map(Number);
  // 마피아 카드에 친구 마피아가 보여요
  const M1 = S[mafias[0] - 1]; await M1.waitForSelector('#hold');
  const hb = await (await M1.$('#hold')).boundingBox(); await M1.mouse.move(hb.x + 10, hb.y + 10); await M1.mouse.down();
  await M1.waitForSelector('.secret.open');
  if (!(await M1.textContent('#sec')).includes(NAMES[mafias[1] - 1])) fail('마피아 카드에 함께하는 마피아가 안 보임');
  await shot(M1, 'mafia-card'); await M1.mouse.up();
  await shot(T, 'tv-mafia-role');

  const ANS = await T.evaluate(() => Object.fromEntries(W(RD.g.set).map(x => [x.d, x.w])));
  const night = async (plan) => {
    await T.click('#go, #night');
    await T.waitForFunction(() => RD.g.phase === 'night');
    const day = (await g()).day;
    const alive = (await g()).alive;
    await Promise.all(S.map(async (p, i) => {
      const n = i + 1;
      await p.waitForSelector('#tk1 .pick button', { timeout: 10000 });
      const tgt = plan[n] || +(await p.$eval('#tk1 .pick button', b => b.dataset.n));
      // 퀴즈를 먼저 하나 풀고 친구를 골라도 퀴즈가 처음으로 돌아가지 않아요
      for (let q = 0; q < 3; q++) {
        await p.waitForFunction(() => document.querySelector('#tk2 .q') && document.querySelector('#tk2 .opts button:not([disabled])'), null, { timeout: 8000 });
        const text = (await p.textContent('#tk2 .q')).trim().replace(/^"|"$/g, '');
        const a = ANS[text]; if (!a) { fail('정답 모르는 밤 퀴즈: ' + text); return; }
        if (q === 0 && n === 1) { const w = await p.$(`#tk2 .opts button:not([data-w="${a}"])`); await w.click(); }
        await p.click(`#tk2 .opts button[data-w="${a}"]`);
        if (q === 0) { await sleep(150); await p.click(`#tk1 .pick button[data-n="${tgt}"]`); await sleep(900); if (!(await p.$('#tk2 .prog span.on'))) fail(`${n}번: 친구를 고른 뒤 퀴즈가 처음으로 돌아감`); }
        if (q > 0) await sleep(650);
      }
      await p.waitForFunction(() => /다 했어요/.test(document.querySelector('#sec').textContent), null, { timeout: 8000 }).catch(() => fail(`${n}번 밤 일이 안 끝남`));
    }));
    await T.waitForFunction(n => new RegExp(`${n} / ${n}명 끝`).test(document.querySelector('#main').textContent), N, { timeout: 10000 });
    if (!(await T.evaluate(() => document.body.classList.contains('dark')))) fail('밤에 TV가 어두워지지 않음');
    await shot(T, 'tv-night-' + day);
    // 경찰 결과
    const pc = await S[police - 1].evaluate(d => SEC.check && SEC.check[d], day);
    if (alive[police] && (!pc || pc.mafia !== (roles[pc.t] === 'mafia'))) fail('경찰 조사 결과가 이상함 ' + JSON.stringify(pc));
    if (alive[police] && day === 1) await shot(S[police - 1], 'police-night');
    await T.click('#morning');
    await T.waitForFunction(() => RD.g.phase === 'morning');
    return (await g()).morning;
  };
  // 1일째 밤: 마피아는 시민 한 명을, 의사는 같은 친구를 지켜요 → 아무도 안 잠듦
  const victim1 = citizens.find(n => n !== doctor && n !== police);
  const plan1 = { [mafias[0]]: victim1, [mafias[1]]: victim1, [doctor]: victim1, [police]: mafias[0] };
  const m1 = await night(plan1);
  if (!(m1.t === victim1 && m1.saved)) fail('의사가 지킨 친구가 잠듦 ' + JSON.stringify(m1));
  await shot(T, 'tv-morning-1');
  ok('1일째 밤: 의사가 지켜 냄, 경찰 조사');
  await T.click('#talk'); await T.waitForFunction(() => RD.g.phase === 'day');
  await shot(T, 'tv-day');
  await T.click('#vote');
  const vote = async (target) => {
    const alive = (await g()).alive;
    for (let i = 0; i < N; i++) { if (!alive[i + 1]) continue; const p = S[i]; await p.waitForSelector('#vp button');
      const t = typeof target === 'function' ? target(i + 1) : target; await p.click(`#vp button[data-n="${t === i + 1 ? 0 : t}"]`); }
    await T.click('#res'); await T.waitForFunction(() => RD.g.phase === 'verdict');
    return (await g()).verdict;
  };
  const v1 = await vote(mafias[0]);
  if (v1.out !== mafias[0] || v1.team !== 'mafia') fail('투표로 마피아가 안 나감 ' + JSON.stringify(v1));
  await shot(T, 'tv-verdict-1');
  ok('1일째 투표: 마피아 한 명 나감');
  // 2일째 밤: 남은 마피아가 시민을 잠재워요
  const victim2 = citizens.find(n => n !== doctor && n !== police && n !== victim1) || victim1;
  const m2 = await night({ [mafias[1]]: victim2, [doctor]: doctor, [police]: mafias[1] });
  if (!(m2.t === victim2 && !m2.saved)) fail('2일째 밤 결과가 이상함 ' + JSON.stringify(m2));
  await S[victim2 - 1].waitForFunction(() => /유령/.test(document.querySelector('#app').textContent), null, { timeout: 8000 }).catch(() => fail('잠든 친구 화면에 유령 안내가 없음'));
  await shot(S[victim2 - 1], 'ghost-morning');
  ok('2일째 밤: 한 명 잠듦 → 유령');
  await T.click('#talk'); await T.click('#vote');
  const v2 = await vote(mafias[1]);
  if (v2.out !== mafias[1]) fail('2일째 투표 결과가 이상함');
  if ((await g()).win !== 'citizen') fail('마피아가 모두 나갔는데 시민 승리가 아님');
  await T.click('#end'); await T.waitForFunction(() => RD.g.phase === 'end');
  await sleep(1000);
  await shot(T, 'tv-mafia-end');
  const pts = await T.evaluate(() => Object.fromEntries(Object.entries(RD.players).map(([n, x]) => [n, x.pt || 0])));
  if (citizens.some(n => pts[n] < pts1[n] + 2)) fail('이긴 시민 팀 점수가 이상함 ' + JSON.stringify(pts));
  if (!/승리/.test(await S[0].textContent('#app'))) fail('학생 화면에 게임 결과가 없음');
  ok('마피아 게임: 시민 팀 승리, 점수 ' + JSON.stringify(pts));
  await T.click('#aw'); await T.waitForSelector('.podium');
  await shot(T, 'tv-award');
  ok('시상식');

  // 정리
  await T.evaluate(c => Promise.all([db.ref('rooms/' + c).remove(), db.ref('rooms/' + c + '_watch').remove()]), code);
  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
