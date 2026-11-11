// 영어 쓰기 마당 자동 테스트: 교사 1 + 학생 4명(🌟 쉬운 화면 1명)으로 네 게임을 한 방에서 차례로 해요.
// 시작 전 대기, 문장 응원전(팀 고르기·쓰기·경주·점수), 번개 받아쓰기, 모자 속 친구 찾기, 우주 정거장 탈출(함정·체크포인트),
// 문제별 정답률·틀린 학생 이름, 시상식.
// 실행: node tests/eplay-e2e.js   (다른 주소: URL=http://localhost:8000/eplay/ node tests/eplay-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/eplay/';
const SHOTS = process.env.SHOTS || '';
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const ok = m => console.log('✅', m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts|ERR_/.test(m.text())) fail(`[${label}] 콘솔 오류: ${m.text()}`); });
    return p;
  };
  const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  const T = await mk('교사', 1400, 1000);
  await T.goto(URL);
  if (!(await T.evaluate(() => getComputedStyle(document.documentElement).wordBreak === 'keep-all'))) fail('word-break: keep-all 아님');
  await T.click('#goTv');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const N = 4, NAMES = ['김하나', '이두리', '박세찬', '최네모'];
  const S = [];
  for (let i = 0; i < N; i++) {
    const p = await mk('학생' + (i + 1), 820, 1180);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(i + 1));
    await p.fill('#cw-name', NAMES[i]);
    await p.click('#enter');
    await p.waitForSelector('text=선생님이 게임을 고르고', { timeout: 15000 });
    S.push(p);
  }
  ok('학생 4명 입장 (게임 고르는 중 대기)');
  await T.click('[data-ez="4"]');
  await S[3].waitForFunction(() => ME.easy === true, null, { timeout: 5000 }).catch(() => fail('쉬운 화면이 안 켜짐'));
  const setup = async (game, set = 'ybm-6-11') => {
    await T.waitForSelector('#gc', { timeout: 10000 });
    await T.click(`#gc [data-g="${game}"]`);
    await T.click(`#sets [data-k="${set}"]`);
    await T.click('#ready');
    await T.waitForSelector('#b-go', { timeout: 10000 });
    await Promise.all(S.map(p => p.waitForSelector('text=선생님이 시작할 때까지', { timeout: 10000 })));
  };
  const scores = () => T.evaluate(() => studs().map(x => x.score || 0));
  const toEnd = async () => { await T.evaluate(c => firebase.database().ref('rooms/' + c + '/cfg/opt/rounds').set(1), code); await T.click('#b-next'); await T.waitForSelector('#b-aw', { timeout: 10000 }); };

  /* 🏅 문장 응원전 */
  await setup('cup');
  if (await S[0].$('.side')) fail('시작 전인데 팀 고르기가 보여요');
  await shot(T, 'cup-0-lobby');
  await T.click('#b-go');
  await Promise.all(S.map(p => p.waitForSelector('.side', { timeout: 10000 })));
  ok('▶ 게임 시작 → 팀 고르기 열림');
  await shot(T, 'cup-1-write'); await shot(S[0], 'cup-1-stu');
  const sideTxt = (p, s) => p.evaluate(s => plain(itemOf(R[s].k).en), s);
  // 1번: L 바로 맞힘, 2번: R 한 번 틀리고 맞힘, 3번: L 안 씀, 4번(쉬운): R 낱말 카드
  await S[0].click('.side[data-s="L"]'); await S[0].waitForSelector('#w');
  await S[0].fill('#w', await sideTxt(S[0], 'L')); await S[0].click('#ok');
  await S[0].waitForSelector('text=문장을 다 썼어요', { timeout: 5000 }).catch(() => fail('1번 다 쓴 화면이 안 나옴'));
  await S[1].click('.side[data-s="R"]'); await S[1].waitForSelector('#w');
  await S[1].fill('#w', 'I like pizza'); await S[1].click('#ok');
  await S[1].waitForSelector('.diff .x, .diff .m', { timeout: 3000 }).catch(() => fail('틀린 낱말 표시가 없음'));
  await S[1].fill('#w', await sideTxt(S[1], 'R')); await S[1].click('#ok');
  await S[1].waitForSelector('text=문장을 다 썼어요', { timeout: 5000 }).catch(() => fail('2번 고쳐 쓴 뒤 다 쓴 화면이 안 나옴'));
  await S[2].click('.side[data-s="L"]');
  await S[3].click('.side[data-s="R"]'); await S[3].waitForSelector('#pool button');
  const words = (await sideTxt(S[3], 'R')).split(/\s+/);
  for (const w of words) await S[3].click(`#pool button:not(.used) >> text="${w}"`);
  await S[3].click('#ok');
  await S[3].waitForSelector('text=문장을 다 썼어요', { timeout: 5000 }).catch(() => fail('쉬운 화면 낱말 카드로 다 쓰지 못함'));
  ok('팀 고르기·쓰기(바로·고쳐서·낱말 카드)');
  await T.click('#b-close');
  await T.waitForSelector('.lane', { timeout: 5000 }).catch(() => fail('경주 화면이 안 나옴'));
  await S[0].waitForSelector('text=TV를 보세요', { timeout: 5000 }).catch(() => fail('학생 경주 중 화면'));
  await sleep(2500); await shot(T, 'cup-2-race');
  await T.waitForSelector('#b-next', { timeout: 15000 });
  const win = await T.evaluate(() => RD.r.win);
  const sc = await scores();
  const want = [win === 'L' ? 3 : 1, win === 'R' ? 3 : 1, 0, win === 'R' ? 3 : 1];
  if (JSON.stringify(sc) === JSON.stringify(want)) ok('경주 뒤 점수 ' + sc.join(',')); else fail(`점수 ${sc} (기대 ${want})`);
  await S[0].waitForSelector('text=승리', { timeout: 5000 }).catch(() => fail('학생 결과 화면'));
  await shot(T, 'cup-3-done'); await shot(S[0], 'cup-3-stu');
  const rows = await T.$$eval('.qrow', r => r.map(x => x.textContent));
  if (rows.length === 2 && rows.some(t => /50%/.test(t))) ok('문제별 정답률 2줄 (R 50%)'); else fail('정답률 줄: ' + rows.join(' | '));
  await T.click('#wrongT');
  if (!/이두리/.test(await T.textContent('#qstat'))) fail('틀린 학생 이름(이두리)이 안 보임'); else ok('틀린 학생 이름 보기');
  await toEnd(); await T.click('#b-aw');
  await T.waitForSelector('.podium', { timeout: 5000 }).catch(() => fail('시상식'));
  await shot(T, 'cup-4-award');
  ok('문장 응원전 끝');

  /* ⚡ 번개 받아쓰기 */
  await T.click('#b-set');
  await setup('speed');
  await T.click('#b-go');
  await Promise.all(S.map(p => p.waitForSelector('text=TV를 보고', { timeout: 10000 })));
  if (!(await T.$('.flyzone .fly'))) fail('TV에 날아가는 글자가 없음');
  await sleep(800); await shot(T, 'speed-1');
  const txt = await S[0].evaluate(() => R.text);
  await S[0].fill('#w', txt); await S[0].click('#ok');
  await S[1].fill('#w', 'zzz'); await S[1].click('#ok'); await sleep(300); await S[1].fill('#w', 'qqq'); await S[1].click('#ok');
  await S[1].waitForSelector('text=기회를 다 썼어요', { timeout: 5000 }).catch(() => fail('두 번 틀리면 끝나야 해요'));
  await S[3].waitForSelector('#eo button');
  await S[3].click(`#eo button >> text="${txt}"`);
  await T.click('#b-rep'); await sleep(300);
  await T.click('#b-close');
  await T.waitForSelector('.bigans', { timeout: 5000 });
  await T.waitForFunction(() => studs()[0].score === 1, null, { timeout: 5000 }).catch(() => fail('번개 받아쓰기 점수'));
  const sp = await scores();
  if (sp[0] === 1 && sp[1] === 0 && sp[3] === 1) ok('번개 받아쓰기 점수 ' + sp); else fail('번개 점수 ' + sp);
  await shot(T, 'speed-2-done');
  await toEnd(); ok('번개 받아쓰기 끝');

  /* 🎩 모자 속 친구 찾기 */
  await T.click('#b-set');
  await setup('hats');
  await T.click('#b-go');
  await S[0].waitForSelector('text=TV를 보세요', { timeout: 10000 });
  await sleep(2600); await shot(T, 'hats-1-shuffle');
  await Promise.all(S.map(p => p.waitForSelector('text=햄스터가 있는 자리', { timeout: 20000 })));
  const ans = await S[0].evaluate(() => R.labels[R.fin]);
  const wrong = await S[0].evaluate(() => R.labels[(R.fin + 1) % 3]);
  await S[0].fill('#w', ans); await S[0].click('#send');
  await S[1].fill('#w', wrong); await S[1].click('#send');
  await S[3].click(`#eo button[data-i="${await S[3].evaluate(() => R.fin)}"]`);
  await sleep(500); await shot(T, 'hats-2-write');
  await T.click('#b-close');
  await T.waitForSelector('#hearH', { timeout: 5000 }).catch(() => fail('모자 정답 공개'));
  await T.waitForFunction(() => studs()[0].score === 2, null, { timeout: 5000 }).catch(() => fail('모자 점수'));
  const hs = await scores();
  if (hs[0] === 2 && hs[1] === 0 && hs[3] === 2) ok('모자 점수 ' + hs); else fail('모자 점수 ' + hs);
  const hr = await T.textContent('#qstat');
  if (!/50%/.test(hr)) fail('모자 정답률(2/4=50%)이 다름: ' + hr);
  await shot(T, 'hats-3-done'); await shot(S[1], 'hats-3-stu');
  await toEnd(); ok('모자 속 친구 찾기 끝');

  /* 🚀 우주 정거장 탈출 */
  await T.click('#b-set');
  await setup('story', 'sample');
  await T.click('#b-go');
  await Promise.all(S.map(p => p.waitForSelector('.doors button', { timeout: 10000 })));
  await shot(S[0], 'story-1-doors');
  const sceneOf = p => p.evaluate(() => { const S = ME.s || { pos: 0 }; const sc = storyScene(CF.items, me.num, me.room, S.pos); return { t: sc.t, d: sc.d, en: plain(CF.items[sc.t].en) }; });
  // 1번: 세 방 바르게 지나 체크포인트, 2번: 틀린 문 → 함정
  for (let k = 0; k < 3; k++) {
    const sc = await sceneOf(S[0]);
    await S[0].click(`.doors button[data-k="${sc.t}"]`);
    await S[0].waitForSelector('#w');
    await S[0].fill('#w', sc.en); await S[0].click('#ok');
    await S[0].waitForFunction(k => (ME.s || {}).pos === k + 1, k, { timeout: 8000 });
    await S[0].waitForSelector('.doors button', { timeout: 8000 });
  }
  const s0 = await S[0].evaluate(() => ME.s);
  if (s0.pos === 3 && s0.cp === 3) ok('세 방 통과 → 🚩 체크포인트'); else fail('체크포인트 ' + JSON.stringify(s0));
  const sc2 = await sceneOf(S[1]);
  await S[1].click(`.doors button[data-k="${sc2.d}"]`);
  await S[1].waitForSelector('text=함정', { timeout: 5000 }).catch(() => fail('함정 화면'));
  await S[1].waitForFunction(() => (ME.s || {}).traps === 1, null, { timeout: 5000 }).catch(() => fail('함정 횟수'));
  await S[1].waitForSelector('.doors button', { timeout: 8000 });
  const sc4 = await sceneOf(S[3]);
  await S[3].click(`.doors button[data-k="${sc4.t}"]`);
  await S[3].waitForSelector('#pool button');
  for (const w of sc4.en.split(/\s+/)) await S[3].click(`#pool button:not(.used) >> text="${w}"`);
  await S[3].click('#ok');
  await S[3].waitForFunction(() => (ME.s || {}).pos === 1, null, { timeout: 8000 }).catch(() => fail('쉬운 화면 우주 정거장 쓰기'));
  await sleep(800);
  await shot(T, 'story-2-map'); await shot(S[0], 'story-2-stu');
  if (!/함정/.test(await T.textContent('#live'))) fail('TV 소식에 함정이 안 보임');
  if ((await T.$$('.map .mr')).length !== N) fail('TV 지도 줄 수');
  const st = await T.textContent('#qstat');
  if (/0%/.test(st)) ok('우주 정거장 정답률에 함정 문제 표시'); else fail('우주 정거장 정답률: ' + st);
  await T.evaluate(() => { window.confirm = () => true; });
  await T.click('#b-stop');
  await T.click('#b-aw');
  await T.waitForSelector('.podium', { timeout: 5000 });
  if (!/김하나/.test(await T.textContent('.podium .p1'))) fail('1등이 김하나가 아님');
  await shot(T, 'story-3-award');
  ok('우주 정거장 탈출 끝');

  await browser.close();
  if (problems.length) { console.log(`\n문제 ${problems.length}개`); process.exit(1); }
  console.log('\n모두 통과');
})().catch(e => { console.error(e); process.exit(1); });
