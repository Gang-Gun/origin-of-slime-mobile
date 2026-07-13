// 도전과제 도감 탭 순수 로직 검증 (DOM/Phaser 없이)
import { loadGameCode } from './helpers/game-code.mjs';

const code = loadGameCode();

const stub = new Proxy(function(){}, {
  get(_t, p){ if (p === Symbol.toPrimitive) return () => 0; if (p === 'toString') return () => ''; return stub; },
  apply(){ return stub; },
  construct(){ return stub; },
  has(){ return true; },
});
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO: 0, Scale: stub, Math: Math };

// localStorage 스텁 (key-value 메모리)
const lsStore = {};
const lsStub = {
  getItem(k) { return lsStore[k] ?? null; },
  setItem(k, v) { lsStore[k] = String(v); },
  removeItem(k) { delete lsStore[k]; },
};

let api;
try {
  const factory = new Function(
    'Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { ACHIEVEMENTS, loadUnlockedAch: typeof loadUnlockedAch !== "undefined" ? loadUnlockedAch : undefined, markAchUnlocked: typeof markAchUnlocked !== "undefined" ? markAchUnlocked : undefined };'
  );
  api = factory(Phaser, stub, stub, stub, lsStub, stub, function(){return 0;});
} catch (e) {
  console.error('스크립트 부팅 실패:', e.name, e.message);
  process.exit(1);
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) 모든 ACHIEVEMENTS 항목에 cat 필드 존재
const VALID_CATS = new Set(['생존','집단','세대','전투','포섭','식량','유전자','지형','돌연변이','보스']);
for (const a of api.ACHIEVEMENTS) {
  if (!a.cat) fail(`${a.id}: cat 필드 없음`);
  else if (!VALID_CATS.has(a.cat)) fail(`${a.id}: cat 값 "${a.cat}" 불명 (유효: ${[...VALID_CATS].join('/')})`);
}

// 2) loadUnlockedAch — 빈 localStorage → 빈 Set (if defined)
if (api.loadUnlockedAch) {
  const empty = api.loadUnlockedAch();
  if (!(empty instanceof Set)) fail('loadUnlockedAch()가 Set을 반환하지 않음');
  if (empty.size !== 0) fail(`빈 저장소인데 size=${empty.size}`);

  // 3) markAchUnlocked → 저장 → loadUnlockedAch 재확인
  if (api.markAchUnlocked) {
    api.markAchUnlocked('rookie');
    api.markAchUnlocked('colony');
    const loaded = api.loadUnlockedAch();
    if (!loaded.has('rookie'))  fail('rookie가 해금되지 않음');
    if (!loaded.has('colony'))  fail('colony가 해금되지 않음');
    if (loaded.size !== 2)      fail(`size=${loaded.size} (기대 2)`);

    // 4) markAchUnlocked 멱등성 — 같은 id 두 번 저장해도 중복 없음
    api.markAchUnlocked('rookie');
    const loaded2 = api.loadUnlockedAch();
    if (loaded2.size !== 2) fail(`중복 저장 후 size=${loaded2.size} (기대 여전히 2)`);
  }
}

if (process.exitCode) {
  console.error('smoke-ach FAILED');
} else {
  console.log(`smoke-ach ok — cat필드 ${api.ACHIEVEMENTS.length}개, localStorage 왕복 확인`);
}
