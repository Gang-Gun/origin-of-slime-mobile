'use strict';
// ── 이동 방식 (PC): 'wasd'(에브리띵이즈크랩식 키보드) | 'mouse'(LoL식 우클릭 이동) ──
function getMoveMode() {
  const m = localStorage.getItem('gpa_move_mode');
  return m === 'mouse' ? 'mouse' : 'wasd';
}
function refreshMoveModeBtns() {
  const label = getMoveMode() === 'mouse' ? '🖱️ 마우스' : '⌨️ WASD';
  for (const id of ['options-movemode-toggle', 'pause-movemode-toggle']) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = label;
  }
  refreshSkillKeyBadges(); // 스킬 키 배지도 현재 이동 방식에 맞게 동기화
}
function cycleMoveMode(btn) {
  const next = getMoveMode() === 'wasd' ? 'mouse' : 'wasd';
  localStorage.setItem('gpa_move_mode', next);
  refreshMoveModeBtns();
  refreshSkillKeyBadges(); // 이동 방식에 따라 스킬 키 배지(1~6 / QWERTY) 갱신
  // 모드 전환 시 이동 목표·조이스틱 잔상 정리
  const sc = window._arenaScene;
  if (sc) { sc._clickTarget = null; sc._rmbHeld = false; sc._clickMarker?.clear(); }
}

function refreshSpeedToggleRow() {
  const btn   = document.getElementById('speed-toggle');
  const label = document.getElementById('speed-toggle-label');
  if (!btn || !label) return;
  const unlocked = LAB_BUFFS?.gameSpeedUnlock > 0;
  if (unlocked) {
    label.textContent = `⚡ 게임 속도 (${LAB_BUFFS.gameSpeedUnlock}×)`;
    btn.disabled = false;
    btn.style.opacity = '';
    refreshSpeedBtn();
  } else {
    label.textContent = '⚡ 게임 속도 (계통수 가속 I 해금 필요)';
    btn.disabled = true;
    btn.style.opacity = '0.35';
    btn.classList.remove('on');
  }
}
function toggleBossBanner() {
  const bb = document.getElementById('boss-banner');
  bb.classList.toggle('boss-collapsed');
}
function openOptionsModal() {
  document.getElementById('options-modal').classList.add('open');
  const bgmBtn = document.getElementById('options-bgm-toggle');
  if (bgmBtn) bgmBtn.classList.toggle('on', localStorage.getItem('gpa_bgm_off') !== '1');
  const mutBtn = document.getElementById('options-mutpick-toggle');
  if (mutBtn) mutBtn.classList.toggle('on', localStorage.getItem('gpa_mutpick_off') !== '1');
  const breedBtn = document.getElementById('options-breedpick-toggle');
  if (breedBtn) breedBtn.classList.toggle('on', localStorage.getItem('gpa_breedpick_off') !== '1');
  refreshTerrainNotifyBtns();
  refreshMoveModeBtns();
  const bgmVol = localStorage.getItem('gpa_bgm_vol') ?? '45';
  const sfxVol = localStorage.getItem('gpa_sfx_vol') ?? '50';
  document.querySelectorAll('.vol-slider[id$="-bgm-vol"]').forEach(s => s.value = bgmVol);
  document.querySelectorAll('.vol-slider[id$="-sfx-vol"]').forEach(s => s.value = sfxVol);
}
function setBgmVol(val) {
  const v = parseInt(val) / 100;
  localStorage.setItem('gpa_bgm_vol', val);
  if (Audio._bgm) Audio._bgm.volume = v;
  document.querySelectorAll('.vol-slider[id$="-bgm-vol"]').forEach(s => s.value = val);
}
function setSfxVol(val) {
  localStorage.setItem('gpa_sfx_vol', val);
  if (Audio.masterGain && !Audio.muted) Audio.masterGain.gain.value = parseInt(val) / 100 * 0.7;
  document.querySelectorAll('.vol-slider[id$="-sfx-vol"]').forEach(s => s.value = val);
}
function toggleOptionsBgm(btn) {
  btn.classList.toggle('on');
  const off = !btn.classList.contains('on');
  localStorage.setItem('gpa_bgm_off', off ? '1' : '0');
  if (off) Audio.pauseBgm(); else Audio.resumeBgm();
  const p = document.getElementById('pause-bgm-toggle');
  if (p) p.classList.toggle('on', !off);
}
function closeOptionsModal() { document.getElementById('options-modal').classList.remove('open'); }
// ── 키보드 단축키 (PC) ──────────────────────────────────────────────
// 이동키(WASD)와 충돌 방지: 게임 실행 중 단일 알파벳 단축키 사용 금지
// 도감(Tab), 계통수(Q), 소리(M — 이동 키 아님), 속도(1/2/3)만 허용
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const sc = window._arenaScene;
  const gameActive = sc && !sc.gameOver && document.getElementById('hud').style.display !== 'none';
  const modalOpen = document.querySelector('.dex-modal.open, #options-modal.open, #pause-modal.open, #mutation-picker.open, #lab-modal.open');
  const paused = _paused; // 일시정지 상태는 모듈 변수 (sc._paused는 존재하지 않음)
  // 전투 스킬 단축키 (이동 방식에 따라 WASD=1~6 / 마우스=QWERTY) — 스위치보다 먼저 처리
  const _skid = skillForKey(e.key);
  if (_skid) {
    if (sc && !modalOpen && !paused) { sc.useCombatSkill(_skid); e.preventDefault(); }
    return; // 스킬 키는 여기서 소비 (다른 단축키로 넘어가지 않음)
  }
  switch (e.key) {
    case 'Tab':
      // Tab: 도감 토글 (WASD와 겹치지 않음)
      if (document.getElementById('dex-modal').classList.contains('open')) { closeDex(); e.preventDefault(); }
      else if (!modalOpen) { openDex(); e.preventDefault(); } break;
    case 'l': case 'L':
      // L: 계통수(Lab) 토글 — Q는 마우스 모드에서 스킬 키라 L로 이동
      if (document.getElementById('lab-modal').classList.contains('open')) { closeLab(); e.preventDefault(); }
      else if (!modalOpen) { openLab(); e.preventDefault(); } break;
    case 'b': case 'B':
      // B: 번식 (이동 키 아님, 게임 중만)
      if (sc && !modalOpen && !paused) { sc.handleAction(); e.preventDefault(); } break;
    case ' ':
      if (sc && !modalOpen && !paused) { sc.handleAction(); e.preventDefault(); } break;
    case 'Escape':
      if (document.getElementById('mutation-picker').classList.contains('open')) {
        resolveMutationPick(null); e.preventDefault(); break;
      }
      if (document.getElementById('dex-modal') && document.getElementById('dex-modal').classList.contains('open')) {
        closeDex(); e.preventDefault(); break;
      }
      if (document.getElementById('options-modal').classList.contains('open')) {
        closeOptionsModal(); e.preventDefault(); break;
      }
      if (document.getElementById('lab-modal').classList.contains('open')) {
        closeLab(); e.preventDefault(); break;
      }
      if (sc) { togglePause(); e.preventDefault(); } break;
    case 'm': case 'M':
      // M: 음소거 (이동 키 아님)
      toggleMute(); e.preventDefault(); break;
    case 'f': case 'F':
      // F: 전체화면 — 게임 중 비활성 (F키 연타 실수 방지), 일시정지/타이틀에서만
      if (!gameActive || paused || modalOpen) { toggleFullscreen(); e.preventDefault(); } break;
    // (게임 속도 숫자 단축키 제거 — WASD 모드에서 1~6이 스킬 키로 쓰임. 속도는 HUD 버튼·설정에서 조절)
  }
});

function resetAccount() {
  if (!confirm('⚠️ 정말 초기화하시겠습니까?\n\n계통수 해금, 통계, 업적, 리더보드 연동 등\n모든 진행 데이터가 삭제됩니다.\n\n이 작업은 되돌릴 수 없습니다.')) return;
  const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('gpa_'));
  keysToRemove.forEach(k => localStorage.removeItem(k));
  closeOptionsModal();
  alert('✅ 초기화 완료. 페이지를 새로고침합니다.');
  location.reload();
}
function toggleOptionsMutPick(btn) {
  btn.classList.toggle('on');
  localStorage.setItem('gpa_mutpick_off', btn.classList.contains('on') ? '0' : '1');
}
function toggleOptionsBreedPick(btn) {
  btn.classList.toggle('on');
  localStorage.setItem('gpa_breedpick_off', btn.classList.contains('on') ? '0' : '1');
  const pauseBtn = document.getElementById('pause-breedpick-toggle');
  if (pauseBtn) pauseBtn.classList.toggle('on', btn.classList.contains('on'));
}
function toggleOptionsSfx(btn) {
  btn.classList.toggle('on');
  const muted = !btn.classList.contains('on');
  Audio.setMuted(muted);
  Audio.muted = muted;
  const sfxBtn = document.getElementById('sfx-toggle');
  if (sfxBtn) sfxBtn.classList.toggle('on', !muted);
}

let _paused = false;
function togglePause() {
  _paused = !_paused;
  const modal = document.getElementById('pause-modal');
  const btn   = document.getElementById('pause-btn');
  modal.classList.toggle('open', _paused);
  if (btn) btn.textContent = _paused ? '▶' : '⏸';
  // Phaser 씬 일시정지/재개
  const scene = game?.scene?.keys?.ArenaScene;
  if (scene) { _paused ? scene.scene.pause() : scene.scene.resume(); }
  _paused ? Audio.pauseBgm() : Audio.resumeBgm();
  // Feature 6: 집단 평균 스탯 요약
  if (_paused) {
    const inds = scene?.player?.individuals?.filter(i => !i.dead) || [];
    if (inds.length) {
      const avg = k => Math.round(inds.reduce((s, i) => s + (i.stats[k] || 0), 0) / inds.length);
      document.getElementById('avg-hp').textContent  = avg('hp');
      document.getElementById('avg-atk').textContent = avg('attack');
      document.getElementById('avg-def').textContent = avg('defense');
      document.getElementById('avg-spd').textContent = avg('speed');
      document.getElementById('pause-avg-stats').style.display = '';
    }
  }
}

function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('open');
  const sLabel = document.getElementById('pause-speed-label');
  const unlocked = LAB_BUFFS?.gameSpeedUnlock > 0;
  if (sLabel) sLabel.textContent = unlocked ? '⚡ 게임 속도' : '⚡ 게임 속도 (계통수 가속 I 해금 필요)';
  refreshSpeedBtn();
  const bgmBtn = document.getElementById('pause-bgm-toggle');
  if (bgmBtn) bgmBtn.classList.toggle('on', localStorage.getItem('gpa_bgm_off') !== '1');
  const bgmVol = localStorage.getItem('gpa_bgm_vol') ?? '45';
  const sfxVol = localStorage.getItem('gpa_sfx_vol') ?? '50';
  document.querySelectorAll('.vol-slider[id$="-bgm-vol"]').forEach(s => s.value = bgmVol);
  document.querySelectorAll('.vol-slider[id$="-sfx-vol"]').forEach(s => s.value = sfxVol);
  const mutBtn = document.getElementById('pause-mutpick-toggle');
  if (mutBtn) mutBtn.classList.toggle('on', localStorage.getItem('gpa_mutpick_off') !== '1');
  const breedBtn = document.getElementById('pause-breedpick-toggle');
  if (breedBtn) breedBtn.classList.toggle('on', localStorage.getItem('gpa_breedpick_off') !== '1');
  refreshTerrainNotifyBtns();
  refreshMoveModeBtns();
}
function togglePauseBgm(btn) {
  btn.classList.toggle('on');
  const off = !btn.classList.contains('on');
  localStorage.setItem('gpa_bgm_off', off ? '1' : '0');
  if (off) Audio.pauseBgm(); else Audio.resumeBgm();
  const o = document.getElementById('options-bgm-toggle');
  if (o) o.classList.toggle('on', !off);
}
function togglePauseMutPick(btn) {
  btn.classList.toggle('on');
  localStorage.setItem('gpa_mutpick_off', btn.classList.contains('on') ? '0' : '1');
  const optBtn = document.getElementById('options-mutpick-toggle');
  if (optBtn) optBtn.classList.toggle('on', btn.classList.contains('on'));
}
function togglePauseBreedPick(btn) {
  btn.classList.toggle('on');
  localStorage.setItem('gpa_breedpick_off', btn.classList.contains('on') ? '0' : '1');
  const optBtn = document.getElementById('options-breedpick-toggle');
  if (optBtn) optBtn.classList.toggle('on', btn.classList.contains('on'));
}

function toggleSfxSetting(btn) {
  btn.classList.toggle('on');
  const muted = !btn.classList.contains('on');
  Audio.setMuted(muted);
  Audio.muted = muted;
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
}

/* ── 전체화면 관리 ───────────────────────────────────────────────── */
function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function enterFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) fn.call(el).catch(() => {});
}
function exitFullscreen() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (fn) fn.call(document).catch(() => {});
}
function toggleFullscreen() {
  if (isFullscreen()) exitFullscreen(); else enterFullscreen();
}
function _syncFsBtns() {
  const label = isFullscreen() ? '🔲 창 모드로' : '⛶ 전체화면으로';
  document.querySelectorAll('.fs-toggle-btn').forEach(btn => { btn.textContent = label; });
}
document.addEventListener('fullscreenchange', _syncFsBtns);
document.addEventListener('webkitfullscreenchange', _syncFsBtns);

/* ── 방향 전환 / 리사이즈 처리 ───────────────────────────────────── */
let _orientTimer = null;

function _cancelJoystick() {
  const sc = window._arenaScene;
  if (!sc?.joystick?.active) return;
  Object.assign(sc.joystick, { active: false, pointerId: null, knobX: 0, knobY: 0, dirX: 0, dirY: 0 });
  const dom = document.getElementById('joystick-dom');
  if (dom) dom.style.display = 'none';
}

function _applyResize() {
  if (!game) return;
  // 사이드 패널 없이 항상 화면 전체 사용
  const left = document.getElementById('pc-panel-left');
  const right = document.getElementById('pc-panel-right');
  if (left)  left.style.display  = 'none';
  if (right) right.style.display = 'none';
  const gc = document.getElementById('game-container');
  if (gc) gc.style.width = '';
  game.scale.resize(window.innerWidth, window.innerHeight);
}

// 일반 resize (데스크톱 창 크기 변경 + 모바일 기본)
window.addEventListener('resize', () => {
  _cancelJoystick();
  _applyResize();
});

// orientationchange: iOS는 이 이벤트 직후 window.innerWidth/Height 가
// 아직 새 값으로 갱신되지 않을 수 있어 300ms 후 재적용
window.addEventListener('orientationchange', () => {
  _cancelJoystick();
  // HUD를 잠시 페이드아웃해 레이아웃 점프를 자연스럽게 숨김
  const hud = document.getElementById('hud');
  if (hud && hud.style.display !== 'none') hud.classList.add('orient-fade');
  clearTimeout(_orientTimer);
  _orientTimer = setTimeout(() => {
    _applyResize();
    if (hud) hud.classList.remove('orient-fade');
  }, 320);
});

