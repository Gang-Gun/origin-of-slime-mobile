'use strict';
// ════════════════════════════════════════════
//  키맵 — 이동/스킬 단축키 데이터화 + 리바인딩
// ════════════════════════════════════════════
// 기본값은 DEFAULT_KEYMAP, 사용자 변경분은 Save('gpa_keymap')에 저장된다.
// 키 표기: 단일 문자는 대문자('W','1'), 방향키는 'UP'/'DOWN'/'LEFT'/'RIGHT'.

const DEFAULT_KEYMAP = {
  move:  { up: 'W', left: 'A', down: 'S', right: 'D' },
  wasd:  { onslaught: '1', rally: '2', burst: '3', heal: '4', haste: '5', fear: '6' },
  mouse: { onslaught: 'Q', rally: 'W', burst: 'E', heal: 'R', haste: 'T', fear: 'Y' },
};

const KEYMAP = { move: {}, wasd: {}, mouse: {} };
function _keymapLoad() {
  let saved = {};
  try { saved = JSON.parse(Save.get('gpa_keymap') || '{}') || {}; } catch { /* 손상 시 기본값 */ }
  for (const sec of Object.keys(DEFAULT_KEYMAP)) {
    for (const [act, def] of Object.entries(DEFAULT_KEYMAP[sec])) {
      const v = saved[sec] && typeof saved[sec][act] === 'string' ? saved[sec][act] : def;
      KEYMAP[sec][act] = v;
    }
  }
}
_keymapLoad();

function _keymapAfterChange() {
  if (typeof refreshSkillKeyBadges === 'function') refreshSkillKeyBadges();
  const sc = window._arenaScene;
  if (sc && sc._bindMoveKeys) sc._bindMoveKeys(); // 게임 중 즉시 반영
}
function rebindKey(sec, act, key) {
  // 같은 섹션에서 이미 쓰는 키면 기존 키와 자리를 교환한다 (중복 배정 방지)
  const cur = KEYMAP[sec][act];
  for (const [other, k] of Object.entries(KEYMAP[sec])) {
    if (other !== act && k === key) KEYMAP[sec][other] = cur;
  }
  KEYMAP[sec][act] = key;
  Save.set('gpa_keymap', JSON.stringify(KEYMAP));
  _keymapAfterChange();
}
function keymapReset() {
  Save.remove('gpa_keymap');
  _keymapLoad();
  _keymapAfterChange();
}

// ── 키 설정 모달 ────────────────────────────────────
const _SKILL_LABELS = {
  onslaught: '⚔️ 돌격', rally: '🛡️ 철벽', burst: '☠️ 독액',
  heal: '💚 재생', haste: '⚡ 질주', fear: '😱 위협',
};
const _KEYBIND_SECTIONS = [
  { sec: 'move',  title: '🏃 이동 (WASD 모드)',
    actions: { up: '위', left: '왼쪽', down: '아래', right: '오른쪽' } },
  { sec: 'wasd',  title: '⚔️ 스킬 — WASD 모드',   actions: _SKILL_LABELS },
  { sec: 'mouse', title: '⚔️ 스킬 — 마우스 모드', actions: _SKILL_LABELS },
];
const _KEY_DISPLAY = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→' };
function keyLabel(k) { return _KEY_DISPLAY[k] || k; }

let _keyCapture = null; // { sec, act } — 키 입력 대기 중인 행

function _renderKeybindBody() {
  const body = document.getElementById('keybind-body');
  if (!body) return;
  body.innerHTML = _KEYBIND_SECTIONS.map(({ sec, title, actions }) => {
    const rows = Object.entries(actions).map(([act, label]) => {
      const waiting = _keyCapture && _keyCapture.sec === sec && _keyCapture.act === act;
      return `<div class="setting-row" style="padding:4px 0">
        <span style="font-size:13px">${label}</span>
        <button type="button" class="pause-btn pause-settings" style="width:auto;min-width:64px;padding:6px 12px;font-size:13px${waiting ? ';color:var(--coral)' : ''}"
          onclick="_startKeyCapture('${sec}','${act}')">${waiting ? '키 입력…' : keyLabel(KEYMAP[sec][act])}</button>
      </div>`;
    }).join('');
    return `<div style="font-size:12px;color:var(--ink-soft);margin:10px 0 2px">${title}</div>${rows}`;
  }).join('');
}
function openKeybindModal() {
  _keyCapture = null;
  _renderKeybindBody();
  document.getElementById('keybind-modal').style.display = 'flex';
}
function closeKeybindModal() {
  _keyCapture = null;
  document.getElementById('keybind-modal').style.display = 'none';
}
function keybindResetClick() { _keyCapture = null; keymapReset(); _renderKeybindBody(); }
function _startKeyCapture(sec, act) { _keyCapture = { sec, act }; _renderKeybindBody(); }

// 캡처 단계에서 가로채 게임 단축키(document 버블 리스너)로 새지 않게 한다
document.addEventListener('keydown', (e) => {
  if (!_keyCapture) return;
  e.preventDefault();
  e.stopPropagation();
  const { sec, act } = _keyCapture;
  if (e.key === 'Escape') { _keyCapture = null; _renderKeybindBody(); return; }
  let key = null;
  if (/^[a-zA-Z0-9]$/.test(e.key)) key = e.key.toUpperCase();
  else if (/^Arrow(Up|Down|Left|Right)$/.test(e.key)) key = e.key.slice(5).toUpperCase();
  if (!key) return; // 허용되지 않는 키는 계속 대기
  _keyCapture = null;
  rebindKey(sec, act, key);
  _renderKeybindBody();
}, true);
