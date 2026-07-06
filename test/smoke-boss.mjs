// 브라우저 없이 index.html의 인라인 스크립트를 스텁 환경에서 부팅하여
// 보스 데이터/웨이브 추첨 로직을 검증한다. (Phaser/DOM 등은 catch-all 프록시로 무력화)
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// 가장 긴 인라인 스크립트 = 메인 게임 스크립트 (앞쪽의 짧은 가드 스크립트는 건너뜀)
const scripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
if (!scripts.length) { console.error('인라인 스크립트를 찾지 못함'); process.exit(1); }
const code = scripts.reduce((a, b) => (b.length > a.length ? b : a), '');

// 어떤 접근/호출/생성에도 자기 자신을 돌려주고 0/''로 강제변환되는 만능 스텁
const stub = new Proxy(function(){}, {
  get(_t, p){ if (p === Symbol.toPrimitive) return () => 0; if (p === 'toString') return () => ''; return stub; },
  apply(){ return stub; },
  construct(){ return stub; },
  has(){ return true; },
});
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO: 0, Scale: stub, Math: Math };

let api;
try {
  const factory = new Function(
    'Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { BOSS_ROSTER, bossById, WAVE_HP, WAVE_FIRST_AT, WAVE_COOLDOWN, getGenotypeLabel, BOSS_PATTERNS, bossHasPhase2 };'
  );
  api = factory(Phaser, stub, stub, stub, stub, stub, function(){return 0;});
} catch (e) {
  console.error('스크립트 부팅 실패:', e.name, e.message);
  process.exit(1);
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) 로스터 무결성 — 히든 1(golden), 최종 1(primordial), 나머지는 중간보스
const hidden = api.BOSS_ROSTER.filter(b => b.hidden);
const finals = api.BOSS_ROSTER.filter(b => b.final);
if (hidden.length !== 1 || hidden[0].id !== 'golden') fail(`히든 보스 ${hidden.map(b=>b.id).join(',')} (기대: golden 1개)`);
if (finals.length !== 1 || finals[0].id !== 'primordial') fail(`최종 보스 ${finals.map(b=>b.id).join(',')} (기대: primordial 1개)`);
if (!api.bossById('lava') || api.bossById('lava').name !== '용암 거인') fail('bossById("lava") 실패');
const ids = new Set(api.BOSS_ROSTER.map(b => b.id));
if (ids.size !== api.BOSS_ROSTER.length) fail('보스 id 중복 존재');
// 모든 보스가 safe 함수와 이름/아이콘/조건 설명을 가짐
for (const b of api.BOSS_ROSTER) {
  if (typeof b.safe !== 'function') fail(`${b.id} safe 함수 없음`);
  if (!b.name || !b.ico || !b.reqText) fail(`${b.id} name/ico/reqText 누락`);
}

// 2) 웨이브 추첨 풀 — 단일 조건·복합 조건 보스가 각각 존재해야 _rollWaveList가 성립
const single = api.BOSS_ROSTER.filter(b => !b.hidden && !b.final && !b.reqText.includes('+'));
const dual   = api.BOSS_ROSTER.filter(b => !b.hidden && !b.final &&  b.reqText.includes('+'));
if (single.length < 1) fail('단일 조건 중간보스 풀이 비어 있음');
if (dual.length < 1) fail('복합 조건 중간보스 풀이 비어 있음');
if (single.length + dual.length + 2 !== api.BOSS_ROSTER.length)
  fail(`보스 분류 합계 불일치: 단일${single.length}+복합${dual.length}+2 != ${api.BOSS_ROSTER.length}`);

// 3) safe 조건 — 합성 개체로 검증
const ind = (color, muts = [], stats = {}) => ({
  genes: { color, poison: ['p','p'], charm: ['c','c'] },
  mutations: muts,
  stats: { hp: 100, speed: 90, defense: 5, attack: 10, charm: 10, gather: 3, ...stats },
  hasDominant: () => false,
});
const rr = ind(['R','R']); const bb = ind(['B','B']);
const armored = ind(['R','B'], ['hard_shell']);
try {
  const glacier = api.bossById('glacier'); // 단단한 껍질 등 요구
  if (glacier.safe(armored) !== true) fail('빙하 군주: 단단한 껍질 개체가 안전해야 함');
  if (glacier.safe(rr) !== false) fail('빙하 군주: 무방비 개체는 도태 대상이어야 함');
  const lava = api.bossById('lava'); // RR 요구
  if (lava.safe(rr) !== true) fail('용암 거인: RR 개체가 안전해야 함');
  if (lava.safe(bb) !== false) fail('용암 거인: BB 개체는 도태 대상이어야 함');
  // 최종 보스: 5항목 중 4가지 충족 필요
  const weak = ind(['R','B']);
  const strong = ind(['R','B'], [], { hp: 150, speed: 110, defense: 12, attack: 25, charm: 20 });
  const prim = api.bossById('primordial');
  if (prim.safe(weak) !== false) fail('태초의 포식자: 무성장 개체는 도태 대상이어야 함');
  if (prim.safe(strong) !== true) fail('태초의 포식자: 5항목 충족 개체는 안전해야 함');
  // 황금 슬라임: 5가지 전부 필요
  const golden = api.bossById('golden');
  if (golden.safe(strong) !== true) fail('황금 슬라임: 5항목 전부 충족 개체는 안전해야 함');
  if (golden.safe(ind(['R','B'], [], { hp: 150, speed: 110, defense: 12, attack: 25 })) !== false)
    fail('황금 슬라임: 4항목만 충족한 개체는 도태 대상이어야 함');
} catch (e) {
  fail('safe 평가 중 예외: ' + e.message + ' (합성 개체 형태 확인 필요)');
}

// 3.5) 특수 패턴 — 모든 보스에 유효한 패턴 배정
for (const b of api.BOSS_ROSTER) {
  const p = api.BOSS_PATTERNS[b.id];
  if (!['shockwave', 'dash', 'both'].includes(p)) fail(`${b.id} 특수 패턴 누락/불명: ${p}`);
}
if ((api.BOSS_PATTERNS.golden !== 'both') || (api.BOSS_PATTERNS.primordial !== 'both'))
  fail('최종/히든 보스는 both 패턴이어야 함');

// 3.6) 2페이즈 대상 — 복합 조건 4 + 최종 1 + 히든 1 = 6
const p2 = api.BOSS_ROSTER.filter(b => api.bossHasPhase2(b)).map(b => b.id);
if (p2.length !== 6) fail(`2페이즈 대상 ${p2.length}개 (기대 6): ${p2.join(',')}`);
if (!api.bossHasPhase2(api.bossById('steel'))) fail('복합 보스(steel)는 2페이즈 대상이어야 함');
if (api.bossHasPhase2(api.bossById('lava'))) fail('단일 보스(lava)는 2페이즈 대상이 아니어야 함');

// 4) 웨이브 스케줄 상수 — 보스 3마리(단일→복합→최종) HP 오름차순
if (!Array.isArray(api.WAVE_HP) || api.WAVE_HP.length !== 3) fail(`WAVE_HP 길이 ${api.WAVE_HP?.length} (기대 3)`);
else if (!(api.WAVE_HP[0] < api.WAVE_HP[1] && api.WAVE_HP[1] < api.WAVE_HP[2])) fail('WAVE_HP가 오름차순이 아님');
if (!(api.WAVE_FIRST_AT > 0 && api.WAVE_COOLDOWN > 0)) fail('WAVE_FIRST_AT/WAVE_COOLDOWN 이상');

// 5) _rollWaveList 알고리즘 재현 — [단일 랜덤, 복합 랜덤, 최종] 형태 검증
for (let k = 0; k < 2000; k++) {
  const pick1 = single[Math.floor(Math.random() * single.length)];
  const pick2 = dual[Math.floor(Math.random() * dual.length)];
  const wave = [pick1.id, pick2.id, finals[0].id];
  if (new Set(wave).size !== 3) fail('웨이브에 중복 보스 발생: ' + wave.join(','));
  if (wave[2] !== 'primordial') fail('최종 슬롯이 primordial이 아님');
}

if (process.exitCode) {
  console.error('smoke-boss FAILED');
} else {
  console.log(`smoke-boss ok — 로스터${api.BOSS_ROSTER.length}(단일${single.length}/복합${dual.length}/히든1/최종1), safe조건, 웨이브 규칙`);
}
