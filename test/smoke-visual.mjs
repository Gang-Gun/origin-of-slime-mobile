import { loadGameCode } from './helpers/game-code.mjs';
const code = loadGameCode();
const stub = new Proxy(function(){}, { get(_t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p==='toString') return ()=>''; return stub; }, apply(){return stub;}, construct(){return stub;}, has(){return true;} });
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO:0, Scale: stub };
let api;
try {
  api = new Function('Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { MUTATION_SIG_IDS, signatureMutations, dominantMutationType, creatureTextureKey, getBodyColor, BOSS_VISUAL, BOSS_ROSTER };'
  )(Phaser, stub, stub, stub, stub, stub, function(){return 0;});
} catch(e){ console.error('부팅 실패:', e.name, e.message); process.exit(1); }
const fail = (msg)=>{ console.error('✗ '+msg); process.exitCode=1; };
if (api.dominantMutationType([]) !== 'none') fail('빈 배열 → none');
if (api.dominantMutationType(['strong_jaw','fast_legs']) !== 'good') fail('good 다수 → good');
if (api.dominantMutationType(['weak_jaw','strong_jaw']) !== 'bad') fail('동수 → bad 우선');
if (api.dominantMutationType(['hard_shell','large_body']) !== 'dual') fail('dual 다수 → dual');
// 전 돌연변이 시그니처화: signatureMutations는 발현 목록 전체를 정렬해 반환
const sig = api.signatureMutations(['efficient_metabolism','poison_gland','hard_shell']);
if (sig.join(',') !== 'efficient_metabolism,hard_shell,poison_gland') fail('시그니처 정렬 실패: '+sig.join(','));
if (![...api.MUTATION_SIG_IDS].includes('weak_jaw')) fail('모든 돌연변이가 시그니처여야 함 (weak_jaw 누락)');
const ind = { genes: { color: ['R','R'] }, mutations: ['hard_shell','large_body','weak_jaw'] };
const key = api.creatureTextureKey(ind);
if (!/^creature_\d+_hard_shell\.weak_jaw_dual$/.test(key)) fail('키 형식 이상: '+key);
if (key.includes('large_body')) fail('스케일 전용이 키에 포함됨: '+key);
for (const b of api.BOSS_ROSTER) {
  const v = api.BOSS_VISUAL[b.id];
  if (!v) { fail('보스 비주얼 누락: '+b.id); continue; }
  if (!v.pal || ['d','m','l','a'].some(k => typeof v.pal[k] !== 'number')) fail('팔레트 불완전: '+b.id);
  if (!v.shape || !Array.isArray(v.parts)) fail('shape/parts 누락: '+b.id);
}
if (Object.keys(api.BOSS_VISUAL).length !== api.BOSS_ROSTER.length) fail(`BOSS_VISUAL 개수(${Object.keys(api.BOSS_VISUAL).length}) != BOSS_ROSTER 개수(${api.BOSS_ROSTER.length})`);
if (process.exitCode) console.error('smoke-visual FAILED');
else console.log('smoke-visual ok — type판정/시그니처/키 정상');
