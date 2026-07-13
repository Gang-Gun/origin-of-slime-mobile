'use strict';
// ════════════════════════════════════════════
//  게임패드 (Steam Deck / 컨트롤러)
// ════════════════════════════════════════════
// 표준(xbox형) 매핑 기준:
//   이동      왼스틱 + 십자키 (이동 방식 설정과 무관하게 항상 동작)
//   A(0)      행동(번식) / 다이얼로그 확인
//   B(1)      다이얼로그 취소 / 일시정지 해제
//   Start(9)  일시정지 토글
//   X(2) Y(3) LB(4) RB(5) LT(6) RT(7) → 스킬 1~6
// 메뉴/도감 탐색은 터치·마우스 사용 (Steam Deck은 터치스크린 지원).
const GamepadInput = (() => {
  const DEAD = 0.28; // 스틱 데드존
  const BTN_SKILL = { 2: 'onslaught', 3: 'rally', 4: 'burst', 5: 'heal', 6: 'haste', 7: 'fear' };
  let padIndex = null;
  let prev = [];
  const move = { x: 0, y: 0 };

  function pad() {
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    if (padIndex !== null && pads[padIndex] && pads[padIndex].connected) return pads[padIndex];
    for (const p of pads) if (p && p.connected) { padIndex = p.index; return p; }
    return null;
  }
  const pressed = (p, i) => !!(p.buttons[i] && p.buttons[i].pressed);
  const edge = (p, i) => pressed(p, i) && !prev[i];

  function poll() {
    requestAnimationFrame(poll);
    const p = pad();
    if (!p) { move.x = 0; move.y = 0; return; }

    // ── 이동 벡터 (ArenaScene update가 moveVec()으로 읽는다) ──
    let x = Math.abs(p.axes[0] || 0) > DEAD ? p.axes[0] : 0;
    let y = Math.abs(p.axes[1] || 0) > DEAD ? p.axes[1] : 0;
    x += (pressed(p, 15) ? 1 : 0) - (pressed(p, 14) ? 1 : 0);
    y += (pressed(p, 13) ? 1 : 0) - (pressed(p, 12) ? 1 : 0);
    move.x = Math.max(-1, Math.min(1, x));
    move.y = Math.max(-1, Math.min(1, y));

    // ── 버튼 (키보드 단축키와 동일한 가드) ──
    const sc = window._arenaScene;
    const modalOpen = document.querySelector('.dex-modal.open, #options-modal.open, #pause-modal.open, #mutation-picker.open, #lab-modal.open');
    const dlg = document.getElementById('ui-dialog-modal');
    const dlgOpen = dlg && dlg.style.display !== 'none';
    const inGame = sc && !sc.gameOver;

    if (edge(p, 0)) { // A: 다이얼로그 확인 / 행동(번식)
      if (dlgOpen) _uiDialogResolve(true);
      else if (inGame && !modalOpen && !_paused) sc.handleAction();
    }
    if (edge(p, 1)) { // B: 다이얼로그 취소 / 일시정지 해제
      if (dlgOpen) _uiDialogResolve(false);
      else if (_paused) togglePause();
    }
    if (edge(p, 9)) { // Start: 일시정지 토글
      if (inGame && !modalOpen && !dlgOpen) togglePause();
    }
    if (inGame && !modalOpen && !dlgOpen && !_paused) {
      for (const [btn, id] of Object.entries(BTN_SKILL)) {
        if (edge(p, +btn)) sc.useCombatSkill(id);
      }
    }
    prev = p.buttons.map(b => !!(b && b.pressed));
  }

  window.addEventListener('gamepadconnected', () => { padIndex = null; });
  window.addEventListener('gamepaddisconnected', () => { padIndex = null; prev = []; });
  if (typeof navigator !== 'undefined' && navigator.getGamepads
      && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(poll);
  }

  return { moveVec: () => move };
})();
