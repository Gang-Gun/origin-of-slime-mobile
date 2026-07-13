'use strict';
// ── 난이도 시스템 ──────────────────────────────────
const DIFFICULTIES = [
  { id:'normal', name:'일반',   ico:'🌱', desc:'기본 게임 환경.\n이벤트·보스 강도 표준.',
    bossHpMult:1,    cdMult:1,    startPop:0,   extraEnemies:0,
    aiGeneQuality:'e', aiMutExtra:0, bossSpecialMult:1 },
  { id:'hard',   name:'어려움', ico:'🔥', desc:'보스 HP 1.6배.\n이벤트 쿨타임 -30%.\n보스 특수 패턴 빈도 +25%.\n시작 개체 -4.\nAI 집단 강화.',
    bossHpMult:1.6,  cdMult:0.7,  startPop:-4,  extraEnemies:2,
    aiGeneQuality:'n', aiMutExtra:1, bossSpecialMult:0.8 },
  { id:'hell',   name:'지옥',   ico:'💀', desc:'보스 HP 2.5배.\n이벤트 쿨타임 -50%.\n보스 특수 패턴 빈도 +55%.\n시작 개체 -8.\nAI 집단 대폭 강화.',
    bossHpMult:2.5,  cdMult:0.5,  startPop:-8,  extraEnemies:4,
    aiGeneQuality:'h', aiMutExtra:2, bossSpecialMult:0.65 },
  { id:'abyss',  name:'심연',   ico:'🌑', desc:'보스 HP 4배.\n이벤트 쿨타임 -65%.\n보스 특수 패턴 빈도 2배.\n시작 개체 -12.\nAI 집단 극한 강화.',
    bossHpMult:4,    cdMult:0.35, startPop:-12, extraEnemies:6,
    aiGeneQuality:'h', aiMutExtra:3, bossSpecialMult:0.5 },
];
let CURRENT_DIFFICULTY = 0; // 0~3, startGame()에서 설정
let GAME_MODE = 'normal'; // 'normal' | 'infinite'
function getMaxUnlockedDiff() {
  return Math.min(3, parseInt(Save.get('gpa_diff_max') || '0', 10));
}
function unlockNextDiff(current) {
  const next = current + 1;
  if (next <= 3 && next > getMaxUnlockedDiff()) {
    Save.set('gpa_diff_max', String(next));
    return DIFFICULTIES[next]; // 새로 해금된 난이도 반환
  }
  return null;
}
function getDiffConfig() { return DIFFICULTIES[CURRENT_DIFFICULTY]; }
const START_FOOD = 30;
const FOOD_CAP = 9999;
const TARGET_POPULATION = 50;
const STARVATION_DEFICIT_DIVISOR = 3;
const MUTATION_EFFECT_MULTIPLIER = 2.5;
const MAX_NEW_MUTATIONS_PER_CHILD = 2;
const BODY_COLOR_RED = 0xef4444;
const BODY_COLOR_BLUE = 0x3b82f6;
const BODY_COLOR_PURPLE = 0xa855f7;
// 색맹 모드 팔레트 (주황/청록/노랑 — 적록색맹 구분 가능)
const MAX_INDIVIDUALS = 100;
const MAX_BATTLE_INDIVIDUALS = 30;
const MAX_RECRUIT_PER_BATTLE = 3;
const BREED_COST = 10;
const SURVIVAL_INTERVAL = 10000;
const FOOD_INTERVAL = 6500;
const DANGER_WARN_MS       = 7000;  // 경고 단계 7초 — 예고 메시지·노란 점멸
const DANGER_ACTIVE_MS     = 15000; // 도태 이벤트 활성 단계 15초 (점진적 도태)
const DANGER_FOOD_ACTIVE_MS = 3000; // 식량 이벤트 활성 단계 3초 (결과 표시 후 종료)
const DANGER_KILL_INTERVAL = 2500;  // 도태 간격: 2.5초마다 틱
const DANGER_CD_MIN     = 35000;  // 쿨타임 최소 35초 (지형 이벤트 빈도 완화)
const DANGER_CD_MAX     = 60000;  // 쿨타임 최대 60초
const METEOR_TIME = 600000;   // 10분 후 운석 멸종
const METEOR_WARN_TIME = 585000; // 9분 45초 경고 시작
const BATTLE_DISTANCE = 155;
const BATTLE_DURATION = 8000;        // AI끼리의 전투 자동 종료 시간 (플레이어 전투는 거리 이탈로만 종료)
const ATTACK_COOLDOWN = 400;         // 보스전 등 기본 공격 주기
const BATTLE_ATTACK_COOLDOWN = 700;  // 집단전 전용 공격 주기 — 전투 시간을 늘려 스킬·위치 선정 여지 확보
// ── 실시간 액션 전투 ──────────────────────────────────
const BATTLE_MELEE_RANGE = 54;       // 이 거리 안에서만 타격 (거리를 벌리면 피해 없음 — 카이팅 가능)
const BATTLE_DISENGAGE_DIST = 430;   // 집단 중심이 이만큼 멀어지면 전투 이탈 (자유 후퇴)
const BATTLE_LEASH_DIST = 250;       // 전투 중 개체가 집단 중심에서 이 이상 떨어지면 복귀 (플레이어 이동 = 부대 지휘)
const BATTLE_PURSUIT_SPEED = 148;    // 전투 중 적 집단 추격 기준 속도 (플레이어 기본 165보다 느림 — 속도 유전자로 격차)
const CRIT_CHANCE = 0.12;
const CRIT_MULT = 1.8;
const KNOCKBACK_PX = 13;
const COMBO_WINDOW = 3000;           // 처치 후 이 시간 안에 또 처치하면 콤보 지속
const COMBO_DMG_PER_STACK = 0.03;    // 콤보당 피해 +3%
const COMBO_DMG_CAP = 0.6;           // 콤보 피해 보너스 상한 +60%
// 전투 스킬은 돌연변이가 만든다 — 집단에 해당 계열 돌연변이 보유 개체가 1마리 이상 있어야 해금.
// 보유 개체 비율이 높을수록 효과가 강해진다 (0% 기준 효과 × 1.0 ~ 100% 기준 × 1.5).
const COMBAT_SKILLS = {
  onslaught: { ico: '⚔️', name: '돌격', desc: '5초간 공격력·공격 속도 증가', dur: 5000, cd: 12000, key: 'Z',
    muts: ['strong_jaw', 'crab_claw', 'oversized_claw', 'adrenal_gland', 'sticky_slime', 'large_body'] },
  rally:     { ico: '🛡️', name: '철벽', desc: '5초간 받는 피해 -50%', dur: 5000, cd: 15000, key: 'X',
    muts: ['hard_shell', 'chitin_layer', 'thick_fur', 'barbed_shell', 'armored_tail', 'molting', 'burrowing', 'deep_roots'] },
  burst:     { ico: '💥', name: '독액 폭발', desc: '주변 적 전체 피해 + 넉백 (보스 유효)', dur: 0, cd: 18000, key: 'C',
    muts: ['poison_gland', 'acid_spit', 'venomous_bite', 'toxic_skin', 'parasite_spore', 'unstable_dna'] },
  heal:      { ico: '💗', name: '재생', desc: '집단 전체 HP 즉시 회복', dur: 0, cd: 20000, key: 'V',
    muts: ['regeneration', 'rapid_healing', 'vital_core', 'symbiotic_algae', 'solar_skin'] },
  haste:     { ico: '⚡', name: '질주', desc: '4초간 이동 속도 +50%', dur: 4000, cd: 14000, key: 'R',
    muts: ['fast_legs', 'spring_legs', 'hyper_metab', 'echolocation', 'night_vision', 'sixth_sense', 'keen_eyes'] },
  fear:      { ico: '😱', name: '위협', desc: '적을 밀쳐내고 4초간 적 공격 속도 -50%', dur: 4000, cd: 16000, key: 'T',
    muts: ['pheromone', 'bright_pattern', 'biolumin', 'mimic_pattern', 'magnetism', 'giant_antennae', 'swarm_body'] },
};
// 스킬 해금 여부: 살아있는 개체 중 계열 돌연변이 발현 개체 수
function combatSkillCarriers(group, skillId) {
  const def = COMBAT_SKILLS[skillId];
  if (!def) return 0;
  let n = 0;
  for (const ind of group.individuals) {
    if (ind.dead) continue;
    const muts = ind.mutations;
    if (def.muts.some(id => muts.includes(id))) n += 1;
  }
  return n;
}
// 스킬 요구 돌연변이 이름 목록 (잠금 안내용)
function combatSkillReqText(skillId) {
  const def = COMBAT_SKILLS[skillId];
  return def.muts.map(id => (mutationById(id) || {}).name).filter(Boolean).join(', ');
}
// ── 이동 방식별 스킬 단축키 ──────────────────────────
// WASD 모드(왼손 이동): 스킬은 숫자열 1~6 / 마우스 모드(오른손 이동): 스킬은 QWERTY 열
// 기본값·사용자 변경분은 js/keymap.js(KEYMAP)가 관리 — 옵션 > 키 설정에서 리바인딩
const SKILL_KEYMAP = {
  get wasd()  { return KEYMAP.wasd; },
  get mouse() { return KEYMAP.mouse; },
};
const SKILL_ORDER = ['onslaught', 'rally', 'burst', 'heal', 'haste', 'fear'];
// 현재 이동 방식에서 해당 스킬의 단축키
function skillKeyFor(id) { return (SKILL_KEYMAP[getMoveMode()] || SKILL_KEYMAP.wasd)[id] || ''; }
// 눌린 키 → 현재 이동 방식에서 매핑된 스킬 id (없으면 null)
function skillForKey(rawKey) {
  if (typeof _keyCapture !== 'undefined' && _keyCapture) return null; // 키 설정 캡처 중
  const k = rawKey && rawKey.length === 1 ? rawKey.toUpperCase() : rawKey;
  const map = SKILL_KEYMAP[getMoveMode()] || SKILL_KEYMAP.wasd;
  for (const id of SKILL_ORDER) if (map[id] === k) return id;
  return null;
}
// 스킬 버튼 좌상단 키 배지를 현재 이동 방식에 맞게 갱신
function refreshSkillKeyBadges() {
  for (const id of SKILL_ORDER) {
    const badge = document.querySelector(`#sk-${id} .sk-key`);
    if (badge) badge.textContent = skillKeyFor(id);
  }
}
const FOLLOW_RADIUS = 78;
const COLLECT_RADIUS = 72;

// 파스텔 톤 지형 (밝고 부드러운 자연 색감)
const TERRAIN = {
  plain:   { id: 'plain',   name: '초원',    ico:'🌿', color: 0x9ed98f, dark: 0x86c977, food: 1.0,  speed: 1.0 },
  forest:  { id: 'forest',  name: '숲',      ico:'🌳', color: 0x6fc06a, dark: 0x56a857, food: 1.35, speed: 0.9 },
  desert:  { id: 'desert',  name: '사막',    ico:'🏜️', color: 0xf3d9a0, dark: 0xe6c483, food: 0.65, speed: 1.08 },
  volcano: { id: 'volcano', name: '화산지대', ico:'🌋', color: 0xe8927c, dark: 0xd97a64, food: 1.05, speed: 0.82, damage: 2 },
  snow:    { id: 'snow',    name: '눈밭',    ico:'❄️', color: 0xeaf2fb, dark: 0xd2e2f2, food: 0.82, speed: 0.75 },
  river:   { id: 'river',   name: '강가',    ico:'💧', color: 0x8ecfe8, dark: 0x6fb8d8, food: 1.05, speed: 0.95 },
  swamp:   { id: 'swamp',   name: '독성 늪',  ico:'🐸', color: 0xb87fd4, dark: 0x9460b8, food: 0.88, speed: 0.65, damage: 3 }
};
const TERRAIN_LIST = Object.values(TERRAIN);

// ── 보스 위협 시스템 ─────────────────────────────────
const BOSS_WARN_TIME = 60000;       // 경고 카운트다운 60초
const BOSS_RETREAT_TIME = 90000;    // 중간보스 퇴각 제한 90초
const BOSS_RANGE = 240;             // 보스 공격범위(거리)
const BOSS_MIN_POP = 3;             // 이 미만으로 떨어지면 게임오버
const BOSS_ATK_CD = 800;            // 보스 공격 쿨다운(ms)
const BOSS_DEFENSE = 5;             // 보스 방어력 (일반 개체 defense 스케일)
const BOSS_ATK_STAT = 40;           // 보스 공격력 (일반 개체 attack 스케일)

const BOSS_ROSTER = [
  // 단일 조건 6 — 돌연변이 보유 또는 능력치 충족 시 안전
  { id:'lava',   name:'용암 거인',   ico:'🔥', reqText:'붉은색 몸·단단한 껍질·재생 능력', refuge:'volcano', refugeText:'🌋 화산',
    safe:i=> getGenotypeLabel(i,'color')==='RR' || (i.mutations||[]).includes('hard_shell') || (i.mutations||[]).includes('regeneration') },
  { id:'sand',   name:'모래 폭군',   ico:'🏜️', reqText:'파란색 몸·빠른 다리·작은 몸집',  refuge:'desert',  refugeText:'🏜️ 사막',
    safe:i=> getGenotypeLabel(i,'color')==='BB' || (i.mutations||[]).includes('fast_legs') || (i.mutations||[]).includes('small_body') },
  { id:'glacier',name:'빙하 군주',   ico:'❄️', reqText:'단단한 껍질·큰 몸집·재생 능력 / 방어 10 이상', refuge:'snow', refugeText:'❄️ 눈밭',
    safe:i=> (i.mutations||[]).includes('hard_shell') || (i.mutations||[]).includes('large_body') || (i.mutations||[]).includes('regeneration') || i.stats.defense > 10 },
  { id:'spore',  name:'독포자 마수', ico:'☠️', reqText:'독성 분비·재생 능력 / 공격력 20 이상',    refuge:'swamp',   refugeText:'🐸 독성늪',
    safe:i=> (i.mutations||[]).includes('poison_gland') || (i.mutations||[]).includes('regeneration') || i.stats.attack > 20 },
  { id:'gale',   name:'질풍 추적자', ico:'💨', reqText:'빠른 다리·작은 몸집 / 속도 105 이상',    refuge:'river',   refugeText:'💧 강가',
    safe:i=> (i.mutations||[]).includes('fast_legs') || (i.mutations||[]).includes('small_body') || i.stats.speed > 105 },
  { id:'charmer',name:'매혹 포식자', ico:'💗', reqText:'지배 페로몬·화려한 무늬 / 매력 18 이상', refuge:'forest', refugeText:'🌳 숲',
    safe:i=> (i.mutations||[]).includes('pheromone') || (i.mutations||[]).includes('bright_pattern') || i.stats.charm > 18 },
  // 복합 조건 3 — 두 조건 동시 충족
  { id:'steel',  name:'강철 질주병', ico:'🛡️', reqText:'(단단한 껍질·방어 10↑) + (빠른 다리·속도 100↑)', refuge:'snow', refugeText:'❄️ 눈밭',
    safe:i=> ((i.mutations||[]).includes('hard_shell')||i.stats.defense>10) && ((i.mutations||[]).includes('fast_legs')||i.stats.speed>100) },
  { id:'plague', name:'화염 역병룡', ico:'🐲', reqText:'붉은색 몸·재생 능력 + 독성 분비·독성 몸', refuge:'volcano', refugeText:'🌋 화산',
    safe:i=> (getGenotypeLabel(i,'color')==='RR'||(i.mutations||[]).includes('regeneration')) && (getGenotypeLabel(i,'poison')==='PP'||(i.mutations||[]).includes('poison_gland')) },
  { id:'siren',  name:'심연 세이렌', ico:'🌊', reqText:'파란색 몸·빠른 다리 + 지배 페로몬·화려한 무늬·매력 몸', refuge:'desert', refugeText:'🏜️ 사막',
    safe:i=> (getGenotypeLabel(i,'color')==='BB'||(i.mutations||[]).includes('fast_legs')) && (getGenotypeLabel(i,'charm')==='CC'||(i.mutations||[]).includes('pheromone')||(i.mutations||[]).includes('bright_pattern')) },
  // ── 추가 보스 5종 ──────────────────────────────────────────────────
  { id:'crystal',    name:'수정 군주',      ico:'💎', reqText:'단단한 껍질·두꺼운 털 / 방어 12 이상', refuge:'snow', refugeText:'❄️ 눈밭',
    safe:i=> (i.mutations||[]).includes('hard_shell') || (i.mutations||[]).includes('thick_fur') || i.stats.defense > 12 },
  { id:'vortex',     name:'소용돌이 폭풍',  ico:'🌀', reqText:'빠른 다리·야시증 / 속도 110 이상', refuge:'river', refugeText:'💧 강가',
    safe:i=> (i.mutations||[]).includes('fast_legs') || (i.mutations||[]).includes('night_vision') || i.stats.speed > 110 },
  { id:'void_shadow',name:'심연의 그림자',  ico:'🌑', reqText:'독성 분비·독성 이빨·산성 타액 / 공격 22 이상', refuge:'forest', refugeText:'🌳 숲',
    safe:i=> (i.mutations||[]).includes('poison_gland') || (i.mutations||[]).includes('venomous_bite') || (i.mutations||[]).includes('acid_spit') || i.stats.attack > 22 },
  { id:'ancient',    name:'고대 파수꾼',    ico:'🗿', reqText:'지배 페로몬·자기장 / 매력 20 이상', refuge:'plain', refugeText:'🌿 초원',
    safe:i=> (i.mutations||[]).includes('pheromone') || (i.mutations||[]).includes('magnetism') || i.stats.charm > 20 },
  { id:'leviathan',  name:'거대 리바이어던',ico:'🐋', reqText:'(재생 능력·두꺼운 털·HP 150↑) + (태양 피부·반향 탐지·수집 6↑)', refuge:'swamp', refugeText:'🐸 독성늪',
    safe:i=> ((i.mutations||[]).includes('regeneration')||(i.mutations||[]).includes('thick_fur')||i.stats.hp>150) &&
             ((i.mutations||[]).includes('solar_skin')||(i.mutations||[]).includes('echolocation')||i.stats.gather>6) },
  // 히든 — 황금 슬라임 (유전자 3종 이상이 100% 완전 고정된 적 있으면 최종 슬롯 대체)
  { id:'golden', name:'황금 슬라임', ico:'✨', hidden:true,
    spawnText:'돌연변이 3종 이상이 집단의 70% 이상에 보급된 런에서 최종 보스 대체(동시 충족 불필요)',
    reqText:'생존력(HP 140↑·재생·단단한 껍질) + 기동력(속도 100↑·빠른 다리·작은 몸집) + 방어력(방어 10↑·단단한 껍질·큰 몸집) + 공격력(공격 20↑·독성 분비·강한 턱) + 매력(매력 18↑·지배 페로몬·화려한 무늬) — 5가지 모두',
    refuge:'plain', refugeText:'🌿 초원 · 위 5가지 조건 전부 유지해야 생존',
    safe: i => {
      const mut = i.mutations || [];
      return (i.stats.hp > 140 || mut.includes('hard_shell') || mut.includes('regeneration')) &&
        (i.stats.speed > 100 || mut.includes('fast_legs') || mut.includes('small_body')) &&
        (i.stats.defense > 10 || mut.includes('hard_shell') || mut.includes('large_body')) &&
        (i.stats.attack > 20 || mut.includes('poison_gland') || mut.includes('strong_jaw')) &&
        (i.stats.charm > 18 || mut.includes('pheromone') || mut.includes('bright_pattern'));
    }
  },
  // 최종 — 5항목 중 4가지 충족 (균형 성장 강제)
  { id:'primordial', name:'태초의 포식자', ico:'🌈', final:true,
    reqText:'아래 5항목 중 4가지 충족 — ①생존력(HP 140↑·재생·단단한 껍질) ②기동력(속도 100↑·빠른 다리·작은 몸집) ③방어력(방어 10↑·단단한 껍질·큰 몸집) ④공격력(공격 20↑·독성 분비·강한 턱) ⑤사회력(매력 18↑·지배 페로몬·화려한 무늬)',
    refuge:null, refugeText:'없음 · 5항목 중 4가지를 갖춰야 생존 (부족한 개체는 도태)',
    safe:(i)=> {
      const mut = i.mutations || [];
      const checks = [
        i.stats.hp > 140 || mut.includes('regeneration') || mut.includes('hard_shell'),     // 전투력
        i.stats.speed > 100 || mut.includes('fast_legs') || mut.includes('small_body'),     // 기동력
        i.stats.defense > 10 || mut.includes('hard_shell') || mut.includes('large_body'),   // 생존력
        i.stats.attack > 20 || mut.includes('poison_gland') || mut.includes('strong_jaw'),  // 저항력
        i.stats.charm > 18 || mut.includes('pheromone') || mut.includes('bright_pattern'),  // 사회력
      ];
      return checks.filter(Boolean).length >= 4;
    }
  },
];
function bossById(id){ return BOSS_ROSTER.find(b=>b.id===id); }

// 보스 비주얼 설정 — createBossTexture가 파츠 조립에 사용
const BOSS_VISUAL = {
  lava:       { shape:'bulky',       pal:{d:0x3a2420,m:0x6a3a2a,l:0x8a4a36,a:0xff7a1a}, parts:['lavaCracks','heavyBrows'], eyes:2, eyeCol:0xff3a1a },
  sand:       { shape:'armored',     pal:{d:0x7a5a32,m:0xc2964a,l:0xe6c483,a:0x5a3a1a}, parts:['shellPlates','spikes'],     eyes:2, eyeCol:0x2a1a0a },
  glacier:    { shape:'crystalline', pal:{d:0x3a6aa0,m:0x8fc0e8,l:0xdcf0ff,a:0xffffff}, parts:['iceCrown'],                  eyes:2, eyeCol:0x1a6aff },
  spore:      { shape:'bulky',       pal:{d:0x4a2a6a,m:0x7a4aa0,l:0xb48ad0,a:0x6fcf4a}, parts:['poisonDrips','spores'],      eyes:4, eyeCol:0xc0ff6a },
  gale:       { shape:'sleek',       pal:{d:0x2f6f7a,m:0x4fb0c0,l:0x9fe0e8,a:0xdffcff}, parts:['legs','streaks'],            eyes:2, eyeCol:0x10303a },
  charmer:    { shape:'tentacled',   pal:{d:0xa83a7a,m:0xe060a0,l:0xffb0d8,a:0xffd23f}, parts:['tentacles'],                 eyes:2, eyeCol:0x4a1030 },
  steel:      { shape:'armored',     pal:{d:0x4a5a6a,m:0x8a9aaa,l:0xc2d2e2,a:0x5a6a7a}, parts:['shellPlates','legs'],        eyes:1, eyeCol:0x1a2a3a },
  plague:     { shape:'draconic',    pal:{d:0x5a1a1a,m:0xa83a2a,l:0xe0604a,a:0x6fcf4a}, parts:['wings','lavaCracks','poisonDrips'], eyes:2, eyeCol:0xffd23f },
  siren:      { shape:'tentacled',   pal:{d:0x1a3a5a,m:0x2f6f9a,l:0x6fb0d8,a:0xaef0ff}, parts:['tentacles','lure'],          eyes:2, eyeCol:0xaef0ff },
  primordial:  { shape:'amorphous',   pal:{d:0x2a2030,m:0x7a4aa0,l:0xffffff,a:0xffffff}, parts:['prism','multiEyes'],           eyes:5, eyeCol:0xffffff, prism:true },
  golden:      { shape:'amorphous',   pal:{d:0x7a5a10,m:0xe0b020,l:0xfff0a0,a:0xffffff}, parts:['prism','multiEyes'],           eyes:5, eyeCol:0xfff6c0, prism:true },
  crystal:     { shape:'crystalline', pal:{d:0x3a5a7a,m:0x6a9aba,l:0xc8e8ff,a:0xffffff}, parts:['iceCrown','shellPlates'],      eyes:2, eyeCol:0xaef0ff },
  vortex:      { shape:'sleek',       pal:{d:0x2a3a5a,m:0x4a6a9a,l:0x8ab8e8,a:0xdcf8ff}, parts:['streaks','legs'],              eyes:2, eyeCol:0x2af8ff },
  void_shadow: { shape:'amorphous',   pal:{d:0x1a0a2a,m:0x3a1a5a,l:0x7a3aa0,a:0xa040f0}, parts:['multiEyes','poisonDrips'],    eyes:4, eyeCol:0x6a1aff },
  ancient:     { shape:'bulky',       pal:{d:0x5a4a3a,m:0x8a7a6a,l:0xc8b8a8,a:0xe8d8c8}, parts:['heavyBrows','shellPlates'],   eyes:2, eyeCol:0xffb850 },
  leviathan:   { shape:'bulky',       pal:{d:0x1a3a4a,m:0x2a6a7a,l:0x4a9aaa,a:0x7ad8e8}, parts:['lavaCracks','spores'],        eyes:3, eyeCol:0x00ffff },
};

// ── 보스 특수 패턴 ──────────────────────────────────
// 보스 테마별 고유 특수공격 7종:
//  shockwave    광역 내려찍기 (원 밖으로 회피)
//  dash         예고선 관통 돌진
//  multi_dash   연속 돌진 (짧은 재예고 후 한 번 더)
//  eruption     용암 폭격 — 플레이어 주변 여러 지점 낙하
//  frost_nova   빙결 노바 — 피해는 낮지만 맞으면 이동 속도 감소
//  poison_pools 독 웅덩이 — 바닥에 남아 밟으면 지속 피해
//  pull         유혹의 손짓 — 범위 내 개체를 보스 쪽으로 끌어당김
//  all          모든 패턴 무작위 (최종·히든 보스)
const BOSS_SPECIAL_DEFS = {
  shockwave:    { ico:'💥', name:'충격파',      hint:'붉은 원 밖으로 피하세요' },
  dash:         { ico:'💨', name:'돌진',        hint:'예고선 밖으로 피하세요' },
  multi_dash:   { ico:'🌀', name:'연속 돌진',   hint:'두 번 이상 연속! 예고선 밖으로' },
  eruption:     { ico:'☄️', name:'용암 폭격',   hint:'낙하 지점 원 밖으로 피하세요' },
  frost_nova:   { ico:'❄️', name:'빙결 노바',   hint:'맞으면 5초간 이동 속도 감소' },
  poison_pools: { ico:'☠️', name:'독 웅덩이',   hint:'보라색 독지대를 밟지 마세요' },
  pull:         { ico:'💗', name:'유혹의 손짓', hint:'보스 쪽으로 끌려갑니다 — 사거리 밖으로' },
};
const BOSS_SPECIAL_ALL = Object.keys(BOSS_SPECIAL_DEFS);
const BOSS_PATTERNS = {
  lava:'eruption',      // 용암 거인: 용암탄 폭격
  sand:'dash',          // 모래 폭군: 모래 돌진
  glacier:'frost_nova', // 빙하 군주: 빙결
  spore:'poison_pools', // 독포자 마수: 독 웅덩이
  gale:'multi_dash',    // 질풍 추적자: 연속 돌진
  charmer:'pull',       // 매혹 포식자: 유혹
  steel:'dash',         // 강철 질주병: 철갑 돌진
  plague:'eruption',    // 화염 역병룡: 화염탄 폭격
  siren:'pull',         // 심연 세이렌: 노래로 끌어당김
  crystal:'frost_nova', // 수정 군주: 빙결
  vortex:'multi_dash',  // 소용돌이 폭풍: 연속 돌진
  void_shadow:'poison_pools', // 심연의 그림자: 어둠의 웅덩이
  ancient:'shockwave',  // 고대 파수꾼: 대지 내려찍기
  leviathan:'shockwave',// 거대 리바이어던: 해일 내려찍기
  golden:'all', primordial:'all',
};
const BOSS_SPECIAL_FIRST_AT = 6000;  // 교전 시작 후 첫 특수 패턴까지(ms) — 난이도 배율 적용
const BOSS_SPECIAL_CD = 8000;        // 이후 쿨다운(ms) — 난이도 배율 적용
const BOSS_SPECIAL_WARN = 1100;      // 텔레그래프(예고) 시간(ms)
const SHOCKWAVE_RADIUS = 300;
const DASH_HIT_WIDTH = 95;
const FROST_NOVA_RADIUS = 340;
const PULL_RADIUS = 480;
// 2페이즈: 복합 조건·최종·히든 보스는 HP 50% 이하에서 강화된다
// (양 패턴 교대 사용, 공격 주기 -30%, 피해 +25%, 특수 패턴 빈도 증가)
function bossHasPhase2(boss) {
  return !!(boss && (boss.final || boss.hidden || boss.reqText.includes('+')));
}
const PHASE2_HP_RATIO = 0.5;
const PHASE2_DMG_MULT = 1.25;
const PHASE2_ATK_CD_MULT = 0.7;
const PHASE2_SPECIAL_CD_MULT = 0.6;
const PHASE2_CHARGE_MULT = 0.72;

// 10분 기준 보스 등장 시각(ms)과 슬롯
const WAVE_FIRST_AT = 90000;   // 첫 보스 경고 시작 시각 (90초)
const WAVE_COOLDOWN = 75000;   // 보스 처치 후 다음 경고까지 대기 (75초)
const WAVE_HP = [37500, 55000, 105000]; // 1·2·3번째 보스 HP (난이도 배율 전)

// ── 날씨 시스템 ──────────────────────────────────
const WEATHERS = {
  sunny:  { id:'sunny',  name:'맑음',   ico:'☀️', foodMult:1.0,  spdMult:1.0,  tint:null },
  rain:   { id:'rain',   name:'비',     ico:'🌧️', foodMult:1.25, spdMult:0.9,  tint:0x3a5a8a }, // 비 = 식량 풍부, 이동 느림
  storm:  { id:'storm',  name:'폭풍',   ico:'⛈️', foodMult:0.8,  spdMult:0.8,  tint:0x2a3a5a }, // 폭풍 = 위험
  fog:    { id:'fog',    name:'안개',   ico:'🌫️', foodMult:0.9,  spdMult:0.95, tint:0x9aa5b5 },
  clear:  { id:'clear',  name:'쾌청',   ico:'🌤️', foodMult:1.1,  spdMult:1.05, tint:null },
};
const WEATHER_LIST = Object.values(WEATHERS);
const DAY_LENGTH = 60000;   // 1일 = 60초 (낮 36초 + 밤 24초)
const WEATHER_INTERVAL = 25000; // 25초마다 날씨 변화

// ── 도전과제 ──────────────────────────────────
const ACHIEVEMENTS = [
  // ── 생존 ──────────────────────────────────────────────
  { id:'rookie',      cat:'생존', name:'🌱 첫 발걸음',    desc:'1분 생존',                     bonus:80,
    check:(g,el)=>el>=60000 },
  { id:'survivor',    cat:'생존', name:'🏅 생존자',       desc:'2분 생존',                     bonus:150,
    check:(g,el)=>el>=120000 },
  { id:'veteran',     cat:'생존', name:'🎖️ 베테랑',      desc:'4분 생존',                     bonus:300,
    check:(g,el)=>el>=240000 },
  { id:'last_stand',  cat:'생존', name:'🕯️ 마지막 불꽃', desc:'운석 30초 전(9분30초)까지 생존', bonus:500,
    check:(g,el)=>el>=270000 },

  // ── 집단 크기 ──────────────────────────────────────────
  { id:'colony',      cat:'집단', name:'🐾 군집',        desc:'개체 30마리 보유',              bonus:150,
    check:(g)=>g.count>=30 },
  { id:'empire',      cat:'집단', name:'🏰 대제국',      desc:'개체 60마리 보유',              bonus:350,
    check:(g)=>g.count>=60 },
  { id:'near_death',  cat:'집단', name:'☠️ 벼랑 끝',    desc:'개체 3마리 이하까지 몰림',      bonus:100,
    check:(g,el,d)=>d.hadNeardeath },
  { id:'comeback',    cat:'집단', name:'💪 기적의 역전', desc:'3마리 이하에서 35마리+ 회복',   bonus:700,
    check:(g,el,d)=>d.hadNeardeath&&g.count>=35 },

  // ── 세대 ───────────────────────────────────────────────
  { id:'gen5',        cat:'세대', name:'🌿 5세대',       desc:'5세대 번식',                   bonus:150,
    check:(g)=>g.generation>=5 },
  { id:'gen15',       cat:'세대', name:'🌳 15세대',      desc:'15세대 번식',                  bonus:300,
    check:(g)=>g.generation>=15 },

  // ── 전투 ──────────────────────────────────────────────
  { id:'first_blood', cat:'전투', name:'⚔️ 첫 승리',    desc:'전쟁 첫 승리',                 bonus:100,
    check:(g)=>g.wins>=1 },
  { id:'warlord',     cat:'전투', name:'🗡️ 전쟁의 신',  desc:'전쟁 3회 이상 승리',           bonus:350,
    check:(g)=>g.wins>=3 },
  { id:'pacifist',    cat:'전투', name:'🕊️ 평화주의자', desc:'패배 없이 3분 생존',           bonus:350,
    check:(g,el)=>g.losses===0&&el>=180000 },
  { id:'escapist',    cat:'전투', name:'🏃 도주의 달인', desc:'거리를 벌려 전투 이탈 3회',                bonus:150,
    check:(g)=>g.escapes>=3 },

  // ── 포섭 ──────────────────────────────────────────────
  { id:'charmer',     cat:'포섭', name:'💫 매력 가득',   desc:'포섭 5마리',                   bonus:250,
    check:(g)=>g.recruited>=5 },
  { id:'diplomat',    cat:'포섭', name:'🤝 외교관',      desc:'포섭 10마리',                  bonus:450,
    check:(g)=>g.recruited>=10 },

  // ── 식량 ──────────────────────────────────────────────
  { id:'rich',        cat:'식량', name:'🌾 식량 부자',   desc:'식량 300 이상',                bonus:200,
    check:(g)=>g.food>=300 },
  { id:'feast',       cat:'식량', name:'🎉 풍년',        desc:'식량 700 이상',                bonus:350,
    check:(g)=>g.food>=700 },
  { id:'no_starve',   cat:'식량', name:'🍀 굶주림 없이', desc:'굶주림 사망 없이 3분 생존',    bonus:300,
    check:(g,el)=>g.starved===0&&el>=180000 },

  // ── 돌연변이 진화 ─────────────────────────────────────
  { id:'evo_lv3',     cat:'돌연변이', name:'🧬 진화 도약',     desc:'진화 레벨 3 달성', bonus:200,
    check:(g,el,d)=>(d.evoLevel||1)>=3 },
  { id:'evo_lv6',     cat:'돌연변이', name:'🦀 수렴 진화',     desc:'진화 레벨 6 달성', bonus:450,
    check:(g,el,d)=>(d.evoLevel||1)>=6 },
  { id:'red_wave',    cat:'돌연변이', name:'❤️ 생존자들',     desc:'재생 능력·단단한 껍질 돌연변이 개체 10마리 이상', bonus:200,
    check:(g)=>g.individuals.filter(i=>!i.dead&&((i.mutations||[]).includes('regeneration')||(i.mutations||[]).includes('hard_shell'))).length>=10 },
  { id:'blue_wave',   cat:'돌연변이', name:'💙 효율주의자',   desc:'효율 대사·작은 몸집 돌연변이 개체 10마리 이상',   bonus:200,
    check:(g)=>g.individuals.filter(i=>!i.dead&&((i.mutations||[]).includes('efficient_metabolism')||(i.mutations||[]).includes('small_body'))).length>=10 },
  { id:'speed_evo',   cat:'돌연변이', name:'⚡ 속도 진화',    desc:'빠른 다리 돌연변이 개체 8마리 이상',              bonus:200,
    check:(g)=>g.individuals.filter(i=>!i.dead&&(i.mutations||[]).includes('fast_legs')).length>=8 },
  { id:'poison_evo',  cat:'돌연변이', name:'☠️ 독성 진화',    desc:'독성 분비 돌연변이 개체 8마리 이상',              bonus:200,
    check:(g)=>g.individuals.filter(i=>!i.dead&&(i.mutations||[]).includes('poison_gland')).length>=8 },
  { id:'charm_evo',   cat:'돌연변이', name:'💗 매력 진화',    desc:'지배 페로몬 돌연변이 개체 8마리 이상',            bonus:200,
    check:(g)=>g.individuals.filter(i=>!i.dead&&(i.mutations||[]).includes('pheromone')).length>=8 },
  { id:'dominant_all',cat:'돌연변이', name:'👑 전방위 진화',  desc:'5종 이상 good 돌연변이를 동시 보유한 개체 존재',  bonus:500,
    check:(g)=>g.individuals.some(i=>!i.dead&&(i.mutations||[]).filter(id=>{const m=MUTATIONS.find(x=>x.id===id);return m&&m.type==='good';}).length>=5) },

  // ── 유전자 — 다양성·돌연변이 ──────────────────────────
  { id:'diverse',     cat:'유전자', name:'🧬 다양성 수호', desc:'2분 후에도 다양성 75%+ 유지',  bonus:250,
    check:(g,el)=>el>=120000&&g.calcDiversity()>=0.75 },
  { id:'mutant6',     cat:'유전자', name:'🔬 돌연변이 6종', desc:'6종 돌연변이 동시 보유',      bonus:250,
    check:(g)=>Object.keys(g.mutationFrequency()).length>=6 },
  { id:'mutant10',    cat:'유전자', name:'🧫 돌연변이 10종', desc:'10종 돌연변이 동시 보유',    bonus:450,
    check:(g)=>Object.keys(g.mutationFrequency()).length>=10 },
  { id:'pure_blood',  cat:'유전자', name:'🫧 순수 혈통',   desc:'2분 후에도 돌연변이 없는 개체 50%+', bonus:250,
    check:(g,el)=>el>=120000&&g.count>0&&g.individuals.filter(i=>i.mutations.length===0).length/g.count>=0.5 },

  // ── 지형 ──────────────────────────────────────────────
  { id:'volcano_win', cat:'지형', name:'🌋 화산 정복',   desc:'화산지대에서 전쟁 승리',       bonus:300,
    check:(g,el,d)=>d.volcanoWin },
  { id:'explorer',    cat:'지형', name:'🗺️ 탐험가',      desc:'5종 이상 지형 방문',           bonus:200,
    check:(g,el,d)=>(d.visitedTerrains||new Set()).size>=5 },

  // ── 보스 ──────────────────────────────────────────────
  { id:'boss_first',   cat:'보스', name:'🏆 첫 처치',      desc:'보스 첫 번째 처치',            bonus:300,
    check:(g,el,d)=>(d.bossKills||0)>=1 },
  { id:'boss_double',  cat:'보스', name:'⚔️ 보스 학살자',  desc:'보스 2마리 처치',              bonus:500,
    check:(g,el,d)=>(d.bossKills||0)>=2 },
  { id:'boss_triple',  cat:'보스', name:'👑 정복자',        desc:'보스 3마리 모두 처치',         bonus:900,
    check:(g,el,d)=>(d.bossKills||0)>=3 },
  { id:'boss_hidden',  cat:'보스', name:'🌈 태초의 승자',   desc:'숨겨진 보스 태초의 포식자 처치', bonus:1500,
    check:(g,el,d)=>!!d.bossHiddenKilled },
  { id:'boss_no_loss', cat:'보스', name:'🛡️ 무손실 처치',  desc:'보스 전투 중 개체 손실 없이 처치', bonus:600,
    check:(g,el,d)=>!!d.bossNoLossKill },
  { id:'boss_quick',   cat:'보스', name:'⏱️ 속전속결',     desc:'보스 등장 후 60초 이내 처치',  bonus:700,
    check:(g,el,d)=>!!d.bossQuickKill },
];

// 지형별 컨셉에 맞는 이벤트 맵
// 이벤트 종류: { predicate } → 경고~활성 단계 점진적 도태 | { foodDelta/foodRatio } → 활성 진입 시 식량 변화
// 각 이벤트: warning(경고 단계 예고 메시지), message(활성 종료 결과 메시지)
const TERRAIN_EVENTS = {
  plain: [
    { name: '메뚜기 떼 습격',
      warning: '메뚜기 떼가 밀밭으로 몰려오고 있습니다! 식량 피해가 예상됩니다.',
      message: '메뚜기 떼가 밀밭을 휩쓸어 식량이 절반으로 줄었습니다.',
      foodRatio: 0.50 },
    { name: '들불',
      warning: '들불이 번지고 있습니다! 속도가 느린 개체들은 피하지 못할 수 있습니다.',
      message: '들불이 느린 개체들을 휩쓸었습니다.',
      predicate: i => i.stats.speed < 68 },
    { name: '야생 동물 습격',
      warning: '야생 동물 무리가 접근 중입니다! 방어력과 매력이 모두 낮은 개체들이 표적이 됩니다.',
      message: '야생 동물이 방어력과 매력이 낮은 개체들을 습격했습니다.',
      predicate: i => i.stats.defense < 6 && i.stats.charm < 10 },
    { name: '전염병 창궐',
      warning: '전염병이 퍼지기 시작했습니다! 번식력이 강한 개체들 사이에서 빠르게 확산됩니다.',
      message: '전염병이 번식력 강한 개체들을 쓰러뜨렸습니다.',
      predicate: i => i.stats.fertility > 1.3 },
    { name: '붉은 달',
      warning: '붉은 달이 떠오릅니다! 파란색 개체들이 달빛에 눈에 띄어 포식자에게 발각될 위험이 있습니다.',
      message: '붉은 달빛 아래 파란색 개체들이 포식자에게 발각됐습니다.',
      predicate: i => getGenotypeLabel(i, 'color') === 'BB' }
  ],
  forest: [
    { name: '위장 포식자 출현',
      warning: '숲 속에서 위장 포식자가 발견됐습니다! 눈에 띄는 붉은색 개체들이 위험합니다.',
      message: '위장 포식자가 숲 속에서 눈에 띄는 붉은색 개체들을 골라 잡아갔습니다.',
      predicate: i => getGenotypeLabel(i, 'color') === 'RR' },
    { name: '나무 쓰러짐',
      warning: '폭풍이 거목들을 흔들고 있습니다! 느린 개체들은 피하지 못할 수 있습니다.',
      message: '폭풍에 거목이 쓰러져 느린 개체들이 깔렸습니다.',
      predicate: i => i.stats.speed < 72 },
    { name: '열매 풍년',
      warning: '숲에 열매가 풍성하게 익었습니다! 곧 식량이 크게 늘어납니다.',
      message: '열매 풍년으로 식량이 크게 늘었습니다!',
      foodDelta: 55 },
    { name: '기생충 감염',
      warning: '숲 속 기생충이 퍼지고 있습니다! 방어력이 낮은 개체들이 취약합니다.',
      message: '기생충이 방어력이 낮은 개체들의 피부에 침투했습니다.',
      predicate: i => i.stats.defense < 7 },
    { name: '야간 포식자',
      warning: '야간 포식자들이 활동을 시작했습니다! 매력이 낮은 개체들이 표적이 됩니다.',
      message: '야간 포식자가 매력이 낮은 개체들을 잡아갔습니다.',
      predicate: i => i.stats.charm < 10 },
  ],
  desert: [
    { name: '극심한 폭염',
      warning: '극심한 폭염이 몰려오고 있습니다! 식량 요구량이 높은 개체들이 탈수 위험에 처합니다.',
      message: '폭염으로 식량 요구량 높은 개체들이 탈수로 쓰러졌습니다.',
      predicate: i => i.stats.foodNeed >= 1.35 },
    { name: '오아시스 발견',
      warning: '오아시스가 발견됐습니다! 곧 귀한 식량을 얻을 수 있습니다.',
      message: '오아시스에서 귀한 식량을 획득했습니다!',
      foodDelta: 40 },
    { name: '독전갈 습격',
      warning: '독전갈 떼가 나타났습니다! 독성에 면역이 없는 개체들이 위험합니다.',
      message: '독전갈이 독성 면역 없는 개체들을 쏘아 쓰러뜨렸습니다.',
      predicate: i => i.stats.attack < 15 && !(i.mutations||[]).includes('poison_gland') },
    { name: '열사병',
      warning: '극한 폭염이 시작됩니다! 방어력은 높지만 속도가 느린 개체들이 열사병에 걸릴 수 있습니다.',
      message: '극한 폭염에 무겁고 느린 개체들이 열사병으로 쓰러졌습니다.',
      predicate: i => i.stats.defense > 12 && i.stats.speed < 75 },
    { name: '신기루',
      warning: '신기루가 나타나 개체들이 뒤쫓기 시작했습니다! 식량 손실이 예상됩니다.',
      message: '신기루를 쫓아가다 지쳐 식량의 30%를 잃었습니다.',
      foodRatio: 0.70 },
  ],
  volcano: [
    { name: '화산 폭발',
      warning: '화산이 폭발하려 합니다! 오직 붉은색 개체만 극한 열기를 버틸 수 있습니다.',
      message: '화산 폭발로 붉은색이 아닌 개체들이 열기를 견디지 못하고 쓰러졌습니다.',
      predicate: i => getGenotypeLabel(i, 'color') !== 'RR' },
    { name: '독가스 분출',
      warning: '화산 독가스가 분출되기 시작했습니다! 독성 면역이 없는 개체들이 위험합니다.',
      message: '독가스로 독성 면역 없는 개체들이 쓰러졌습니다.',
      predicate: i => i.stats.attack < 15 && !(i.mutations||[]).includes('poison_gland') },
    { name: '마그마 흐름',
      warning: '마그마가 흘러들고 있습니다! 느린 개체들은 피하지 못할 수 있습니다.',
      message: '마그마에 느린 개체들이 피하지 못하고 쓰러졌습니다.',
      predicate: i => i.stats.speed < 70 },
    { name: '용암 분수',
      warning: '용암이 솟구치려 합니다! 매력이 낮은 개체들이 무리 밖에서 위험에 처합니다.',
      message: '용암 분수가 무리에서 멀어진 개체들을 덮쳤습니다.',
      predicate: i => i.stats.charm < 10 },
    { name: '화산재 폭풍',
      warning: '짙은 화산재가 쏟아지기 시작했습니다! 방어력이 낮은 개체들이 질식 위험에 처합니다.',
      message: '화산재 폭풍에 방어력이 낮은 개체들이 질식했습니다.',
      predicate: i => i.stats.defense < 7 }
  ],
  snow: [
    { name: '눈보라',
      warning: '눈보라가 몰아치기 시작했습니다! 방어력이 낮은 개체들이 동사할 위험이 있습니다.',
      message: '눈보라에 방어력이 낮은 개체들이 동사했습니다.',
      predicate: i => i.stats.defense < 7 },
    { name: '혹한 동상',
      warning: '극심한 추위가 몰려옵니다! 체력이 낮은 개체들이 동상에 걸릴 수 있습니다.',
      message: '혹한에 체력이 낮은 개체들이 동상으로 쓰러졌습니다.',
      predicate: i => i.hp < i.stats.hp * 0.55 },
    { name: '먹이 고갈',
      warning: '눈이 모든 것을 뒤덮기 시작했습니다! 식량이 급격히 줄어들 것입니다.',
      message: '눈이 뒤덮어 식량의 40%가 사라졌습니다.',
      foodRatio: 0.60 },
    { name: '극야 생존',
      warning: '극야의 혹한이 시작됩니다! 파란색 개체만 눈밭에서 살아남을 수 있습니다.',
      message: '극야의 혹한에 파란색이 아닌 개체들이 쓰러졌습니다.',
      predicate: i => getGenotypeLabel(i, 'color') !== 'BB' },
    { name: '눈사태',
      warning: '눈사태가 일어나려 합니다! 속도가 느린 개체들이 미처 피하지 못할 수 있습니다.',
      message: '눈사태에 느린 개체들이 미처 피하지 못했습니다.',
      predicate: i => i.stats.speed < 75 && i.stats.defense > 12 }
  ],
  river: [
    { name: '갑작스런 홍수',
      warning: '상류에서 수위가 급상승하고 있습니다! 느린 개체들이 떠내려갈 수 있습니다.',
      message: '강이 범람해 느린 개체들이 떠내려갔습니다.',
      predicate: i => i.stats.speed < 70 },
    { name: '강 독소 유입',
      warning: '상류에서 독소가 유입되고 있습니다! 독성 면역이 없는 개체들이 중독될 수 있습니다.',
      message: '독소로 독성 면역이 없는 개체들이 중독됐습니다.',
      predicate: i => i.stats.attack < 15 && !(i.mutations||[]).includes('poison_gland') },
    { name: '물고기 풍년',
      warning: '강에 물고기가 넘쳐흐르고 있습니다! 곧 풍성한 식량을 얻을 수 있습니다.',
      message: '물고기 풍년으로 풍성한 식량을 얻었습니다!',
      foodDelta: 60 },
    { name: '급류',
      warning: '급류가 발생하고 있습니다! 방어력은 높지만 속도가 느린 개체들이 가라앉을 수 있습니다.',
      message: '급류에 무거운 개체들이 가라앉았습니다.',
      predicate: i => i.stats.speed < 72 && i.stats.defense > 12 },
    { name: '강변 포식자',
      warning: '강변 포식자들이 모여들고 있습니다! 매력이 낮은 개체들이 표적이 됩니다.',
      message: '강변 포식자가 매력이 낮은 개체들을 잡아갔습니다.',
      predicate: i => i.stats.charm < 10 }
  ],
  swamp: [
    { name: '독성 폭발 확산',
      warning: '늪의 독성이 급격히 강해지고 있습니다! 독성 면역이 없는 개체 대다수가 위험합니다.',
      message: '늪 독성 폭발로 독성 면역 없는 개체들이 대거 쓰러졌습니다.',
      predicate: i => i.stats.attack < 15 && !(i.mutations||[]).includes('poison_gland') },
    { name: '늪 수렁',
      warning: '늪이 깊어지기 시작했습니다! 느린 개체들이 수렁에 빠질 수 있습니다.',
      message: '늪 수렁에 느린 개체들이 헤어나오지 못했습니다.',
      predicate: i => i.stats.speed < 62 },
    { name: '썩은 열매',
      warning: '늪에 썩은 열매가 번지고 있습니다! 식량이 오염될 수 있습니다.',
      message: '썩은 열매를 먹어 식량의 35%가 손실됐습니다.',
      foodRatio: 0.65 },
    { name: '독거미',
      warning: '독거미들이 활동을 시작했습니다! 매력이 낮고 공격력이 약한 개체들이 무리 밖에서 위험합니다.',
      message: '독거미가 방어력이 낮은 개체들을 물어 쓰러뜨렸습니다.',
      predicate: i => i.stats.charm < 10 && i.stats.attack < 14 },
    { name: '늪 안개',
      warning: '짙은 늪 안개가 몰려오고 있습니다! 독성 면역도 없고 느린 개체들이 특히 위험합니다.',
      message: '늪 안개에 면역력과 이동력이 부족한 개체들이 질식했습니다.',
      predicate: i => !(i.mutations||[]).includes('poison_gland') && i.stats.speed < 65 },
  ]
};

const GENES = {
  color: { alleles: ['R', 'B'], dominant: 'R', recessive: 'B', dominantName: '붉은색', recessiveName: '푸른색', heteroName: '보라색' },
  speed: { alleles: ['S', 's'], dominant: 'S', recessive: 's', dominantName: '빠른 다리', recessiveName: '보통 속도' },
  poison: { alleles: ['P', 'p'], dominant: 'P', recessive: 'p', dominantName: '독성 있음', recessiveName: '독성 없음' },
  armor: { alleles: ['A', 'a'], dominant: 'A', recessive: 'a', dominantName: '갑옷 있음', recessiveName: '갑옷 없음' },
  charm: { alleles: ['C', 'c'], dominant: 'C', recessive: 'c', dominantName: '높은 매력', recessiveName: '보통 매력' }
};
const GENE_EFFECTS = {
  color:  { dominant: { attack: 5, hp: 8 },                recessive: { defense: 4, foodNeed: -0.2 } }, // R:공격적, B:효율적
  speed:  { dominant: { speed: 25, foodNeed: 0.3 },         recessive: {} },                              // 속도: 빠름 + 식량소모 증가
  poison: { dominant: { attack: 10, defense: 3 },          recessive: {} },                              // 독성: 강한 공격·방어
  armor:  { dominant: { defense: 10, hp: 15, speed: -8 },  recessive: {} },                              // 갑옷: 높은 방어·체력, 느림
  charm:  { dominant: { charm: 12, fertility: 0.3 },       recessive: {} },                              // 매력: 높은 매력·번식력
};
// 대립유전자 품질에 따른 우성 효과 배율 — e(약함)/n(보통)/h(강함)
const QUALITY_MULT = { e: 0.45, n: 1.0, h: 1.7 };
const QUALITY_ORDER = ['e', 'n', 'h'];
function blendQuality(qa, qb) {
  const ia = QUALITY_ORDER.indexOf(qa || 'n');
  const ib = QUALITY_ORDER.indexOf(qb || 'n');
  return QUALITY_ORDER[clamp(Math.round((ia + ib) / 2), 0, 2)];
}
const MUTATIONS = [
  { id: 'strong_jaw', name: '강한 턱', type: 'good', effects: { attack: 4 } },
  { id: 'fast_legs', name: '빠른 다리', type: 'good', effects: { speed: 25, gather: 1 } },
  { id: 'regeneration', name: '재생 능력', type: 'good', effects: { hp: 25, defense: 2 } },
  { id: 'efficient_metabolism', name: '효율 대사', type: 'good', effects: { foodNeed: -0.4 } },
  { id: 'poison_gland', name: '독성 분비', type: 'good', effects: { attack: 6 } },
  { id: 'high_fertility', name: '높은 번식력', type: 'dual', effects: { fertility: 0.5, foodNeed: 0.3 } },
  { id: 'hard_shell', name: '단단한 껍질', type: 'dual', effects: { defense: 5, speed: -10 } },
  { id: 'large_body', name: '큰 몸집', type: 'dual', effects: { hp: 30, attack: 2, speed: -15, foodNeed: 0.5 } },
  { id: 'small_body', name: '작은 몸집', type: 'dual', effects: { hp: -15, attack: -1, speed: 20, foodNeed: -0.3 } },
  { id: 'bright_pattern', name: '화려한 무늬', type: 'dual', effects: { charm: 8, defense: -1 } },
  { id: 'pheromone', name: '지배 페로몬', type: 'dual', effects: { charm: 15, fertility: -0.2 } },
  { id: 'unstable_dna', name: '불안정 DNA', type: 'dual', effects: { mutationRate: 0.03 } },
  { id: 'weak_jaw', name: '약한 턱', type: 'bad', effects: { attack: -4 } },
  { id: 'thin_shell', name: '얇은 껍질', type: 'bad', effects: { hp: -10, defense: -3, speed: 5 } },
  { id: 'slow_legs', name: '느린 다리', type: 'bad', effects: { speed: -20, gather: -1 } },
  { id: 'weak_immunity', name: '약한 면역', type: 'bad', effects: { hp: -15, defense: -2, foodNeed: 0.2 } },
  { id: 'low_fertility', name: '낮은 번식력', type: 'bad', effects: { fertility: -0.4 } },
  { id: 'frail_body', name: '약한 체질', type: 'bad', effects: { hp: -25 } },
  { id: 'timid', name: '겁 많은 성향', type: 'bad', effects: { attack: -2, charm: -3, speed: 5 } },
  { id: 'bad_metabolism', name: '불완전 대사', type: 'bad', effects: { hp: -10, speed: -5, gather: -2, fertility: -0.2, foodNeed: 0.5 } },
  // ── 추가 돌연변이 10종 ──────────────────────────────────────────────
  { id: 'acid_spit',    name: '산성 타액',  type: 'good', effects: { attack: 6 } },
  { id: 'thick_fur',    name: '두꺼운 털',  type: 'good', effects: { hp: 20, defense: 3 } },
  { id: 'echolocation', name: '반향 탐지',  type: 'good', effects: { gather: 3, speed: 10 } },
  { id: 'solar_skin',   name: '태양 피부',  type: 'good', effects: { gather: 4, foodNeed: -0.2 } },
  { id: 'venomous_bite',name: '독성 이빨',  type: 'dual', effects: { attack: 8, fertility: -0.3 } },
  { id: 'camouflage',   name: '위장술',     type: 'dual', effects: { defense: 4, charm: -5 } },
  { id: 'magnetism',    name: '자기장',     type: 'dual', effects: { charm: 12, attack: -3 } },
  { id: 'deep_roots',   name: '뿌리 감각',  type: 'dual', effects: { defense: 4, foodNeed: -0.3, speed: -20 } },
  { id: 'night_vision', name: '야시증',     type: 'dual', effects: { speed: 15, gather: 2, hp: -10 } },
  { id: 'brittle_bones',name: '약한 뼈',    type: 'bad',  effects: { hp: -25, defense: -2 } },
  // ── 추가 돌연변이 35종 (진화 선택지 다양화) ──────────────────────
  // 이점 (good) 12종
  { id: 'crab_claw',      name: '집게발',       type: 'good', effects: { attack: 7, defense: 2 } },
  { id: 'chitin_layer',   name: '키틴 장갑',    type: 'good', effects: { defense: 4, hp: 5 } },
  { id: 'keen_eyes',      name: '예리한 눈',    type: 'good', effects: { gather: 3, speed: 5 } },
  { id: 'adrenal_gland',  name: '아드레날린샘', type: 'good', effects: { speed: 15, attack: 2 } },
  { id: 'symbiotic_algae',name: '공생 조류',    type: 'good', effects: { foodNeed: -0.3, hp: 5 } },
  { id: 'iron_stomach',   name: '강철 위장',    type: 'good', effects: { foodNeed: -0.3, gather: 1 } },
  { id: 'pack_instinct',  name: '무리 본능',    type: 'good', effects: { charm: 6, defense: 1 } },
  { id: 'rapid_healing',  name: '급속 치유',    type: 'good', effects: { hp: 15, fertility: 0.1 } },
  { id: 'sixth_sense',    name: '육감',         type: 'good', effects: { speed: 10, gather: 2 } },
  { id: 'sticky_slime',   name: '끈끈한 점액',  type: 'good', effects: { attack: 3, defense: 2 } },
  { id: 'spring_legs',    name: '용수철 다리',  type: 'good', effects: { speed: 20 } },
  { id: 'vital_core',     name: '생명의 핵',    type: 'good', effects: { hp: 20, charm: 2 } },
  // 양면 (dual) 15종
  { id: 'molting',        name: '탈피 주기',    type: 'dual', effects: { defense: 6, hp: -10 } },
  { id: 'oversized_claw', name: '거대 집게',    type: 'dual', effects: { attack: 10, speed: -15, gather: -1 } },
  { id: 'barbed_shell',   name: '가시 껍질',    type: 'dual', effects: { defense: 5, charm: -4 } },
  { id: 'biolumin',       name: '생체 발광',    type: 'dual', effects: { charm: 10, defense: -2 } },
  { id: 'cold_blood',     name: '냉혈 체질',    type: 'dual', effects: { foodNeed: -0.5, speed: -10 } },
  { id: 'hyper_metab',    name: '과열 대사',    type: 'dual', effects: { speed: 25, foodNeed: 0.5 } },
  { id: 'burrowing',      name: '굴파기 본능',  type: 'dual', effects: { defense: 4, gather: 2, speed: -15 } },
  { id: 'gluttony',       name: '폭식가',       type: 'dual', effects: { hp: 25, gather: 2, foodNeed: 0.6 } },
  { id: 'parasite_spore', name: '기생 포자',    type: 'dual', effects: { attack: 7, hp: -10 } },
  { id: 'silk_gland',     name: '거미줄샘',     type: 'dual', effects: { gather: 3, charm: 3, speed: -8 } },
  { id: 'armored_tail',   name: '갑옷 꼬리',    type: 'dual', effects: { defense: 3, hp: 10, speed: -8 } },
  { id: 'toxic_skin',     name: '독성 피부',    type: 'dual', effects: { attack: 5, charm: -4 } },
  { id: 'swarm_body',     name: '군체화',       type: 'dual', effects: { fertility: 0.4, hp: -15 } },
  { id: 'giant_antennae', name: '거대 더듬이',  type: 'dual', effects: { gather: 4, defense: -2 } },
  { id: 'mimic_pattern',  name: '의태 무늬',    type: 'dual', effects: { defense: 3, charm: 5, attack: -2 } },
  // 불이익 (bad) 8종 — 자연 돌연변이로만 발생 (진화 선택지에는 안 나옴)
  { id: 'nearsighted',    name: '근시',         type: 'bad',  effects: { gather: -2, speed: -5 } },
  { id: 'heavy_bones',    name: '무거운 뼈',    type: 'bad',  effects: { speed: -15 } },
  { id: 'anemia',         name: '빈혈',         type: 'bad',  effects: { hp: -15, attack: -2 } },
  { id: 'picky_eater',    name: '편식',         type: 'bad',  effects: { foodNeed: 0.4, gather: -1 } },
  { id: 'brittle_claw',   name: '무른 집게',    type: 'bad',  effects: { attack: -5 } },
  { id: 'dull_senses',    name: '둔한 감각',    type: 'bad',  effects: { gather: -3 } },
  { id: 'thin_membrane',  name: '얇은 막',      type: 'bad',  effects: { defense: -3, hp: -8 } },
  { id: 'sterile_line',   name: '불임 계통',    type: 'bad',  effects: { fertility: -0.5 } }
];
// 외형에 직접 반영되는 시그니처 돌연변이 — 이제 모든 돌연변이가 고유 외형 특징을 가짐
// (large_body/small_body는 스케일 전용, 나머지는 drawMutationOverlay에서 픽셀 오버레이)
const MUTATION_SIG_IDS = new Set(MUTATIONS.map(m => m.id));
function signatureMutations(mutations) {
  return (mutations || []).filter(id => MUTATION_SIG_IDS.has(id)).sort();
}
function dominantMutationType(mutations) {
  const count = { good:0, bad:0, dual:0 };
  for (const id of (mutations || [])) {
    const m = MUTATIONS.find(x => x.id === id);
    if (m) count[m.type]++;
  }
  if (count.good === 0 && count.bad === 0 && count.dual === 0) return 'none';
  const order = ['bad','dual','good'];
  let best = 'good', bestN = -1;
  for (const t of order) { if (count[t] > bestN) { bestN = count[t]; best = t; } }
  return best;
}
function creatureTextureKey(individual) {
  const body = getBodyColor(individual);
  const sig = signatureMutations(individual.mutations)
    .filter(id => id !== 'large_body' && id !== 'small_body');
  const cat = dominantMutationType(individual.mutations);
  return `creature_${body}_${sig.length ? sig.join('.') : 'none'}_${cat}`;
}
// ── 진화 게이지 시스템 ──────────────────────────────────
// 전투(전쟁 처치·승리·보스 처치)로만 EXP를 모아 레벨업 → 진화 3택1 → 집단 전체에 발현
// (Everything is Crab식 "사냥해서 진화" 루프 — 채집은 식량만, 진화는 오직 전투)
const EVO_EXP_BASE = 120;      // 레벨 1→2 필요 EXP
const EVO_EXP_GROWTH = 1.35;   // 레벨당 필요량 배율
const EVO_CHOICES_BASE = 3;    // 기본 선택지 수 (계통수 pick 노드가 있으면 그 이상)
const EVO_BATTLE_EXP = 80;     // 전쟁 승리 보상 EXP
const EVO_KILL_EXP = 12;       // 전쟁 중 적 개체 처치당 EXP
function evoExpNeedFor(level) {
  return Math.round(EVO_EXP_BASE * Math.pow(EVO_EXP_GROWTH, Math.max(0, level - 1)));
}
// 레벨업 진화 후보: 집단 전체가 이미 가진(=보편화된) 형질과 순수 불이익 형질 제외
function rollEvolutionCandidates(group, n) {
  const alive = group.individuals.filter(i => !i.dead);
  const universal = new Set(
    MUTATIONS.filter(m => alive.length > 0 && alive.every(i => (i.mutations || []).includes(m.id))).map(m => m.id)
  );
  const pool = MUTATIONS.filter(m => m.type !== 'bad' && !universal.has(m.id)).map(m => m.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

const BASE_STATS = { hp: 100, attack: 10, defense: 3, speed: 80, gather: 5, fertility: 1, charm: 5, foodNeed: 1, mutationRate: 0.08 };
const MIN_STATS = { hp: 20, attack: 1, defense: 0, speed: 20, gather: 0, fertility: 0.1, charm: 0, foodNeed: 0.2, mutationRate: 0 };
const MAX_STATS = { hp: 300, attack: 50, defense: 30, speed: 200, gather: 30, fertility: 3, charm: 50, foodNeed: 5, mutationRate: 0.3 };

let nextIndividualId = 0;
let nextGroupId = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function choose(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function mutationById(id) {
  return MUTATIONS.find(mutation => mutation.id === id);
}

function combineAlleles(gene, alleleA, alleleB) {
  const def = GENES[gene];
  const pair = [alleleA, alleleB];
  if (gene === 'color') {
    return pair.sort((a, b) => {
      if (a === 'R' && b === 'B') return -1;
      if (a === 'B' && b === 'R') return 1;
      return a.localeCompare(b);
    });
  }
  return pair.sort((a, b) => {
    if (a === def.dominant && b !== def.dominant) return -1;
    if (b === def.dominant && a !== def.dominant) return 1;
    return a.localeCompare(b);
  });
}

function makeGamete(individual) {
  // Mendelian segregation: each gamete receives one allele from each gene pair.
  // Independent assortment: every gene pair is sampled independently in this loop.
  const gamete = {};
  for (const gene of Object.keys(GENES)) {
    gamete[gene] = choose(individual.genes[gene]);
  }
  return gamete;
}

function getGenotypeLabel(individual, gene) {
  return individual.genes[gene].join('');
}
function isHomozygous(i, gene) {
  const d = GENES[gene].dominant;
  return i.genes[gene][0] === d && i.genes[gene][1] === d;
}

function getPhenotypeLabel(individual, gene) {
  if (gene === 'color') {
    const genotype = getGenotypeLabel(individual, gene);
    if (genotype === 'RR') return '붉은색';
    if (genotype === 'BB') return '푸른색';
    return '보라색';
  }
  return individual.hasDominant(gene) ? GENES[gene].dominantName : GENES[gene].recessiveName;
}

function getBodyColor(individual) {
  const g = getGenotypeLabel(individual, 'color');
  if (g === 'RR') return BODY_COLOR_RED;
  if (g === 'BB') return BODY_COLOR_BLUE;
  return BODY_COLOR_PURPLE;
}
function getColorGenotype(individual) { return getGenotypeLabel(individual, 'color'); }

class Individual {
  constructor(groupId, x, y, genes = null, mutationsOrGenes = []) {
    this.id = `individual_${++nextIndividualId}`;
    this.groupId = groupId;
    this.x = x;
    this.y = y;
    this.offsetX = (Math.random() - 0.5) * FOLLOW_RADIUS * 2;
    this.offsetY = (Math.random() - 0.5) * FOLLOW_RADIUS * 2;
    this.genes = genes || this.randomGenes();
    // 돌연변이 멘델 유전: 각 좌마다 ['M'|'m','M'|'m'] (M=돌연변이 대립유전자, 우성 발현)
    // mm인 좌는 저장하지 않음. 배열을 받으면 발현 목록으로 보고 각각 Mm 이형접합으로 변환
    if (Array.isArray(mutationsOrGenes)) {
      this.mutationGenes = {};
      for (const id of mutationsOrGenes) this.mutationGenes[id] = ['M', 'm'];
    } else {
      this.mutationGenes = mutationsOrGenes || {};
    }
    // 대립유전자 품질 등급: e(약)/n(보통)/h(강) — 우성 효과 배율에 반영
    this.geneQuality = { color:'n', speed:'n', poison:'n', armor:'n', charm:'n' };
    // 유전 가능한 스탯 보너스 (부모 평균으로 자손에 전달)
    this.statBonus = { hpMult: 1, attack: 0, speed: 0, defense: 0 };
    this.stats = this.calculateStats();
    this.hp = this.stats.hp;
    this.dead = false;
    this.lastAttackAt = 0;
    this.newMutationCount = 0;
    this.newlyGained = []; // 이번에 새로 발현된 돌연변이 ID (획득 알림용)
  }

  // 발현된 돌연변이 목록 (M 대립유전자를 하나라도 가진 좌 = 우성 발현)
  get mutations() {
    return Object.keys(this.mutationGenes).filter(id => this.mutationGenes[id].includes('M'));
  }

  // 돌연변이 유전자형 라벨 (비공개 처리용 — 동형/이형접합 구분)
  mutationZygosity(id) {
    const g = this.mutationGenes[id];
    if (!g) return null;
    return g[0] === 'M' && g[1] === 'M' ? 'homo' : g.includes('M') ? 'hetero' : null;
  }

  randomGenes() {
    const genes = {};
    for (const [name, def] of Object.entries(GENES)) {
      genes[name] = combineAlleles(name, choose(def.alleles), choose(def.alleles));
    }
    return genes;
  }

  hasDominant(gene) {
    return this.genes[gene].includes(GENES[gene].dominant);
  }

  calculateStats() {
    const stats = { ...BASE_STATS };
    for (const gene of Object.keys(GENES)) {
      const dominant = this.hasDominant(gene);
      const effects = dominant ? GENE_EFFECTS[gene].dominant : GENE_EFFECTS[gene].recessive;
      const qm = dominant ? (QUALITY_MULT[(this.geneQuality || {})[gene]] ?? 1.0) : 1.0;
      for (const [key, value] of Object.entries(effects)) stats[key] = (stats[key] || 0) + value * qm;
    }
    for (const mutationId of this.mutations) {
      const mutation = mutationById(mutationId);
      if (!mutation) continue;
      for (const [key, value] of Object.entries(mutation.effects)) stats[key] = (stats[key] || 0) + value * MUTATION_EFFECT_MULTIPLIER;
    }
    for (const key of Object.keys(MIN_STATS)) {
      stats[key] = clamp(stats[key] || 0, MIN_STATS[key], MAX_STATS[key]);
    }
    for (const key of Object.keys(stats)) {
      if (key === 'mutationRate' || key === 'foodNeed') continue;
      stats[key] = clamp(stats[key] * (0.88 + Math.random() * 0.24), MIN_STATS[key], MAX_STATS[key]);
    }
    // 유전 보너스 적용 (statBonus는 constructor에서 초기화 후 외부에서 설정)
    if (this.statBonus) {
      if (this.statBonus.hpMult > 1)  stats.hp      = clamp(Math.round(stats.hp * this.statBonus.hpMult), MIN_STATS.hp, MAX_STATS.hp);
      if (this.statBonus.attack  > 0) stats.attack  = clamp(stats.attack  + this.statBonus.attack,  MIN_STATS.attack,  MAX_STATS.attack);
      if (this.statBonus.speed   > 0) stats.speed   = clamp(stats.speed   + this.statBonus.speed,   MIN_STATS.speed,   MAX_STATS.speed);
      if (this.statBonus.defense > 0) stats.defense = clamp(stats.defense + this.statBonus.defense, MIN_STATS.defense, MAX_STATS.defense);
    }
    return stats;
  }

  takeHit(attack, dmgMult = 1) {
    const damage = Math.max(1, Math.round((Math.max(1, attack - this.stats.defense)) * dmgMult));
    this.hp -= damage;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
    return damage;
  }

  // deferPick: 신규 돌연변이 발생 여부만 굴리고 정체는 미정으로 남김 (플레이어 선택창에서 결정)
  static breed(parentA, parentB, groupId, x, y, guaranteeMutation = false, deferPick = false) {
    const genes = {};
    const gameteA = makeGamete(parentA);
    const gameteB = makeGamete(parentB);
    for (const gene of Object.keys(GENES)) {
      genes[gene] = combineAlleles(gene, gameteA[gene], gameteB[gene]);
    }
    // 돌연변이 멘델 유전: 각 좌마다 부모 대립유전자 하나씩 분리 → 자식 유전자형
    const loci = new Set([...Object.keys(parentA.mutationGenes), ...Object.keys(parentB.mutationGenes)]);
    const childMutGenes = {};
    for (const id of loci) {
      const a = parentA.mutationGenes[id] || ['m', 'm'];
      const b = parentB.mutationGenes[id] || ['m', 'm'];
      const allele = [choose(a), choose(b)];
      if (allele.includes('M')) childMutGenes[id] = allele; // mm는 저장 안 함 (발현 안 됨)
    }
    // 부모가 발현했던 돌연변이 (새 발현 판정 기준)
    const parentExpressed = new Set([...parentA.mutations, ...parentB.mutations]);

    // 새 돌연변이 발생 (신규 변이)
    const _sc = window._arenaScene;
    const _mutStormActive = _sc && _sc._specialEventMutStormUntil && _sc.elapsed < _sc._specialEventMutStormUntil;
    const mutationRollRate = clamp(((parentA.stats.mutationRate + parentB.stats.mutationRate) / 2) * (_mutStormActive ? 3 : 1), 0, MAX_STATS.mutationRate);
    let newMutationCount = 0;
    let deferredCount = 0; // 정체 미정 신규 변이 수 (선택창에서 결정)
    const newlyGained = [];
    const forceOne = guaranteeMutation;
    if (forceOne && newMutationCount === 0) {
      if (deferPick) {
        deferredCount += 1;
        newMutationCount += 1;
      } else {
        const available = MUTATIONS.filter(m => !(childMutGenes[m.id] && childMutGenes[m.id].includes('M')));
        if (available.length) {
          const picked = choose(available).id;
          const existing = childMutGenes[picked] || ['m', 'm'];
          const idx = existing.indexOf('m');
          if (idx >= 0) existing[idx] = 'M';
          childMutGenes[picked] = existing;
          newlyGained.push(picked);
          newMutationCount += 1;
        }
      }
    }
    while (newMutationCount < MAX_NEW_MUTATIONS_PER_CHILD && Math.random() < mutationRollRate) {
      if (deferPick) {
        deferredCount += 1;
        newMutationCount += 1;
        continue;
      }
      const available = MUTATIONS.filter(m => !(childMutGenes[m.id] && childMutGenes[m.id].includes('M')));
      if (!available.length) break;
      const picked = choose(available).id;
      const existing = childMutGenes[picked] || ['m', 'm'];
      const idx = existing.indexOf('m');
      if (idx >= 0) existing[idx] = 'M'; // m 하나를 M으로 (이형접합 신규 변이)
      childMutGenes[picked] = existing;
      newlyGained.push(picked);
      newMutationCount += 1;
    }

    const child = new Individual(groupId, x, y, genes, childMutGenes);
    // geneQuality 부모 블렌드 상속
    child.geneQuality = {};
    for (const gene of Object.keys(GENES)) {
      child.geneQuality[gene] = blendQuality(
        (parentA.geneQuality || {})[gene],
        (parentB.geneQuality || {})[gene]
      );
    }
    // statBonus 부모 평균 상속 (세대 걸쳐 점진 희석)
    const ba = parentA.statBonus || {}; const bb = parentB.statBonus || {};
    child.statBonus = {
      hpMult:  1 + ((ba.hpMult  - 1 || 0) + (bb.hpMult  - 1 || 0)) / 2,
      attack:  ((ba.attack  || 0) + (bb.attack  || 0)) / 2,
      speed:   ((ba.speed   || 0) + (bb.speed   || 0)) / 2,
      defense: ((ba.defense || 0) + (bb.defense || 0)) / 2,
    };
    child.stats = child.calculateStats(); // geneQuality·statBonus 반영해 재계산
    child.hp = child.stats.hp;
    child.newMutationCount = newMutationCount;
    child._pendingNewMut = deferredCount; // 선택창 대기 중인 신규 변이 수
    // 부모에게 없던 발현 = 진짜 새 획득 (멘델 재조합으로 새로 발현된 것 포함)
    child.newlyGained = child.mutations.filter(id => !parentExpressed.has(id));
    return child;
  }
}

class Group {
  constructor(x, y, isPlayer = false, name = 'AI 집단') {
    this.id = `group_${++nextGroupId}`;
    this.name = name;
    this.x = x;
    this.y = y;
    this.isPlayer = isPlayer;
    this.food = START_FOOD;
    this.state = 'normal';
    this.battleId = null;
    this.individuals = [];
    this.generation = 0;
    this.wins = 0;
    this.losses = 0;
    this.recruited = 0;
    this.recruitedAway = 0;
    this.escapes = 0;
    this.starved = 0;
    this.terrainEventDeaths = 0;
    this.driftEvents = 0;
    this.mutationEvents = 0;
    this.currentBattleRecruits = 0;
    this.color = isPlayer ? 0x38bdf8 : choose([0xfb7185, 0xf97316, 0xa78bfa, 0x2dd4bf, 0xfacc15, 0x84cc16]);
    this.aiTimer = 0;
    this.aiDirection = { x: 1, y: 0 };
  }

  get count() {
    return this.individuals.length;
  }

  _maxPop() {
    return this.isPlayer ? MAX_INDIVIDUALS + ((LAB_BUFFS && LAB_BUFFS.maxPopBonus) || 0) : MAX_INDIVIDUALS;
  }

  need() {
    const base = this.individuals.reduce((sum, individual) => sum + individual.stats.foodNeed, 0);
    const mult = (this.isPlayer && LAB_BUFFS && LAB_BUFFS.foodNeedMult) || 1;
    return mult === 1 ? base : base * mult;
  }

  surplus() {
    return this.food - this.need();
  }

  canBreed() {
    const bc = this.isPlayer && LAB_BUFFS ? Math.max(1, Math.round(BREED_COST * LAB_BUFFS.breedCostMult)) : BREED_COST;
    const minPop = this.isPlayer ? 5 : 2;
    const minFood = this.isPlayer ? bc * 10 : bc;
    return this.state === 'normal' && this.count >= minPop && this.count < this._maxPop() && this.surplus() >= minFood;
  }

  average(stat) {
    if (!this.individuals.length) return 0;
    return this.individuals.reduce((sum, individual) => sum + (individual.stats[stat] || 0), 0) / this.individuals.length;
  }

  // Shannon diversity index (0~1) across all gene allele frequencies
  calcDiversity() {
    const freq = this.geneFrequency();
    let H = 0;
    for (const pct of Object.values(freq)) {
      const p = clamp(pct / 100, 0.001, 0.999);
      const q = 1 - p;
      H -= p * Math.log2(p) + q * Math.log2(q);
    }
    return H / Object.keys(GENES).length; // normalize 0~1 (1 = all genes at 50/50)
  }

  mutationFrequency() {
    const frequency = {};
    if (!this.individuals.length) return frequency;
    for (const individual of this.individuals) {
      for (const mutationId of individual.mutations) frequency[mutationId] = (frequency[mutationId] || 0) + 1;
    }
    for (const key of Object.keys(frequency)) frequency[key] = frequency[key] / this.individuals.length * 100;
    return frequency;
  }

  geneFrequency() {
    // 대립유전자 빈도: 전체 대립유전자 풀에서 우성 대립유전자의 비율 (p값)
    // 개체당 2개 대립유전자 → 전체 풀 크기 = 개체수 × 2
    const frequency = {};
    if (!this.individuals.length) return frequency;
    for (const gene of Object.keys(GENES)) {
      const dominant = GENES[gene].dominant;
      let domCount = 0;
      for (const individual of this.individuals) {
        domCount += individual.genes[gene].filter(a => a === dominant).length;
      }
      frequency[gene] = domCount / (this.individuals.length * 2) * 100;
    }
    return frequency;
  }

  genotypeFrequency(gene) {
    const frequency = {};
    if (!this.individuals.length) return frequency;
    for (const individual of this.individuals) {
      const genotype = getGenotypeLabel(individual, gene);
      frequency[genotype] = (frequency[genotype] || 0) + 1;
    }
    for (const genotype of Object.keys(frequency)) frequency[genotype] = frequency[genotype] / this.individuals.length * 100;
    return frequency;
  }

  survivalTick() {
    const need = this.need();
    if (this.food >= need) {
      this.food -= need;
      return { deaths: 0, consumed: need };
    }
    const deficit = need - this.food;
    this.food = 0;
    const overTarget = Math.max(0, this.count - TARGET_POPULATION);
    const deficitDeaths = Math.ceil(deficit / STARVATION_DEFICIT_DIVISOR);
    const populationPressureDeaths = Math.ceil(overTarget * 0.5);
    const maxDeaths = Math.max(0, this.count - 2);
    const deathCount = clamp(Math.max(1, deficitDeaths, populationPressureDeaths), 1, maxDeaths);
    const victims = this.sortStarvationVictims().slice(0, deathCount);
    if (!victims.length) return { message: '살아남은 개체가 없습니다.', deaths: 0 };
    const victimIds = new Set(victims.map(individual => individual.id));
    this.individuals = this.individuals.filter(individual => !victimIds.has(individual.id));
    this.starved += victims.length;
    return { deaths: victims.length, consumed: 0 };
  }

  pickStarvationVictim() {
    return this.sortStarvationVictims()[0] || null;
  }

  sortStarvationVictims() {
    return [...this.individuals].sort((a, b) => {
      const foodNeedDelta = b.stats.foodNeed - a.stats.foodNeed;
      if (foodNeedDelta !== 0) return foodNeedDelta;
      return (a.hp / a.stats.hp) - (b.hp / b.stats.hp);
    });
  }

  // 밀도 의존 번식률: 개체수↑ → 번식 감소 (환경 수용력)
  densityFactor() {
    return Math.max(0.10, 1 - (this.count / this._maxPop()) * 0.88);
  }

  breed() {
    if (!this.canBreed()) return 0;
    const breedCost = this.isPlayer && LAB_BUFFS
      ? Math.max(1, Math.round(BREED_COST * LAB_BUFFS.breedCostMult))
      : BREED_COST;
    const rawCount = this.isPlayer ? 10 : Math.floor(this.surplus() / breedCost);
    const childCount = Math.min(Math.max(1, this.isPlayer ? rawCount : Math.floor(rawCount * this.densityFactor())), this._maxPop() - this.count);
    if (childCount <= 0) return 0;
    this.food -= childCount * breedCost;
    this.generation += 1;
    let newMutations = 0;
    this.lastGainedMutations = []; // 이번 번식에서 새로 발현된 돌연변이 ID
    this._pendingMutChildren = []; // 돌연변이 정체 선택 대기 자손 (플레이어 전용)
    // 번식 돌연변이 기본값은 무작위 발현 — 계통수 [돌연변이 선별] 구매 시 3택1 선택창 해금
    // (설정의 [번식 돌연변이 선택창] 토글로 켜고 끌 수 있음. 튜토리얼 중에는 항상 무작위)
    const deferPick = this.isPlayer
      && LAB_BUFFS && LAB_BUFFS.breedMutPick
      && typeof window !== 'undefined' && window._arenaScene && !window._arenaScene.tutorialActive
      && Save.get('gpa_breedpick_off') !== '1';
    for (let i = 0; i < childCount; i += 1) {
      const parentA = this.pickParent();
      const parentB = this.pickParent(parentA);
      if (!parentA || !parentB) break;
      const child = Individual.breed(parentA, parentB, this.id, this.x + (Math.random() - 0.5) * 84, this.y + (Math.random() - 0.5) * 84, i === 0 && !!this._guaranteeNextMutation, deferPick);
      newMutations += child.newMutationCount;
      for (const id of child.newlyGained) {
        if (!this.lastGainedMutations.includes(id)) this.lastGainedMutations.push(id);
      }
      if (child._pendingNewMut > 0) this._pendingMutChildren.push(child);
      this.individuals.push(child);
      // Twin chance (player only)
      if (this.isPlayer && LAB_BUFFS && LAB_BUFFS.twinChance > 0
          && Math.random() < LAB_BUFFS.twinChance && this.individuals.length < this._maxPop()) {
        const twin = Individual.breed(parentA, parentB, this.id, this.x + (Math.random()-0.5)*84, this.y + (Math.random()-0.5)*84, false, deferPick);
        if (twin._pendingNewMut > 0) this._pendingMutChildren.push(twin);
        this.individuals.push(twin);
      }
    }
    this.mutationEvents += newMutations;
    return childCount;
  }

  pickParent(exclude = null) {
    const candidates = exclude ? this.individuals.filter(i => i !== exclude) : this.individuals;
    if (!candidates.length) return null;
    // 선택 가중치 = 번식력 × (1 + 매력 보너스)
    // 매력이 높을수록 짝으로 선택될 확률 상승 (성선택)
    const weight = i => i.stats.fertility * (1 + i.stats.charm * 0.04);
    const total = candidates.reduce((sum, i) => sum + weight(i), 0);
    let roll = Math.random() * total;
    for (const i of candidates) {
      roll -= weight(i);
      if (roll <= 0) return i;
    }
    return candidates[candidates.length - 1];
  }

  aiTick(dt) {
    if (this.state !== 'normal' || !this.individuals.length) return;
    this.aiTimer -= dt;
    if (this.aiTimer <= 0) {
      this.aiTimer = 1600 + Math.random() * 3600;
      const angle = Math.random() * Math.PI * 2;
      this.aiDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      if (this.canBreed() && Math.random() < 0.45) this.breed();
    }
    const speed = (this.average('speed') / 80) * 128 * (dt / 1000);
    this.x = clamp(this.x + this.aiDirection.x * speed, 60, WORLD_W - 60);
    this.y = clamp(this.y + this.aiDirection.y * speed, 60, WORLD_H - 60);
  }
}

class Battle {
  constructor(groupA, groupB, terrainA = TERRAIN.plain, terrainB = TERRAIN.plain) {
    this.id = `battle_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.groupA = groupA;
    this.groupB = groupB;
    this.startedAt = Date.now();
    this.active = true;
    this.winner = null;
    this.recruitsA = 0; // groupA가 이 전투에서 포섭한 수
    this.recruitsB = 0; // groupB가 이 전투에서 포섭한 수
    this.isPlayerBattle = groupA.isPlayer || groupB.isPlayer;
    this.onHit = null; // 플레이어 전투 시 타격 이펙트 콜백 (ArenaScene이 주입)
    // Terrain-based attack multiplier (natural selection in battle)
    this.bonusA = Battle.calcTerrainBattleBonus(groupA, terrainA);
    this.bonusB = Battle.calcTerrainBattleBonus(groupB, terrainB);
    groupA.state = 'battle';
    groupB.state = 'battle';
    groupA.battleId = this.id;
    groupB.battleId = this.id;
    groupA.currentBattleRecruits = 0;
    groupB.currentBattleRecruits = 0;
    this.sideA = [...groupA.individuals].sort(() => Math.random() - 0.5).slice(0, MAX_BATTLE_INDIVIDUALS);
    this.sideB = [...groupB.individuals].sort(() => Math.random() - 0.5).slice(0, MAX_BATTLE_INDIVIDUALS);
  }

  tick() {
    if (!this.active) return;
    if (this.isPlayerBattle) {
      // 플레이어 전투는 타이머 없음 — 거리 이탈·전멸·도망으로만 종료 (실시간 액션)
      const centerDist = Math.hypot(this.groupA.x - this.groupB.x, this.groupA.y - this.groupB.y);
      if (centerDist >= BATTLE_DISENGAGE_DIST) return this.end('disengage');
    } else if (Date.now() - this.startedAt >= BATTLE_DURATION) {
      return this.end('timeout');
    }
    const liveA = this.sideA.filter(i => !i.dead && i.groupId === this.groupA.id);
    const liveB = this.sideB.filter(i => !i.dead && i.groupId === this.groupB.id);
    if (!liveA.length && !liveB.length) return this.end('draw');
    if (!liveA.length) return this.end('groupB');
    if (!liveB.length) return this.end('groupA');
    const allA = this.groupA.individuals.filter(i => !i.dead);
    const allB = this.groupB.individuals.filter(i => !i.dead);
    const now = Date.now();

    // 전투 (공격)
    for (const attacker of liveA) this.attack(attacker, allB, now, this.bonusA);
    for (const attacker of liveB) this.attack(attacker, allA, now, this.bonusB);

    // 포섭 — 집단 단위로 1회씩 시도 (비대칭 보장)
    // 매력 우위가 있는 쪽만 포섭 가능, 우위 크기가 성공률 결정
    this.tryRecruit(this.groupA, this.groupB);
    this.tryRecruit(this.groupB, this.groupA);

    this.groupA.individuals = this.groupA.individuals.filter(i => !i.dead);
    this.groupB.individuals = this.groupB.individuals.filter(i => !i.dead);
    if (!this.groupA.individuals.length) this.end('groupB');
    if (!this.groupB.individuals.length) this.end('groupA');
  }

  // 개별 공격 (포섭 로직 분리) — 사거리·크리티컬·넉백·스킬 버프 적용
  attack(attacker, foes, now, terrainBonus = 1) {
    if (attacker.dead || !foes.length) return;
    const sc = this.isPlayerBattle ? window._arenaScene : null;
    const isPlayerSide = sc && attacker.groupId === sc.player.id;
    let cooldown = BATTLE_ATTACK_COOLDOWN;
    if (isPlayerSide && sc.combatBuffActive('onslaught')) cooldown *= 0.6; // 돌격: 공격 속도 +40%
    if (sc && !isPlayerSide && sc.combatBuffActive('fear')) cooldown *= 2;  // 위협: 적 공격 속도 -50%
    if (now - attacker.lastAttackAt < cooldown) return;
    const target = nearest(attacker, foes.filter(f => !f.dead));
    if (!target) return;
    // 근접 사거리: 거리를 벌리면 맞지 않음 (위치 선정이 곧 전술)
    if (Math.hypot(target.x - attacker.x, target.y - attacker.y) > BATTLE_MELEE_RANGE) return;
    attacker.lastAttackAt = now;
    let dmgMult = 1;
    if (isPlayerSide) {
      if (sc.combatBuffActive('onslaught')) dmgMult *= 1 + 0.4 * (sc.combat.power.onslaught || 1); // 돌격: 피해 +40%×위력
      dmgMult *= 1 + Math.min(COMBO_DMG_CAP, (sc.combat?.combo || 0) * COMBO_DMG_PER_STACK);
    }
    if (sc && target.groupId === sc.player.id && sc.combatBuffActive('rally')) dmgMult *= 0.5; // 결집: 받는 피해 -50%
    const crit = Math.random() < CRIT_CHANCE;
    if (crit) dmgMult *= CRIT_MULT;
    const dmg = target.takeHit(attacker.stats.attack * terrainBonus, dmgMult);
    // 넉백: 공격자 반대 방향으로 밀려남 (크리는 2배)
    const kdx = target.x - attacker.x, kdy = target.y - attacker.y;
    const kd = Math.hypot(kdx, kdy) || 1;
    const push = crit ? KNOCKBACK_PX * 2 : KNOCKBACK_PX;
    target.x = clamp(target.x + kdx / kd * push, 20, WORLD_W - 20);
    target.y = clamp(target.y + kdy / kd * push, 20, WORLD_H - 20);
    if (this.isPlayerBattle) {
      Audio.sfxHit();
      if (this.onHit) this.onHit(target.x, target.y);
      if (crit && sc && sc.spawnFloatText) sc.spawnFloatText(target.x, target.y - 18, `💢${dmg}`, '#ffb020', 15);
      // 포식: 플레이어 개체가 적을 처치하면 진화 EXP + 콤보 (전투가 유일한 진화 동력)
      if (target.dead && isPlayerSide) sc.registerPlayerKill(target.x, target.y);
    }
  }

  // 집단 단위 포섭 시도 — 매력 우위를 가진 쪽만 성공 가능
  tryRecruit(atkGroup, defGroup) {
    if (atkGroup.currentBattleRecruits >= MAX_RECRUIT_PER_BATTLE) return;

    const atkCharm = atkGroup.average('charm');
    const defCharm = defGroup.average('charm');
    const charmAdv = atkCharm - defCharm; // 양수면 포섭 측 유리

    // 매력 우위 없으면 포섭 불가 (비대칭 핵심)
    if (charmAdv <= 0) return;

    // 성공률: 매력차 / (최대가능 매력) 기반, 최대 70%
    const maxCharm = 50;
    const chance = clamp(charmAdv / maxCharm * 1.4, 0.05, 0.70);
    if (Math.random() > chance) return;

    // 가장 HP가 낮은 적 개체 대상 (0% ~ 60% HP만 포섭 가능)
    const wounded = defGroup.individuals
      .filter(i => !i.dead && i.hp / i.stats.hp < 0.6)
      .sort((a, b) => (a.hp / a.stats.hp) - (b.hp / b.stats.hp));
    if (!wounded.length) return;

    const target = wounded[0];
    defGroup.individuals = defGroup.individuals.filter(i => i !== target);
    target.groupId = atkGroup.id;
    target.hp = target.stats.hp * 0.4;
    atkGroup.individuals.push(target);
    atkGroup.recruited += 1;
    atkGroup.currentBattleRecruits += 1;
    defGroup.recruitedAway += 1;
    if (atkGroup === this.groupA) this.recruitsA += 1; else this.recruitsB += 1;
  }

  // 지형-유전자 전투 보너스: 해당 지형에 유리한 형질 보유 비율에 따라 최대 +20% 공격력
  static calcTerrainBattleBonus(group, terrain) {
    if (!group.individuals.length) return 1;
    const n = group.individuals.length;
    const ratio = (predicate) => group.individuals.filter(predicate).length / n;
    switch (terrain.id) {
      case 'volcano': return 1 + ratio(i => getGenotypeLabel(i, 'color') === 'RR') * 0.20;
      case 'desert':  return 1 + ratio(i => getGenotypeLabel(i, 'color') === 'BB') * 0.20;
      case 'snow':    return 1 + ratio(i => i.hasDominant('armor')) * 0.15;
      case 'swamp':   return 1 + ratio(i => i.hasDominant('poison')) * 0.18;
      case 'forest':  return 1 + ratio(i => i.hasDominant('charm')) * 0.10;
      default:        return 1;
    }
  }

  end(reason) {
    if (!this.active) return;
    this.active = false;
    this.endReason = reason;
    const resolve = (winner, loser) => {
      const loot = Math.floor(loser.food * 0.5);
      winner.food = Math.min(FOOD_CAP, winner.food + loot);
      loser.food -= loot;
      winner.wins += 1;
      loser.losses += 1;
      this.winner = winner;
      winner.state = 'normal';
      loser.state = loser.individuals.length ? 'normal' : 'defeated';
    };
    if (reason === 'groupA') resolve(this.groupA, this.groupB);
    else if (reason === 'groupB') resolve(this.groupB, this.groupA);
    else {
      this.groupA.state = this.groupA.individuals.length ? 'normal' : 'defeated';
      this.groupB.state = this.groupB.individuals.length ? 'normal' : 'defeated';
    }
    this.groupA.battleId = null;
    this.groupB.battleId = null;
  }

}

function nearest(source, list) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of list) {
    const distance = Phaser.Math.Distance.Between(source.x, source.y, target.x, target.y);
    if (distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

