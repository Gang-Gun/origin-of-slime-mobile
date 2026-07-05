# 스팀 출시 패키징 가이드

이 게임은 단일 `index.html` + `assets/` 로 구성된 완전 오프라인 실행 가능한 웹 게임입니다.

## 오프라인 실행 보장 (완료된 작업)

| 의존성 | 상태 |
|---|---|
| Phaser 3.60.0 | `assets/vendor/phaser.min.js` 로컬 번들 |
| Jua·Nunito·Galmuri11 폰트 | `assets/fonts/` 로컬 번들 (`fonts.css`) |
| BGM | `assets/bgm.mp3` 로컬 |
| Firebase (온라인 순위표) | `initLeaderboard()`에서 동적 로드 — 오프라인이면 순위표만 조용히 비활성화되고 게임은 정상 동작 |

외부 네트워크 접근은 순위표(Firebase)뿐이며, 실패해도 게임 흐름에 영향이 없습니다.

## Electron 패키징 (권장)

```bash
npm init -y
npm install --save-dev electron electron-builder
```

`main.js`:

```js
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  win.loadFile('index.html');
});
app.on('window-all-closed', () => app.quit());
```

`package.json`에 빌드 설정:

```json
{
  "main": "main.js",
  "scripts": { "start": "electron .", "dist": "electron-builder" },
  "build": {
    "appId": "com.ganggun.originofslime",
    "files": ["index.html", "assets/**/*", "main.js"],
    "win": { "target": "portable" }
  }
}
```

빌드 결과물을 Steamworks의 `steamcmd` + `app_build` 스크립트로 업로드하면 됩니다.

## 스팀 연동 시 참고

- **전체화면**: 게임 내 옵션의 전체화면 버튼은 브라우저 Fullscreen API 기반.
  Electron `fullscreen: true`로 시작하면 그대로 동작합니다.
- **창 비활성 자동 일시정지**: `visibilitychange` 기반으로 구현되어 있습니다.
  Electron에서 창 최소화 시 자동으로 일시정지됩니다.
  (`backgroundThrottling: false`를 권장 — 백그라운드에서 타이머가 멎는 대신
  게임 자체 일시정지가 동작하도록)
- **저장 데이터**: 전부 `localStorage` (`gpa_*` 키). Electron 기본 저장 위치는
  OS별 userData 디렉터리라 별도 작업 불필요. Steam Cloud를 쓰려면
  userData 경로를 클라우드 동기화 대상으로 지정하면 됩니다.
- **도전과제(Steam Achievements)**: 게임 내 도전과제는 `markAchUnlocked(id)`
  (index.html)에서 해금됩니다. greenworks/steamworks.js를 붙일 경우 이 함수에
  훅을 추가하는 것이 가장 간단합니다.
- **Phaser 로드 실패 안내**: 파일 손상 시 "게임 파일 무결성 확인" 안내 화면이
  표시됩니다 (index.html의 Phaser 가드 스크립트).

## 테스트

```bash
node test/check-syntax.mjs   # 인라인 스크립트 문법 검사
node test/smoke-ach.mjs      # 도전과제 데이터/저장 왕복
node test/smoke-boss.mjs     # 보스 로스터·웨이브 추첨·안전 조건
node test/smoke-evo.mjs      # 진화 게이지 EXP 곡선·후보 추첨 규칙
node test/smoke-visual.mjs   # 크리처/보스 비주얼 데이터 무결성
```

오프라인 실행 검증: 로컬 서버(`python3 -m http.server`)로 띄운 뒤
개발자도구 Network 탭에서 오프라인 모드로 전환해도 타이틀→게임 시작→보스전이
모두 동작해야 합니다 (순위표 패널만 숨겨짐).
