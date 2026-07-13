'use strict';
// ── 이벤트 도감 ──────────────────────────────────
const EVENT_DEX_DATA = [
  {
    id:'plain', label:'초원', ico:'🌿',
    bg:'linear-gradient(135deg,#6ec46a,#3d8a3a)',
    events:[
      { name:'메뚜기 떼 습격',   type:'food',  criterion:'식량 50% 즉시 감소',                          desc:'메뚜기 떼가 밀밭을 휩쓸어 식량이 절반으로 줄어듭니다.' },
      { name:'들불',             type:'death', criterion:'속도 68 미만 개체 → 15초간 점진 사망',         desc:'빠르지 않으면 번지는 불길을 피하지 못합니다. 빠른 다리·작은 몸집 돌연변이가 도움이 됩니다.' },
      { name:'야생 동물 습격',   type:'death', criterion:'방어 6 미만 AND 매력 10 미만 개체 → 점진 사망', desc:'방어력이나 매력이 있으면 살아남습니다. 단단한 껍질·지배 페로몬 돌연변이가 효과적입니다.' },
      { name:'전염병 창궐',      type:'death', criterion:'번식력 1.3 초과 개체 → 15초간 점진 사망',      desc:'높은 번식력 돌연변이는 번식에 유리하지만 전염병에 취약합니다.' },
      { name:'붉은 달',          type:'death', criterion:'매력 10 미만 AND 단단한 껍질 없는 개체 → 점진 사망', desc:'매력이 낮고 몸을 숨기지 못하는 개체가 포식자에게 발각됩니다. 지배 페로몬·단단한 껍질이 유리합니다.' },
    ]
  },
  {
    id:'forest', label:'숲', ico:'🌳',
    bg:'linear-gradient(135deg,#3d8a3a,#1a5c1a)',
    events:[
      { name:'위장 포식자 출현',  type:'death', criterion:'HP 110 미만 AND 재생 능력 없는 개체 → 점진 사망', desc:'체력이 약하고 회복력이 없는 개체가 사냥당합니다. 재생 능력·큰 몸집 돌연변이가 도움이 됩니다.' },
      { name:'나무 쓰러짐',       type:'death', criterion:'속도 72 미만 개체 → 15초간 점진 사망',         desc:'폭풍에 거목이 쓰러집니다. 빠른 다리·작은 몸집 돌연변이가 유리합니다.' },
      { name:'열매 풍년',         type:'food',  criterion:'식량 +55 즉시',                                desc:'숲에 열매가 풍성하게 익어 식량이 크게 늘어납니다.' },
      { name:'기생충 감염',        type:'death', criterion:'방어 7 미만 개체 → 15초간 점진 사망',          desc:'방어력이 낮으면 기생충을 막지 못합니다. 단단한 껍질·재생 능력 돌연변이가 효과적입니다.' },
      { name:'야간 포식자',        type:'death', criterion:'매력 10 미만 개체 → 15초간 점진 사망',          desc:'매력이 낮아 무리를 이탈한 개체가 표적이 됩니다. 지배 페로몬·화려한 무늬 돌연변이가 도움이 됩니다.' },
    ]
  },
  {
    id:'desert', label:'사막', ico:'🏜️',
    bg:'linear-gradient(135deg,#e8b84b,#b87d1a)',
    events:[
      { name:'극심한 폭염',       type:'death', criterion:'식량요구량 1.35 이상 개체 → 15초간 점진 사망',  desc:'대사량이 높으면 탈수가 빠릅니다. 효율 대사·작은 몸집 돌연변이로 식량 소모를 줄이세요.' },
      { name:'오아시스 발견',      type:'food',  criterion:'식량 +40 즉시',                                desc:'귀한 오아시스를 발견해 식량을 획득합니다.' },
      { name:'독전갈 습격',        type:'death', criterion:'공격 15 미만 AND 독성 분비 없는 개체 → 점진 사망', desc:'독성 면역이 없으면 독에 쓰러집니다. 독성 분비 돌연변이가 가장 효과적입니다.' },
      { name:'열사병',             type:'death', criterion:'방어 12 초과 AND 속도 75 미만 개체 → 점진 사망', desc:'방어력이 높지만 느린 개체가 열기를 못 이깁니다. 사막에서는 기동성이 중요합니다.' },
      { name:'신기루',             type:'food',  criterion:'식량 30% 즉시 감소',                           desc:'신기루를 쫓다 지쳐 식량을 낭비합니다.' },
    ]
  },
  {
    id:'volcano', label:'화산지대', ico:'🌋',
    bg:'linear-gradient(135deg,#e85c3a,#9b2010)',
    events:[
      { name:'화산 폭발',         type:'death', criterion:'방어 7 미만 AND 재생 능력 없는 개체 → 점진 사망', desc:'방어력이나 회복력이 없으면 열기를 버티지 못합니다. 재생 능력·단단한 껍질 돌연변이가 유리합니다.' },
      { name:'독가스 분출',        type:'death', criterion:'공격 15 미만 AND 독성 분비 없는 개체 → 점진 사망', desc:'독성 면역이 없으면 가스에 쓰러집니다. 독성 분비 돌연변이가 가장 효과적입니다.' },
      { name:'마그마 흐름',        type:'death', criterion:'속도 70 미만 개체 → 15초간 점진 사망',           desc:'마그마를 피하려면 빠른 이동이 필요합니다. 빠른 다리·작은 몸집 돌연변이가 도움이 됩니다.' },
      { name:'용암 분수',          type:'death', criterion:'매력 10 미만 개체 → 15초간 점진 사망',           desc:'무리 밖에 혼자 있던 개체가 용암 분수에 덮칩니다. 지배 페로몬으로 무리를 유지하세요.' },
      { name:'화산재 폭풍',        type:'death', criterion:'방어 7 미만 개체 → 15초간 점진 사망',            desc:'짙은 화산재에 방어력이 낮으면 질식합니다. 단단한 껍질·재생 능력 돌연변이가 효과적입니다.' },
    ]
  },
  {
    id:'snow', label:'눈밭', ico:'❄️',
    bg:'linear-gradient(135deg,#8ecfe8,#4a9ec0)',
    events:[
      { name:'눈보라',             type:'death', criterion:'방어 7 미만 개체 → 15초간 점진 사망',           desc:'방어력이 낮으면 혹한을 버티지 못하고 동사합니다. 단단한 껍질·큰 몸집 돌연변이가 유리합니다.' },
      { name:'혹한 동상',          type:'death', criterion:'현재 HP < 최대 HP×55% 개체 → 15초간 점진 사망', desc:'체력이 낮은 상태일수록 동상에 취약합니다.' },
      { name:'먹이 고갈',          type:'food',  criterion:'식량 40% 즉시 감소',                            desc:'눈이 모든 것을 뒤덮어 식량이 급감합니다.' },
      { name:'극야 생존',          type:'death', criterion:'HP 115 미만 AND 큰 몸집 없는 개체 → 점진 사망', desc:'체력과 보온성이 부족한 개체가 버티지 못합니다. 큰 몸집·재생 능력 돌연변이가 도움이 됩니다.' },
      { name:'눈사태',             type:'death', criterion:'속도 75 미만 AND 방어 12 초과 개체 → 점진 사망', desc:'무겁고 느린 개체가 눈사태를 피하지 못합니다. 기동성을 유지하세요.' },
    ]
  },
  {
    id:'river', label:'강가', ico:'💧',
    bg:'linear-gradient(135deg,#4ab8d8,#1a6a98)',
    events:[
      { name:'갑작스런 홍수',      type:'death', criterion:'속도 70 미만 개체 → 15초간 점진 사망',           desc:'빠르지 않으면 강물에 떠내려갑니다. 빠른 다리·작은 몸집 돌연변이가 유리합니다.' },
      { name:'강 독소 유입',       type:'death', criterion:'공격 15 미만 AND 독성 분비 없는 개체 → 점진 사망', desc:'독성 면역이 없으면 중독됩니다. 독성 분비 돌연변이가 가장 효과적입니다.' },
      { name:'물고기 풍년',        type:'food',  criterion:'식량 +60 즉시',                                 desc:'강에 물고기가 넘쳐 풍성한 식량을 얻습니다.' },
      { name:'급류',               type:'death', criterion:'속도 72 미만 AND 방어 12 초과 개체 → 점진 사망', desc:'무겁고 느린 개체가 급류에 가라앉습니다. 기동성과 무게의 균형을 맞추세요.' },
      { name:'강변 포식자',        type:'death', criterion:'매력 10 미만 개체 → 15초간 점진 사망',           desc:'무리를 이탈한 개체가 강변 포식자의 표적이 됩니다. 지배 페로몬·화려한 무늬가 효과적입니다.' },
    ]
  },
  {
    id:'swamp', label:'독성 늪', ico:'🐸',
    bg:'linear-gradient(135deg,#7ab84a,#3a6e1a)',
    events:[
      { name:'독성 폭발 확산',     type:'death', criterion:'공격 15 미만 AND 독성 분비 없는 개체 → 점진 사망', desc:'늪의 독성이 폭발적으로 강해집니다. 독성 분비 돌연변이가 없으면 살아남기 어렵습니다.' },
      { name:'늪 수렁',            type:'death', criterion:'속도 62 미만 개체 → 15초간 점진 사망',            desc:'깊어진 수렁에 느린 개체가 빠져나오지 못합니다.' },
      { name:'썩은 열매',          type:'food',  criterion:'식량 35% 즉시 감소',                            desc:'썩은 열매를 먹어 식량이 오염됩니다.' },
      { name:'독거미',             type:'death', criterion:'매력 10 미만 AND 공격 14 미만 개체 → 점진 사망', desc:'매력과 공격력이 모두 낮은 고립된 개체가 독거미에 물립니다.' },
      { name:'늪 안개',            type:'death', criterion:'독성 분비 없음 AND 속도 65 미만 → 동시 해당 시 점진 사망', desc:'두 조건을 동시에 만족하는 개체만 위험합니다. 독성 분비 돌연변이나 빠른 이동으로 대응하세요.' },
    ]
  },
];

let _eventFilter = 'all';

function renderEventDex() {
  const list = document.getElementById('event-dex-list');
  const filtered = _eventFilter === 'all'
    ? EVENT_DEX_DATA
    : EVENT_DEX_DATA.filter(t => t.id === _eventFilter);

  list.innerHTML = filtered.map(terrain => `
    <div class="evdex-terrain">
      <div class="evdex-terrain-header" style="background:${terrain.bg};cursor:pointer" onclick="filterEventByTerrain('${terrain.id}')">
        <span style="font-size:22px">${terrain.ico}</span>
        <span>${terrain.label}</span>
        <span style="margin-left:auto;font-size:12px;opacity:.8">${_eventFilter==='all' ? '▶ 상세보기' : terrain.events.length+'개 이벤트'}</span>
      </div>
      <div class="evdex-terrain-body">
        ${terrain.events.map(ev => `
          <div class="evdex-event">
            <div class="evdex-name">${ev.name}</div>
            <div class="evdex-desc">${ev.desc}</div>
            <span class="evdex-criterion ${ev.type}">
              ${ev.type==='death' ? '💀 사망 조건' : '🌾 식량 변화'}
              · ${ev.criterion}
            </span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

function openEventDex() {
  document.getElementById('event-dex-modal').classList.add('open');
  renderEventDex();
}
function closeEventDex() {
  document.getElementById('event-dex-modal').classList.remove('open');
}
function setEventFilter(filter, btn) {
  _eventFilter = filter;
  document.querySelectorAll('#event-dex-filters .dex-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEventDex();
}
function filterEventByTerrain(id) {
  _eventFilter = id;
  document.querySelectorAll('#event-dex-filters .dex-filter').forEach(b => {
    const onclick = b.getAttribute('onclick') || '';
    b.classList.toggle('active', onclick.includes("'" + id + "'") || (id === 'all' && onclick.includes("'all'")));
  });
  renderEventDex();
  document.getElementById('event-dex-list').scrollTop = 0;
}

// ── 보스 도감 저장소 ──────────────────────────────────────
function loadKilledBosses() {
  try { const r = localStorage.getItem('gpa_boss_killed'); return new Set(r ? JSON.parse(r) : []); }
  catch { return new Set(); }
}
function markBossKilled(id) {
  const s = loadKilledBosses(); s.add(id);
  localStorage.setItem('gpa_boss_killed', JSON.stringify([...s]));
  // 난이도별 처치 기록
  const dk = `gpa_boss_killed_d${CURRENT_DIFFICULTY}`;
  try {
    const ds = new Set(JSON.parse(localStorage.getItem(dk) || '[]'));
    ds.add(id); localStorage.setItem(dk, JSON.stringify([...ds]));
  } catch {}
}
function loadBossKilledOnDiff(diffIdx) {
  try { return new Set(JSON.parse(localStorage.getItem(`gpa_boss_killed_d${diffIdx}`) || '[]')); }
  catch { return new Set(); }
}
function renderBossDex() {
  const killed = loadKilledBosses();
  const list = document.getElementById('dex-boss-list');
  if (!list) return;
  const found = BOSS_ROSTER.filter(b => killed.has(b.id)).length;

  const lockedIco  = b => b.hidden ? '🌑' : b.final ? '🌈' : '❓';
  const lockedName = b => b.hidden ? '??? 미지의 존재' : b.final ? '??? 최종의 존재' : '??? 미확인 보스';
  const typeTag    = b => b.hidden
    ? `<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(251,191,36,.18);color:#fbbf24;font-weight:800">✨ 히든</span>`
    : b.final
    ? `<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(99,102,241,.18);color:#818cf8;font-weight:800">🌈 최종</span>`
    : `<span style="font-size:10px;padding:1px 6px;border-radius:99px;background:rgba(148,163,184,.15);color:var(--ink-soft);font-weight:800">${b.reqText.includes('+') ? '복합' : '일반'}</span>`;

  list.innerHTML =
    `<div style="text-align:center;padding:6px 0 4px;font-size:12px;color:var(--ink-soft)">처치 ${found} / ${BOSS_ROSTER.length}</div>` +
    BOSS_ROSTER.map(b => {
      if (killed.has(b.id)) {
        const diffColors = ['#3d8a3a','#e07a20','#c9402f','#4a1a6a'];
        const diffBadges = DIFFICULTIES.map((d,i) =>
          loadBossKilledOnDiff(i).has(b.id)
            ? `<span style="font-size:10px;padding:1px 5px;border-radius:99px;background:${diffColors[i]};color:#fff;font-weight:800">${d.ico}${d.name}</span>`
            : ''
        ).filter(Boolean).join(' ');
        return `<div class="boss-card killed" data-boss-id="${b.id}">
          <div class="boss-ico">${b.ico}</div>
          <div class="boss-info">
            <div class="boss-name" style="display:flex;align-items:center;gap:5px">${b.name} ${typeTag(b)}</div>
            ${diffBadges ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin:3px 0">${diffBadges}</div>` : ''}
            <div class="boss-req" style="margin-top:3px">🛡️ 안전조건: ${b.reqText}</div>
            <div class="boss-req">⚔️ 특수 패턴: ${(() => {
              const pid = BOSS_PATTERNS[b.id] || 'shockwave';
              if (pid === 'all') return '🌈 모든 패턴 무작위 사용';
              const pd = BOSS_SPECIAL_DEFS[pid];
              return `${pd.ico} ${pd.name} (${pd.hint})`;
            })()}</div>
            ${bossHasPhase2(b) ? `<div class="boss-req" style="color:#f97316">🔥 2페이즈: HP 50% 이하에서 강화 — 양 패턴 사용·공속/피해 증가</div>` : ''}
            ${b.spawnText ? `<div class="boss-req" style="color:#fbbf24">⚡ 등장 조건: ${b.spawnText}</div>` : ''}
          </div>
          <div class="boss-badge">✅ 처치</div>
        </div>`;
      }
      return `<div class="boss-card locked" data-boss-id="${b.id}">
        <div class="boss-ico">${lockedIco(b)}</div>
        <div class="boss-info">
          <div class="boss-name" style="color:var(--ink-soft);display:flex;align-items:center;gap:5px">${lockedName(b)} ${typeTag(b)}</div>
          <div class="boss-req">처치 후 정보 해금</div>
        </div>
        <div class="boss-badge">🔒</div>
      </div>`;
    }).join('');

  // 활성 보스 카드 강조 + 자동 스크롤
  const sc = window._arenaScene;
  const activeBossId = sc?.activeBoss?.id || (sc?._waveList && sc._waveIdx < sc._waveList.length ? sc._waveList[sc._waveIdx] : null);
  if (activeBossId) {
    const card = list.querySelector(`[data-boss-id="${activeBossId}"]`);
    if (card) {
      card.style.outline = '2px solid #fbbf24';
      card.style.boxShadow = '0 0 0 3px rgba(251,191,36,.25)';
      setTimeout(() => card.scrollIntoView({ behavior:'smooth', block:'nearest' }), 80);
    }
  }
}

// ── 도전과제 영구 해금 저장소 ─────────────────────────────
function loadUnlockedAch() {
  try {
    const raw = localStorage.getItem('gpa_ach_unlocked');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function markAchUnlocked(id) {
  const set = loadUnlockedAch();
  set.add(id);
  localStorage.setItem('gpa_ach_unlocked', JSON.stringify([...set]));
}

let _achFilter = 'all';

// ── 돌연변이 도감 ──────────────────────────────
let _dexFilter = 'all';

const MUT_ICO = { good: '✅', dual: '🔵', bad: '❌' };
const MUT_LABEL = { good: '이점', dual: '양면', bad: '불이익' };

function effectText(effects) {
  return Object.entries(effects).map(([k, v]) => {
    const NAMES = {
      attack:'공격', defense:'방어', speed:'속도', hp:'HP',
      gather:'채집', charm:'매력', fertility:'번식력',
      foodNeed:'먹이요구', mutationRate:'돌연변이율',
    };
    const name = NAMES[k] || k;
    const cls  = v > 0 ? 'up' : 'down';
    return `<span class="${cls}">${name} ${v > 0 ? '+' : ''}${v}</span>`;
  }).join('  ');
}

function renderDex() {
  const scene = game?.scene?.keys?.ArenaScene;
  const freq  = scene?.player?.mutationFrequency() || {};
  const list  = document.getElementById('dex-list');
  if (!list) return;

  const filtered = MUTATIONS.filter(m => {
    if (_dexFilter === 'owned') return (freq[m.id] || 0) > 0;
    if (_dexFilter === 'good')  return m.type === 'good';
    if (_dexFilter === 'dual')  return m.type === 'dual';
    if (_dexFilter === 'bad')   return m.type === 'bad';
    return true;
  });

  list.innerHTML = filtered.map(m => {
    const pct     = freq[m.id] || 0;
    const hasIt   = pct > 0;
    const typeClass = m.type === 'bad' ? 'type-bad' : m.type === 'dual' ? 'type-dual' : '';
    const fillClass = m.type === 'bad' ? 'bad' : m.type === 'dual' ? 'dual' : '';
    return `<div class="dex-card ${hasIt ? 'has-mut' : ''} ${typeClass}">
      <div class="dex-type-ico">${MUT_ICO[m.type]}</div>
      <div class="dex-info">
        <div class="dex-name">${m.name} ${hasIt ? '<span class="dex-badge">보유중</span>' : ''}</div>
        <div class="dex-effects">${effectText(m.effects)}</div>
        <div style="font-size:11px;color:var(--ink-soft);margin-top:3px">${MUT_LABEL[m.type]} 돌연변이</div>
      </div>
      <div class="dex-freq">
        <div class="dex-pct ${pct === 0 ? 'zero' : ''}">${pct > 0 ? pct.toFixed(0) + '%' : '미발견'}</div>
        <div class="dex-bar"><div class="dex-bar-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }).join('') || '<div style="text-align:center;color:var(--ink-soft);padding:24px">해당하는 돌연변이 없음</div>';
}

function openDex(tab) {
  document.getElementById('dex-modal').classList.add('open');
  const tabTarget = ['event','boss','achieve','mutation'].includes(tab) ? tab : 'mutation';
  switchDexTab(tabTarget, document.querySelector(`.dex-tab[data-tab="${tabTarget}"]`));
  const scene = game?.scene?.keys?.ArenaScene;
  if (scene && !_paused) scene.scene.pause();
}
function openEventDex() { openDex('event'); }
function closeDex() {
  document.getElementById('dex-modal').classList.remove('open');
  const scene = game?.scene?.keys?.ArenaScene;
  if (scene && !_paused) scene.scene.resume();
}
function closeEventDex() { closeDex(); }
function renderAchieveDex() {
  // 이번 게임 달성 여부만 사용 (영구 기록 무관)
  const gameAch = window._arenaScene?.achievements ?? new Set();
  const header = document.getElementById('dex-achieve-header');
  const list   = document.getElementById('dex-achieve-list');
  if (!header || !list) return;

  header.textContent = `이번 게임 달성 ${gameAch.size} / ${ACHIEVEMENTS.length}`;

  const filtered = ACHIEVEMENTS.filter(a => {
    if (_achFilter === 'done')   return gameAch.has(a.id);
    if (_achFilter === 'locked') return !gameAch.has(a.id);
    return true;
  });

  list.innerHTML = filtered.map(a => {
    const done = gameAch.has(a.id);
    if (done) {
      return `<div class="ach-card unlocked">
        <div class="ach-title">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-footer">
          <span class="ach-bonus">+${a.bonus}점</span>
          <span class="ach-badge">✅ 이번 게임 달성</span>
        </div>
      </div>`;
    } else {
      return `<div class="ach-card locked">
        <div class="ach-title locked-title">🔒 [${a.cat}]</div>
        <div class="ach-desc">???</div>
        <div class="ach-footer">
          <span class="ach-bonus">+${a.bonus}점</span>
          <span class="ach-badge" style="color:var(--ink-soft)">미달성</span>
        </div>
      </div>`;
    }
  }).join('') || '<div style="text-align:center;color:var(--ink-soft);padding:24px">해당 도전과제 없음</div>';
}

function setAchFilter(filter, btn) {
  _achFilter = filter;
  document.querySelectorAll('#ach-filters .dex-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAchieveDex();
}

function switchDexTab(tab, btn) {
  document.querySelectorAll('.dex-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const mutPanel = document.getElementById('dex-mutation-panel');
  const evPanel  = document.getElementById('dex-event-panel');
  const achPanel = document.getElementById('dex-achieve-panel');
  const bossPanel = document.getElementById('dex-boss-panel');
  mutPanel.style.display = 'none';
  evPanel.style.display  = 'none';
  if (achPanel)  achPanel.style.display  = 'none';
  if (bossPanel) bossPanel.style.display = 'none';
  const flex = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
  if (tab === 'achieve') {
    if (achPanel) achPanel.style.cssText = flex;
    renderAchieveDex();
  } else if (tab === 'event') {
    evPanel.style.cssText = flex;
    renderEventDex();
  } else if (tab === 'boss') {
    if (bossPanel) bossPanel.style.cssText = flex;
    renderBossDex();
  } else {
    mutPanel.style.cssText = flex;
    renderDex();
  }
}
function setDexFilter(filter, btn) {
  _dexFilter = filter;
  document.querySelectorAll('#dex-filters .dex-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDex();
}
function cycleGameSpeed() {
  const max = LAB_BUFFS?.gameSpeedUnlock || 0;
  if (!max) return;
  const cur = parseFloat(localStorage.getItem('gpa_speed_val') || '1');
  const options = [1, ...(max >= 1.5 ? [1.5] : []), ...(max >= 2 ? [2] : [])];
  const next = options[(options.indexOf(cur) + 1) % options.length];
  localStorage.setItem('gpa_speed_val', String(next));
  refreshSpeedBtn();
}
function refreshSpeedBtn() {
  const btn = document.getElementById('pause-speed-toggle');
  if (!btn) return;
  const max = LAB_BUFFS?.gameSpeedUnlock || 0;
  const cur = parseFloat(localStorage.getItem('gpa_speed_val') || '1');
  btn.textContent = `${cur}×`;
  btn.disabled = !max;
  btn.style.opacity = max ? '' : '0.35';
  btn.style.background = cur > 1 ? 'var(--coral)' : '';
  btn.style.color = cur > 1 ? '#fff' : '';
}
function toggleGameSpeed(btn) { cycleGameSpeed(); } // 하위호환

// 지형 이벤트 알림 3단계 순환: compact(간략) → full(자세히) → off(끄기)
const TERR_NOTIFY_MODES = ['compact', 'full', 'off'];
const TERR_NOTIFY_LABEL = { compact: '간략', full: '자세히', off: '끄기' };
function getTerrainNotify() {
  const m = localStorage.getItem('gpa_terrain_notify');
  return TERR_NOTIFY_MODES.includes(m) ? m : 'compact';
}
function refreshTerrainNotifyBtns() {
  const label = TERR_NOTIFY_LABEL[getTerrainNotify()];
  for (const id of ['options-terrnotify-toggle', 'pause-terrnotify-toggle']) {
    const btn = document.getElementById(id);
    if (btn) btn.textContent = label;
  }
}
function cycleTerrainNotify(btn) {
  const cur = getTerrainNotify();
  const next = TERR_NOTIFY_MODES[(TERR_NOTIFY_MODES.indexOf(cur) + 1) % TERR_NOTIFY_MODES.length];
  localStorage.setItem('gpa_terrain_notify', next);
  refreshTerrainNotifyBtns();
  refreshMoveModeBtns();
  // 즉시 반영: 남아있던 칩/박스 정리 (다음 틱에 새 모드로 다시 그려짐)
  const alert = document.getElementById('terrain-alert');
  if (alert) { alert.style.display = 'none'; alert.classList.remove('warn', 'active'); alert.dataset.k = ''; }
}
