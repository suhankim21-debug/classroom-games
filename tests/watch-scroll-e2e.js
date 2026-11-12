// 학생 화면 보기 스크롤 테스트: 선생님이 학생 화면 보기(👀)를 아래로 내린 뒤 실시간으로 다시 그려져도 맨 위로 튕기지 않는지 확인해요.
// 실행: node tests/watch-scroll-e2e.js   (다른 활동: URL=http://localhost:8000/globe/ node tests/watch-scroll-e2e.js)
// 학생별 카드 목록, 한 학생 크게 보기, '← 모든 학생'으로 돌아올 때 자리 기억을 확인해요. 끝나면 방은 지워요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/reader/';
const N = 8;
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const mk = async (label, w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { try { Object.keys(localStorage).filter(k => k.startsWith('firebase:host')).forEach(k => localStorage.removeItem(k)); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${label}] JS 오류: ${e.message}`));
    return p;
  };
  const T = await mk('교사', 1000, 500);
  await T.goto(URL + '#teacher');
  await T.waitForSelector('.roomcode', { timeout: 20000 });
  const code = (await T.textContent('.roomcode')).trim();
  console.log('방 번호', code);
  const S = [];
  for (let i = 1; i <= N; i++) {
    const p = await mk(i + '번', 820, 900);
    await p.goto(URL + '?room=' + code);
    await p.fill('#cw-name', `${i} 학생${i}`);
    await p.click('#enter');
    await sleep(300);
    S.push(p);
  }
  // 학생 화면을 길게 만들고 계속 바뀌게 해요 (실시간 갱신)
  const grow = async k => S[k].evaluate(k => {
    const r = document.getElementById('app') || document.body;
    let d = document.getElementById('tlong'); if (!d) { d = document.createElement('div'); d.id = 'tlong'; r.appendChild(d); }
    d.innerHTML = Array.from({ length: 40 }, (_, i) => `<p>긴 줄 ${i} · ${k} · ${Date.now()}</p>`).join('');
  }, k);
  for (let k = 0; k < N; k++) await grow(k);
  await T.click('.cw-open');
  await T.waitForFunction(n => document.querySelectorAll('.cw-card').length >= n, N, { timeout: 15000 });
  const top = () => T.evaluate(() => document.querySelector('.cw-ov').scrollTop);
  const max = await T.evaluate(() => { const o = document.querySelector('.cw-ov'); return o.scrollHeight - o.clientHeight; });
  if (max < 100) fail('학생 카드 목록이 스크롤할 만큼 길지 않음(테스트 조건) ' + max);
  await T.evaluate(() => { const o = document.querySelector('.cw-ov'); o.scrollTop = o.scrollHeight; });
  const y1 = await top();
  for (let t = 0; t < 3; t++) { for (let k = 0; k < N; k++) await grow(k); await sleep(2200); }
  await sleep(4000); // 5초마다 다시 그리는 것까지
  const y2 = await top();
  console.log('카드 목록 스크롤', y1, '→', y2);
  if (Math.abs(y2 - y1) > 5) fail(`카드 목록 스크롤이 튕김: ${y1} → ${y2}`);
  // 한 학생 크게 보기
  await T.evaluate(() => document.querySelector('.cw-card').click()); // 마우스 클릭처럼 스크롤을 옮기지 않게
  await T.waitForSelector('.cw-zoom .cw-scr');
  await sleep(800);
  if (await top() !== 0) fail('크게 보기를 열면 맨 위부터 보여야 함');
  await T.evaluate(() => { const o = document.querySelector('.cw-ov'); o.scrollTop = 700; });
  const z1 = await top();
  if (z1 < 300) fail('크게 보기가 스크롤할 만큼 길지 않음(테스트 조건) ' + z1);
  for (let t = 0; t < 4; t++) { for (let k = 0; k < N; k++) await grow(k); await sleep(1500); }
  await sleep(1000);
  const z2 = await top();
  console.log('크게 보기 스크롤', z1, '→', z2);
  if (Math.abs(z2 - z1) > 5) fail(`크게 보기 스크롤이 튕김: ${z1} → ${z2}`);
  await T.click('.cw-back');
  await sleep(500);
  const y3 = await top();
  console.log('모든 학생으로 돌아옴', y3, await T.evaluate(() => { const o = document.querySelector('.cw-ov'); return o.scrollHeight - o.clientHeight; }));
  if (Math.abs(y3 - y2) > 5) fail(`'← 모든 학생'으로 돌아오면 아까 자리여야 함: ${y2} → ${y3}`);
  // 단계별 화면 탭도 다시 그릴 때 튕기지 않아요
  await T.click('.cw-tabs button[data-tab="steps"]');
  await sleep(1500);
  const sMax = await T.evaluate(() => { const o = document.querySelector('.cw-ov'); return o.scrollHeight - o.clientHeight; });
  if (sMax > 50) {
    await T.evaluate(() => { const o = document.querySelector('.cw-ov'); o.scrollTop = o.scrollHeight; });
    const s1 = await top();
    for (let t = 0; t < 2; t++) { for (let k = 0; k < N; k++) await grow(k); await sleep(2200); }
    const s2 = await top();
    console.log('단계별 화면 스크롤', s1, '→', s2);
    if (Math.abs(s2 - s1) > 5) fail(`단계별 화면 스크롤이 튕김: ${s1} → ${s2}`);
  }
  await T.evaluate(c => firebase.database().ref('rooms/' + c).remove().then(() => firebase.database().ref('rooms/' + c + '_watch').remove()), code).catch(() => {});
  await browser.close();
  if (problems.length) { console.log(`\n문제 ${problems.length}개`); process.exit(1); }
  console.log('\n✅ 학생 화면 보기 스크롤 테스트 통과');
})().catch(e => { console.error(e); process.exit(1); });
