// 우리말 지킴이 자동 테스트: 교사 화면 1개 + 학생 8명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/urimal-e2e.js   (다른 주소: URL=http://localhost:8000/urimal/ node tests/urimal-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/urimal/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const ANS = { '점메추': '점심 메뉴 추천', '핫플': '인기 있는 곳', '인생샷': '아주 멋진 사진', '노잼': '재미없다', '스크린도어': '안전문', '레시피': '조리법', '웰빙': '참살이', '팩트': '사실' };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
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
  const S = {};
  try {
    // 입장
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 820 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('.seg', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);
    // 👀 학생 화면: 선생님 화면에서 모든 학생이 번호 이름과 1단계로 보여요
    await T.click('.cw-open');
    await T.waitForFunction(n => [...document.querySelectorAll('.cw-card:not(.off)')].filter(x => /\d+번 학생\d+/.test(x.textContent) && /1\/4/.test(x.textContent)).length === n, N, { timeout: 15000 })
      .catch(async () => fail('학생 화면 보기에 학생들이 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-card')].map(x => x.textContent.slice(0, 30)).join(' | ')))));
    await T.click('.cw-close');
    const dup = await mk('중복');
    await dup.goto(URL + '?room=' + code);
    await dup.fill('#cw-name', '3 다른학생'); await dup.click('#enter');
    await dup.waitForFunction(() => /이미/.test(document.querySelector('#jm')?.textContent || ''), null, { timeout: 10000 })
      .then(() => console.log('같은 번호 다른 이름 막기 OK')).catch(() => fail('같은 번호에 다른 이름으로 들어가도 막히지 않음'));
    await dup.context().close();

    // 1단계: 점검표 + 미션
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      n = +n;
      for (const k of ['f', 's', 'n', 'g']) await p.click(`.seg[data-k="${k}"] button[data-v="${(n + k.charCodeAt(0)) % 3}"]`);
      await p.fill('#w1', ['점메추', '레전드', '킹받네', '팩트'][n % 4]);
      if (n % 2) await p.fill('#w2', '레시피');
      await p.click('#save1');
      for (let q = 0; q < 8; q++) {
        await p.waitForSelector('.quiz .word', { timeout: 10000 });
        const w = (await p.textContent('.quiz .word')).trim();
        if (q === 0 && n === 2) { // 일부러 틀려 보기
          const wrong = await p.$(`.opts button:not([data-o="${ANS[w]}"])`); await wrong.click();
          if (!/다시/.test(await p.textContent('#qm'))) fail('틀렸을 때 "다시 골라 봐요"가 안 나옴');
        }
        await p.click(`.opts button[data-o="${ANS[w]}"]`);
        await p.waitForFunction(w0 => { const el = document.querySelector('.quiz .word'); return !el || el.textContent.trim() !== w0; }, w, { timeout: 5000 });
      }
      await p.waitForSelector('text=우리말 번역가 배지', { timeout: 10000 });
    }));
    console.log('1단계 점검표·미션 완료');
    await T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, N, { timeout: 10000 })
      .then(() => console.log('TV 1단계 집계 OK')).catch(async () => fail('TV 1단계 집계가 맞지 않음: ' + await T.textContent('#cnt')));
    if (!/점메추/.test(await T.textContent('.cloud'))) fail('TV 자주 쓰는 말에 점메추가 없음');
    await shot(T, 'tv1'); await shot(S[1], 'stu1');

    // 2단계
    await T.click('#tsteps button[data-s="2"]');
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('#f-reason', { timeout: 10000 });
      await p.fill('#f-reason', '줄임말을 많이 써서 가족이 알아듣기 어려우므로, 우리말을 바르게 사용하고자');
      await p.click('#ideas button >> nth=0');
      await p.fill('#f-p1', '우리말을 사랑');
      const hint = await p.textContent('#h1');
      if (!/하겠습니다/.test(hint)) fail(`${n}번: "~하겠습니다" 끝맺음 힌트가 안 나옴 (${hint})`);
      await p.fill('#f-p1', '하루에 고유어 한 개를 찾아 일기에 쓰겠습니다.');
      await p.fill('#f-p2', '게임할 때 비속어 대신 고운 말을 쓰겠습니다');
      await p.click('#fsub');
      await p.waitForFunction(() => /올렸어요/.test(document.querySelector('#fm').textContent), null, { timeout: 10000 });
    }));
    console.log('2단계 다짐문 올리기 완료');
    await shot(S[1], 'stu2');
    await T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, N, { timeout: 10000 })
      .catch(async () => fail('TV 2단계 집계가 맞지 않음: ' + await T.textContent('#cnt')));

    // 새로고침해도 이어지는지
    await S[4].reload();
    await S[4].waitForSelector('#f-reason', { timeout: 15000 });
    if (!/가족이/.test(await S[4].inputValue('#f-reason'))) fail('새로고침 뒤 다짐문 내용이 사라짐');
    else console.log('새로고침 후 이어 쓰기 OK');

    // 3단계
    await T.click('#tsteps button[data-s="3"]');
    const reviewTo = {};
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('#rsend', { timeout: 15000 });
      reviewTo[n] = +(await p.textContent('#partA h2')).match(/(\d+)번/)[1];
      await p.click('#cpr button >> nth=1'); await p.click('#cfx button >> nth=0');
      await p.fill('#rnote', '좋아요');
      await p.click('#rsend');
      await p.waitForFunction(() => /보냈어요/.test(document.querySelector('#rmsg').textContent), null, { timeout: 10000 });
    }));
    const tos = Object.values(reviewTo);
    if (Object.entries(reviewTo).some(([a, b]) => +a === b)) fail('자기 다짐문을 받은 학생이 있음');
    if (new Set(tos).size < N - 1) fail('의견 받을 친구가 한쪽으로 몰림: ' + JSON.stringify(reviewTo));
    console.log('의견 짝', JSON.stringify(reviewTo));
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      const from = Object.keys(reviewTo).filter(k => reviewTo[k] === +n);
      if (from.length) await p.waitForFunction(() => /👍/.test(document.querySelector('#got').textContent), null, { timeout: 10000 }).catch(() => fail(`${n}번: 받은 의견이 안 보임`));
      await p.fill('#f-p0', '친구에게 문자를 보낼 때 줄임말은 하루 한 번만 쓰겠습니다.');
      await p.click('#fsub');
      await p.waitForFunction(() => /고쳐 쓴 다짐문을 올렸어요/.test(document.querySelector('#fm').textContent), null, { timeout: 10000 });
    }));
    console.log('3단계 의견 주고받기·고쳐 쓰기 완료');
    await shot(S[1], 'stu3');
    await T.waitForFunction(n => document.querySelectorAll('.gallery .paper').length === n, N, { timeout: 10000 }).catch(() => fail('TV 갤러리 카드 수가 맞지 않음'));
    if (!/하루 한 번만/.test(await T.textContent('.gallery'))) fail('TV 갤러리에 고쳐 쓴 내용이 안 보임');
    await T.click('.gallery .paper >> nth=0'); await T.waitForSelector('.modal');
    await shot(T, 'tv3big'); await T.click('#mclose');
    await shot(T, 'tv3');

    // 4단계
    await T.click('#tsteps button[data-s="4"]');
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      await p.waitForSelector('#ssave', { timeout: 10000 });
      for (const k of ['a', 'b', 'c']) await p.click(`.seg[data-k="${k}"] button[data-v="${1 + (+n % 3)}"]`);
      await p.click(`#pk button[data-k="${+n % 3}"]`);
      await p.fill('#feel', `${n}번 느낀 점`);
      await p.click('#ssave');
      await p.waitForFunction(() => /시작했어요/.test(document.querySelector('#sm').textContent), null, { timeout: 10000 });
    }));
    await T.waitForFunction(n => document.querySelectorAll('.board')[0]?.children.length === n, N, { timeout: 10000 })
      .then(() => console.log('4단계 챌린지 TV 표시 OK')).catch(() => fail('TV 챌린지 목록 수가 맞지 않음'));
    await shot(S[1], 'stu4'); await shot(T, 'tv4');
    // 이전 단계로 돌아가 보기
    await S[5].click('#steps button[data-s="1"]');
    await S[5].waitForSelector('text=우리말 번역가 배지', { timeout: 5000 }).then(() => console.log('지난 단계 다시 보기 OK')).catch(() => fail('1단계로 돌아가면 배지 화면이 안 보임'));
  } catch (e) { fail('진행 중 멈춤: ' + e.message); }
  finally {
    await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
    await browser.close();
  }
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모든 테스트 통과');
  process.exit(problems.length ? 1 : 0);
})();
