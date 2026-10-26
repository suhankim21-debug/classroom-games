# classroom-games

6학년 수업에서 쓰는 웹 게임 모음입니다. GitHub Pages로 배포합니다.

- `trade/` 무역 왕국 (사회 2단원 13차시): 짝이 한 나라가 되어 자원을 주고받아 상품을 만드는 실시간 게임. 실시간 데이터는 Firebase Realtime Database의 `rooms/` 아래에 저장됩니다.

## 자동 테스트

`node tests/trade-e2e.js` 로 배포된 무역 왕국을 Playwright로 끝까지 플레이해 봅니다 (교사 1 + 학생 5나라, 보내기 29번, 상품 10개). 테스트 방은 끝나면 지웁니다.
