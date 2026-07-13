'use strict';
// ════════════════════════════════════════════
//  Electron 메인 프로세스 — 스팀 데스크톱 셸
// ════════════════════════════════════════════
// 렌더러(게임)는 window.desktop(preload.js)을 통해서만 여기에 접근한다.
//  - 저장: userData/save/{options,progress}.json (원자적 쓰기 + .bak 백업)
//  - Steam: steamworks.js가 설치되어 있고 Steam이 실행 중일 때만 활성화.
//    없어도 게임은 그대로 동작한다 (도전과제 동기화만 꺼짐).
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// ── Steam (선택적) ──────────────────────────────────
let steamClient = null;
function initSteam() {
  try {
    const steamworks = require('steamworks.js');
    // 앱 ID는 배포 시 실행 파일 옆 steam_appid.txt 또는 Steam 클라이언트가 제공
    steamClient = steamworks.init();
    try { steamworks.electronEnableSteamOverlay(); } catch { /* 오버레이 미지원 환경 */ }
    console.log('[Steam] 초기화 완료');
  } catch (e) {
    console.warn('[Steam] 비활성 (steamworks.js 미설치 또는 Steam 미실행):', e.message);
  }
}

// ── 저장 파일 (js/save.js SaveStore의 데스크톱 어댑터 대상) ──
const SECTIONS = new Set(['options', 'progress']);
const saveDir = () => path.join(app.getPath('userData'), 'save');
const saveFile = (s) => path.join(saveDir(), `${s}.json`);

ipcMain.on('save-load-sync', (e, section) => {
  let out = null;
  if (SECTIONS.has(section)) {
    // 본 파일 손상/유실 시 .bak 폴백
    for (const f of [saveFile(section), saveFile(section) + '.bak']) {
      try { out = fs.readFileSync(f, 'utf8'); break; } catch { /* 다음 후보 */ }
    }
  }
  e.returnValue = out;
});

ipcMain.on('save-write-sync', (e, section, json) => {
  let ok = false;
  if (SECTIONS.has(section) && typeof json === 'string') {
    try {
      fs.mkdirSync(saveDir(), { recursive: true });
      const f = saveFile(section);
      try { fs.copyFileSync(f, f + '.bak'); } catch { /* 첫 저장이면 백업 없음 */ }
      fs.writeFileSync(f + '.tmp', json);
      fs.renameSync(f + '.tmp', f); // 원자적 교체
      ok = true;
    } catch (err) { console.error('[Save] 쓰기 실패:', section, err); }
  }
  e.returnValue = ok;
});

ipcMain.on('save-delete-sync', (e, section) => {
  if (SECTIONS.has(section)) {
    for (const suffix of ['', '.bak', '.tmp']) {
      try { fs.unlinkSync(saveFile(section) + suffix); } catch { /* 없으면 무시 */ }
    }
  }
  e.returnValue = true;
});

ipcMain.on('steam-available-sync', (e) => { e.returnValue = !!steamClient; });

ipcMain.on('steam-unlock-ach', (_e, name) => {
  if (!steamClient || typeof name !== 'string' || !name) return;
  try { steamClient.achievement.activate(name); }
  catch (err) { console.warn('[Steam] 도전과제 해금 실패:', name, err.message); }
});

ipcMain.on('app-quit', () => app.quit());
ipcMain.on('set-fullscreen', (_e, on) => { win?.setFullScreen(!!on); });
ipcMain.on('get-fullscreen-sync', (e) => { e.returnValue = !!win?.isFullScreen(); });

// ── 창 ──────────────────────────────────────────────
let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#9ed98f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 백그라운드에서 타이머를 멈추지 않는다 — 게임 자체의
      // visibilitychange 자동 일시정지가 대신 동작한다.
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => { initSteam(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
