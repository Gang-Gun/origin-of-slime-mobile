# 스팀 출시 패키징 가이드

이 게임은 `index.html` + `css/` + `js/` + `assets/` 로 구성된 완전 오프라인 실행
가능한 웹 게임이며, `electron/` 셸로 데스크톱(스팀) 빌드를 만든다.

## 저장소 구조

```
index.html          DOM/마크업 (로직 없음, 인라인 핸들러만)
css/game.css        전체 스타일
js/                 게임 로직 (클래식 스크립트 — index.html의 태그 순서대로 로드)
  save.js           SaveStore: options/progress 2섹션 통합 저장 + 마이그레이션
  keymap.js         이동·스킬 키맵 + 리바인딩 UI
  i18n.js           한/영 번역
  leaderboard.js    Firebase 온라인 순위표 (오프라인이면 자동 비활성)
  lab.js            계통수(메타 진행)
  systems.js        난이도·전투·보스·날씨·도전과제·진화 데이터/규칙
  arena.js          AudioManager + ArenaScene (게임 본체)
  screens.js        결과 그래프·게임 시작·타이틀 버튼
  dex.js            도감·영구 저장소(도전과제 등)
  input.js          옵션·일시정지·전체화면·UI 크기·리사이즈
  ui.js             튜토리얼·힌트·통계·부트스트랩
  desktop.js        Electron/Steam 연동 + 공용 다이얼로그(uiConfirm/uiAlert)
  gamepad.js        게임패드 (Steam Deck/컨트롤러)
electron/main.js    데스크톱 셸 (창·저장 파일 IPC·steamworks.js)
electron/preload.js window.desktop API (contextIsolation)
```

새 스크립트 파일을 추가하면 index.html의 `<script src="js/...">` 목록
(로드 순서 = 의존 순서)과 이 표를 함께 갱신할 것. 테스트는 이 태그 목록을
읽어 코드를 로드한다 (`test/helpers/game-code.mjs`).

## 오프라인 실행 보장

| 의존성 | 상태 |
|---|---|
| Phaser 3.60.0 | `assets/vendor/phaser.min.js` 로컬 번들 |
| Jua·Nunito·Galmuri11 폰트 | `assets/fonts/` 로컬 번들 (`fonts.css`) |
| BGM | `assets/bgm.mp3` 로컬 |
| Firebase (온라인 순위표) | `initLeaderboard()`에서 동적 로드 — 오프라인이면 순위표만 조용히 비활성화 |

외부 네트워크 접근은 순위표(Firebase)뿐이며, 실패해도 게임 흐름에 영향이 없다.

## 저장 데이터 (SaveStore — js/save.js)

- 모든 저장은 `Save.get/set/remove` (키 이름은 기존 `gpa_*` 그대로).
- 내부적으로 **options**(기기별 설정) / **progress**(진행 데이터) 2섹션,
  각 섹션은 `{ v: 버전, data: {...} }` 형태.
- 웹: localStorage `gpa_options` / `gpa_progress`.
  Electron: `userData/save/options.json` / `progress.json`
  (원자적 쓰기 + `.bak` 백업, 로드 시 손상되면 `.bak` 폴백).
- 구버전의 흩어진 `gpa_*` 키는 최초 실행 시 자동 마이그레이션.
- 스키마를 바꿀 때는 `VERSION`을 올리고 `MIGRATIONS[새버전]`을 추가한다.
- **Steam Cloud**: Steamworks Auto-Cloud에서 `save/progress.json`만 동기화
  대상으로 지정 (options는 기기별이라 제외 권장).

## Electron 데스크톱 빌드

```bash
npm install          # electron / electron-builder (devDependencies)
npm start            # 개발 실행 (--dev: DevTools 열림)
npm run dist         # electron-builder 패키징
```

- 창: 전체화면 시작, 메뉴 숨김, `backgroundThrottling: false`
  (창 비활성 시 게임 자체 `visibilitychange` 일시정지가 동작).
- 전체화면 토글: 게임 내 버튼이 Electron에서는 창 전체화면으로 동작.
- 종료: 데스크톱에서만 타이틀에 "게임 종료" 버튼 표시, 종료 전 `Save.flush()`.

## Steam 연동

- **steamworks.js** (optionalDependency): 설치되어 있고 Steam이 실행 중이면
  `electron/main.js`가 자동 초기화. 없어도 게임은 정상 동작.
  개발 중에는 실행 파일 옆 `steam_appid.txt`에 앱 ID를 둔다.
- **도전과제**: `markAchUnlocked(id)`(js/dex.js) → `steamUnlockAch(id)`
  (js/desktop.js) → Steam API Name으로 활성화.
  - API Name 기본 규칙: `ACH_<대문자 id>` (예: `rookie` → `ACH_ROOKIE`).
    Steamworks에 다른 이름으로 등록했다면 `STEAM_ACH_MAP`에 매핑 추가.
  - 부팅 시 해금 전체를 재전송하므로 오프라인 중 해금분도 자동 보정된다.
- **오버레이**: `steamworks.electronEnableSteamOverlay()` 호출 포함.
  패키징 후 오버레이 표시 여부를 반드시 실기에서 확인할 것.
- 빌드 결과물은 Steamworks `steamcmd` + `app_build` 스크립트로 업로드.

## 입력 (Steam Deck 대응)

- **게임패드**(js/gamepad.js): 왼스틱/십자키 이동, A=행동, B=취소/재개,
  Start=일시정지, X/Y/LB/RB/LT/RT=스킬. 메뉴·도감은 터치/마우스 사용.
- **키 리바인딩**(js/keymap.js): 옵션 > 키 설정. 이동 4키 + 모드별 스킬 6키.
- **UI 크기**: 옵션에서 80~140% — 캔버스는 원본 유지, HUD/메뉴만 배율 조정.

## 테스트

```bash
npm test                     # 아래 전부 실행
node test/check-syntax.mjs   # 인라인 + js/ 스크립트 문법 검사
node test/smoke-save.mjs     # SaveStore 마이그레이션/섹션/왕복/손상 복구
node test/smoke-ach.mjs      # 도전과제 데이터/저장 왕복
node test/smoke-boss.mjs     # 보스 로스터·웨이브 추첨·안전 조건
node test/smoke-evo.mjs      # 진화 게이지 EXP 곡선·후보 추첨 규칙
node test/smoke-visual.mjs   # 크리처/보스 비주얼 데이터 무결성
```

오프라인 실행 검증: 로컬 서버(`npm run serve`)로 띄운 뒤 개발자도구 Network
탭에서 오프라인 모드로 전환해도 타이틀→게임 시작→보스전이 모두 동작해야
한다 (순위표 패널만 숨겨짐).

## 남은 작업 (다음 단계)

- 순위표를 Firebase → Steam Leaderboards로 이전 (오프라인 의존 제거)
- Playwright E2E 스모크 자동화 + CI
- steamcmd `app_build`/depot 스크립트 저장소에 추가, beta/default 채널 전략
