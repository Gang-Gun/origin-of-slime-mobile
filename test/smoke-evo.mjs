// 진화 게이지 시스템 순수 로직 검증 (DOM/Phaser 없이)
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// 가장 긴 인라인 스크립트 = 메인 게임 스크립트 (앞쪽의 짧은 가드 스크립트는 건너뜀)
const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (!scripts.length) { console.error('인라인 스크립트를 찾지 못함'); process.exit(1); }
const code = scripts.reduce((a, b) => (b.length > a.length ? b : a), '');

const stub = new Proxy(function(){}, {
  get(_t, p){ if (p === Symbol.toPrimitive) return () => 0; if (p === 'toString') return () => ''; return stub; },
  apply(){ return stub; },
  construct(){ return stub; },
  has(){ return true; },
});
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO: 0, Scale: stub, Math: Math };

let api;
try {
  api = new Function('Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { evoExpNeedFor, rollEvolutionCandidates, MUTATIONS, EVO_EXP_BASE, EVO_CHOICES_BASE, EVO_BATTLE_EXP, EVO_KILL_EXP, ACHIEVEMENTS };'
  )(Phaser, stub, stub, stub, stub, stub, function(){return 0;});
} catch (e) {
  console.error('스크립트 부팅 실패:', e.name, e.message);
  process.exit(1);
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) EXP 곡선 — 양수·단조 증가
if (api.evoExpNeedFor(1) !== api.EVO_EXP_BASE) fail(`레벨1 필요량 ${api.evoExpNeedFor(1)} != EVO_EXP_BASE ${api.EVO_EXP_BASE}`);
for (let lv = 1; lv < 12; lv++) {
  if (!(api.evoExpNeedFor(lv + 1) > api.evoExpNeedFor(lv))) fail(`EXP 곡선이 레벨 ${lv}→${lv+1}에서 증가하지 않음`);
}
if (api.EVO_CHOICES_BASE < 2) fail('기본 선택지가 2개 미만');
if (!(api.EVO_BATTLE_EXP > 0)) fail('전쟁 승리 EXP가 0 이하');
if (!(api.EVO_KILL_EXP > 0)) fail('전투 처치 EXP가 0 이하');

// 2) 후보 추첨 — 불이익(bad) 형질과 집단 보편화 형질 제외
const badIds = new Set(api.MUTATIONS.filter(m => m.type === 'bad').map(m => m.id));
const mkInd = (muts) => ({ dead: false, mutations: muts });
const group = { individuals: [mkInd(['hard_shell']), mkInd(['hard_shell']), mkInd(['hard_shell', 'fast_legs'])] };
for (let k = 0; k < 300; k++) {
  const picks = api.rollEvolutionCandidates(group, 3);
  if (picks.length !== 3) fail(`후보 수 ${picks.length} (기대 3)`);
  for (const id of picks) {
    if (badIds.has(id)) fail(`불이익 형질 ${id}이(가) 후보에 등장`);
    if (id === 'hard_shell') fail('집단 전체가 이미 가진 형질이 후보에 등장');
  }
  if (new Set(picks).size !== picks.length) fail('후보 중복 발생');
}
// fast_legs는 일부만 보유 → 후보에 나올 수 있어야 함
let sawPartial = false;
for (let k = 0; k < 500 && !sawPartial; k++) {
  if (api.rollEvolutionCandidates(group, 3).includes('fast_legs')) sawPartial = true;
}
if (!sawPartial) fail('일부만 보유한 형질(fast_legs)이 500회 추첨에서 한 번도 안 나옴');

// 3) 모든 good/dual 형질이 보편화되면 빈 배열
const allGoodDual = api.MUTATIONS.filter(m => m.type !== 'bad').map(m => m.id);
const maxed = { individuals: [mkInd(allGoodDual), mkInd(allGoodDual)] };
if (api.rollEvolutionCandidates(maxed, 3).length !== 0) fail('완전 진화 집단인데 후보가 나옴');

// 4) 진화 도전과제 존재 + evoLevel 판정
const lv3 = api.ACHIEVEMENTS.find(a => a.id === 'evo_lv3');
const lv6 = api.ACHIEVEMENTS.find(a => a.id === 'evo_lv6');
if (!lv3 || !lv6) fail('진화 도전과제(evo_lv3/evo_lv6) 누락');
if (lv3 && lv3.check(null, 0, { evoLevel: 3 }) !== true) fail('evo_lv3: 레벨 3인데 미달성 판정');
if (lv3 && lv3.check(null, 0, { evoLevel: 2 }) !== false) fail('evo_lv3: 레벨 2인데 달성 판정');
if (lv6 && lv6.check(null, 0, {}) !== false) fail('evo_lv6: evoLevel 없는데 달성 판정');

if (process.exitCode) {
  console.error('smoke-evo FAILED');
} else {
  console.log(`smoke-evo ok — EXP곡선(기본 ${api.EVO_EXP_BASE}), 후보추첨 규칙, 도전과제 판정`);
}
