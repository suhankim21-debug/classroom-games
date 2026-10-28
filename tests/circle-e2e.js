// 원의 둘레와 넓이 실험실 자동 테스트: 다섯 화면을 차례로 눌러 보고 오류가 없는지 확인해요.
// 실행: node tests/circle-e2e.js   (다른 주소: URL=http://localhost:8000/circle/ node tests/circle-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/circle/';
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY && !URL.startsWith('file:') ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  for (const [w, h] of [[1366, 768], [820, 1180]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => fail(`[${w}] JS 오류: ${e.message}`));
    await p.goto(URL);
    await p.click('#r1play'); await p.waitForTimeout(4600);
    if (!(await p.textContent('#say1')).includes('3배보다 조금')) fail(`[${w}] 원 굴리기 결과 문장이 안 나옴`);
    await p.click('#r1mode');
    await p.click('nav button[data-t=s5]');
    await p.click('#r5play'); await p.waitForTimeout(5200);
    if (!(await p.textContent('#say5')).includes('3번')) fail(`[${w}] 지름 끈 감기 결과 문장이 안 나옴`);
    await p.click('#r5poly');
    for (let k = 0; k < 4; k++) await p.click('#r5more');
    if (!(await p.textContent('#say5')).includes('3.141')) fail(`[${w}] 정96각형 값 이상: ${await p.textContent('#say5')}`);
    await p.click('nav button[data-t=s2]');
    for (const i of [1, 2, 6]) { await p.click(`#objs button:nth-child(${i})`); await p.waitForTimeout(7200); }
    const pis = await p.$$eval('#tb td.pi', t => t.map(x => +x.textContent));
    if (pis.length !== 3 || pis.some(v => v < 3.1 || v > 3.15)) fail(`[${w}] 원주율 표 이상: ${pis}`);
    if ((await p.textContent('#cdo')) !== '31.4 cm') fail(`[${w}] 원주 계산 이상`);
    await p.click('nav button[data-t=s3]');
    await p.click('#g_full'); await p.click('#g_part');
    if (!(await p.textContent('#say3')).includes('88칸보다 크고 132칸보다')) fail(`[${w}] 모눈 세기 이상: ${await p.textContent('#say3')}`);
    await p.click('nav button[data-t=s4]'); await p.click('#r4play'); await p.waitForTimeout(3000);
    if (!(await p.isVisible('#steps li:first-child'))) fail(`[${w}] 잘라 붙이기 1단계가 안 보임`);
    for (let k = 0; k < 3; k++) await p.click('#r4next');
    if (!(await p.isVisible('#steps li:nth-child(4)'))) fail(`[${w}] 마지막 단계가 안 보임`);
    if (!(await p.textContent('#aro')).includes('78.5')) fail(`[${w}] 넓이 계산 이상`);
    await p.close();
  }
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
