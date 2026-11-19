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
  await p.waitForSelector('#paper_el');
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
  // 대표 사진은 알맞은 크기(높이 70mm 이하, 폭 62% 이하)로 왼쪽에, 전문은 오른쪽에 와요.
  await p.waitForTimeout(300);
  const hero = await p.evaluate(() => { const i = document.querySelector('#pImg1'), pp = document.querySelector('#paper_el'), mm = pp.getBoundingClientRect().width / 210; const r = i.getBoundingClientRect(); return { h: r.height / mm, w: r.width / mm, ratio: (r.width / r.height) / (i.naturalWidth / i.naturalHeight) }; });
  console.log('대표 사진 크기(mm)', hero.w.toFixed(0), 'x', hero.h.toFixed(0));
  if (hero.h > 71 || hero.w > 117 || Math.abs(hero.ratio - 1) > 0.03) fail('대표 사진 크기가 알맞지 않음: ' + JSON.stringify(hero));
  await p.fill('#cap1', '운동회에서 줄다리기를 하는 6학년 학생들');
  await p.setInputFiles('#img2', { name: 'b.png', mimeType: 'image/png', buffer: await png(800, 800, '#E0704F') });
  await p.waitForSelector('#pCols figure img');

  // 설문 조사 결과는 사진으로만 넣어요(그래프 칸 없음).
  if (await p.isVisible('#svBox')) fail('설문 그래프 칸이 아직 보임');
  if (!/설문 조사 결과 사진/.test(await p.textContent('#fs3 legend'))) fail('설문 조사 결과 사진 칸 이름이 다름');
  await p.setInputFiles('#img3', { name: 's.png', mimeType: 'image/png', buffer: await png(900, 600, '#888') });
  await p.waitForSelector('#pCols figure.survey img');
  if (!/설문 조사 결과/.test(await p.textContent('#pCols figure.survey .tag'))) fail('설문 사진 표시가 없음');

  if (!/지난 10일/.test(await p.textContent('#pLeadSide'))) fail('전문이 대표 사진 옆에 안 나옴');
  const txt = await p.textContent('#paper_el');
  for (const s of ['봄빛 어린이 신문', '학교 소식', '6학년, 운동회에서', '줄다리기 역전승', '김하늘 기자', '6학년 2반', '운동회에서 줄다리기를 하는', '지난 10일'])
    if (!txt.includes(s)) fail('미리 보기에 안 나옴: ' + s);
  const info = await p.evaluate(() => ({
    cols: getComputedStyle(document.querySelector('#pCols')).columnCount,
    wb: getComputedStyle(document.querySelector('#paper_el')).wordBreak,
    over: document.querySelector('#paper_el').scrollHeight > document.querySelector('#paper_el').clientHeight + 1,
    grow: document.querySelector('#paper_el').classList.contains('grow'),
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

  // B4·A3 용지: 같은 기사가 그 용지 한 장에 맞게 커져요.
  for (const [name, w, h] of [['B4', 728.5, 1031.8], ['A3', 841.9, 1190.6]]) {
    await p.selectOption('#paper', name);
    await p.waitForTimeout(300);
    const pp = await p.pdf({ preferCSSPageSize: true, printBackground: true });
    const mb = pp.toString('latin1').match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)/);
    console.log(name, 'PDF 쪽수', pdfPages(pp), mb && mb.slice(1).join('x'));
    if (pdfPages(pp) !== 1) fail(name + ' 한 장으로 인쇄되지 않음: ' + pdfPages(pp));
    if (!mb || Math.abs(mb[1] - w) > 3 || Math.abs(mb[2] - h) > 3) fail(name + ' 용지 크기가 아님: ' + (mb && mb.slice(1)));
    if (SHOTS) require('fs').writeFileSync(`${SHOTS}/${name}.pdf`, pp);
    if (!(await p.textContent('#fit')).includes(name + ' 한 장에')) fail(name + ' 안내 문구가 없음');
  }
  await p.selectOption('#paper', 'A4');
  // 새로고침해도 남아 있어요.
  await p.reload(); await p.waitForSelector('#pFig1:not([hidden])', { timeout: 5000 }).catch(() => fail('새로고침 뒤 사진이 사라짐'));
  if (await p.inputValue('#title') !== '6학년, 운동회에서 하나 된 마음 보여') fail('새로고침 뒤 표제가 사라짐');

  // 조금 긴 글은 글자를 줄여 한 장에 맞춰요.
  await p.fill('#body', Array(9).fill(para).join('\n'));
  const fs = +(await p.getAttribute('#paper_el', 'data-fs'));
  console.log('긴 글 본문 글자 크기', fs);
  if (await p.evaluate(() => document.querySelector('#paper_el').classList.contains('grow'))) fail('조금 긴 글이 한 장에 안 들어감');
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

  // 조 편성 링크: 조를 고르면 기자 이름이 들어가고, 조마다 따로 저장돼요.
  await p.setViewportSize({ width: 1300, height: 900 });
  const tag = Math.random().toString(36).slice(2, 7);
  const TEAMSTR = encodeURIComponent(`가나${tag}·다라|마바·사아${tag}`);
  await p.goto(URL + '#teams=' + TEAMSTR);
  await p.waitForSelector('#teamBox:not([hidden])').catch(() => fail('조 고르기가 안 보임'));
  await p.selectOption('#team', '2');
  if (await p.inputValue('#reporter') !== `마바·사아${tag}`) fail('조를 골라도 기자 이름이 안 들어감');
  if (!(await p.textContent('#pBy')).includes(`마바·사아${tag} 기자`)) fail('기자 이름이 신문에 안 나옴');
  if (!/2조/.test(await p.textContent('#pFootL'))) fail('꼬리에 조가 안 나옴');
  await p.fill('#title', '2조 기사');
  await p.selectOption('#team', '1');
  if (await p.inputValue('#title') !== '') fail('다른 조로 바꿨는데 2조 글이 보임');
  if (await p.inputValue('#reporter') !== `가나${tag}·다라`) fail('1조 기자 이름이 안 들어감');
  await p.selectOption('#team', '2');
  if (await p.inputValue('#title') !== '2조 기사') fail('2조 글이 저장되지 않음');
  await p.reload(); await p.waitForSelector('#teamBox:not([hidden])');
  if (await p.inputValue('#team') !== '2' || await p.inputValue('#title') !== '2조 기사') fail('새로고침 뒤 조·글이 이어지지 않음');
  // Ctrl+V 붙여 넣기 대신: 끌어다 놓기로 사진 넣기
  const b64 = (await png(600, 400, '#3F8A5A')).toString('base64');
  await p.evaluate(b64 => {
    const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([u], 'c.png', { type: 'image/png' }));
    document.querySelector('#fs1').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, b64);
  await p.waitForSelector('#pFig1:not([hidden])', { timeout: 5000 }).catch(() => fail('끌어다 놓은 사진이 안 들어감'));

  // 선생님 실시간 보기
  await p.waitForFunction(() => /저장됨/.test(document.querySelector('#sync').textContent), null, { timeout: 15000 }).catch(() => fail('인터넷 저장 표시가 안 나옴'));
  const tctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const T = await tctx.newPage();
  T.on('pageerror', e => fail('[교사] JS 오류: ' + e.message));
  await T.goto(URL + '#teams=' + TEAMSTR + '&teacher');
  await T.waitForSelector('.tcard', { timeout: 15000 }).catch(() => fail('선생님 화면에 조 카드가 없음'));
  if (await T.isVisible('#f')) fail('선생님 화면에 입력 칸이 보임');
  await T.click('.tcard[data-t="2"]');
  await T.waitForFunction(() => document.querySelector('#pTitle').textContent === '2조 기사', null, { timeout: 15000 }).catch(() => fail('선생님 화면에 2조 표제가 안 보임'));
  await T.waitForSelector('#pFig1:not([hidden])', { timeout: 15000 }).catch(() => fail('선생님 화면에 2조 사진이 안 보임'));
  await p.fill('#lead', '실시간으로 보이는 전문입니다.');
  await T.waitForFunction(() => /실시간으로 보이는 전문/.test(document.querySelector('#paper_el').textContent), null, { timeout: 15000 }).catch(() => fail('학생이 쓴 전문이 선생님 화면에 바로 안 보임'));
  if (!/2조/.test(await T.textContent('.tcard[data-t="2"]')) || !/방금/.test(await T.textContent('.tcard[data-t="2"]'))) fail('조 카드에 방금 표시가 없음');
  if (SHOTS) await T.screenshot({ path: `${SHOTS}/teacher.png` });
  await T.emulateMedia({ media: null });
  const tpdf = await T.pdf({ preferCSSPageSize: true, printBackground: true });
  if (pdfPages(tpdf) !== 1) fail('선생님 화면에서 조 신문 인쇄가 한 장이 아님: ' + pdfPages(tpdf));

  // 글자 수 제한·제출·반려·피드백·통과, 붙여 넣기 기록
  if (!(await p.isDisabled('#submit'))) fail('글자 수가 모자란데 제출 단추가 눌림');
  if (!/\/ 60자 이상/.test(await p.textContent('#leadCount'))) fail('전문 글자 수 안내가 없음');
  const LEAD = '지난 11월 18일 수요일, 6학년 학생들이 속초 영랑호에서 습지의 소중함을 알아보려고 해설사의 설명을 들으며 습지 체험학습을 했다.';
  const BODY = Array(7).fill('이날 학생들은 호숫가 산책길을 걸으며 물새와 갈대를 관찰하고 활동지에 기록했다. 해설사는 습지가 물을 깨끗하게 해 준다고 설명했다.').join('\n');
  await p.fill('#lead', LEAD);
  await p.evaluate(t => { const dt = new DataTransfer(); dt.setData('text/plain', t); document.querySelector('#body').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, BODY);
  await p.fill('#body', BODY);
  if (await p.isDisabled('#submit')) fail('글자 수를 채웠는데 제출이 안 됨');
  await p.click('#submit');
  await p.waitForSelector('#rvBox:not([hidden])', { timeout: 10000 }).catch(() => fail('제출 뒤 학생 화면에 안내가 없음'));
  const card2 = '.tcard[data-t="2"]';
  await T.waitForFunction(s => /제출함/.test(document.querySelector(s).textContent), card2, { timeout: 15000 }).catch(() => fail('선생님 카드에 제출함이 안 보임'));
  await T.waitForFunction(s => /붙여 넣기 1번/.test(document.querySelector(s).textContent), card2, { timeout: 15000 }).catch(() => fail('붙여 넣기 기록이 안 보임'));
  if (!/붙여 넣기 기록 1번/.test(await T.textContent('.tpanel'))) fail('평가 칸에 붙여 넣기 기록이 없음');
  const setScores = async v => { const s2 = await T.$$('.rub select'); for (let k = 0; k < s2.length; k++) await s2[k].selectOption(String(v[k])); };
  await setScores([3, 1, 2, 2, 2, 2]);
  if (!/반려를 추천/.test(await T.textContent('.tpanel'))) fail('②가 1점인데 반려 추천이 아님');
  await T.fill('#tFeedback', '전문에 누가 무엇을 했는지 더 분명하게 써 보세요.');
  await T.click('text=↩️ 반려 (다시 쓰기)');
  await p.waitForFunction(() => /반려/.test(document.querySelector('#rvBox').textContent) && /더 분명하게/.test(document.querySelector('#rvBox').textContent), null, { timeout: 15000 }).catch(() => fail('학생 화면에 반려·피드백이 안 보임'));
  if (!/12 \/ 18점/.test(await p.textContent('#rvBox'))) fail('학생 화면에 점수가 안 보임: ' + await p.textContent('#rvBox'));
  if (!/다시 제출/.test(await p.textContent('#submit'))) fail('반려 뒤 다시 제출 단추가 아님');
  await p.click('#submit');
  await T.waitForFunction(s => /제출함/.test(document.querySelector(s).textContent), card2, { timeout: 15000 }).catch(() => fail('다시 제출이 선생님 화면에 안 보임'));
  await T.click(card2);
  await setScores([3, 3, 3, 3, 2, 2]);
  if (!/통과를 추천/.test(await T.textContent('.tpanel'))) fail('16점인데 통과 추천이 아님');
  await T.click('text=✅ 통과');
  await p.waitForFunction(() => /통과/.test(document.querySelector('#rvBox').textContent), null, { timeout: 15000 }).catch(() => fail('학생 화면에 통과가 안 보임'));
  // 기준 글자 수 바꾸기
  const minBody = (await T.$$('.tpanel input[type=number]'))[1];
  await minBody.fill('900'); await minBody.dispatchEvent('change');
  await p.waitForFunction(() => /\/ 900자 이상/.test(document.querySelector('#count').textContent), null, { timeout: 15000 }).catch(() => fail('선생님이 바꾼 글자 수 기준이 학생 화면에 안 보임'));
  if (!(await p.isDisabled('#submit'))) fail('바뀐 기준보다 짧은데 제출이 됨');
  if (SHOTS) await T.screenshot({ path: `${SHOTS}/teacher-review.png`, fullPage: true });
  // 세로 사진도 잘리지 않아요.
  await p.setInputFiles('#img1', { name: 'tall.png', mimeType: 'image/png', buffer: await png(600, 1000, '#555') });
  await p.waitForTimeout(800);
  const ratio = await p.evaluate(() => { const i = document.querySelector('#pImg1'); const r = i.getBoundingClientRect(); return (r.width / r.height) / (i.naturalWidth / i.naturalHeight); });
  if (Math.abs(ratio - 1) > 0.03) fail('사진이 잘리거나 늘어남: ' + ratio);

  // 선생님 컴퓨터에서 학생 주소로 예시를 보여 줘도 학생 조 글은 그대로예요.
  const D = await tctx.newPage();
  D.on('dialog', d => d.dismiss());
  await D.goto(URL + '#teams=' + TEAMSTR);
  await D.waitForSelector('#teamBox:not([hidden])');
  await D.selectOption('#team', '2');
  await D.fill('#title', '선생님 예시 표제');
  // 예시 모드: 제출 → 선생님 평가 과정(루브릭) → 반려 안내를 이 화면에서만 보여 줘요.
  await D.fill('#lead', '지난 11월 18일 수요일, 6학년 학생들이 속초 영랑호에서 습지의 소중함을 알아보려고 해설사의 설명을 들으며 습지 체험학습을 했다.');
  await D.fill('#body', Array(7).fill('이날 학생들은 호숫가 산책길을 걸으며 물새와 갈대를 관찰하고 활동지에 기록했다. 해설사는 습지가 물을 깨끗하게 해 준다고 설명했다.').join('\n'));
  if (!(await D.isVisible('#submit'))) fail('예시 화면에 제출 단추가 없음');
  await D.click('#submit');
  await D.waitForSelector('#demoEval:not([hidden])', { timeout: 5000 }).catch(() => fail('예시 평가 과정 칸이 안 나옴'));
  const ds = await D.$$('#demoEval select');
  if (ds.length !== 6) fail('예시 평가 칸 루브릭이 6개가 아님: ' + ds.length);
  for (const [k, v] of [3, 1, 2, 2, 2, 2].entries()) await ds[k].selectOption(String(v));
  if (!/반려하고 피드백/.test(await D.textContent('#demoEval'))) fail('예시 평가에서 반려 안내가 없음');
  await D.fill('#dFeedback', '전문에 왜 했는지를 넣어 보세요.');
  await D.click('#demoEval >> text=↩️ 반려 (다시 쓰기)');
  if (!/반려/.test(await D.textContent('#rvBox')) || !/왜 했는지/.test(await D.textContent('#rvBox'))) fail('예시 반려 안내·피드백이 학생 화면에 안 보임');
  if (await D.isVisible('#demoEval')) fail('반려 뒤에도 예시 평가 칸이 남음');
  await D.waitForTimeout(1500);
  if (!/예시 모드/.test(await D.textContent('#sync'))) fail('선생님 컴퓨터인데 예시 모드 표시가 없음');
  if (await T.textContent('#pTitle') !== '2조 기사') fail('선생님 예시가 학생 조 글을 덮어씀');
  await D.close();

  // 컴퓨터가 초기화돼도(빈 브라우저) 같은 조를 고르면 인터넷에서 불러와요.
  const nctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const N = await nctx.newPage();
  await N.goto(URL + '#teams=' + TEAMSTR);
  await N.waitForSelector('#teamBox:not([hidden])');
  await N.selectOption('#team', '2');
  await N.waitForFunction(() => document.querySelector('#title').value === '2조 기사', null, { timeout: 15000 }).catch(() => fail('새 컴퓨터에서 2조 글을 못 불러옴'));
  await N.waitForSelector('#pFig1:not([hidden])', { timeout: 15000 }).catch(() => fail('새 컴퓨터에서 2조 사진을 못 불러옴'));
  // 이 컴퓨터 글과 인터넷 글이 다르면 물어보고, 취소하면 이 컴퓨터 글을 지켜요.
  const cctx = await browser.newContext();
  const C = await cctx.newPage();
  let asked = false;
  C.on('dialog', d => { asked = true; d.dismiss(); });
  await C.goto(URL + '#teams=' + TEAMSTR + '&student');
  await C.waitForSelector('#teamBox:not([hidden])');
  await C.evaluate(() => localStorage.setItem('newspaper-draft-v1-t2', JSON.stringify({ title: '이 컴퓨터 글', body: '본문', t: 1 })));
  await C.selectOption('#team', '1'); await C.selectOption('#team', '2');
  await C.waitForTimeout(2500);
  if (!asked) fail('글이 서로 다른데 묻지 않음');
  if (await C.inputValue('#title') !== '이 컴퓨터 글') fail('취소했는데 이 컴퓨터 글이 사라짐');
  await cctx.close();

  // 테스트 방 지우기
  await N.evaluate(() => cloud.remove(''));
  await tctx.close(); await nctx.close();

  await browser.close();
  console.log(problems.length ? `\n문제 ${problems.length}개` : '\n✅ 모두 통과');
  process.exit(problems.length ? 1 : 0);
})();
