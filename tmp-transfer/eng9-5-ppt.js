// 영어 9단원 5차시 수업 PPT (도덕 양식: 교실 게시판)
const pptxgen = require('pptxgenjs');
const path = require('path');
const D = process.argv[2]; // 도구 폴더 (bg_cover.png 등)
const OUT = process.argv[3];
const QR = 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAaQAAAGkAQAAAABWN2yYAAACw0lEQVR4nO2cQY7kIAxFv0fZkxvU/W8HJ/izMGAnUi26lYxg9LOoThGe0pa+bLBNGfHzq/35BQSIEvWdajYvNLMTANBsjgOwE5dpW9glajeKflUAXYEAUMgKkv3rZdoedonajGrd76EQhXZ2BwjAzFCGFOe0XewStSk1nCFJFNqH2R8+/C5Ror5RhR6OgbFEPNHV+Pi7RImK6wCAEjJjMxR2D1iqAWjGdvIybX27RO1FHQAi7raTAF147WQzv/eHKTyvb5eovagjO0O/zHcr4wauwMu09e0StRcFVrAOmfn6cOZwxkjkcAoBsK5vl6i9KPgeZOYGuwKn8JA2L12E0qGoxymE9hBKm15xPpr6hPyhqOepA4AVWql5dK4FLd379pm/f5coUV+viMs1NiOX6DwWkPNT/lDU05TnD6uV6vU7Au4bCVh3lV2c5gW+wh3sErUXhbkRjhVgYe58CJfo80n5Q1FPU6GxKN7NEJxG5rh0KOoF6vA/BOB1E6/leYwelRSXI6PhYX27RO1FXZPYc5C8pW5yulv+UNTTVArHY9ecI3XskZlSi9KhqIepob3hAIHLcjHyOXNxqPWhqOep0GGUUUYdGSNAx7jqeqJeoprZh2Zmn5EnPPszknZ29xgHB/79fyjq/6cuh6Ry3SRlafqjdL++XaL2oqIPtndcez92PpMy2rOtVJM/FPUKda+nzPVh7geLyVR9WdQb1IjLMzqX1O5V7gocScX17RK1F3VgFE0A9MMp3tKQ4rVhHF3pXRDr2yVqL+rA7DDsdT2aLwj9nNQ8HjWUyWbcwC5Re1EH0BXo+xTvdO17lhSXu2/sznN9u0TtTDVjxfxdEf+M3ptQ5m52iVqdOm7f/eA8bnmb8bW3y25gl6gNqdlqGCfyxvN8UsB9Y9Pvzol6nEqSSyf17pOSPpW3EfUCZfo9WFELUH8BLHZFaEjdg5EAAAAASUVORK5CYII=';
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = '영어 9단원 5차시 수업';

const COL = { bg: 'BFB089', card: 'F1DBAA', paper: 'FFFDF7', band: 'F98F6E', band2: 'E0704F', title: '453422', body: '6D4215', shelf: '6D4115', ok: '3F8A5A', blue: '3D6E8C', gold: 'E9B04F', muted: '8A7458' };
const FB = '경기천년제목 Bold', FM = '경기천년제목 Medium', FL = '경기천년제목 Light';
const BG = n => ({ path: path.join(D, 'bg_' + n.toLowerCase() + '.png') });
const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: FM, color: COL.body, valign: 'middle' }, o));
const box = (s, x, y, w, h, fill, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill } }, o));
// 제목 띠: 가운데 정렬, 글자 수에 맞춘 너비
function band(s, text, y = 0.57, size = 29) {
  const w = Math.max(3.2, [...text].reduce((a, c) => a + (/[가-힣]/.test(c) ? 0.42 : c === ' ' ? 0.13 : 0.22), 0) + 1.0), x = (13.333 - w) / 2;
  box(s, x, y, w, 0.94, COL.band, { rectRadius: 0.05 });
  T(s, text, { x, y, w, h: 0.94, fontFace: FB, fontSize: size, color: 'FFFFFF', align: 'center' });
}
function chip(s, text, x, y, w, color = COL.band) {
  box(s, x, y, w, 0.44, color, { rectRadius: 0.06 });
  T(s, text, { x, y, w, h: 0.44, fontFace: FM, fontSize: 15, color: 'FFFFFF', align: 'center' });
}
function link(s, text, url, x, y, w, h = 0.5) {
  box(s, x, y, w, h, COL.blue, { rectRadius: 0.1 });
  T(s, [{ text, options: { hyperlink: { url, tooltip: url } } }], { x, y, w, h, fontFace: FM, fontSize: 15, color: 'FFFFFF', align: 'center' });
}
const slideBg = n => { const s = pres.addSlide(); s.background = BG(n); return s; };
const content = () => slideBg('CONTENT');

/* 1 표지 */
{
  const s = slideBg('COVER');
  s.addShape(pres.shapes.RECTANGLE, { x: 3.62, y: 1.75, w: 6.09, h: 0.81, fill: { color: COL.band }, line: { color: COL.band } });
  T(s, '초등 6학년 2학기 - 영어', { x: 3.62, y: 1.75, w: 6.09, h: 0.81, fontFace: FB, fontSize: 31, color: 'FFFFFF', align: 'center' });
  T(s, 'How Can I Get to the Library?', { x: 1.9, y: 2.78, w: 9.53, h: 1.39, fontFace: FB, fontSize: 46, color: COL.title, align: 'center' });
  s.addShape(pres.shapes.LINE, { x: 3.62, y: 4.37, w: 6.09, h: 0, line: { color: COL.title, width: 1.5 } });
  T(s, 'Lesson 9 · 우리 지역 명소 안내지 쓰기', { x: 2.31, y: 4.58, w: 8.7, h: 0.6, fontFace: FB, fontSize: 29, color: COL.title, align: 'center' });
  T(s, '5/6차시 · 교과서 138~139쪽 · 버스로? 걸어서? 우리 동네 명소를 영어로 안내해요', { x: 2.31, y: 5.32, w: 8.7, h: 0.46, fontFace: FM, fontSize: 17, color: COL.body, align: 'center' });
  s.addNotes(`[표지] YBM(최희경) 6학년 Lesson 9 How Can I Get to the Library? 5/6차시 (교과서 138~139쪽, 지도서 398~401쪽).
40분 흐름: 도입 4분 → 활동 1 Discovery Fun 5분 → 활동 2 안내지 읽기 6분 → 활동 2 안내지 쓰기 13분 → 활동 3 문장 탑 쌓기 게임 10분 → 정리 2분.
준비물: TV(전자책·교사 화면), 학생 태블릿 1인 1대, 교과서.
수업 전: ① YBM 전자책(ybmbooksam.com)을 138쪽에 열어 두기 ② TV 다른 탭에 문장 탑 쌓기(suhankim21-debug.github.io/classroom-games/tower/) → "선생님 화면 (TV)" → 문장 세트 "YBM(최희경) 6학년 9단원", 10분, 5조 → 방 만들기.`);
}

/* 2 생각 열기 */
{
  const s = slideBg('INTRO');
  chip(s, '생각 열기', 5.67, 1.38, 2.0);
  T(s, 'How can I get to the zoo?', { x: 2.2, y: 1.95, w: 8.93, h: 0.8, fontFace: FB, fontSize: 34, color: COL.title, align: 'center' });
  const tr = [['🚌', 'bus'], ['🚇', 'subway'], ['🚕', 'taxi'], ['🚆', 'train'], ['🚲', 'bike'], ['🚶', 'walk']];
  tr.forEach(([e, w], i) => {
    const x = 2.35 + i * 1.47;
    box(s, x, 3.0, 1.27, 1.55, COL.paper, { line: { color: 'DCCDA6', width: 1 } });
    T(s, e, { x, y: 3.05, w: 1.27, h: 0.95, fontSize: 44, align: 'center', fontFace: 'Segoe UI Emoji' });
    T(s, w, { x, y: 3.98, w: 1.27, h: 0.45, fontFace: FB, fontSize: 18, color: COL.title, align: 'center' });
  });
  T(s, 'You can get there ______ .', { x: 2.2, y: 4.85, w: 8.93, h: 0.7, fontFace: FB, fontSize: 28, color: COL.band2, align: 'center' });
  s.addNotes(`[도입 4분 중 2분] 지난 시간 복습 + 동기 유발 (지도서의 주사위 놀이를 그림 카드로 대신).
발문: "Class, how can I get to the zoo?" → 학생이 그림 하나를 골라 "You can get there by bus." 처럼 답합니다.
장소를 바꿔 2~3번: library, hospital, bank, market, station.
마지막에 🚶 walk 카드를 골라 "You can get there by walk?" 하고 일부러 틀리게 말해 봅니다 → "이상한 점은? 오늘 그 규칙을 찾아봐요."`);
}

/* 3 학습목표 */
{
  const s = slideBg('PLAIN');
  T(s, '학습목표', { x: 4.82, y: 0.93, w: 3.7, h: 0.74, fontFace: FB, fontSize: 41, color: COL.title, align: 'center' });
  s.addShape(pres.shapes.RECTANGLE, { x: 1.82, y: 2.0, w: 9.69, h: 1.1, fill: { color: COL.card }, line: { color: COL.card } });
  T(s, '교통수단과 위치를 나타내는 말을 써서\n우리 지역 명소 안내지를 쓸 수 있다.', { x: 1.94, y: 2.0, w: 9.44, h: 1.1, fontSize: 23, color: COL.title, align: 'center' });
  [['활동 1', 'Discovery Fun\nby의 규칙 찾기'], ['활동 2', '명소 안내지\n읽고 쓰기'], ['활동 3', '문장 탑 쌓기\n쓰기 게임']].forEach(([a, b], i) => {
    const x = 1.82 + i * 3.31;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 3.8, w: 3.07, h: 1.53, fill: { color: COL.card }, line: { color: COL.card } });
    chip(s, a, x + 1.07, 3.56, 0.93);
    T(s, b, { x: x + 0.1, y: 4.12, w: 2.89, h: 1.11, fontSize: 20, color: COL.title, align: 'center' });
  });
  s.addNotes(`[도입 4분 중 2분] 학습 목표를 함께 읽고 오늘 할 세 활동을 안내합니다.
"오늘은 교과서의 안내지를 읽고, 짝과 우리 지역 명소를 영어로 소개하는 안내지를 써요. 마지막에는 쓰기 게임으로 오늘 문장을 정리해요."`);
}

/* 4 활동 1 Discovery Fun */
{
  const s = content();
  band(s, '활동 1 · Discovery Fun');
  box(s, 1.99, 1.9, 5.3, 4.49, COL.paper);
  T(s, '단어와 어구를 읽고 규칙을 찾아요', { x: 2.2, y: 2.0, w: 4.9, h: 0.5, fontFace: FB, fontSize: 18, color: COL.title });
  [['🚌', 'bus', 'by bus'], ['🚇', 'subway', 'by subway'], ['🚕', 'taxi', 'by taxi']].forEach(([e, a, b], i) => {
    const y = 2.6 + i * 0.95;
    T(s, e, { x: 2.2, y, w: 0.8, h: 0.75, fontSize: 32, fontFace: 'Segoe UI Emoji', align: 'center' });
    T(s, a, { x: 3.05, y, w: 1.4, h: 0.75, fontFace: FB, fontSize: 24, color: COL.title });
    T(s, '→', { x: 4.35, y, w: 0.5, h: 0.75, fontFace: FB, fontSize: 24, color: COL.muted, align: 'center' });
    T(s, [{ text: 'by', options: { color: COL.band2 } }, { text: ' ' + b.slice(3), options: { color: COL.title } }], { x: 4.9, y, w: 2.2, h: 0.75, fontFace: FB, fontSize: 24 });
  });
  T(s, '규칙은? 타고 가는 교통수단 앞에 ______ !', { x: 2.2, y: 5.55, w: 4.9, h: 0.6, fontFace: FM, fontSize: 17, color: COL.body });
  box(s, 7.5, 1.9, 3.93, 2.05, 'FFF4DF', { line: { color: COL.band, width: 1.5 } });
  T(s, [{ text: '🚶 걸어서 갈 때는?', options: { fontFace: FB, fontSize: 19, color: COL.title, breakLine: true } }, { text: 'by가 아니라 ', options: { fontSize: 18, breakLine: false } }, { text: 'on foot', options: { fontFace: FB, fontSize: 24, color: COL.band2 } }], { x: 7.7, y: 2.0, w: 3.6, h: 1.85, align: 'center' });
  box(s, 7.5, 4.15, 3.93, 2.24, COL.paper);
  T(s, 'Quiz 빈칸에 알맞은 말은?', { x: 7.7, y: 4.25, w: 3.6, h: 0.45, fontFace: FB, fontSize: 17, color: COL.title });
  T(s, '1  You can get there ___ train.\n2  You can get there ___ bike.\n3  You can get there ___ foot.', { x: 7.7, y: 4.75, w: 3.6, h: 1.5, fontSize: 16, color: COL.body, paraSpaceAfter: 6, valign: 'top' });
  s.addNotes(`[활동 1 · 5분] 교과서 138쪽 Discovery Fun. 전자책 138쪽을 띄워 함께 읽어도 됩니다.
1) Look and Think: "What means of transportation do you see?" (버스, 지하철, 택시)
2) Read and Find: 함께 소리 내어 읽고 "Did you notice any patterns?" → "타고 가는 교통수단 앞에 by가 붙어요."
   "To talk about a means of transportation, you use the word 'by'. When you walk, use 'on foot' instead of 'by'."
3) Quiz 정답: 1 by  2 by  3 on (교과서 문제는 1, 2번이고 3번은 on foot 확인용으로 더했습니다)
주의: by the bus, by a taxi 처럼 the/a를 넣지 않아요.`);
}

/* 5 활동 2 A Read */
{
  const s = content();
  band(s, '활동 2 · 명소 안내지 읽기');
  box(s, 1.99, 1.9, 5.6, 4.49, COL.paper, { shadow: { type: 'outer', color: '000000', opacity: 0.18, blur: 6, offset: 2, angle: 90 } });
  box(s, 1.99, 1.9, 5.6, 0.75, COL.ok, { rectRadius: 0.12 });
  T(s, "🌳 Sunny Children's Park", { x: 2.2, y: 1.9, w: 5.2, h: 0.75, fontFace: FB, fontSize: 22, color: 'FFFFFF', align: 'center' });
  const lines = ['Where do you want to go?', "What about Sunny Children's Park?", 'You can visit the zoo.', 'You can ride the Sunny Train.', 'You can get there by subway.', "It's next to the library."];
  lines.forEach((l, i) => T(s, l, { x: 2.3, y: 2.8 + i * 0.58, w: 5.1, h: 0.5, fontFace: FB, fontSize: 19, color: COL.title }));
  box(s, 7.85, 1.9, 3.58, 2.75, COL.card);
  T(s, [{ text: '읽고 표시해요', options: { fontFace: FB, fontSize: 19, color: COL.title, breakLine: true } },
    { text: '1  어떤 명소에 대한 안내지인가요?', options: { fontSize: 16, breakLine: true } },
    { text: '2  위치를 설명하는 문장 ○', options: { fontSize: 16, breakLine: true } },
    { text: '3  가는 방법을 설명하는 문장 △', options: { fontSize: 16 } }], { x: 8.05, y: 2.0, w: 3.25, h: 2.55, valign: 'top', paraSpaceAfter: 8 });
  link(s, '▶ 전자책 138쪽 음원 듣기', 'https://www.ybmbooksam.com', 7.85, 4.9, 3.58, 0.6);
  link(s, '교과서 138쪽 QR 자료', 'http://YBMqr.com/cak057', 7.85, 5.7, 3.58, 0.5);
  s.addNotes(`[활동 2 · 읽기 6분] 교과서 138쪽 Read and Write in Real Life A.
1) "First, look over the text quickly. What is the genre of this text?" (명소 안내지)
2) 전자책 음원을 들으며 눈으로 따라 읽기 → 한 문장씩 듣고 따라 읽기 → 손가락으로 짚으며 스스로 읽기.
   (파란 단추: 전자책은 YBM 북샘 로그인 후 열기 / 교과서 138쪽 QR 링크)
3) 정답: 1 Sunny 어린이 공원  2 ○ It's next to the library.  3 △ You can get there by subway.
Teaching Tip: 이 글의 짜임은 장소 제안 → 할 수 있는 일 → 교통수단 → 위치 (다음 슬라이드).`);
}

/* 6 안내지의 짜임 */
{
  const s = content();
  band(s, '안내지는 이렇게 써요');
  const steps = [['1', '장소 제안', 'Where do you want to go?\nWhat about ______ ?'], ['2', '할 수 있는 일', 'You can ______ .'], ['3', '가는 방법', 'You can get there by ______ .\n(걸어서: on foot)'], ['4', '위치', "It's next to / in front of ______ .\nIt's between ___ and ___ ."]];
  steps.forEach(([n, k, e], i) => {
    const y = 1.85 + i * 1.12;
    box(s, 1.99, y, 9.44, 0.98, COL.paper);
    s.addShape(pres.shapes.OVAL, { x: 2.15, y: y + 0.22, w: 0.54, h: 0.54, fill: { color: COL.band }, line: { color: COL.band } });
    T(s, n, { x: 2.15, y: y + 0.22, w: 0.54, h: 0.54, fontFace: FB, fontSize: 18, color: 'FFFFFF', align: 'center' });
    T(s, k, { x: 2.9, y, w: 2.2, h: 0.98, fontFace: FB, fontSize: 20, color: COL.title });
    T(s, e, { x: 5.1, y, w: 6.2, h: 0.98, fontFace: FB, fontSize: 18, color: COL.band2 });
  });
  s.addNotes(`[활동 2 · 쓰기 13분 중 1분] 방금 읽은 Sunny Children's Park 안내지를 네 부분으로 나누어 봅니다. 이 순서대로 우리 지역 명소 안내지를 씁니다.
위치 낱말: next to(옆에), in front of(앞에), between A and B(A와 B 사이에).`);
}

/* 7 Write Step 1 */
{
  const s = content();
  band(s, '활동 2 · Step 1 쓸 내용 정하기');
  T(s, '짝과 소개하고 싶은 우리 지역 명소를 정하고, 길 찾기 앱으로 가는 방법과 위치를 찾아요', { x: 1.99, y: 1.75, w: 9.44, h: 0.5, fontSize: 17, color: COL.title, align: 'center' });
  const rows = [['명소 이름', 'Sokcho Beach · Seoraksan Mountain · Sokcho Eye · Abai Village · Central Market'], ['할 수 있는 일', 'swim · ride the Sokcho Eye · eat lunch · hike · take pictures · see the sea'], ['가는 방법', 'by bus · by subway · by taxi · by train · by bike · on foot'], ['위치', "next to the ___ · in front of the ___ · between the ___ and the ___"]];
  rows.forEach(([k, v], i) => {
    const y = 2.4 + i * 0.86;
    box(s, 1.99, y, 2.2, 0.72, COL.band, { rectRadius: 0.08 });
    T(s, k, { x: 1.99, y, w: 2.2, h: 0.72, fontFace: FB, fontSize: 18, color: 'FFFFFF', align: 'center' });
    box(s, 4.3, y, 7.13, 0.72, COL.paper, { rectRadius: 0.08 });
    T(s, v, { x: 4.45, y, w: 6.85, h: 0.72, fontSize: 15, color: COL.body });
  });
  box(s, 1.99, 5.9, 9.44, 0.55, COL.card, { rectRadius: 0.08 });
  T(s, '예) Happy Toy Store · see many toys, play games · by bus · between the bank and the hospital', { x: 2.1, y: 5.9, w: 9.2, h: 0.55, fontSize: 15, color: COL.title, align: 'center' });
  s.addNotes(`[활동 2 · 쓰기 13분 중 3분] 교과서 139쪽 B Write Step 1 (짝 협력 쓰기).
"With your partner, write about a local attraction you want to introduce. Then, research the place and complete the table."
- 태블릿 지도·길 찾기 앱(네이버 지도, 카카오맵)으로 학교에서 가는 방법과 주변 건물을 찾습니다. 공식 홈페이지에서 할 수 있는 일을 찾습니다.
- 명소 예시는 속초입니다: 속초해수욕장(Sokcho Beach), 설악산(Seoraksan Mountain), 속초아이 대관람차(Sokcho Eye), 아바이마을(Abai Village), 속초관광수산시장(Central Market). 학교에서 가는 방법(by bus, on foot 등)과 위치는 아이들이 지도 앱으로 직접 찾습니다.
- 역할 나누기: 한 명은 검색, 한 명은 표 채우기.
특수교육대상 학생: 학생 B는 짝과 함께 보기(말 상자)에서 골라 쓰기, 학생 A는 짝이 고른 교통수단 그림을 손가락으로 짚고 "bus" 따라 쓰기.`);
}

/* 8 Write Step 2 */
{
  const s = content();
  band(s, '활동 2 · Step 2 안내지 쓰기');
  box(s, 1.99, 1.9, 5.0, 4.49, COL.paper);
  T(s, '우리 안내지 틀', { x: 2.2, y: 2.0, w: 4.6, h: 0.5, fontFace: FB, fontSize: 19, color: COL.title });
  T(s, 'Where do you want to go?\nWhat about ____________ ?\nYou can ____________ .\nYou can ____________ .\nYou can get there ________ .\nIt\'s ________ the ________ .', { x: 2.2, y: 2.55, w: 4.6, h: 3.7, fontFace: FB, fontSize: 18, color: COL.title, valign: 'top', paraSpaceAfter: 9 });
  box(s, 7.2, 1.9, 4.23, 3.05, COL.card);
  T(s, [{ text: '예시 · Happy Toy Store', options: { fontFace: FB, fontSize: 17, color: COL.band2, breakLine: true } },
    { text: 'Where do you want to go?\nWhat about Happy Toy Store?\nYou can see many toys.\nYou can play games.\nYou can get there by bus.\nIt\'s between the bank and the hospital.', options: { fontSize: 15, color: COL.title } }], { x: 7.4, y: 2.0, w: 3.9, h: 2.85, valign: 'top' });
  box(s, 7.2, 5.1, 4.23, 1.29, 'FFF4DF', { line: { color: COL.band, width: 1.2 } });
  T(s, '왼쪽에 명소 그림, 오른쪽에 문장!\n다 쓴 짝은 캔바로 안내지를 꾸며요', { x: 7.35, y: 5.1, w: 3.95, h: 1.29, fontSize: 16, color: COL.title, align: 'center' });
  s.addNotes(`[활동 2 · 쓰기 13분 중 6분] 교과서 139쪽 Step 2. "Based on the table above, write your own guide. You can draw the place on the left and write sentences on the right."
- 교과서(또는 전자책 디지털 쓰기)에 짝과 함께 씁니다. 대문자로 시작, 마침표·물음표로 끝내기를 확인합니다.
- 일찍 끝난 짝: 캔바로 사진을 넣어 안내지를 꾸밉니다(우리 반은 캔바에 능숙). 시간이 없으면 집에서 해 오기 과제로.
- 순회 지도 포인트: by + 교통수단에 the/a를 넣지 않았는지, 걸어서는 on foot인지, next to the ___ 처럼 the를 넣었는지.
특수교육대상 학생: 학생 B는 틀의 빈칸에 보기에서 고른 낱말 쓰기(2~3칸), 학생 A는 by bus · on foot 따라 쓰기와 명소 그림 그리기.`);
}

/* 9 Write Step 3 + Let's Check */
{
  const s = content();
  band(s, "활동 2 · Step 3 나누고 점검하기");
  box(s, 1.99, 1.9, 4.6, 4.49, COL.paper);
  T(s, [{ text: '바꾸어 읽어요', options: { fontFace: FB, fontSize: 20, color: COL.title, breakLine: true } },
    { text: '옆 짝과 안내지를 바꾸어 소리 내어 읽어요', options: { breakLine: true } },
    { text: '"I want to go there!" 하고 싶은 일을 한 가지 말해 줘요', options: { breakLine: true } },
    { text: '두세 짝은 TV로 발표해요', options: {} }], { x: 2.2, y: 2.05, w: 4.2, h: 4.2, fontSize: 17, color: COL.body, valign: 'top', paraSpaceAfter: 12 });
  box(s, 6.8, 1.9, 4.63, 4.49, COL.card);
  T(s, "Let's Check", { x: 7.0, y: 2.0, w: 4.2, h: 0.6, fontFace: FB, fontSize: 22, color: COL.band2 });
  ['명소에서 할 수 있는 일을 알맞게 썼나요?', '교통수단과 위치를 바르게 썼나요?', '친구와 글을 바꾸어 읽고 의견을 나누었나요?'].forEach((t, i) => {
    const y = 2.75 + i * 1.15;
    box(s, 7.0, y, 4.25, 0.95, COL.paper, { rectRadius: 0.08 });
    T(s, '☆☆☆', { x: 7.1, y, w: 1.0, h: 0.95, fontSize: 16, color: COL.gold, align: 'center' });
    T(s, t, { x: 8.1, y, w: 3.05, h: 0.95, fontSize: 15, color: COL.title });
  });
  s.addNotes(`[활동 2 · 쓰기 13분 중 3분] Step 3 "Share your report with others. Leave comments on others' work."
- 옆 짝과 바꾸어 읽고, TV(실물화상기 또는 태블릿 미러링)로 두세 짝만 발표합니다.
- Let's Check 세 가지를 별 세 개로 스스로 점검합니다(평가: 관찰·자기·동료 평가).
평가 기준(지도서): 잘함 - 온라인에서 조사하고 장소·교통수단 어구를 정확하게 써서 안내지 완성 / 보통 - 어구를 사용해 완성 / 노력 요함 - 도움을 받아 일부 사용.`);
}

/* 10 활동 3 접속 */
{
  const s = content();
  band(s, '활동 3 · 문장 탑 쌓기');
  box(s, 1.99, 1.9, 4.82, 4.49, COL.paper);
  [['1', '태블릿 카메라로 TV의 QR을 찍어요'], ['2', '"번호 이름"으로 들어가요\n예) 7 김민수'], ['3', '짝과 같은 조를 골라요']].forEach(([n, t], i) => {
    const y = 2.08 + i * 0.8;
    T(s, n, { x: 2.13, y, w: 0.56, h: 0.6, fontFace: FB, fontSize: 20, color: COL.band2, align: 'center' });
    T(s, t, { x: 2.64, y, w: 4.07, h: 0.7, fontSize: 18, color: COL.title });
  });
  box(s, 2.27, 4.54, 4.26, 1.62, COL.card);
  T(s, '약속', { x: 2.27, y: 4.63, w: 4.26, h: 0.42, fontFace: FB, fontSize: 20, color: COL.title, align: 'center' });
  T(s, '키보드는 영어로 바꿔요\n소리 지르지 않아요 · 친구 화면은 보지 않아요', { x: 2.36, y: 5.05, w: 4.07, h: 1.02, fontSize: 16, color: COL.body, align: 'center' });
  box(s, 7.22, 1.9, 4.21, 4.49, COL.paper);
  s.addImage({ data: QR, x: 7.98, y: 2.13, w: 2.69, h: 2.69 });
  T(s, 'suhankim21-debug.github.io\n/classroom-games/tower/', { x: 7.32, y: 4.95, w: 4.03, h: 0.74, fontSize: 16, color: COL.title, align: 'center' });
  T(s, '(방 번호는 TV 선생님 화면에서)', { x: 7.32, y: 5.74, w: 4.03, h: 0.46, fontFace: FL, fontSize: 15, color: COL.muted, align: 'center' });
  s.addNotes(`[활동 3 · 게임 10분 중 2분] 수업 전에 TV 다른 탭에서 문장 탑 쌓기 → "선생님 화면 (TV)" → 문장 세트 "YBM(최희경) 6학년 9단원 How Can I Get to the Library?", 게임 시간 7분, 5조 → 방 만들기를 해 둡니다.
TV 화면의 QR(방 번호가 들어 있음)을 찍는 것이 가장 빠릅니다. 이 슬라이드 QR은 주소만 들어 있어 방 번호 4자리를 따로 넣어야 합니다.
TV 대기실에 조별로 이름이 뜨는지 확인합니다. 잘못 들어온 이름은 × 로 지울 수 있습니다.
특수교육대상 학생: 각자 짝과 같은 조에 들어가고, 짝 옆에서 ⭐ 낱말 카드 단계로 합니다(학생 A는 짝이 같이 눌러 줌).`);
}

/* 11 게임 방법 */
{
  const s = content();
  band(s, '게임 방법');
  T(s, '그림과 우리말 뜻을 보고 영어로 쓰면 우리 조 탑에 블록이 쌓여요', { x: 1.99, y: 1.75, w: 9.44, h: 0.5, fontSize: 18, color: COL.title, align: 'center' });
  [['⭐', '낱말 카드', '카드를 순서대로 눌러\n문장 만들기', '블록 1'], ['⭐⭐', '빈칸 쓰기', '빠진 낱말을 써서\n문장 완성하기', '블록 2'], ['⭐⭐⭐', '문장 쓰기', '문장 전체를\n직접 쓰기', '블록 3']].forEach(([st, k, d, b], i) => {
    const x = 1.99 + i * 3.21;
    box(s, x, 2.4, 3.0, 2.4, COL.paper);
    T(s, st, { x, y: 2.5, w: 3.0, h: 0.5, fontSize: 20, color: COL.gold, align: 'center' });
    T(s, k, { x, y: 3.0, w: 3.0, h: 0.5, fontFace: FB, fontSize: 21, color: COL.title, align: 'center' });
    T(s, d, { x, y: 3.5, w: 3.0, h: 0.8, fontSize: 15, color: COL.body, align: 'center' });
    chip(s, b, x + 0.95, 4.3, 1.1, i === 2 ? COL.band2 : COL.band);
  });
  box(s, 1.99, 5.0, 9.44, 1.39, COL.card);
  T(s, [{ text: '틀리면 빨간 낱말을 고쳐 다시! · 두 번 틀리면 정답을 보고 따라 쓰기 (블록 1)', options: { breakLine: true } }, { text: '한 번에 3문제 연속 정답이면 황금 블록 +1 · 단계는 언제든 바꿀 수 있어요', options: {} }], { x: 2.15, y: 5.0, w: 9.1, h: 1.39, fontSize: 17, color: COL.title, align: 'center', paraSpaceAfter: 6 });
  s.addNotes(`[활동 3 · 게임 10분 중 7분] TV에서 "게임 시작". 조별 탑과 "방금 쓴 문장"이 실시간으로 보입니다. ＋1분 / 게임 끝 버튼이 있습니다.
- 대문자·마침표·줄임말(It's = It is)은 틀려도 정답으로 칩니다. 철자와 낱말 순서만 봅니다.
- 처음에는 ⭐⭐ 빈칸 쓰기로 시작하고, 자신 있으면 ⭐⭐⭐로 올리라고 안내합니다.
- 문장 18개: by bus/subway/taxi/train/bike, on foot, How can I get to the library/hospital?, in front of, next to, between, Where do you want to go?, What about Sunny Children's Park?, You can visit the zoo / ride the Sunny Train / play soccer / see many toys, The market is next to the station.
- 시간이 끝나면 TV에서 "시상식"을 누릅니다(1분). 학생 화면에도 우리 조 등수가 나옵니다. "한 판 더"는 점수만 0으로 하고 조는 그대로 둡니다.`);
}

/* 12 오늘의 정리 */
{
  const s = content();
  band(s, '오늘의 정리');
  T(s, '알맞은 말을 함께 말해요', { x: 1.99, y: 1.75, w: 9.44, h: 0.5, fontSize: 18, color: COL.title, align: 'center' });
  [['1', '타고 가는 교통수단 앞에는\nby  예) by bus, by subway'], ['2', '걸어서 갈 때는\non foot'], ['3', '위치: next to · in front of\nbetween A and B'], ['4', '안내지 짜임: 장소 제안 → 할 수 있는 일\n→ 가는 방법 → 위치']].forEach(([n, t], i) => {
    const x = 1.99 + (i % 2) * 4.82, y = 2.45 + Math.floor(i / 2) * 1.95;
    box(s, x, y, 4.62, 1.75, COL.paper);
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5, fill: { color: COL.band }, line: { color: COL.band } });
    T(s, n, { x: x + 0.2, y: y + 0.2, w: 0.5, h: 0.5, fontFace: FB, fontSize: 17, color: 'FFFFFF', align: 'center' });
    T(s, t, { x: x + 0.85, y: y + 0.1, w: 3.65, h: 1.55, fontSize: 17, color: COL.title });
  });
  s.addNotes(`[정리 2분] 게임 시상식 뒤에 함께 읽습니다. "Can you name the things you can do in the place you introduced?" 하고 두세 명에게 묻습니다.`);
}

/* 13 다음시간에 만나요 */
{
  const s = slideBg('PLAIN');
  box(s, 5.16, 1.98, 3.01, 0.6, COL.band, { rectRadius: 0.05 });
  T(s, 'Lesson 9', { x: 5.16, y: 1.98, w: 3.01, h: 0.6, fontFace: FB, fontSize: 20, color: 'FFFFFF', align: 'center' });
  T(s, '다음시간에 만나요', { x: 2.78, y: 3.06, w: 7.78, h: 0.93, fontFace: FB, fontSize: 53, color: COL.title, align: 'center' });
  T(s, '오늘은 by + 교통수단, on foot, 위치를 나타내는 말로 우리 지역 명소 안내지를 썼어요.\n다음 시간에는 9단원을 정리하고 세계 여러 나라의 교통수단을 알아봐요.', { x: 2.31, y: 4.21, w: 8.7, h: 1.34, fontFace: FL, fontSize: 17, color: COL.body, align: 'center' });
  s.addNotes(`[마무리] 다음 차시(6차시, 교과서 140~142쪽): Wrap Up, Culture Project(세계 여러 나라의 교통수단, 나만의 교통수단 만들기).
참고: play.13w.kr의 "Stay Alive" 중 "Billy and the Midnight Bus"(room.13w.kr/tv?story=bus)가 이 단원(How can I get to ~?)에 맞춘 쓰기 탈출 게임입니다. 25분 이상 걸려서 단원 정리 차시나 남는 시간에 쓰기 좋습니다.`);
}

pres.writeFile({ fileName: OUT }).then(f => console.log('saved', f));
