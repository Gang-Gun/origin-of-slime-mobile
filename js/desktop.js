'use strict';
// ════════════════════════════════════════════
//  데스크톱(Electron/Steam) 연동 + 공용 다이얼로그
// ════════════════════════════════════════════
// window.desktop은 electron/preload.js가 노출한다. 웹 실행에서는 undefined이며
// 이 파일의 모든 기능은 조용히 웹 동작으로 폴백한다.

// ── confirm()/alert() 대체 게임 내 다이얼로그 ──────────
// Electron에서 네이티브 다이얼로그는 OS 창으로 떠서 어색하고 포커스를 뺏는다.
let _uiDialogCb = null;
function _uiDialogResolve(ok) {
  document.getElementById('ui-dialog-modal').style.display = 'none';
  const cb = _uiDialogCb; _uiDialogCb = null;
  if (cb) cb(ok);
}
function _uiDialogOpen(msg, showCancel, cb) {
  document.getElementById('ui-dialog-msg').textContent = msg;
  document.getElementById('ui-dialog-cancel').style.display = showCancel ? '' : 'none';
  _uiDialogCb = cb;
  document.getElementById('ui-dialog-modal').style.display = 'flex';
}
function uiConfirm(msg, onOk, onCancel) { _uiDialogOpen(msg, true, ok => { if (ok) onOk && onOk(); else onCancel && onCancel(); }); }
function uiAlert(msg, onOk) { _uiDialogOpen(msg, false, () => { onOk && onOk(); }); }

function confirmGoHome() {
  uiConfirm(T('confirm_home'), () => { Audio.stopBgm(); location.reload(); });
}

// ── 데스크톱 종료 ──────────────────────────────────
function desktopQuit() {
  uiConfirm(T('confirm_quit'), () => {
    try { Save.flush(); } catch { /* 저장 실패해도 종료는 진행 */ }
    window.desktop.quit();
  });
}

// ── Steam 도전과제 브리지 ──────────────────────────
// 게임 내 도전과제 id ↔ Steam API Name 매핑.
// 기본 규칙은 ACH_<대문자 id>. Steamworks 설정에서 다른 이름을 썼다면 여기에 추가한다.
//   예) rookie: 'ACH_FIRST_STEPS',
const STEAM_ACH_MAP = {};
function _steamAchName(id) { return STEAM_ACH_MAP[id] || ('ACH_' + String(id).toUpperCase()); }

let _steamOn = null;
function _steamAvailable() {
  if (_steamOn === null) {
    try { _steamOn = !!(window.desktop && window.desktop.steamAvailable()); }
    catch { _steamOn = false; }
  }
  return _steamOn;
}

// markAchUnlocked(js/dex.js)가 해금 시마다 호출한다.
function steamUnlockAch(id) {
  if (!_steamAvailable()) return;
  try { window.desktop.unlockAchievement(_steamAchName(id)); } catch { /* 무시 */ }
}

// ── 부팅: 종료 버튼 표시 + 도전과제 재동기화 ────────
document.addEventListener('DOMContentLoaded', () => {
  if (!window.desktop) return;
  const q = document.getElementById('quit-btn');
  if (q) q.style.display = '';
  // Steam 미실행/오프라인 중 해금분 보정: 이미 해금된 도전과제의 activate는
  // Steam이 무시하므로, 부팅 때 전체를 다시 보내는 것이 가장 단순한 재동기화다.
  if (_steamAvailable()) {
    try { for (const id of loadUnlockedAch()) window.desktop.unlockAchievement(_steamAchName(id)); }
    catch { /* 무시 */ }
  }
});
