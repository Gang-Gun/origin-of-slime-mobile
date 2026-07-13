'use strict';
// ── 대립유전자 변화 그래프 (결과 화면) ──────────────────────
const ALLELE_GRAPH_META = {
  color:  { ico:'🔴', label:'R 대립유전자 (몸색)',  col:'#ef5555' },
  speed:  { ico:'⚡', label:'S 대립유전자 (속도)',  col:'#22c55e' },
  poison: { ico:'☠️', label:'P 대립유전자 (독성)',  col:'#a855f7' },
  armor:  { ico:'🛡️', label:'A 대립유전자 (갑옷)',  col:'#60a5fa' },
  charm:  { ico:'💗', label:'C 대립유전자 (매력)',  col:'#f0abfc' },
};
const ALLELE_KEYS = ['color','speed','poison','armor','charm'];

function closeAlleleGraph() {
  document.getElementById('allele-graph-modal').classList.remove('open');
}

function _fmtClock(ms) {
  const s = Math.floor((ms || 0) / 1000);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function showAlleleGraph(gene) {
  const scene = window._arenaScene;
  const meta = ALLELE_GRAPH_META[gene] || ALLELE_GRAPH_META.color;
  let hist = (scene && scene.alleleHistory) || [];
  const events = (scene && scene.eventLog) || [];
  const body = document.getElementById('allele-graph-body');
  document.getElementById('allele-graph-title').innerHTML = `📈 ${meta.ico} ${meta.label} 변화`;

  if (!hist.length) {
    body.innerHTML = '<div class="result-card"><div class="row"><span class="label">기록된 데이터가 없습니다.</span></div></div>';
    document.getElementById('allele-graph-modal').classList.add('open');
    return;
  }
  // 점이 하나뿐이면(아주 일찍 종료) 평평한 선이 보이도록 복제
  if (hist.length === 1) hist = [hist[0], { ...hist[0], t: (hist[0].t || 0) + 1 }];

  // 좌표계
  const W = 360, H = 200, PX0 = 36, PX1 = 352, PY0 = 12, PY1 = 176;
  const maxT = Math.max(hist[hist.length - 1].t, 1);
  const x = t => PX0 + (t / maxT) * (PX1 - PX0);
  const y = v => PY1 - (Math.max(0, Math.min(100, v)) / 100) * (PY1 - PY0);

  // 가로 격자 + y축 라벨
  let grid = '';
  for (const v of [0, 25, 50, 75, 100]) {
    const gy = y(v);
    const is50 = v === 50;
    grid += `<line x1="${PX0}" y1="${gy.toFixed(1)}" x2="${PX1}" y2="${gy.toFixed(1)}"
      stroke="${is50 ? 'rgba(110,99,132,.55)' : 'rgba(110,99,132,.18)'}"
      stroke-width="${is50 ? 1.2 : 0.8}" ${is50 ? 'stroke-dasharray="4 3"' : ''}/>`;
    grid += `<text x="${PX0 - 5}" y="${(gy + 3).toFixed(1)}" text-anchor="end"
      font-size="9" fill="var(--px-ink)" opacity="0.65">${v}</text>`;
  }

  // 환경 이벤트만 추출 (전쟁·번식·굶주림 제외)
  const envEvents = events.filter(e => e.env);
  // 선택 유전자 곡선상의 y를 선형보간으로 구함 (점선 연결용)
  const gv = hist.map(h => ({ t: h.t, v: h[gene] }));
  const curveY = (t) => {
    if (t <= gv[0].t) return y(gv[0].v);
    const lp = gv[gv.length - 1];
    if (t >= lp.t) return y(lp.v);
    for (let i = 1; i < gv.length; i++) {
      if (t <= gv[i].t) {
        const a = gv[i - 1], b = gv[i];
        const f = (t - a.t) / ((b.t - a.t) || 1);
        return y(a.v + (b.v - a.v) * f);
      }
    }
    return y(lp.v);
  };
  // 환경 이벤트: X축 번호 핀 + 곡선까지 점선 연결
  let envMarks = '';
  envEvents.forEach((e, i) => {
    const ex = x(e.t), cy = curveY(e.t);
    envMarks += `<line x1="${ex.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${PY1}"
        stroke="${meta.col}" stroke-width="1" stroke-dasharray="2 3" opacity="0.55"/>
      <circle cx="${ex.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.3" fill="${meta.col}"/>
      <circle cx="${ex.toFixed(1)}" cy="${PY1}" r="6.5" fill="${meta.col}" stroke="#fff" stroke-width="1"/>
      <text x="${ex.toFixed(1)}" y="${(PY1 + 2.6).toFixed(1)}" text-anchor="middle" font-size="8" font-weight="900" fill="#fff">${i + 1}</text>`;
  });

  // 다른 유전자 옅은 선 (맥락용)
  let faint = '';
  for (const k of ALLELE_KEYS) {
    if (k === gene) continue;
    const pts = hist.map(h => `${x(h.t).toFixed(1)},${y(h[k]).toFixed(1)}`).join(' ');
    faint += `<polyline points="${pts}" fill="none" stroke="rgba(110,99,132,.22)" stroke-width="1"/>`;
  }

  // 선택 유전자 굵은 선 + 끝점
  const mainPts = hist.map(h => `${x(h.t).toFixed(1)},${y(h[gene]).toFixed(1)}`).join(' ');
  const last = hist[hist.length - 1];
  const main = `<polyline points="${mainPts}" fill="none" stroke="${meta.col}"
      stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(last.t).toFixed(1)}" cy="${y(last[gene]).toFixed(1)}" r="3.5" fill="${meta.col}"/>`;

  // x축 시간 라벨
  let xlabels = '';
  for (const frac of [0, 0.5, 1]) {
    const t = maxT * frac;
    xlabels += `<text x="${x(t).toFixed(1)}" y="${(PY1 + 14).toFixed(1)}"
      text-anchor="${frac === 0 ? 'start' : frac === 1 ? 'end' : 'middle'}"
      font-size="9" fill="var(--px-ink)" opacity="0.65">${_fmtClock(t)}</text>`;
  }

  const startV = hist[0][gene], endV = last[gene], delta = endV - startV;
  const deltaCol = delta > 0 ? meta.col : delta < 0 ? '#94a3b8' : 'var(--ink-soft)';

  // 환경 이벤트 목록 — X축 번호 핀과 1:1 대응
  const envList = envEvents.length
    ? envEvents.map((e, i) => `<div class="row" style="align-items:flex-start;gap:8px">
        <span style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${meta.col};color:#fff;font-size:10px;font-weight:900">${i + 1}</span>
        <span style="flex-shrink:0;font-family:'Galmuri11',monospace;font-size:11px;font-weight:900;color:var(--px-red-d)">${_fmtClock(e.t)}</span>
        <span style="flex:1;text-align:right;font-size:12px;line-height:1.4">${e.text}</span>
      </div>`).join('')
    : '<div class="row"><span class="label">환경 이벤트가 없습니다.</span></div>';

  body.innerHTML = `
    <div class="result-card">
      <h2>${meta.ico} ${meta.label} 변화</h2>
      <div class="row"><span>시작</span><span style="font-weight:900">${startV.toFixed(0)}%</span></div>
      <div class="row"><span>최종</span><span style="font-weight:900;color:${meta.col}">${endV.toFixed(0)}%</span></div>
      <div class="row"><span>변화량</span><span style="font-weight:900;color:${deltaCol}">${delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '– '}${Math.abs(delta).toFixed(0)}%p</span></div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:8px;background:rgba(150,105,55,.06);border-radius:6px">
        ${grid}${faint}${main}${envMarks}${xlabels}
      </svg>
      <div style="font-size:10px;color:var(--px-ink);opacity:.7;text-align:center;margin-top:5px">
        가로축: 생존 시간 · ●숫자: 환경 이벤트 시점(점선=그래프 연결) · 옅은 선: 다른 유전자
      </div>
    </div>
    <div class="result-card">
      <h2>🌍 환경 이벤트 (${envEvents.length})</h2>
      ${envList}
    </div>`;

  document.getElementById('allele-graph-modal').classList.add('open');
}

let game = null;
function openDiffSelect() {
  const maxUnlocked = getMaxUnlockedDiff();
  const list = document.getElementById('diff-list');
  const btnColors = ['', 'sky', 'coral', 'lilac'];
  list.innerHTML = DIFFICULTIES.map((d, i) => {
    const locked = i > maxUnlocked;
    return `<button onclick="${locked ? '' : `closeDiffSelect();startGame(${i})`}"
      class="big-btn ${locked ? '' : btnColors[i]}"
      style="width:100%;padding:13px 16px;text-align:left;
             display:flex;align-items:center;gap:12px;
             opacity:${locked ? .45 : 1};cursor:${locked ? 'default' : 'pointer'};
             ${locked ? 'background:var(--px-parch2) !important;color:var(--px-ink) !important;text-shadow:none !important;' : ''}">
      <span style="font-size:26px;line-height:1">${locked ? '🔒' : d.ico}</span>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:900;letter-spacing:.5px">${d.name}${locked ? ' (잠김)' : ''}</div>
        <div style="font-size:11px;opacity:.85;white-space:pre-line;margin-top:3px;line-height:1.4">${locked ? '이전 난이도 최종보스 처치 시 해금' : d.desc}</div>
      </div>
    </button>`;
  }).join('');
  document.getElementById('diff-modal').style.display = 'flex';
}
function closeDiffSelect() {
  document.getElementById('diff-modal').style.display = 'none';
}
function startGame(diffIndex = 0, mode = 'normal') {
  CURRENT_DIFFICULTY = diffIndex ?? 0;
  GAME_MODE = mode;
  enterFullscreen();
  stopLeaderboard();
  if (game) return;
  // 자동 재시작(튜토리얼 직후 리로드) 등 사용자 제스처 없이 호출되면
  // 오디오는 첫 입력 시점으로 미룬다 (자동재생 정책으로 무음 오디오가 생기는 것 방지)
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) {
    document.addEventListener('pointerdown', () => { Audio.init(); Audio.resume(); Audio.startBgm(); }, { once: true });
  } else {
    Audio.init(); Audio.resume(); Audio.startBgm();
  }
  document.getElementById('title-screen').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  // PC에서도 사이드 패널 없이 화면 전체 사용 (좌우 여백·설명창 제거)
  document.getElementById('pc-panel-left').style.display = 'none';
  document.getElementById('pc-panel-right').style.display = 'none';
  refreshSkillKeyBadges(); // 현재 이동 방식에 맞는 스킬 키 배지 표시
  const _db = document.getElementById('diff-badge');
  const _dc = getDiffConfig();
  if (GAME_MODE === 'infinite') {
    document.getElementById('diff-badge-ico').textContent = '♾️';
    document.getElementById('diff-badge-name').textContent = '무한';
    _db.style.display = '';
  } else if (CURRENT_DIFFICULTY > 0) {
    document.getElementById('diff-badge-ico').textContent = _dc.ico;
    document.getElementById('diff-badge-name').textContent = _dc.name;
    _db.style.display = '';
  } else {
    _db.style.display = 'none';
  }
  const width = Math.max(window.innerWidth || 800, 400);
  const height = Math.max(window.innerHeight || 600, 500);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-container',
    width,
    height,
    backgroundColor: '#9ed98f',
    pixelArt: true,
    antialias: false,
    scene: [ArenaScene],
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width,
      height
    }
  });
}

function startInfiniteMode() {
  startGame(CURRENT_DIFFICULTY, 'infinite');
}

function _refreshTitleButtons() {
  computeLabBuffs();
  const infBtn = document.getElementById('infinite-btn');
  if (infBtn) infBtn.style.display = (LAB_BUFFS && LAB_BUFFS.infiniteMode) ? '' : 'none';
}

function toggleStatsPanel() {
  document.getElementById('hud').classList.toggle('stats-open');
}
function toggleStatsDetail() {
  const detail = document.getElementById('stats-detail');
  const btn = document.getElementById('stats-expand-btn');
  const open = detail.style.display === 'none';
  detail.style.display = open ? '' : 'none';
  btn.textContent = open ? '▲' : '▼';
}
function toggleStatsGene() {
  const sec = document.getElementById('stats-gene-section');
  const btn = document.getElementById('stats-gene-btn');
  const open = sec.style.display === 'none';
  sec.style.display = open ? '' : 'none';
  btn.textContent = open ? '🧬 유전자 비율 ▲' : '🧬 유전자 비율 ▼';
}

function toggleMute() {
  Audio.muted = !Audio.muted;
  Audio.setMuted(Audio.muted);
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = Audio.muted ? '🔇' : '🔊';
}

