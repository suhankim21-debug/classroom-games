// 우리 반 신문 편집기 자동 테스트: 내용·사진을 넣으면 신문처럼 편집되고, 인쇄(PDF)하면 A4 한 장에 맞는지 봐요.
// 실행: node tests/newspaper-e2e.js   (다른 주소: URL=http://localhost:8000/newspaper/ node tests/newspaper-e2e.js)
const { chromium } = require('playwright');
const URL = process.env.URL || 'https://suhankim21-debug.github.io/classroom-games/newspaper/';
const SHOTS = process.env.SHOTS || '';
const problems = [];
const fail = m => { problems.push(m); console.log('❌', m); };
const pdfPages = buf => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const A4 = { w: 595, h: 842 };
(async () => {
  const browser = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => fail('JS 오류: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|TUNNEL|tunnel via proxy|fonts/.test(m.text())) fail('콘솔 오류: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(URL);
  await p.waitForSelector('#paper');
  if (!/표제를 쓰세요/.test(await p.textContent('#pTitle'))) fail('빈 상태 안내가 없음');

  // 사진으로 쓸 그림을 브라우저에서 만들어요.
  const png = async (w, h, color) => Buffer.from((await p.evaluate(([w, h, color]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '80px sans-serif'; g.fillText('사진', 40, 120);
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h, color])), 'base64');

  await p.fill('#paperName', '봄빛 어린이 신문');
  await p.fill('#section', '학교 소식');
  await p.fill('#pub', '6학년 2반');
  await p.fill('#title', '6학년, 운동회에서 하나 된 마음 보여');
  await p.fill('#deck', '줄다리기 역전승에 운동장 들썩\n친구를 응원하는 목소리 가득');
  await p.fill('#reporter', '김하늘');
  await p.fill('#lead', '지난 10일 오전 9시, 학교 운동장에서 6학년 학생들이 가을 운동회를 열어 반끼리 힘을 모아 줄다리기와 이어달리기를 했다.');
  const para = '이날 운동회는 학생들이 직접 경기 순서를 정하고 응원 도구를 만들어 더욱 뜻깊었다. 처음에는 청팀이 앞섰지만 백팀이 마지막 줄다리기에서 힘을 모아 역전에 성공했다.';
  await p.fill('#body', [para, para, '인터뷰에 응한 한 학생은 "친구들과 함께해서 이긴 것보다 더 기뻤다."라고 말했다.', para].join('\n'));
  await p.setInputFiles('#img1', { name: 'a.png', mimeType: 'image/png', buffer: await png(1600, 1000, '#3D6E8C') });
  await p.waitForSelector('#pFig1:not([hidden])');
  await p.fill('#cap1', '운동회에서 줄다리기를 하는 6학년 학생들');
  await p.setInputFiles('#img2', { name: 'b.png', mimeType: 'image/png', buffer: await png(800, 800, '#E0704F') });
  await p.waitForSelector('#pCols figure img');

  const txt = await p.textContent('#paper');
  for (const s of ['봄빛 어린이 신문', '학교 소식', '6학년, 운동회에서', '줄다리기 역전승', '김하늘 기자', '6학년 2반', '운동회에서 줄다리기를 하는', '지난 10일'])
    if (!txt.includes(s)) fail('미리 보기에 안 나옴: ' + s);
  const info = await p.evaluate(() => ({
    cols: getComputedStyle(document.querySelector('#pCols')).columnCount,
    wb: getComputedStyle(document.querySelector('#paper')).wordBreak,
    over: document.querySelector('#paper').scrollHeight > document.querySelector('#paper').clientHeight + 1,
    grow: document.querySelector('#paper').classList.contains('grow'),
    big: document.querySelector('#pImg1').naturalWidth,
  }));
  console.log('다단', info.cols, '줄바꿈', info.wb, '사진 폭', info.big);
  if (!(+info.cols >= 2)) fail('본문이 다단으로 나뉘지 않음');
  if (info.wb !== 'keep-all') fail('word-break가 keep-all이 아님');
  if (info.over || info.grow) fail('보통 길이 기사가 한 장을 넘음');
  if (info.big > 1400) fail('사진을 줄이지 않음');
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/screen.png`, fullPage: true });

  // 인쇄: A4 한 장
  await p.emulateMedia({ media: 'print' });
  if (await p.isVisible('#f')) fail('인쇄할 때 입력 칸이 보임');
  await p.emulateMedia({ media: null });
  let pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  if (SHOTS) require('fs').writeFileSync(`${SHOTS}/one.pdf`, pdf);
  console.log('보통 기사 PDF 쪽수', pdfPages(pdf));
  if (pdfPages(pdf) !== 1) fail('보통 기사가 A4 한 장으로 인쇄되지 않음: ' + pdfPages(pdf));
  const box = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/);
  if (!box || Math.abs(box[1] - A4.w) > 2 || Math.abs(box[2] - A4.h) > 2) fail('용지가 A4가 아님: ' + (box && box.slice(1)));

  // 새로고침해도 남아 있어요.
  await p.reload(); await p.waitForSelector('#pFig1:not([hidden])', { timeout: 5000 }).catch(() => fail('새로고침 뒤 사진이 사라짐'));
  if (await p.inputValue('#title') !== '6학년, 운동회에서 하나 된 마음 보여') fail('새로고침 뒤 표제가 사라짐');

  // 조금 긴 글은 글자를 줄여 한 장에 맞춰요.
  await p.fill('#body', Array(9).fill(para).join('\n'));
  const fs = +(await p.getAttribute('#paper', 'data-fs'));
  console.log('긴 글 본문 글자 크기', fs);
  if (await p.evaluate(() => document.querySelector('#paper').classList.contains('grow'))) fail('조금 긴 글이 한 장에 안 들어감');
  pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  if (pdfPages(pdf) !== 1) fail('조금 긴 글이 한 장으로 인쇄되지 않음');

  // 아주 긴 글은 안내가 나오고 2쪽으로.
  await p.fill('#body', Array(30).fill(para).join('\n'));
  if (!/2쪽/.test(await p.textContent('#fit'))) fail('아주 긴 글 안내가 없음');
  pdf = await p.pdf({ preferCSSPageSize: true, printBackground: true });
  console.log('아주 긴 글 PDF 쪽수', pdfPages(pdf));
  if (pdfPages(pdf) < 2) fail('아주 긴 글 내용이 잘림');

  // 휴대폰·태블릿 폭: 가로 스크롤 없이 미리 보기가 줄어요.
  await p.setViewportSize({ width: 390, height: 800 });
  await p.waitForTimeout(200);
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  if (sw > 392) fail('좁은 화면에서 가로로 넘침: ' + sw);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/phone.png`, fullPage: true });

  // 새로 쓰기
  await p.click('#reset');
  if (await p.inputValue('#title') !== '') fail('새로 쓰기가 안 됨');
  if (await p.isVisible('#pFig1')) fail('새로 쓰기 뒤 사진이 남음');

  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
