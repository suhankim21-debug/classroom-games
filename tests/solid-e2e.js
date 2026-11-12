// 원기둥·원뿔·구 실험실 자동 테스트: 네 화면을 차례로 눌러 보고 오류가 없는지, 설명 문장이 맞게 나오는지 확인해요.
// 실행: node tests/solid-e2e.js   (다른 주소: URL=http://localhost:8000/solid/ node tests/solid-e2e.js)
// three.js를 CDN에서 못 받는 곳에서는 THREE_JS=<three.min.js 경로> 를 주면 그 파일을 써요.
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/solid/';
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  for (const [w, h] of [[1366, 768], [820, 1180]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    if (process.env.THREE_JS) await p.route('**/three.min.js', r => r.fulfill({ path: process.env.THREE_JS, contentType: 'application/javascript' }));
    p.on('pageerror', e => fail(`[${w}] JS 오류: ${e.message}`));
    await p.goto(URL); await p.waitForTimeout(800);
    const say = async id => (await p.textContent(id)).replace(/\s+/g, ' ');
    for (const [sh, want] of [['rect', '원기둥이'], ['tri', '원뿔이'], ['semi', '구가']]) {
      await p.click(`[data-sh=${sh}]`); await p.click('#r1play'); await p.waitForTimeout(300);
      if (!(await say('#say1')).includes(want + ' 돼요')) fail(`[${w}] 돌려 만들기 ${sh} → ${want} 문장 없음: ${await say('#say1')}`);
    }
    await p.click('[data-sh=rect]'); await p.click('#r1play'); await p.waitForTimeout(200);
    if (!(await say('#say1')).includes('밑면의 지름 6 cm')) fail(`[${w}] 가로 3 cm → 지름 6 cm 문장 없음`);
    await p.click('nav button[data-t=s2]');
    for (const so of ['cyl', 'cone', 'sph']) {
      await p.click(`[data-so=${so}]`);
      const n = await p.$$eval('#parts button', bs => bs.length);
      for (let i = 0; i < n; i++) await p.click(`#parts button >> nth=${i}`);
    }
    if (!(await say('#say2')).includes('길이가 모두 같아요')) fail(`[${w}] 구 반지름 여러 개 문장 없음`);
    await p.click('nav button[data-t=s3]'); await p.click('#r3play'); await p.waitForTimeout(300);
    if (!(await say('#say3')).includes('12.56 cm')) fail(`[${w}] 전개도 옆면 가로 12.56 cm 문장 없음: ${await say('#say3')}`);
    await p.click('#r3fit'); await p.click('#r3back'); await p.waitForTimeout(300);
    if (!(await say('#say3')).includes('전개도가 아니에요')) fail(`[${w}] 맞지 않는 전개도 안내 없음: ${await say('#say3')}`);
    await p.click('nav button[data-t=s4]'); await p.click('[data-cam=front]');
    if (!(await say('#say4')).includes('삼각형')) fail(`[${w}] 앞에서 본 모양 문장 없음`);
    await p.click('#r4all');
    if (await p.$('#tb4 td.hide')) fail(`[${w}] 표 모두 보기 안 됨`);
    await p.close();
  }
  await browser.close();
  console.log(problems.length ? `문제 ${problems.length}개` : '✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
