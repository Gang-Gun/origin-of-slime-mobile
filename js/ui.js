'use strict';
// ════════════════════════════════════════════
//  TutorialManager
// ════════════════════════════════════════════
const Tutorial = (() => {
  // 단계 정의
  // noMask: true → 어두운 오버레이 없이 링만 표시 (이동·식량 단계)
  const STEPS = [
    {
      ico: '🎯',
      title: '목표',
      desc: '⚔️ 다른 집단과 싸워 적을 처치하면\n🧬 진화 게이지가 차요.\n가득 차면 새 형질을 골라\n집단 전체가 진화합니다!\n\n🍓 먹이는 식량(번식 자원)이 되고,\n보스 3마리를 순서대로 처치하면 승리.\n보스마다 안전 조건이 있어요.',
      target: null, cond: null, nextLabel: '알겠어요 →',
    },
    {
      ico: '🕹️',
      title: '이동',
      desc: '화면을 꾹 누르고 드래그하면\n조이스틱이 나타나요.\n슬라임들이 따라와요!',
      target: null,
      noMask: true,
      cond: (scene) => scene._tutorialMoved,
      condLabel: '조이스틱을 드래그해보세요 👇',
      nextLabel: '완료! →',
    },
    {
      ico: '🍓',
      title: '식량 모으기',
      desc: '맵의 노란 원이 식량이에요.\n가까이 이동하면 자동 수집!\n아래 식량 바가 채워지면 번식 가능해요.',
      target: null,
      noMask: true,
      cond: (scene) => scene.player && scene.player.food > 40,
      condLabel: '식량을 조금 모아보세요 🍓',
      nextLabel: '좋아요! →',
    },
    {
      ico: '🥚',
      title: '번식',
      desc: '식량이 충분하면 🥚 버튼이 켜져요.\n눌러서 자손을 낳으세요!\n번식할 때 가끔 돌연변이가 생겨요.',
      target: '#breed-btn',
      noMask: true,
      cond: (scene) => scene.player && scene.player.generation >= 1,
      condLabel: '🥚 번식 버튼을 눌러보세요',
      nextLabel: '탄생! 🌱',
    },
    {
      ico: '🧬',
      title: '돌연변이',
      desc: '번식 후 돌연변이 선택창이 뜨면\n원하는 능력을 골라요!\n\n돌연변이는 집단 전체에 퍼질수록 강해져요.\n보스 안전 조건도 돌연변이로 충족할 수 있어요.\n처음엔 거부도 가능해요.',
      target: null, cond: null, nextLabel: '다음 →',
    },
    {
      ico: '👹',
      title: '보스 대비법',
      desc: '보스 경고가 뜨면 도감에서 안전 조건 확인!\n\n⚔️ 번식을 계속해 조건을 갖춘 개체를 늘리고\n💨 보스가 오면 도망치며 번식하세요.\n\n안전 조건 없는 개체는 도태되니\n집단 전체가 준비되도록 번식하세요!',
      target: null, cond: null, nextLabel: '시작! →',
    },
  ];

  let current = -1;
  let scene = null;
  let checkInterval = null;
  let _active = false;
  let playTimer = null;   // 인터랙티브 단계에서 설명창을 접는 타이머

  function getEl(sel) { return sel ? document.querySelector(sel) : null; }

  function getTargetRect(sel) {
    const el = getEl(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = 10;
    return { x: r.left - pad, y: r.top - pad, w: r.width + pad*2, h: r.height + pad*2 };
  }

  function positionCard(step) {
    const card = document.getElementById('tutorial-card');
    const rect = step.target ? getTargetRect(step.target) : null;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth || 320, ch = card.offsetHeight || 200;

    if (!rect) {
      if (step.noMask && step.cond) {
        // 이동·식량 같은 인터랙티브 단계: 상단에 배치해 중앙 플레이 영역을 비움
        card.style.left = `${(vw - cw) / 2}px`;
        card.style.top  = `10px`;
        return;
      }
      // 중앙
      card.style.left = `${(vw - cw) / 2}px`;
      card.style.top  = `${(vh - ch) / 2}px`;
      return;
    }
    // 타겟 아래 or 위에 배치
    const spaceBelow = vh - (rect.y + rect.h);
    const spaceAbove = rect.y;
    let top, left;
    if (spaceBelow >= ch + 20) {
      top  = rect.y + rect.h + 14;
    } else if (spaceAbove >= ch + 20) {
      top  = rect.y - ch - 14;
    } else {
      top = Math.max(10, Math.min(vh - ch - 10, rect.y + rect.h / 2 - ch / 2));
    }
    left = Math.max(10, Math.min(vw - cw - 10, rect.x + rect.w / 2 - cw / 2));
    card.style.left = `${left}px`;
    card.style.top  = `${top}px`;
  }

  function positionRing(step) {
    const ring  = document.getElementById('tutorial-ring');
    const arrow = document.getElementById('tutorial-arrow');
    if (!step.target) {
      ring.style.display = 'none';
      arrow.style.display = 'none';
      return;
    }
    const rect = getTargetRect(step.target);
    if (!rect) { ring.style.display='none'; arrow.style.display='none'; return; }
    ring.style.display = 'block';
    ring.style.left  = `${rect.x}px`;
    ring.style.top   = `${rect.y}px`;
    ring.style.width = `${rect.w}px`;
    ring.style.height= `${rect.h}px`;
    // 화살표 (링 위 중앙)
    arrow.style.display = 'block';
    arrow.textContent = '👆';
    arrow.style.left = `${rect.x + rect.w/2 - 14}px`;
    arrow.style.top  = `${rect.y - 36}px`;
  }

  function applyMask(step) {
    const mask = document.getElementById('tutorial-mask');
    // noMask 단계: 오버레이 완전 투명 (이동·식량 등 플레이 방해 없이)
    if (step.noMask) {
      mask.style.clipPath = '';
      mask.style.background = 'transparent';
      return;
    }
    if (!step.target) {
      mask.style.clipPath = '';
      mask.style.background = 'rgba(20,14,36,0.65)';
      return;
    }
    const rect = getTargetRect(step.target);
    if (!rect) { mask.style.clipPath = ''; return; }
    const x1=rect.x, y1=rect.y, x2=rect.x+rect.w, y2=rect.y+rect.h;
    const W=window.innerWidth, H=window.innerHeight;
    mask.style.background = 'rgba(20,14,36,0.65)';
    mask.style.clipPath =
      `polygon(0 0, ${W}px 0, ${W}px ${H}px, 0 ${H}px, ` +
      `0 ${y1}px, ${x1}px ${y1}px, ${x1}px ${y2}px, ${x2}px ${y2}px, ` +
      `${x2}px ${y1}px, 0 ${y1}px)`;
  }

  function render() {
    const step = STEPS[current];
    document.getElementById('tutorial-card').classList.remove('tut-playing');
    document.getElementById('tut-step-label').textContent = `${current+1} / ${STEPS.length}`;
    document.getElementById('tut-ico').textContent   = step.ico;
    document.getElementById('tut-title').textContent = step.title;
    document.getElementById('tut-desc').textContent  = step.desc;
    document.getElementById('tut-cond').textContent  = step.condLabel || '';
    const nextBtn = document.getElementById('tut-next-btn');
    nextBtn.textContent = step.nextLabel || '다음 →';
    // 조건 있는 단계: 버튼 비활성
    nextBtn.disabled = !!step.cond;
    nextBtn.style.opacity = step.cond ? '0.4' : '1';

    positionCard(step);
    positionRing(step);
    applyMask(step);
  }

  function startConditionCheck() {
    clearInterval(checkInterval);
    const step = STEPS[current];
    if (!step.cond) return;
    checkInterval = setInterval(() => {
      if (!scene || !_active) return;
      if (step.cond(scene)) {
        const nextBtn = document.getElementById('tut-next-btn');
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        document.getElementById('tut-cond').textContent = '✅ 완료! 다음을 눌러주세요';
        // 접혀 있던 설명창을 다시 펼쳐 '다음' 버튼이 보이게
        clearTimeout(playTimer);
        const card = document.getElementById('tutorial-card');
        card.classList.remove('tut-playing');
        positionCard(step);
        clearInterval(checkInterval);
      }
    }, 300);
  }

  function show(idx) {
    current = idx;
    if (current >= STEPS.length) { end(); return; }
    const overlay = document.getElementById('tutorial-overlay');
    overlay.classList.add('active');
    _active = true;
    render();
    startConditionCheck();
    // 인터랙티브 단계: 설명을 잠깐 보여준 뒤 슬림 띠로 접어 화면을 비움
    clearTimeout(playTimer);
    const stepNow = STEPS[current];
    if (stepNow.noMask && stepNow.cond) {
      playTimer = setTimeout(() => {
        if (_active && current === idx) document.getElementById('tutorial-card').classList.add('tut-playing');
      }, 1200);
    }
    // 이동 추적 (step 1)
    if (current === 1 && scene && !scene._tutorialMovePatch) {
      scene._tutorialMovePatch = true;
      const orig = scene.movePlayer.bind(scene);
      scene.movePlayer = function(dt) {
        orig(dt);
        if ((scene.joystick?.active) || scene.keys?.left?.isDown || scene.keys?.right?.isDown || scene.keys?.up?.isDown || scene.keys?.down?.isDown) {
          scene._tutorialMoved = true;
        }
      };
    }
  }

  return {
    start(sceneRef) {
      scene = sceneRef;
      scene.tutorialActive = true; // 사망 시스템 정지 (완료/건너뛰기 시 리로드로 자연 해제)
      show(0);
    },
    next() {
      const step = STEPS[current];
      if (step.cond) {
        const btn = document.getElementById('tut-next-btn');
        if (btn.disabled) return;
      }
      show(current + 1);
    },
    skip() {
      end(true);
    },
  };

  function end(fromSkip = false) {
    _active = false;
    clearInterval(checkInterval);
    clearTimeout(playTimer);
    document.getElementById('tutorial-card').classList.remove('tut-playing');
    Save.set('gpa_tutorial_done', '1');
    // 리로드 후 타이틀·난이도 선택을 다시 거치지 않고 같은 설정으로 바로 시작
    try { sessionStorage.setItem('gpa_autostart', JSON.stringify({ diff: CURRENT_DIFFICULTY, mode: GAME_MODE })); } catch {}

    if (fromSkip) {
      // 건너뛰기도 새 게임 시작
      document.getElementById('tutorial-overlay').classList.remove('active');
      document.getElementById('tutorial-mask').style.clipPath = '';
      location.reload();
      return;
    }

    // 마지막 단계 완료: 새 게임 시작 안내 후 리로드
    const card = document.getElementById('tutorial-card');
    card.innerHTML = `
      <span class="tut-ico">🎉</span>
      <div class="tut-title">튜토리얼 완료!</div>
      <div class="tut-desc">이제 진짜 게임을 시작합니다.\n10분 안에 살아남으세요!</div>
      <div class="tut-actions" style="margin-top:14px">
        <button class="tut-btn tut-btn-next" onclick="location.reload()">🌱 새 게임 시작!</button>
      </div>`;
    // 마스크 제거해서 카드만 보이게
    document.getElementById('tutorial-mask').style.background = 'rgba(30,20,50,0.85)';
    document.getElementById('tutorial-mask').style.clipPath = '';
    document.getElementById('tutorial-ring').style.display = 'none';
    document.getElementById('tutorial-arrow').style.display = 'none';

    // 카드 중앙 배치
    const vw = window.innerWidth, vh = window.innerHeight;
    card.style.left = `${(vw - (card.offsetWidth || 300)) / 2}px`;
    card.style.top  = `${(vh - (card.offsetHeight || 200)) / 2}px`;
  }
})();

// ── 상황별 1회 힌트 ───────────────────────────────────────────────
const ContextHint = (() => {
  const KEY = 'gpa_hints_seen';
  function seen(id) {
    try { return JSON.parse(Save.get(KEY) || '[]').includes(id); } catch { return false; }
  }
  function mark(id) {
    try {
      const arr = JSON.parse(Save.get(KEY) || '[]');
      if (!arr.includes(id)) { arr.push(id); Save.set(KEY, JSON.stringify(arr)); }
    } catch {}
  }
  function show(id, ico, text) {
    if (seen(id)) return;
    mark(id);
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      z-index:95;background:var(--px-parch);border:3px solid var(--px-out);border-radius:8px;
      padding:16px 20px;font-family:'Galmuri11','Jua',sans-serif;font-size:14px;color:var(--px-ink);
      text-align:center;max-width:80vw;box-shadow:0 6px 0 var(--px-out);line-height:1.6;
      animation:popIn .25s cubic-bezier(.34,1.56,.64,1)`;
    el.innerHTML = `<div style="font-size:28px;margin-bottom:8px">${ico}</div><div>${text.replace(/\n/g,'<br>')}</div>
      <button onclick="this.parentElement.remove()" style="margin-top:12px;background:var(--px-green);
        color:#fff;border:2px solid var(--px-out);border-radius:5px;padding:6px 18px;
        font-family:inherit;font-size:13px;cursor:pointer">확인</button>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 8000);
  }
  return { show };
})();

// 페이지 로드 시 순위표 초기화
function _syncLangBtns() {
  const ko = document.getElementById('lang-ko-btn');
  const en = document.getElementById('lang-en-btn');
  if (ko) ko.style.fontWeight = _lang === 'ko' ? '900' : '700';
  if (ko) ko.style.borderColor = _lang === 'ko' ? 'var(--leaf-dk)' : '';
  if (en) en.style.fontWeight = _lang === 'en' ? '900' : '700';
  if (en) en.style.borderColor = _lang === 'en' ? 'var(--leaf-dk)' : '';
}

window.addEventListener('DOMContentLoaded', () => {
  initLeaderboard();
  _refreshTitleButtons();
  applyI18n();
  _syncLangBtns();
  // 튜토리얼 직후 리로드 등에서 같은 설정으로 즉시 게임 재개
  try {
    const auto = JSON.parse(sessionStorage.getItem('gpa_autostart') || 'null');
    sessionStorage.removeItem('gpa_autostart');
    if (auto && typeof auto.diff === 'number') startGame(auto.diff, auto.mode === 'infinite' ? 'infinite' : 'normal');
  } catch {}
});

// ── 창 비활성/숨김 시 자동 일시정지 (PC 표준 동작) ─────────────────
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  const sc = window._arenaScene;
  const inGame = sc && !sc.gameOver && document.getElementById('hud').style.display !== 'none';
  // 모달이 열려 있으면 씬이 이미 멈춰 있으므로 중복 일시정지하지 않음
  const modalOpen = document.querySelector('.dex-modal.open, #options-modal.open, #mutation-picker.open, #lab-modal.open');
  if (inGame && !_paused && !sc.tutorialActive && !modalOpen) togglePause();
});

// ── Feature 4: 누적 통계 ────────────────────────────────────────────
function loadStats() {
  try {
    const v = JSON.parse(Save.get('gpa_stats') || '{}');
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch { return {}; }
}
function saveStats(s) { Save.set('gpa_stats', JSON.stringify(s)); }
function openStatsModal() {
  const s = loadStats();
  const ms = s.totalPlayMs || 0;
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  const rows = [
    ['🎮 총 게임 수', `${s.totalGames || 0}회`],
    ['🏆 최종보스 처치', `${s.totalWins || 0}회`],
    ['⭐ 최고 점수', `${(s.bestScore || 0).toLocaleString()}`],
    ['💀 총 보스 처치', `${s.totalBossKills || 0}회`],
    ['⏱ 총 플레이 시간', `${h}시간 ${m}분`],
  ];
  document.getElementById('stats-modal-content').innerHTML =
    `<div style="display:flex;flex-direction:column;gap:0;font-family:'Jua',sans-serif">` +
    rows.map((r, i) =>
      `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 4px;${i < rows.length - 1 ? 'border-bottom:1px solid var(--glass-bdr)' : ''}">
        <span style="color:var(--ink-soft);font-size:13px">${r[0]}</span>
        <strong style="color:var(--ink);font-size:14px">${r[1]}</strong>
      </div>`
    ).join('') + `</div>`;
  document.getElementById('stats-modal').style.display = 'flex';
}
function closeStatsModal() { document.getElementById('stats-modal').style.display = 'none'; }

// ── Feature 3: 전쟁 승리 영입 토스트 ────────────────────────────────
// 스킬바 버튼 onclick 전역 진입점 (실제 로직은 ArenaScene.useCombatSkill)
function useCombatSkill(id) {
  const sc = window._arenaScene;
  if (sc && sc.useCombatSkill) sc.useCombatSkill(id);
}

let _recruitTimer = null;
function showRecruit(loserGroup, survivorCount) {
  const msg = document.getElementById('recruit-msg');
  const toast = document.getElementById('recruit-toast');
  if (!msg || !toast) return;
  msg.textContent = `패배한 집단에 생존자 ${survivorCount}마리가 있습니다. 영입하시겠습니까?`;
  toast.style.display = 'block';
  if (_recruitTimer) clearTimeout(_recruitTimer);
  _recruitTimer = setTimeout(() => dismissRecruit(), 10000);
}
function dismissRecruit() {
  const toast = document.getElementById('recruit-toast');
  if (toast) toast.style.display = 'none';
  if (_recruitTimer) { clearTimeout(_recruitTimer); _recruitTimer = null; }
  window._pendingRecruit = null;
}
function doRecruit() {
  const pr = window._pendingRecruit;
  if (!pr) return dismissRecruit();
  const { group: loserGroup, scene } = pr;
  if (!scene || !scene.player) return dismissRecruit();
  const survivors = loserGroup.individuals.filter(i => !i.dead);
  const toRecruit = survivors.slice(0, 2);
  for (const ind of toRecruit) {
    ind.groupId = scene.player.id;
    scene.player.individuals.push(ind);
    const idx = loserGroup.individuals.indexOf(ind);
    if (idx !== -1) loserGroup.individuals.splice(idx, 1);
  }
  scene.ensureSprites(scene.player);
  scene.showMessage(`🤝 ${toRecruit.length}마리를 영입했습니다!`);
  dismissRecruit();
}
