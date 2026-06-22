import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (!m) { console.error('인라인 스크립트 없음'); process.exit(1); }
const code = m[1];
const stub = new Proxy(function(){}, { get(_t,p){ if(p===Symbol.toPrimitive) return ()=>0; if(p==='toString') return ()=>''; return stub; }, apply(){return stub;}, construct(){return stub;}, has(){return true;} });
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO:0, Scale: stub };
let api;
try {
  api = new Function('Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { MUTATION_SIG_IDS, signatureMutations, dominantMutationType, creatureTextureKey, getBodyColor };'
  )(Phaser, stub, stub, stub, stub, stub, function(){return 0;});
} catch(e){ console.error('부팅 실패:', e.name, e.message); process.exit(1); }
const fail = (msg)=>{ console.error('✗ '+msg); process.exitCode=1; };
if (api.dominantMutationType([]) !== 'none') fail('빈 배열 → none');
if (api.dominantMutationType(['strong_jaw','fast_legs']) !== 'good') fail('good 다수 → good');
if (api.dominantMutationType(['weak_jaw','strong_jaw']) !== 'bad') fail('동수 → bad 우선');
if (api.dominantMutationType(['hard_shell','large_body']) !== 'dual') fail('dual 다수 → dual');
const sig = api.signatureMutations(['efficient_metabolism','poison_gland','hard_shell']);
if (sig.join(',') !== 'hard_shell,poison_gland') fail('시그니처 필터/정렬 실패: '+sig.join(','));
const ind = { genes: { color: ['R','R'] }, mutations: ['hard_shell','large_body','weak_jaw'] };
const key = api.creatureTextureKey(ind);
if (!/^creature_\d+_hard_shell_/.test(key)) fail('키 형식 이상: '+key);
if (key.includes('large_body')) fail('스케일 전용이 키에 포함됨: '+key);
if (process.exitCode) console.error('smoke-visual FAILED');
else console.log('smoke-visual ok — type판정/시그니처/키 정상');
