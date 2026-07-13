// SaveStore 검증: 레거시 gpa_* 키 마이그레이션, 섹션 분류, 왕복, 초기화
import { loadGameCode } from './helpers/game-code.mjs';

const code = loadGameCode();

const stub = new Proxy(function(){}, {
  get(_t, p){ if (p === Symbol.toPrimitive) return () => 0; if (p === 'toString') return () => ''; return stub; },
  apply(){ return stub; },
  construct(){ return stub; },
  has(){ return true; },
});
const Phaser = { Scene: class {}, Game: class { constructor(){} }, AUTO: 0, Scale: stub, Math: Math };

function makeEnv(seed = {}) {
  const lsStore = { ...seed };
  const lsStub = {
    getItem(k) { return lsStore[k] ?? null; },
    setItem(k, v) { lsStore[k] = String(v); },
    removeItem(k) { delete lsStore[k]; },
  };
  // Object.keys(localStorage)가 저장 키를 반환하도록 실제 객체 기반 스텁 사용
  const lsProxy = new Proxy(lsStore, {
    get(t, p) { if (p in lsStub) return lsStub[p]; return t[p]; },
  });
  // window.desktop이 없어야 웹(localStorage) 경로를 탄다
  const winStub = { desktop: undefined, addEventListener(){}, innerWidth: 800, innerHeight: 600 };
  const factory = new Function(
    'Phaser','document','window','navigator','localStorage','firebase','requestAnimationFrame',
    code + '\n;return { Save, loadUnlockedAch, markAchUnlocked };'
  );
  const api = factory(Phaser, stub, winStub, stub, lsProxy, stub, function(){return 0;});
  return { api, lsStore };
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) 레거시 키 마이그레이션 — 섹션 분류 + 원본 제거
{
  const { api, lsStore } = makeEnv({
    gpa_lang: 'en',
    gpa_bgm_vol: '30',
    gpa_frag: '5',
    gpa_ach_unlocked: '["rookie"]',
    gpa_boss_killed_d2: '["stonegolem"]',
  });
  if (api.Save.get('gpa_lang') !== 'en') fail('마이그레이션 후 gpa_lang 값 소실');
  if (api.Save.get('gpa_frag') !== '5') fail('마이그레이션 후 gpa_frag 값 소실');
  if (api.Save.get('gpa_boss_killed_d2') !== '["stonegolem"]') fail('동적 키 마이그레이션 실패');
  if ('gpa_lang' in lsStore) fail('레거시 키가 제거되지 않음');
  const opt = JSON.parse(lsStore.gpa_options);
  const prog = JSON.parse(lsStore.gpa_progress);
  if (opt.v !== 1 || prog.v !== 1) fail(`섹션 버전 이상 (opt=${opt.v}, prog=${prog.v})`);
  if (!('gpa_lang' in opt.data) || !('gpa_bgm_vol' in opt.data)) fail('옵션 키가 options 섹션에 없음');
  if (!('gpa_frag' in prog.data) || !('gpa_ach_unlocked' in prog.data)) fail('진행 키가 progress 섹션에 없음');
  if ('gpa_frag' in opt.data) fail('진행 키가 options 섹션에 잘못 분류됨');
  // 마이그레이션된 도전과제 위에 신규 해금 왕복
  if (!api.loadUnlockedAch().has('rookie')) fail('마이그레이션된 도전과제 로드 실패');
  api.markAchUnlocked('colony');
  if (!api.loadUnlockedAch().has('colony')) fail('마이그레이션 후 신규 해금 실패');
}

// 2) 섹션 저장본 재로드 (마이그레이션 없이) + set 즉시 영속
{
  const first = makeEnv({});
  first.api.Save.set('gpa_lang', 'ko');
  first.api.Save.set('gpa_stats', '{"runs":3}');
  const second = makeEnv({ ...first.lsStore });
  if (second.api.Save.get('gpa_lang') !== 'ko') fail('섹션 재로드 실패 (options)');
  if (second.api.Save.get('gpa_stats') !== '{"runs":3}') fail('섹션 재로드 실패 (progress)');
}

// 3) remove / resetAll
{
  const { api, lsStore } = makeEnv({ gpa_frag: '7' });
  api.Save.remove('gpa_frag');
  if (api.Save.get('gpa_frag') !== null) fail('remove 후에도 값이 남음');
  api.Save.set('gpa_ess', 2);
  if (api.Save.get('gpa_ess') !== '2') fail('숫자 set이 문자열로 저장되지 않음');
  api.Save.resetAll();
  if (api.Save.get('gpa_ess') !== null) fail('resetAll 후 값이 남음');
  if (Object.keys(lsStore).some(k => k.startsWith('gpa_'))) fail('resetAll 후 저장 키가 남음');
}

// 4) 손상된 섹션 JSON → 빈 상태로 안전 복구
{
  const { api } = makeEnv({ gpa_progress: '{broken json', gpa_options: '42' });
  if (api.Save.get('gpa_lang') !== null) fail('손상 저장본에서 예기치 않은 값');
  api.Save.set('gpa_lang', 'en');
  if (api.Save.get('gpa_lang') !== 'en') fail('손상 저장본 복구 후 set 실패');
}

if (process.exitCode) {
  console.error('smoke-save FAILED');
} else {
  console.log('smoke-save ok — 레거시 마이그레이션/섹션 분류/왕복/초기화/손상 복구');
}
