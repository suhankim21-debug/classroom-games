// 우리 반 AI 연구소 자동 테스트: 교사 화면 1개 + 학생 8명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 2단계에서는 학생마다 삼각형·사각형·원을 손으로 그린 것처럼 조금씩 다르게 그려 데이터를 모으고,
// 3단계에서 학습시킨 AI가 새 그림(평가용 데이터)을 얼마나 맞히는지(많이 배운 AI가 조금 배운 AI보다 잘 맞히는지) 확인해요.
// 실행: node tests/ai-e2e.js   (다른 주소: URL=http://localhost:8000/ai/ node tests/ai-e2e.js)
// 끝나면 테스트로 만든 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/ai/';
const SHOTS = process.env.SHOTS || '';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
// 손그림 흉내: 위치·크기·비율·떨림을 무작위로 바꿔요 (280×280 그림판 좌표)
const SHAPES = () => {
  const R = (a, b) => a + Math.random() * (b - a);
  const jit = p => [p[0] + R(-3, 3), p[1] + R(-3, 3)];
  const ell = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 28) => Array.from({ length: n + 1 }, (_, i) => jit([cx + rx * Math.cos(a0 + (a1 - a0) * i / n), cy + ry * Math.sin(a0 + (a1 - a0) * i / n)]));
  const line = (...ps) => ps.map(jit);
  return {
    tri() { const cx = R(110, 170), by = R(190, 230), w = R(130, 190), h = w * R(0.75, 1.0);
      return [line([cx - w / 2, by], [cx, by - h], [cx + w / 2, by], [cx - w / 2, by])]; },
    sq() { const x = R(50, 90), y = R(50, 90), w = R(120, 170), h = w * R(0.8, 1.15);
      return [line([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y])]; },
    cir() { const cx = R(120, 160), cy = R(120, 160), r = R(55, 85);
      return [ell(cx, cy, r, r * R(0.85, 1.1))]; },
    other() { // 배우지 않은 것: 별
      const cx = R(120, 160), cy = R(120, 160), r = R(70, 95);
      return [line(...Array.from({ length: 6 }, (_, i) => { const th = -Math.PI / 2 + i * 4 * Math.PI / 5; return [cx + r * Math.cos(th), cy + r * Math.sin(th)]; }))]; },
  };
};
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
  const ANS = await T.evaluate(() => Object.fromEntries([...SCENE, ...GAME].map(q => [q.q, q.a])));
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
  const draw = (p, kind) => p.evaluate(([src, kind]) => { const S = eval('(' + src + ')')(); window.__pad.clear(); window.__pad.strokes(S[kind]()); }, [SHAPES.toString(), kind]);
  const S = {};
  try {
    await Promise.all(Array.from({ length: N }, (_, i) => i + 1).map(async n => {
      const p = await mk(n + '번', n === 1 ? 400 : 1000, 1000); S[n] = p;
      await p.goto(URL + '?room=' + code);
      await p.fill('#cw-name', `${n} 학생${n}`);
      await p.click('#enter');
      await p.waitForSelector('#cards button', { timeout: 15000 });
    }));
    console.log(`${N}명 입장 완료`);
    // 👀 학생 화면: 선생님 화면에서 모든 학생이 번호 이름과 1단계로 보여요
    await T.click('.cw-open');
    await T.waitForFunction(n => [...document.querySelectorAll('.cw-tile:not(.off)')].filter(x => /\d+번 학생\d+/.test(x.textContent) && /1\/4/.test(x.textContent) && x.querySelector('.cw-scr main')).length === n, N, { timeout: 15000 })
      .catch(async () => fail('학생 화면 보기에 학생들이 안 보임: ' + (await T.evaluate(() => [...document.querySelectorAll('.cw-tile')].map(x => x.textContent.slice(0, 30)).join(' | ')))));
    await T.click('.cw-close');

    // 1단계: 순서 맞히기(2번은 일부러 한 번 틀려요) → 장면 문제
    await Promise.all(Object.entries(S).map(async ([n, p]) => {
      if (+n === 2) { await p.click('#cards button[data-i="2"]'); if (!/아니에요/.test(await p.textContent('#om'))) fail('순서를 틀렸을 때 안내가 안 나옴'); }
      for (let i = 0; i < 4; i++) await p.click(`#cards button[data-i="${i}"]`);
      await solve(p, '#qz', 4, +n === 3);
    }));
    await T.waitForFunction(n => new RegExp(`이 단계 끝 ${n}명`).test(document.querySelector('#cnt').textContent), N, { timeout: 15000 }).catch(() => fail('1단계 끝이 TV에 안 보임'));
    await shot(S[1], 's1-done'); await shot(T, 't1');
    console.log('1단계 OK');

    // 2단계: 그림마다 3개씩 그려 보내요
    await stage(2);
    const KIND = { '삼각형': 'tri', '사각형': 'sq', '원': 'cir' };
    await Promise.all(Object.values(S).map(async p => {
      await p.waitForSelector('#padbox canvas', { timeout: 10000 });
      for (let k = 0; k < 9; k++) {
        const ask = await p.textContent('#ask'); const name = Object.keys(KIND).find(x => new RegExp(' ' + x + '을').test(ask));
        await draw(p, KIND[name]);
        await p.click('#send');
        await p.waitForFunction(nm => document.querySelector('#dm').textContent.includes(nm) && !document.querySelector('#ask').textContent.includes('__'), name, { timeout: 10000 });
        await p.waitForFunction(k => { const t = document.querySelector('#mine').textContent.match(/\d+(?=\/3)/g); return t && t.reduce((a, b) => a + +b, 0) >= k; }, k + 1, { timeout: 10000 });
      }
    }));
    await T.waitForFunction(n => new RegExp(`이 단계 끝 ${n}명`).test(document.querySelector('#cnt').textContent), N, { timeout: 15000 }).catch(() => fail('2단계 끝이 TV에 안 보임'));
    const total = await T.$$eval('.gal figure', e => e.length);
    if (total !== N * 9) fail(`TV 갤러리 그림 수 ${total} (기대 ${N * 9})`);
    await T.click('.gal figure button');
    await T.waitForFunction(n => document.querySelectorAll('.gal figure').length === n, N * 9 - 1, { timeout: 10000 }).catch(() => fail('✕로 데이터가 안 지워짐'));
    await shot(S[1], 's2'); await shot(T, 't2');
    console.log('2단계 OK');

    // 3단계: 학습시키기 → 학생마다 테스트 5번(그림 4개 + 배우지 않은 것 1개)
    await stage(3);
    await S[1].waitForSelector('.train', { timeout: 10000 });
    await T.click('#trainBtn');
    await Promise.all(Object.values(S).map(p => p.waitForSelector('#pick', { timeout: 20000 })));
    const kinds = ['tri', 'sq', 'cir', 'sq', 'other'];
    await Promise.all(Object.values(S).map(async p => {
      for (let i = 0; i < kinds.length; i++) {
        await p.click(`#pick button[data-l="${kinds[i]}"]`);
        await draw(p, kinds[i]);
        await p.click('#test');
        await p.waitForFunction(i => document.querySelector('#cnt3').textContent.includes(`평가 ${i}번`), i + 1, { timeout: 10000 });
      }
    }));
    await T.waitForFunction(n => new RegExp(`이 단계 끝 ${n}명`).test(document.querySelector('#cnt').textContent), N, { timeout: 15000 }).catch(() => fail('3단계 끝이 TV에 안 보임'));
    const accs = await T.$$eval('.bars .bar > span:last-child', e => e.map(x => parseInt(x.textContent)));
    console.log('정확도 많이 배운 AI', accs[0] + '%', '· 조금 배운 AI', accs[1] + '%');
    if (!(accs[0] >= 75)) fail('많이 배운 AI 정확도가 낮음: ' + accs[0]);
    if (!(accs[0] >= accs[1])) fail('많이 배운 AI가 조금 배운 AI보다 못함');
    if (!/모두 삼각형·사각형·원 중 하나로/.test(await T.textContent('#main'))) fail('배우지 않은 것 결과가 TV에 안 보임');
    await shot(S[2], 's3'); await shot(T, 't3');
    console.log('3단계 OK');

    // 4단계: 퀴즈 대결 → 시상식
    await stage(4);
    await Promise.all(Object.entries(S).map(([n, p]) => solve(p, '#gz', 9, +n === 4)));
    await T.waitForFunction(n => new RegExp(`이 단계 끝 ${n}명`).test(document.querySelector('#cnt').textContent), N, { timeout: 15000 }).catch(() => fail('4단계 끝이 TV에 안 보임'));
    await T.click('#awon');
    await T.waitForSelector('.podium', { timeout: 10000 });
    await S[1].waitForFunction(() => /등!/.test(document.body.textContent), null, { timeout: 10000 }).catch(() => fail('학생 화면에 등수가 안 보임'));
    await shot(S[1], 's4'); await shot(T, 't4');
    console.log('4단계 OK');
  } catch (e) { fail('진행 중 멈춤: ' + e.message); }
  await T.evaluate(c => Promise.all([firebase.database().ref('rooms/' + c).remove(), firebase.database().ref('rooms/' + c + '_watch').remove()]), code).catch(() => {});
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
