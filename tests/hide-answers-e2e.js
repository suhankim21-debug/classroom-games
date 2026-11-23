// 답 가리기 자동 테스트: 선생님 화면(#teacher)마다 🙈 답 가리기 버튼이 생기고, 처음엔 답(.cw-ans)이 가려져 있고,
// 버튼을 누르면 보였다가 다시 누르면 가려지는지 확인해요. 학생 화면에는 버튼이 없어야 해요.
// 실행: node tests/hide-answers-e2e.js   (다른 주소: BASE=http://localhost:8000/ node tests/hide-answers-e2e.js)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'https://suhankim21-debug.github.io/classroom-games/';
const APPS = (process.env.APPS || 'ai aifuture census conesphere culture cylinder docu eplay expo garden globe gwanggo hoop jamak magazine pi reader reporter space spy ssireum target tradelab tradeops wonju').split(' ');
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  for (const app of APPS) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', e => fail(`[${app}] JS 오류: ${e.message}`));
    try {
      await p.goto(BASE + app + '/#teacher');
      await p.waitForSelector('.cw-ansbtn', { timeout: 20000 });
    } catch (e) { fail(`[${app}] 선생님 화면에 답 가리기 버튼이 없음`); await ctx.close(); continue; }
    // 실제 화면 모양 그대로: 정답률 줄 하나를 붙여 보고 덮개가 씌워지는지 확인
    const cover = () => p.evaluate(() => {
      let t = document.getElementById('cw-test');
      if (!t) { t = document.createElement('div'); t.id = 'cw-test'; t.innerHTML = '<small class="muted cw-ans">정답: 3.14</small><div class="qb cw-ans">80%</div>'; document.body.appendChild(t); }
      return [...t.querySelectorAll('.cw-ans')].map(e => getComputedStyle(e, '::after').content);
    });
    const label = () => p.textContent('.cw-ansbtn');
    let c = await cover();
    if (!c.every(x => /가림/.test(x))) fail(`[${app}] 처음에 답이 가려져 있지 않음`);
    if (!/답 보기/.test(await label())) fail(`[${app}] 처음 버튼 글자가 '답 보기'가 아님`);
    await p.click('.cw-ansbtn');
    c = await cover();
    if (!c.every(x => x === 'none' || x === 'normal')) fail(`[${app}] 버튼을 눌러도 답이 보이지 않음`);
    if (!/답 가리기/.test(await label())) fail(`[${app}] 보인 뒤 버튼 글자가 '답 가리기'가 아님`);
    await p.click('.cw-ansbtn');
    c = await cover();
    if (!c.every(x => /가림/.test(x))) fail(`[${app}] 다시 눌러도 가려지지 않음`);
    // 학생 화면에는 버튼이 없어야 해요
    const s = await ctx.newPage();
    await s.goto(BASE + app + '/');
    await s.waitForTimeout(1500);
    if (await s.$('.cw-ansbtn')) fail(`[${app}] 학생 화면에 답 가리기 버튼이 있음`);
    console.log(problems.length ? '…' : '✅', app);
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
