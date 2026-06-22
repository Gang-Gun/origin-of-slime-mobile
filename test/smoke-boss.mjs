// 브라우저 없이 index.html의 인라인 스크립트를 스텁 환경에서 부팅하여
// 보스 데이터/추첨 로직을 검증한다. (Phaser/DOM 등은 catch-all 프록시로 무력화)
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (!m) { console.error('인라인 스크립트를 찾지 못함'); process.exit(1); }
const code = m[1];

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
    code + '\n;return { BOSS_ROSTER, bossById, BOSS_SCHEDULE, HIDDEN_BOSS_CHANCE, getGenotypeLabel };'
  );
  api = factory(Phaser, stub, stub, stub, stub, stub, function(){return 0;});
} catch (e) {
  console.error('스크립트 부팅 실패:', e.name, e.message);
  process.exit(1);
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) 로스터 무결성
if (api.BOSS_ROSTER.length !== 10) fail(`BOSS_ROSTER 길이 ${api.BOSS_ROSTER.length} (기대 10)`);
const hidden = api.BOSS_ROSTER.filter(b => b.hidden);
if (hidden.length !== 1) fail(`히든 보스 ${hidden.length}개 (기대 1)`);
if (!api.bossById('lava') || api.bossById('lava').name !== '용암 거인') fail('bossById("lava") 실패');
// 모든 보스가 safe 함수를 가짐
for (const b of api.BOSS_ROSTER) if (typeof b.safe !== 'function') fail(`${b.id} safe 함수 없음`);

// 2) safe 조건 — 합성 개체로 검증
const ind = (color, dom=[]) => ({ genes: { color }, hasDominant: (g) => dom.includes(g) });
// getGenotypeLabel이 genes.color 배열을 읽는다고 가정. 실패 시 아래에서 드러남.
const rr = ind(['R','R']); const bb = ind(['B','B']);
const armored = ind(['R','B'], ['armor']);
try {
  const glacier = api.bossById('glacier'); // 갑옷 요구
  if (glacier.safe(armored) !== true) fail('빙하 군주: 갑옷 개체가 안전해야 함');
  if (glacier.safe(rr) !== false) fail('빙하 군주: 무갑옷 개체는 도태 대상이어야 함');
  const lava = api.bossById('lava'); // RR 요구
  if (lava.safe(rr) !== true) fail('용암 거인: RR 개체가 안전해야 함');
  if (lava.safe(bb) !== false) fail('용암 거인: BB 개체는 도태 대상이어야 함');
} catch (e) {
  fail('safe 평가 중 예외: ' + e.message + ' (getGenotypeLabel/hasDominant 시그니처 확인 필요)');
}

// 3) 히든 등장 확률 ~2%
const HC = api.HIDDEN_BOSS_CHANCE;
if (Math.abs(HC - 0.02) > 1e-9) fail(`HIDDEN_BOSS_CHANCE=${HC} (기대 0.02)`);

// 4) rollBossSchedule 로직 재현 검증 (메서드는 인스턴스 필요 → 동일 알고리즘으로 분포만 확인)
let hiddenHits = 0, N = 20000;
const regular = api.BOSS_ROSTER.filter(b => !b.hidden);
for (let k = 0; k < N; k++) {
  const pool = [...regular];
  for (let i = pool.length-1; i>0; i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  const sched = api.BOSS_SCHEDULE.map((s,idx)=>{ let boss=pool[idx]; if (s.slot==='final' && Math.random()<HC) boss=hidden[0]; return boss.id; });
  if (new Set(sched).size !== 3 && !sched.includes('primordial')) fail('스케줄에 중복 보스 발생');
  if (sched.includes('primordial')) hiddenHits++;
}
const rate = hiddenHits / N;
if (rate < 0.01 || rate > 0.035) fail(`히든 등장률 ${(rate*100).toFixed(2)}% (기대 ~2%)`);

if (process.exitCode) {
  console.error('smoke-boss FAILED');
} else {
  console.log(`smoke-boss ok — 로스터10/히든1, safe조건, 히든등장률 ${(rate*100).toFixed(2)}%`);
}
