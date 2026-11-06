// 이달의 기업 편집실 자동 테스트: 교사 화면 1개 + 학생 3명이 실제 Firebase 방에서 1~4단계를 끝까지 해 봐요.
// 실행: node tests/magazine-e2e.js   (다른 주소: URL=http://localhost:8000/magazine/ node tests/magazine-e2e.js)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/magazine/';
const SHOTS = process.env.SHOTS || '';
const N = 3;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w = 1000, h = 900) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
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
    const p = await mk('학생' + n, 820, 1100);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-num', String(n)); await p.fill('#cw-name', `학생${n}`);
    await p.click('#enter');
    S.push(p);
  }
  await S[0].waitForSelector('.cw-wait', { timeout: 15000 }).catch(() => fail('시작 전 대기 화면이 안 보임'));
  await shot(S[0], 's-wait');
  // 3번은 쉬운 화면
  await T.click('#ppl button[data-ez="3"]');
  await T.click('.cw-go');
  await S[0].waitForSelector('.cw-wait', { state: 'detached', timeout: 10000 }).catch(() => fail('시작 뒤에도 대기 화면'));
  const cnt = async n => T.waitForFunction(n => /이 단계 끝 (\d+)명/.exec(document.querySelector('#cnt').textContent)?.[1] == n, n, { timeout: 20000 })
    .then(() => true).catch(async () => { fail('TV 집계가 맞지 않음: ' + await T.textContent('#cnt')); return false; });
  const answer = async (p, wrong) => {
    await p.waitForSelector('.opts button:not([disabled])', { timeout: 10000 });
    const ok = await p.evaluate(wrong => {
      const qt = document.querySelector('.q').textContent;
      const it = [...RECALL, ...CHECK].find(x => x.q === qt);
      if (!it) return false;
      const b = [...document.querySelectorAll('.opts button')].find(b => wrong ? b.dataset.o !== it.a : b.dataset.o === it.a);
      b.click(); return true;
    }, wrong);
    if (!ok) fail('문제를 찾지 못함');
    if (wrong) { await p.waitForTimeout(200); await answer(p, false); }
    await p.waitForTimeout(1100);
  };
  // 1단계
  await Promise.all(S.map(async (p, k) => { for (let i = 0; i < 8; i++) await answer(p, k === 0 && i === 2); }));
  if ((await S[2].$$('.opts button')).length) fail('1단계가 끝나지 않음');
  await cnt(N);
  await T.click('#wrongT');
  if (!/학생1/.test(await T.textContent('#qstat'))) fail('1단계 틀린 학생 이름이 안 보임');
  await shot(T, 't1');
  // 2단계
  await T.click('#tsteps button[data-s="2"]');
  await S[1].waitForSelector('.cw-wait', { timeout: 10000 }).catch(() => fail('2단계에서 대기 화면이 안 보임'));
  await T.click('.cw-go');
  const countries = ['중국', '인도', '미국'];
  await Promise.all(S.map(async (p, k) => {
    for (let i = 0; i < 2; i++) await answer(p, k === 1 && i === 0);
    await p.waitForSelector('#save');
    if (k === 2) {
      if (await p.$('#f_feat')) fail('쉬운 화면인데 선택 칸이 보임');
      for (const f of ['name', 'prod', 'goal', 'worker']) await p.click(`.field[data-f="${f}"] .chips button`);
      await p.click(`.field[data-f="country"] .chips button[data-c="${countries[k]}"]`);
    } else {
      await p.click('#save');
      if (!/빠진 칸/.test(await p.textContent('#fm'))) fail('빈 칸 안내가 안 나옴');
      await p.fill('#f_name', `기업${k + 1}`);
      await p.click('.field[data-f="prod"] .chips button');
      await p.fill('#f_feat', '아주 좋아요');
      await p.click(`.field[data-f="country"] .chips button[data-c="${countries[k]}"]`);
      await p.fill('#f_why', '인구가 많아서');
      await p.click('.field[data-f="goal"] .chips button');
      await p.fill('#f_worker', '휴가를 보장해요');
    }
    await p.click('#save');
    await p.waitForSelector('#edit');
  }));
  await cnt(N);
  await shot(S[0], 's2-plan'); await shot(T, 't2');
  if (!/기업1/.test(await T.textContent('#main'))) fail('TV에 계획서가 안 보임');
  // 3단계: 그림 올리기
  await T.click('#tsteps button[data-s="3"]');
  await T.click('.cw-go');
  const img = path.join(require('os').tmpdir(), 'mag-cover.png');
  fs.writeFileSync(img, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAAhAAJrN5jVAAAAAElFTkSuQmCC', 'base64'));
  await Promise.all(S.map(async (p, k) => {
    await p.waitForSelector('.check button');
    await p.click('.check button');
    if (k === 2) { await p.click('#noimg'); }
    else { await p.setInputFiles('#file', img); await p.waitForSelector('#up:not([disabled])'); await p.click('#up'); }
    await p.waitForSelector('#redo', { timeout: 20000 });
  }));
  await cnt(N);
  await shot(S[0], 's3-done'); await shot(T, 't3');
  if ((await T.$$('#main .gal img')).length !== 2) fail('TV 표지 갤러리 그림 수가 2가 아님');
  // 4단계: 박람회
  await T.click('#tsteps button[data-s="4"]');
  await T.click('.cw-go');
  await Promise.all(S.map(async (p, k) => {
    for (const s of ['ex', 'so', 'wk']) {
      await p.waitForSelector('.gal button.it', { timeout: 15000 });
      const others = await p.$$eval('.gal button.it', b => b.map(x => +x.dataset.n));
      const tgt = others[s === 'wk' ? 1 % others.length : 0];
      await p.click(`.gal button[data-n="${tgt}"]`);
      if (await p.$('#qq')) {
        await p.click(`#qq button[data-o="${countries[tgt - 1]}"]`);
      }
      await p.waitForSelector(`.stickers button[data-k="${s}"]`);
      await p.click(`.stickers button[data-k="${s}"]`);
      await p.waitForTimeout(300);
      await p.click('#back2');
    }
  }));
  await cnt(N);
  await shot(S[0], 's4'); await shot(T, 't4');
  await T.click('#award');
  if (!/수출 전략상/.test(await T.textContent('#main'))) fail('시상식이 안 보임');
  await shot(T, 't4-award');
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code);
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
