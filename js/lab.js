'use strict';
// ══════════════════════════════════════════════════════
// ▶ 연구소 (Lab) Meta Progression System
// ══════════════════════════════════════════════════════

// Currency icon builders
function labFicon(sz=11){
  return `<svg class="lab-frag-svg" width="${sz}" height="${sz}" viewBox="0 0 14 14" style="vertical-align:middle;flex-shrink:0;margin-right:2px">
    <polygon points="7,0 14,7 7,14 0,7" fill="url(#lab-fgrad)"/>
    <polygon points="7,0.5 10.5,5 7,5.8 3.5,5" fill="rgba(255,255,255,.38)"/>
  </svg>`;
}
function labEicon(sz=11){
  return `<svg class="lab-ess-icon" width="${sz}" height="${sz}" viewBox="0 0 16 16" style="vertical-align:middle;flex-shrink:0;margin-right:2px">
    <circle cx="8" cy="8" r="7" fill="rgba(176,110,224,.18)"/>
    <circle cx="8" cy="8" r="5.5" fill="url(#lab-egrad)" filter="url(#lab-eglow)"/>
    <circle cx="8" cy="8" r="5.5" fill="none" stroke="rgba(220,170,255,.6)" stroke-width=".7"/>
    <ellipse cx="5.8" cy="5.2" rx="1.8" ry="1.1" fill="rgba(255,255,255,.5)"/>
  </svg>`;
}
function labFc(n){ return `${labFicon()}×${n}`; }
function labEc(n){ return `${labEicon()}×${n}`; }

// ── Node definitions ────────────────────────────────
// s: 'root'|'purchased'|'available'|'locked'  (computed at render time)
// t: 'frag'|'ess'   tree type
// parent: id string
// cost: {type:'frag'|'ess', amt:N}
// effect: human-readable description
const LAB_NODE_DEFS = [
  // ── 파편 트리 root ──
  { id:'froot', t:'frag', parent:null, ico:'🌱', name:'생명의 씨앗', costType:null, costAmt:0,
    effect:'항상 해금되어 있습니다.' },
  // 생명력 계열
  { id:'hp1',  t:'frag', parent:'froot', ico:'🩸', name:'생명력 I',   costType:'frag', costAmt:4,  effect:'초기 개체 HP +10%' },
  { id:'hp2',  t:'frag', parent:'hp1',   ico:'🩸', name:'생명력 II',  costType:'frag', costAmt:8,  effect:'초기 개체 HP +20%' },
  { id:'hp3',  t:'frag', parent:'hp2',   ico:'🩸', name:'생명력 III', costType:'frag', costAmt:14, effect:'초기 개체 HP +35%' },
  { id:'hp4',  t:'frag', parent:'hp3',   ico:'🩸', name:'생명력 IV',  costType:'frag', costAmt:22, effect:'초기 개체 HP +55%' },
  { id:'hp5',  t:'frag', parent:'hp4',   ico:'🩸', name:'생명력 V',   costType:'frag', costAmt:34, effect:'초기 개체 HP +80%' },
  { id:'hb1',  t:'frag', parent:'hp3',   ico:'🌿', name:'혈통 I',    costType:'frag', costAmt:26, effect:'적 포섭 저항 +20%' },
  { id:'hb2',  t:'frag', parent:'hb1',   ico:'🌿', name:'혈통 II',   costType:'frag', costAmt:42, effect:'적 포섭 저항 +40%' },
  // 군집 계열
  { id:'pop1', t:'frag', parent:'froot', ico:'🌊', name:'군집 I',    costType:'frag', costAmt:3,  effect:'시작 개체 수 +1' },
  { id:'pop2', t:'frag', parent:'pop1',  ico:'🌊', name:'군집 II',   costType:'frag', costAmt:6,  effect:'시작 개체 수 +2' },
  { id:'pop3', t:'frag', parent:'pop2',  ico:'🌊', name:'군집 III',  costType:'frag', costAmt:11, effect:'시작 개체 수 +3' },
  { id:'pop4', t:'frag', parent:'pop3',  ico:'🌊', name:'군집 IV',   costType:'frag', costAmt:19, effect:'시작 개체 수 +5' },
  { id:'pop5', t:'frag', parent:'pop4',  ico:'🌊', name:'군집 V',    costType:'frag', costAmt:32, effect:'시작 개체 수 +7' },
  { id:'col1', t:'frag', parent:'pop3',  ico:'🍖', name:'채집 I',    costType:'frag', costAmt:16, effect:'채집 능력 +4' },
  { id:'col2', t:'frag', parent:'col1',  ico:'🍖', name:'채집 II',   costType:'frag', costAmt:28, effect:'채집 능력 +8' },
  { id:'col3', t:'frag', parent:'col2',  ico:'🍖', name:'채집 III',  costType:'frag', costAmt:46, effect:'채집 능력 +14' },
  // 번식 계열
  { id:'br1',  t:'frag', parent:'froot', ico:'🔥', name:'번식 I',    costType:'frag', costAmt:3,  effect:'번식 비용 -5%' },
  { id:'br2',  t:'frag', parent:'br1',   ico:'🔥', name:'번식 II',   costType:'frag', costAmt:7,  effect:'번식 비용 -10%' },
  { id:'br3',  t:'frag', parent:'br2',   ico:'🔥', name:'번식 III',  costType:'frag', costAmt:13, effect:'번식 비용 -18%' },
  { id:'tw1',  t:'frag', parent:'br3',   ico:'🥚', name:'쌍둥이 I',  costType:'frag', costAmt:22, effect:'번식 시 쌍둥이 확률 15%' },
  { id:'tw2',  t:'frag', parent:'tw1',   ico:'🥚', name:'쌍둥이 II', costType:'frag', costAmt:36, effect:'쌍둥이 확률 25%' },
  { id:'bs1',  t:'frag', parent:'br3',   ico:'🔥', name:'번식속도 I', costType:'frag', costAmt:20, effect:'번식 비용 -28%' },
  { id:'bs2',  t:'frag', parent:'bs1',   ico:'🔥', name:'번식속도 II',costType:'frag', costAmt:34, effect:'번식 비용 -40%' },
  // 전투력 계열
  { id:'bt1',  t:'frag', parent:'froot', ico:'⚔️', name:'전투력 I',  costType:'frag', costAmt:4,  effect:'기본 공격력 +3' },
  { id:'bt2',  t:'frag', parent:'bt1',   ico:'⚔️', name:'전투력 II', costType:'frag', costAmt:9,  effect:'기본 공격력 +6' },
  { id:'bt3',  t:'frag', parent:'bt2',   ico:'⚔️', name:'전투력 III',costType:'frag', costAmt:17, effect:'기본 공격력 +10' },
  { id:'bt4',  t:'frag', parent:'bt3',   ico:'⚔️', name:'전투력 IV', costType:'frag', costAmt:28, effect:'기본 공격력 +16' },
  { id:'bt5',  t:'frag', parent:'bt4',   ico:'⚔️', name:'전투력 V',  costType:'frag', costAmt:44, effect:'기본 공격력 +24' },
  { id:'rc1',  t:'frag', parent:'bt1',   ico:'🧲', name:'포섭 I',    costType:'frag', costAmt:8,  effect:'포섭 성공률 +5%' },
  { id:'rc2',  t:'frag', parent:'rc1',   ico:'🧲', name:'포섭 II',   costType:'frag', costAmt:16, effect:'포섭 성공률 +12%' },
  { id:'rc3',  t:'frag', parent:'rc2',   ico:'🧲', name:'포섭 III',  costType:'frag', costAmt:28, effect:'포섭 성공률 +20%' },
  { id:'rc4',  t:'frag', parent:'rc3',   ico:'🧲', name:'포섭 IV',   costType:'frag', costAmt:46, effect:'포섭 성공률 +30%' },
  // 군집한계 계열 (최대 개체 수 증가)
  { id:'cap1', t:'frag', parent:'froot', ico:'🏟️', name:'군집한계 I',  costType:'frag', costAmt:8,  effect:'최대 개체 수 +10 (→110)' },
  { id:'cap2', t:'frag', parent:'cap1',  ico:'🏟️', name:'군집한계 II', costType:'frag', costAmt:18, effect:'최대 개체 수 +20 (→130)' },
  { id:'cap3', t:'frag', parent:'cap2',  ico:'🏟️', name:'군집한계 III',costType:'frag', costAmt:32, effect:'최대 개체 수 +35 (→165)' },
  { id:'cap4', t:'frag', parent:'cap3',  ico:'🏟️', name:'군집한계 IV', costType:'frag', costAmt:52, effect:'최대 개체 수 +55 (→220)' },
  { id:'cap5', t:'frag', parent:'cap4',  ico:'🏟️', name:'군집한계 V',  costType:'frag', costAmt:80, effect:'최대 개체 수 +80 (→300)' },

  // ── 정수 트리 root ──
  { id:'eroot', t:'ess', parent:null, ico:'👁️', name:'진화의 눈', costType:null, costAmt:0,
    effect:'항상 해금되어 있습니다.' },
  // 생존 계열
  { id:'sur1', t:'ess', parent:'eroot', ico:'⏰', name:'생존 I',   costType:'ess', costAmt:1,  effect:'운석 타이머 +20초' },
  { id:'sur2', t:'ess', parent:'sur1',  ico:'⏰', name:'생존 II',  costType:'ess', costAmt:2,  effect:'운석 타이머 +40초' },
  { id:'sur3', t:'ess', parent:'sur2',  ico:'⏰', name:'생존 III', costType:'ess', costAmt:4,  effect:'운석 타이머 +65초' },
  { id:'sur4', t:'ess', parent:'sur3',  ico:'⏰', name:'생존 IV',  costType:'ess', costAmt:8,  effect:'운석 타이머 +95초' },
  { id:'sur5', t:'ess', parent:'sur4',  ico:'⏰', name:'생존 V',   costType:'ess', costAmt:14, effect:'운석 타이머 +130초' },
  // 유전자 계열
  { id:'gen1', t:'ess', parent:'eroot', ico:'⭐', name:'유전자 I',  costType:'ess', costAmt:1,  effect:'시작 시 우성 유전자 1개 선택' },
  { id:'gen2', t:'ess', parent:'gen1',  ico:'⭐', name:'유전자 II', costType:'ess', costAmt:2,  effect:'시작 시 우성 유전자 2개 선택' },
  { id:'gen3', t:'ess', parent:'gen2',  ico:'⭐', name:'유전자 III',costType:'ess', costAmt:5,  effect:'시작 시 우성 유전자 3개 선택' },
  { id:'gen4', t:'ess', parent:'gen3',  ico:'⭐', name:'유전자 IV', costType:'ess', costAmt:10, effect:'보스 요구 유전자 +20초 먼저 공개' },
  { id:'gp1',  t:'ess', parent:'gen1',  ico:'🔮', name:'보스 예지', costType:'ess', costAmt:3,  effect:'보스 경고 시 요구 유전자 타입 표시' },
  { id:'gp2',  t:'ess', parent:'gp1',   ico:'🔮', name:'예지 II',   costType:'ess', costAmt:8,  effect:'보스 등장 30초 전 카운트다운 표시' },
  // 보스저항 계열
  { id:'bos1', t:'ess', parent:'eroot', ico:'🛡️', name:'보스저항 I', costType:'ess', costAmt:1,  effect:'안전 개체 즉사 면역' },
  { id:'bos2', t:'ess', parent:'bos1',  ico:'🛡️', name:'저항 II',   costType:'ess', costAmt:3,  effect:'패배 시 30% 확률로 포획 개체 귀환' },
  { id:'bos3', t:'ess', parent:'bos2',  ico:'🛡️', name:'저항 III',  costType:'ess', costAmt:6,  effect:'보스 피해 -50%' },
  { id:'bos4', t:'ess', parent:'bos3',  ico:'🛡️', name:'저항 IV',   costType:'ess', costAmt:11, effect:'보스 처치 시 전 개체 HP +30%' },
  { id:'bos5', t:'ess', parent:'bos4',  ico:'🛡️', name:'저항 V',    costType:'ess', costAmt:20, effect:'안전하지 않은 개체 2마리 이상 필요' },
  // 선택적 진화 계열
  { id:'evo1',  t:'ess', parent:'eroot', ico:'🧬', name:'선택적 진화', costType:'ess', costAmt:1,  effect:'진화 선택지 확장 + 유전 분석 계열 해금' },
  { id:'pick1', t:'ess', parent:'evo1',  ico:'🎲', name:'선택 I',    costType:'ess', costAmt:1,  effect:'진화 선택지 4개' },
  { id:'pick2', t:'ess', parent:'pick1', ico:'🎲', name:'선택 II',   costType:'ess', costAmt:2,  effect:'진화 선택지 5개' },
  { id:'pick3', t:'ess', parent:'pick2', ico:'🎲', name:'선택 III',  costType:'ess', costAmt:5,  effect:'진화 선택지 6개' },
  { id:'pick4', t:'ess', parent:'pick3', ico:'🎲', name:'선택 IV',   costType:'ess', costAmt:10, effect:'진화 선택지 7개' },
  { id:'vis1',  t:'ess', parent:'evo1',  ico:'🔬', name:'유전 분석 I',  costType:'ess', costAmt:2,  effect:'현황판에 대립유전자 빈도 표시 (5종 비율 바)' },
  { id:'vis2',  t:'ess', parent:'vis1',  ico:'🔬', name:'유전 분석 II', costType:'ess', costAmt:5,  effect:'유전자형 분포 추가 표시 (동형·이형접합 비율)' },
  { id:'vis3',  t:'ess', parent:'vis2',  ico:'🔬', name:'유전 분석 III', costType:'ess', costAmt:10, effect:'결과 화면에서 대립유전자 변화 그래프 해금' },
  // 게임 속도 계열
  { id:'spd1', t:'ess', parent:'eroot', ico:'⚡', name:'가속 I',  costType:'ess', costAmt:2,  effect:'설정에서 1.5× 속도 토글 해금' },
  { id:'spd2', t:'ess', parent:'spd1',  ico:'⚡', name:'가속 II', costType:'ess', costAmt:6,  effect:'설정에서 2× 속도 토글 해금' },

  // ── 특수 이벤트 계열 (정수) ──
  { id:'event1', t:'ess', parent:'eroot', ico:'🎭', name:'이벤트 해금 I',  costType:'ess', costAmt:2, effect:'게임 중 "풍요의 봄" 이벤트 발생 (식량 +150)' },
  { id:'event2', t:'ess', parent:'event1',ico:'🎭', name:'이벤트 해금 II', costType:'ess', costAmt:5, effect:'"돌연변이 폭풍" 이벤트 발생 (전 개체 돌연변이 발생률 3배 30초)' },
  { id:'event3', t:'ess', parent:'event2',ico:'🎭', name:'이벤트 해금 III',costType:'ess', costAmt:10,effect:'"긴급 피난" 이벤트 발생 (보스 등장 시 즉시 안전 지형으로 텔레포트)' },

  // ── 무한모드 해금 계열 (정수) ──
  { id:'inf1', t:'ess', parent:'eroot', ico:'♾️', name:'무한 생존 I', costType:'ess', costAmt:3, effect:'제목 화면에서 무한 생존 모드 해금 (운석 없음, 보스 무한 출현)' },
  { id:'inf2', t:'ess', parent:'inf1',  ico:'♾️', name:'무한 생존 II',costType:'ess', costAmt:8, effect:'무한 모드 보스 HP 증가 속도 -25% (더 오래 생존 가능)' },

  // ── 파편 트리 새 계열: 돌연변이 촉진 ──
  { id:'mut1', t:'frag', parent:'froot', ico:'🔬', name:'진화 촉진 I',   costType:'frag', costAmt:10, effect:'기본 돌연변이 발생률 +2%' },
  { id:'mut2', t:'frag', parent:'mut1',  ico:'🔬', name:'진화 촉진 II',  costType:'frag', costAmt:22, effect:'기본 돌연변이 발생률 +4% (누적)' },
  { id:'mut3', t:'frag', parent:'mut2',  ico:'🔬', name:'진화 촉진 III', costType:'frag', costAmt:42, effect:'기본 돌연변이 발생률 +7% (누적)' },
  { id:'mutsel', t:'frag', parent:'mut1', ico:'🎯', name:'돌연변이 선별', costType:'frag', costAmt:26, effect:'번식 돌연변이 발생 시 3택1 선택창 해금 (미보유 시 무작위 발현)' },

  // ── 파편 트리 새 계열: 식량 효율 ──
  { id:'food1', t:'frag', parent:'froot', ico:'🍖', name:'대사 효율 I',  costType:'frag', costAmt:8,  effect:'집단 식량 소비 -8%' },
  { id:'food2', t:'frag', parent:'food1', ico:'🍖', name:'대사 효율 II', costType:'frag', costAmt:18, effect:'집단 식량 소비 -16% (누적)' },
  { id:'food3', t:'frag', parent:'food2', ico:'🍖', name:'대사 효율 III',costType:'frag', costAmt:35, effect:'집단 식량 소비 -25% (누적)' },
];

// Build lookup map
const LAB_NODE_MAP = {};
for (const n of LAB_NODE_DEFS) LAB_NODE_MAP[n.id] = n;

// ── localStorage helpers ────────────────────────────
function labGetFrag()  { const n = parseInt(Save.get('gpa_frag') || '0', 10); return Number.isFinite(n) ? n : 0; }
function labGetEss()   { const n = parseInt(Save.get('gpa_ess')  || '0', 10); return Number.isFinite(n) ? n : 0; }
function labGetOwned() {
  // 저장 데이터가 손상돼 배열이 아니면 빈 배열로 복구
  // (여기서 배열이 아닌 값이 나오면 computeLabBuffs()의 new Set()이 최상위에서 던져 게임 전체가 부팅 불가)
  try {
    const v = JSON.parse(Save.get('gpa_lab_purchased') || '[]');
    return Array.isArray(v) ? v : [];
  }
  catch(e){ return []; }
}
function labSaveOwned(arr) { Save.set('gpa_lab_purchased', JSON.stringify(arr)); }

// ── Compute LAB_BUFFS from purchased nodes ──────────
let LAB_BUFFS = {};
function computeLabBuffs() {
  const owned = new Set(labGetOwned());
  const has = id => owned.has(id);
  LAB_BUFFS = {
    hpMult:        1 + (has('hp1')?0.10:0) + (has('hp2')?0.20:0) + (has('hp3')?0.35:0) + (has('hp4')?0.55:0) + (has('hp5')?0.80:0),
    extraPop:      (has('pop1')?1:0) + (has('pop2')?2:0) + (has('pop3')?3:0) + (has('pop4')?5:0) + (has('pop5')?7:0),
    gatherBonus:   (has('col1')?4:0) + (has('col2')?8:0) + (has('col3')?14:0),
    attackBonus:   (has('bt1')?3:0) + (has('bt2')?6:0) + (has('bt3')?10:0) + (has('bt4')?16:0) + (has('bt5')?24:0),
    recruitBonus:  (has('rc1')?0.05:0) + (has('rc2')?0.12:0) + (has('rc3')?0.20:0) + (has('rc4')?0.30:0),
    resistBonus:   (has('hb1')?0.20:0) + (has('hb2')?0.40:0),
    breedCostMult: 1 * (has('br1')?0.95:1) * (has('br2')?0.90:1) * (has('br3')?0.82:1)
                     * (has('bs1')?0.72/0.82:1) * (has('bs2')?0.60/0.72:1),
    twinChance:    has('tw2') ? 0.25 : has('tw1') ? 0.15 : 0,
    meteorBonus:   (has('sur1')?20000:0) + (has('sur2')?40000:0) + (has('sur3')?65000:0)
                 + (has('sur4')?95000:0) + (has('sur5')?130000:0),
    chosenGenes:   has('gen3') ? 3 : has('gen2') ? 2 : has('gen1') ? 1 : 0,
    bossEarlyReveal: has('gen4'),
    bossWarnEarly:   has('gp2'),
    bossShowGeneType:has('gp1'),
    bossResist1:   has('bos1'),
    captureReturn: has('bos2') ? 0.30 : 0,
    bossDmgHalf:   has('bos3'),
    bossHealOnKill:has('bos4'),
    bossHarderThreshold: has('bos5'),
    mutationEnabled: has('evo1'),
    mutationChoices: has('pick4')?7 : has('pick3')?6 : has('pick2')?5 : has('pick1')?4 : 0,
    geneVisLevel: has('vis3')?3 : has('vis2')?2 : has('vis1')?1 : 0,
    maxPopBonus: (has('cap1')?10:0) + (has('cap2')?20:0) + (has('cap3')?35:0) + (has('cap4')?55:0) + (has('cap5')?80:0),
    gameSpeedUnlock: has('spd2') ? 2 : has('spd1') ? 1.5 : 0,
    // 새 계열
    specialEvents: has('event3') ? 3 : has('event2') ? 2 : has('event1') ? 1 : 0,
    infiniteMode:  has('inf1'),
    infiniteBossSlowdown: has('inf2') ? 0.75 : 1.0,
    mutRateBonus:  (has('mut1')?0.02:0) + (has('mut2')?0.04:0) + (has('mut3')?0.07:0),
    breedMutPick:  has('mutsel'), // 번식 돌연변이 3택1 선택창 (미보유 시 무작위 발현)
    foodNeedMult:  1 * (has('food1')?0.92:1) * (has('food2')?0.84/0.92:1) * (has('food3')?0.75/0.84:1),
  };
}
computeLabBuffs();

// ── Tree layout algorithm ────────────────────────────
const LAB_NW=80, LAB_NH=52, LAB_GX=22, LAB_GY=46, LAB_SX=LAB_NW+LAB_GX, LAB_SY=LAB_NH+LAB_GY, LAB_PAD=16;

function _labBuildTree(type) {
  const nodes = LAB_NODE_DEFS.filter(n => n.t === type);
  const byId = {};
  for (const n of nodes) byId[n.id] = { ...n, children:[] };
  const roots = [];
  for (const n of nodes) {
    if (n.parent && byId[n.parent]) byId[n.parent].children.push(byId[n.id]);
    else roots.push(byId[n.id]);
  }
  return roots[0]; // single root per tree
}

function _labLeafCount(node) {
  return node.children.length === 0 ? 1 : node.children.reduce((s,c)=>s+_labLeafCount(c),0);
}
function _labMaxDepth(node, d=0) {
  return node.children.length === 0 ? d : Math.max(...node.children.map(c=>_labMaxDepth(c,d+1)));
}
function _labLayout(node, depth, leftX, maxD) {
  const leafs = _labLeafCount(node);
  node.cx = leftX + (leafs * LAB_SX - LAB_GX) / 2;
  node.x  = node.cx - LAB_NW / 2;
  node.y  = LAB_PAD + (maxD - depth) * LAB_SY;
  let cx = leftX;
  for (const c of node.children) { _labLayout(c, depth+1, cx, maxD); cx += _labLeafCount(c)*LAB_SX; }
}

function _labNodeState(id) {
  const owned = new Set(labGetOwned());
  owned.add('froot'); owned.add('eroot'); // roots are always owned
  if (owned.has(id)) return 'purchased';
  const node = LAB_NODE_MAP[id];
  if (node.parent && owned.has(node.parent)) return 'available';
  return 'locked';
}

function _labDrawEdges(svg, parent, depth) {
  for (const child of parent.children) {
    const x1=parent.cx, y1=parent.y;
    const x2=child.cx,  y2=child.y + LAB_NH;
    const dy = Math.abs(y2-y1), dx = x2-x1;
    const ctrl = dy*0.52, lean = Math.abs(dx)*0.15;
    const c1x = x1 + (dx>0 ? lean : -lean);
    const c2x = x2 + (dx>0 ? -lean : lean);
    const d = `M${x1},${y1} C${c1x},${y1-ctrl} ${c2x},${y2+ctrl} ${x2},${y2}`;
    const w = Math.max(1.2, 3.6 - depth*0.55);
    // shadow + main
    const shadow = document.createElementNS('http://www.w3.org/2000/svg','path');
    shadow.setAttribute('d',d); shadow.setAttribute('stroke','rgba(0,0,0,.18)');
    shadow.setAttribute('stroke-width',w+1.5); shadow.setAttribute('fill','none');
    shadow.setAttribute('stroke-linecap','round');
    svg.appendChild(shadow);
    const main = document.createElementNS('http://www.w3.org/2000/svg','path');
    main.setAttribute('d',d);
    const owned = _labNodeState(child.id) !== 'locked';
    main.setAttribute('stroke', owned ? '#9b6fc4' : '#a09ab8');
    main.setAttribute('stroke-width',w); main.setAttribute('fill','none');
    main.setAttribute('stroke-linecap','round');
    if (!owned) main.setAttribute('stroke-dasharray','5,4');
    svg.appendChild(main);
    _labDrawEdges(svg, child, depth+1);
  }
}

function renderLabTree(type) {
  const canvas = document.getElementById(`lab-canvas-${type}`);
  if (!canvas) return;
  canvas.innerHTML = '';

  const root = _labBuildTree(type);
  const maxD = _labMaxDepth(root);
  const totalLeafs = _labLeafCount(root);
  const W = totalLeafs * LAB_SX - LAB_GX + LAB_PAD*2;
  const H = (maxD+1) * LAB_SY + LAB_PAD*2;
  _labLayout(root, 0, LAB_PAD, maxD);

  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  // SVG branches
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('lab-branches');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  _labDrawEdges(svg, root, 0);
  canvas.appendChild(svg);

  // Nodes (DFS)
  const queue = [root];
  while (queue.length) {
    const node = queue.shift();
    const state = _labNodeState(node.id);
    const el = document.createElement('div');
    el.className = `lab-node ${state}`;
    el.style.left = node.x + 'px';
    el.style.top  = node.y + 'px';
    const isRoot = (node.id==='froot'||node.id==='eroot');
    const locked = state==='locked';
    const costHtml = node.costAmt > 0
      ? `<span class="lab-node-cost">${node.costType==='frag' ? labFc(node.costAmt) : labEc(node.costAmt)}</span>` : '';
    el.innerHTML = `<div class="lab-node-box">
      <span class="lab-node-ico">${locked ? '🔒' : node.ico}</span>
      <span class="lab-node-name">${locked ? '???' : node.name}</span>
    </div>${locked ? '' : costHtml}`;
    if (state === 'available') {
      el.onclick = () => openLabConfirm(node.id);
    }
    canvas.appendChild(el);
    for (const c of node.children) queue.push(c);
  }
}

// ── Lab screen open/close ────────────────────────────
let _labActiveTab = 'frag';
function openLab() {
  computeLabBuffs();
  document.getElementById('lab-modal').classList.add('open');
  _labUpdateCurrency();
  renderLabTree('frag');
  renderLabTree('ess');
  // Scroll each wrap to bottom-center after slideUp animation (0.32s) completes
  setTimeout(() => {
    ['frag','ess'].forEach(t => {
      const wrap = document.getElementById('lab-wrap-' + t);
      if (wrap) {
        wrap.scrollTop  = wrap.scrollHeight;
        wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2);
      }
    });
  }, 350);
}
function closeLab() {
  document.getElementById('lab-modal').classList.remove('open');
  _refreshTitleButtons();
}
function switchLabTab(type, btn) {
  _labActiveTab = type;
  document.querySelectorAll('.lab-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('lab-panel-frag').style.display = type==='frag' ? '' : 'none';
  document.getElementById('lab-panel-ess').style.display  = type==='ess'  ? '' : 'none';
}
function _labUpdateCurrency() {
  const f = labGetFrag(), e = labGetEss();
  document.getElementById('lab-frag-icon').innerHTML = labFicon(13);
  document.getElementById('lab-ess-icon').innerHTML  = labEicon(13);
  document.getElementById('lab-frag-count').textContent = f;
  document.getElementById('lab-ess-count').textContent  = e;
}

// ── Node purchase flow ───────────────────────────────
let _pendingBuyId = null;
function openLabConfirm(id) {
  const node = LAB_NODE_MAP[id];
  if (!node) return;
  _pendingBuyId = id;
  document.getElementById('lab-confirm-ico').textContent  = node.ico;
  document.getElementById('lab-confirm-name').textContent = node.name;
  document.getElementById('lab-confirm-desc').textContent = node.effect;
  document.getElementById('lab-confirm-cost').innerHTML =
    node.costType === 'frag' ? labFc(node.costAmt) : labEc(node.costAmt);
  document.getElementById('lab-confirm-msg').textContent = '';
  document.getElementById('lab-confirm').classList.add('open');
}
function closeLabConfirm() {
  document.getElementById('lab-confirm').classList.remove('open');
  _pendingBuyId = null;
}
function confirmBuyLabNode() {
  const id = _pendingBuyId;
  if (!id) return;
  const node = LAB_NODE_MAP[id];
  const frag = labGetFrag(), ess = labGetEss();
  const owned = labGetOwned();
  if (owned.includes(id)) { closeLabConfirm(); return; }
  if (node.costType==='frag' && frag < node.costAmt) {
    document.getElementById('lab-confirm-msg').textContent =
      `파편이 부족합니다. (보유: ${frag} / 필요: ${node.costAmt})`;
    return;
  }
  if (node.costType==='ess' && ess < node.costAmt) {
    document.getElementById('lab-confirm-msg').textContent =
      `정수가 부족합니다. (보유: ${ess} / 필요: ${node.costAmt})`;
    return;
  }
  if (node.costType==='frag') Save.set('gpa_frag', frag - node.costAmt);
  if (node.costType==='ess')  Save.set('gpa_ess',  ess  - node.costAmt);
  owned.push(id);
  labSaveOwned(owned);
  computeLabBuffs();
  closeLabConfirm();
  _labUpdateCurrency();
  renderLabTree(node.t);
}

// ── Mutation selection window ────────────────────────
let _mutPickResolve = null;
let _mutPickChild = null;

// (번식 돌연변이 선택창은 제거됨 — 번식 돌연변이는 무작위 자동 발현.
//  아래 선택창 UI는 레벨업 진화(showEvolutionPicker)에서만 사용)
function resolveMutationPick(chosenId) {
  document.getElementById('mutation-picker').classList.remove('open');
  if (_mutPickResolve) { _mutPickResolve(chosenId); _mutPickResolve = null; _mutPickChild = null; }
}

// 집단 보유율 배지 HTML — 이 돌연변이를 현재 몇 %의 개체가 발현 중인지
function mutOwnBadge(pct) {
  const p = Math.round(pct || 0);
  let col, bg;
  if (p >= 100)     { col = '#b5731c'; bg = 'rgba(251,191,36,.18)'; } // 완전 보급(금색)
  else if (p >= 50) { col = '#2a8a3a'; bg = 'rgba(34,197,94,.15)'; }  // 다수 보유(초록)
  else if (p >= 1)  { col = '#2a6fb0'; bg = 'rgba(59,130,246,.14)'; } // 일부 보유(파랑)
  else              { col = '#8a8296'; bg = 'rgba(140,130,150,.12)'; } // 미보유(회색)
  return `<span class="mut-own" style="color:${col};background:${bg};border-color:${col}">${p}%<small>집단 보유</small></span>`;
}

// ── 레벨업 진화 선택창 — 돌연변이 선택창 UI를 재사용하되 집단 전체에 발현 ──
function showEvolutionPicker(scene) {
  const nChoices = Math.max(EVO_CHOICES_BASE, LAB_BUFFS.mutationChoices || 0);
  const candidates = rollEvolutionCandidates(scene.player, nChoices);
  if (!candidates.length) {
    // 모든 형질 보편화(극후반): 식량 보상으로 대체
    scene.player.food = Math.min(FOOD_CAP, scene.player.food + 150);
    scene.showToast('🧬 완전 진화! +150 식량', 'ach');
    return false;
  }
  const titleEl = document.getElementById('mutation-picker-title');
  if (titleEl) titleEl.textContent = `✨ 집단 진화! (Lv.${scene.evoLevel} → Lv.${scene.evoLevel + 1})`;
  document.getElementById('mutation-picker-sub').textContent = '선택한 형질이 집단 전체에 발현됩니다.';
  document.getElementById('mutation-skip-btn').style.display = 'none';

  const _mutIco = { good:'✅', dual:'🔵', bad:'❌' };
  const _effDesc = (effects) => Object.entries(effects || {}).map(([k, v]) => {
    const labels = { hp:'HP', attack:'공격', defense:'방어', speed:'속도', gather:'채집', charm:'매력', foodNeed:'식량소모', fertility:'번식력', mutationRate:'돌연변이율' };
    return `${labels[k] || k} ${v > 0 ? '+' : ''}${v}`;
  }).join(' · ');
  // 다음 보스 안전조건에 도움이 되면 배지 표시
  const nextBoss = (() => {
    if (scene.bossPhase !== 'idle') return scene.activeBoss;
    if (!scene._waveList || scene._waveIdx >= scene._waveList.length) return null;
    return bossById(scene._waveList[scene._waveIdx]);
  })();
  const rep = scene.player.individuals.find(i => !i.dead);
  const _ownFreq = scene.player.mutationFrequency();
  document.getElementById('mutation-picker-options').innerHTML = candidates.map(mid => {
    const m = mutationById(mid);
    const helpsBoss = nextBoss && rep && (() => {
      try {
        const fake = { mutations: [...(rep.mutations || []), mid], stats: rep.stats, genes: rep.genes, mutationGenes: rep.mutationGenes };
        return nextBoss.safe(fake) && !nextBoss.safe(rep);
      } catch (e) { return false; }
    })();
    const badge = helpsBoss ? `<span style="display:inline-block;margin-left:6px;font-size:10px;padding:2px 7px;border-radius:999px;background:rgba(251,191,36,.18);border:1.5px solid #fbbf24;color:#b45309;font-weight:900">${nextBoss.ico} 보스 대비</span>` : '';
    return `<div class="mut-pick-option" onclick="resolveMutationPick('${mid}')">
      <span class="mut-ico">${_mutIco[m.type] || '🧬'}</span>
      <div class="mut-info">
        <div class="mut-name">${m.name}${badge}</div>
        <div class="mut-desc">${_effDesc(m.effects)}</div>
      </div>
      ${mutOwnBadge(_ownFreq[mid] || 0)}
    </div>`;
  }).join('');

  _mutPickResolve = (chosenId) => {
    if (chosenId) {
      scene._applyEvolution(chosenId);
    } else {
      // Esc 등으로 닫힘 — 게이지는 그대로, 다음 틱에 다시 열림
      scene._evoPickerQueued = true;
    }
    if (!_paused) scene.scene.resume();
  };
  document.getElementById('mutation-picker').classList.add('open');
  scene.scene.pause();
  return true;
}

// ── 번식 돌연변이 선택창 — 자손의 신규 돌연변이 정체를 플레이어가 3택1로 결정 ──
// (기본값은 무작위 발현. 계통수 [돌연변이 선별](mutsel) 구매 시에만 이 창이 열리며,
//  건너뛰기 = 무작위 발현. 설정의 [번식 돌연변이 선택창] 토글(gpa_breedpick_off)로 끌 수 있음.)
function showBreedMutationPicker(scene, children) {
  const owned = new Set();
  for (const c of children) for (const id of c.mutations) owned.add(id);
  const pool = MUTATIONS.filter(m => !owned.has(m.id)).map(m => m.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const candidates = pool.slice(0, 3);
  if (!candidates.length) { scene._applyBreedMutation(children, null); return; }

  const titleEl = document.getElementById('mutation-picker-title');
  if (titleEl) titleEl.textContent = '🧬 신생 돌연변이 선택';
  document.getElementById('mutation-picker-sub').textContent =
    `돌연변이를 가진 자손 ${children.length}마리가 태어났어요. 발현할 형질을 고르세요.`;
  const skipBtn = document.getElementById('mutation-skip-btn');
  skipBtn.style.display = '';
  skipBtn.textContent = '🎲 무작위 발현';

  const _mutIco = { good: '✅', dual: '🔵', bad: '❌' };
  const _effDesc = (effects) => Object.entries(effects || {}).map(([k, v]) => {
    const labels = { hp:'HP', attack:'공격', defense:'방어', speed:'속도', gather:'채집', charm:'매력', foodNeed:'식량소모', fertility:'번식력', mutationRate:'돌연변이율' };
    return `${labels[k] || k} ${v > 0 ? '+' : ''}${v}`;
  }).join(' · ');
  const _ownFreq = scene.player.mutationFrequency();
  document.getElementById('mutation-picker-options').innerHTML = candidates.map(mid => {
    const m = mutationById(mid);
    return `<div class="mut-pick-option" onclick="resolveMutationPick('${mid}')">
      <span class="mut-ico">${_mutIco[m.type] || '🧬'}</span>
      <div class="mut-info">
        <div class="mut-name">${m.name}</div>
        <div class="mut-desc">${_effDesc(m.effects)}</div>
      </div>
      ${mutOwnBadge(_ownFreq[mid] || 0)}
    </div>`;
  }).join('');

  _mutPickResolve = (chosenId) => {
    scene._applyBreedMutation(children, chosenId);
    if (!_paused) scene.scene.resume();
  };
  document.getElementById('mutation-picker').classList.add('open');
  scene.scene.pause();
}

const WORLD_W = 5000;
const WORLD_H = 5000;
const TILE = 80;
const START_INDIVIDUALS = 20;

