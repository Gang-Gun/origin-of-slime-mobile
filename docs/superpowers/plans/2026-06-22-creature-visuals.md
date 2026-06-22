# 보스 비주얼 + 돌연변이 슬라임 외형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 슬라임이 보유 돌연변이에 따라 픽셀 외형이 달라지고, 보스 10종이 테마별 절차적 픽셀 몬스터로 렌더되게 한다.

**Architecture:** 단일 파일 `index.html`. 순수 로직(텍스처 캐시 키·기조 type 판정·시그니처 필터·보스 설정 데이터)은 전역 함수/상수로 분리해 node로 검증한다. 픽셀 드로잉(`createCreatureTexture`/`createBossTexture`)은 기존 `make.graphics()→generateTexture()→캐시` 패턴을 따르며 브라우저에서 시각 확인한다.

**Tech Stack:** Phaser 3.60 (CDN), 순수 JS, 단일 HTML. 검증: `node test/check-syntax.mjs`(문법), `node test/smoke-visual.mjs`(순수 로직, 신규), 그리고 사용자 브라우저 플레이테스트(드로잉).

---

## 검증 방식 (공통)

- 매 작업: `node test/check-syntax.mjs` → `syntax ok` 필수.
- 순수 로직 작업: `node test/smoke-visual.mjs`(Task 1에서 생성)로 단언.
- 드로잉 작업: 문법 통과 확인 + 마지막 Task에서 사용자가 브라우저로 시각 확인(`C:\Users\User\gene-pool-arena-mobile\index.html`를 `python -m http.server`로 띄워 확인).
- 기존 `test/smoke-boss.mjs`의 스텁 부팅 패턴(브라우저 globals를 catch-all 프록시로 무력화 후 `new Function`)을 재사용한다.

## File Structure

- **Modify only:** `index.html`
  - 돌연변이 상수/순수 함수: `MUTATIONS` 정의 뒤.
  - `createCreatureTexture`, `addIndividualSprite`: 기존 위치(~2632, ~2682).
  - 보스 비주얼 데이터/함수: 보스 시스템 블록(`BOSS_ROSTER`) 근처 + `ArenaScene`에 `createBossTexture`.
  - `spawnBoss`: 기존 위치.
- **Create:** `test/smoke-visual.mjs` (순수 로직 스모크).

---

## Task 1: 순수 로직 — 시그니처/기조 type/캐시 키 + 스모크

**Files:**
- Modify: `index.html` (`MUTATIONS` 배열 정의 바로 뒤)
- Create: `test/smoke-visual.mjs`

- [ ] **Step 1: 전역 상수/함수 추가**

`index.html`에서 `const MUTATIONS = [ ... ];` 가 끝나는 `];` 줄 **바로 뒤**에 삽입:

```js
// 외형에 직접 반영되는 시그니처 돌연변이(스케일 전용 2종 포함)
const MUTATION_SIG_IDS = new Set([
  'large_body','small_body','hard_shell','bright_pattern','strong_jaw',
  'poison_gland','regeneration','fast_legs','pheromone',
]);
// 개체의 시그니처 돌연변이 id만 정렬 반환
function signatureMutations(mutations) {
  return (mutations || []).filter(id => MUTATION_SIG_IDS.has(id)).sort();
}
// 개체 돌연변이의 우세 type. 동수면 bad>dual>good. 없으면 'none'.
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
// 텍스처 캐시 키. 스케일 전용(large/small_body)은 그리기 동일 → 키에서 제외.
function creatureTextureKey(individual) {
  const body = getBodyColor(individual);
  const sig = signatureMutations(individual.mutations)
    .filter(id => id !== 'large_body' && id !== 'small_body');
  const cat = dominantMutationType(individual.mutations);
  return `creature_${body}_${sig.length ? sig.join('.') : 'none'}_${cat}`;
}
```

- [ ] **Step 2: 스모크 테스트 작성**

`test/smoke-visual.mjs` 생성(기존 `test/smoke-boss.mjs`의 부팅 방식 차용):

```js
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

// dominantMutationType
if (api.dominantMutationType([]) !== 'none') fail('빈 배열 → none');
if (api.dominantMutationType(['strong_jaw','fast_legs']) !== 'good') fail('good 다수 → good');
if (api.dominantMutationType(['weak_jaw','strong_jaw']) !== 'bad') fail('동수 → bad 우선');
if (api.dominantMutationType(['hard_shell','large_body']) !== 'dual') fail('dual 다수 → dual');

// signatureMutations: 정렬 + 비시그니처 제외
const sig = api.signatureMutations(['efficient_metabolism','poison_gland','hard_shell']);
if (sig.join(',') !== 'hard_shell,poison_gland') fail('시그니처 필터/정렬 실패: '+sig.join(','));

// creatureTextureKey: 합성 개체 (color 유전자형은 getBodyColor 입력 형태에 맞춤)
const ind = { genes: { color: ['R','R'] }, mutations: ['hard_shell','large_body','weak_jaw'] };
const key = api.creatureTextureKey(ind);
if (!/^creature_\d+_hard_shell_/.test(key)) fail('키 형식 이상(시그니처/스케일제외): '+key);
if (key.includes('large_body')) fail('스케일 전용이 키에 포함됨: '+key);

if (process.exitCode) console.error('smoke-visual FAILED');
else console.log('smoke-visual ok — type판정/시그니처/키 정상');
```

> 참고: `getBodyColor`가 `individual.genes.color` 배열을 읽는지 구현을 먼저 확인하고, 위 합성 `ind.genes.color` 형태를 실제 시그니처에 맞춰라. 다르면 `ind`만 맞게 조정(로직 단언은 동일).

- [ ] **Step 3: 검증**

```
node test/check-syntax.mjs   # → syntax ok
node test/smoke-visual.mjs   # → smoke-visual ok
```

- [ ] **Step 4: Commit**

```bash
git add index.html test/smoke-visual.mjs
git commit -m "feat: 돌연변이 외형 순수 로직(시그니처·기조type·캐시키) + 스모크"
```
(커밋 메시지 끝줄: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

## Task 2: 슬라임 텍스처에 돌연변이 오버레이 그리기

**Files:**
- Modify: `index.html` (`createCreatureTexture` 전면 교체, `drawMutationOverlay` 추가)

- [ ] **Step 1: createCreatureTexture를 개체 기반으로 교체**

기존 `createCreatureTexture(bodyColor) { ... }` 메서드 전체를 아래로 교체(기존 16×10 그리드 로직은 유지하고 입력만 개체로, 끝에 오버레이 호출):

```js
createCreatureTexture(individual) {
  const bodyColor = getBodyColor(individual);
  const sig = signatureMutations(individual.mutations).filter(id => id!=='large_body' && id!=='small_body');
  const cat = dominantMutationType(individual.mutations);
  const key = creatureTextureKey(individual);
  if (this.textures.exists(key)) return key;
  const g = this.make.graphics({ add: false });
  const S = 4;
  // 기조 type에 따른 몸색 보정(bad=회색 블렌드)
  let c = bodyColor;
  if (cat === 'bad') {
    const ri=(c>>16)&0xFF, gi=(c>>8)&0xFF, bi=c&0xFF, gray=0x88;
    const bl=(a,b)=>Math.round(a*0.9+b*0.1);
    c=(bl(ri,gray)<<16)|(bl(gi,gray)<<8)|bl(bi,gray);
  }
  const ri=(c>>16)&0xFF, gi=(c>>8)&0xFF, bi=c&0xFF;
  const dark =(Math.floor(ri*.45)<<16)|(Math.floor(gi*.45)<<8)|Math.floor(bi*.45);
  const light=(Math.min(255,Math.floor(ri*1.55))<<16)|(Math.min(255,Math.floor(gi*1.55))<<8)|Math.min(255,Math.floor(bi*1.55));
  const _ = null, D = dark, L = light, H = 0xffffff;
  const E = 0xffffff, PL = 0x111111, M = 0x111111, T = 0xff88aa;
  const grid = [
    [_,_,_,D,D,D,D,D,D,D,D,D,_,_,_,_],
    [_,_,D,L,L,L,L,L,L,L,L,L,D,_,_,_],
    [_,D,L,H,H,L,L,L,L,L,L,L,L,D,_,_],
    [D,L,L,H,L,L,L,L,L,L,L,L,L,L,D,_],
    [D,L,L,L,E,E,L,L,L,E,E,L,L,L,D,_],
    [D,L,L,L,E,PL,L,L,L,E,PL,L,L,L,D,_],
    [D,L,L,L,E,E,L,L,L,E,E,L,L,L,D,_],
    [D,L,L,L,L,M,M,L,M,M,L,L,L,L,D,_],
    [_,D,L,L,L,L,T,T,T,L,L,L,L,D,_,_],
    [_,_,D,D,D,D,D,D,D,D,D,D,D,_,_,_],
  ];
  for (let row=0; row<grid.length; row++) for (let col=0; col<grid[row].length; col++) {
    const cl=grid[row][col]; if (cl===null) continue;
    g.fillStyle(cl,1); g.fillRect(col*S, row*S, S, S);
  }
  this.drawMutationOverlay(g, S, sig, cat, { dark, light, body: c });
  g.generateTexture(key, 16*S, 10*S);
  g.destroy();
  return key;
}
```

- [ ] **Step 2: drawMutationOverlay 추가**

`createCreatureTexture` 바로 아래에 추가:

```js
// 시그니처 돌연변이 + 기조 type을 슬라임 텍스처 위에 픽셀로 덧그림 (S=셀크기)
drawMutationOverlay(g, S, sig, cat, pal) {
  const px=(x,y,w,h,c,a=1)=>{ g.fillStyle(c,a); g.fillRect(x*S,y*S,w*S,h*S); };
  if (sig.includes('hard_shell')) { px(3,0,7,1,0x8a8a96); px(2,1,2,1,0x8a8a96); px(8,1,3,1,0x8a8a96); px(4,0,2,1,0xc2c2ce); }
  if (sig.includes('bright_pattern')) { px(3,3,1,1,0xffd23f); px(8,5,1,1,0xffd23f); px(5,7,1,1,0xffd23f); px(10,4,1,1,0xffd23f); }
  if (sig.includes('strong_jaw')) { px(5,7,1,1,0xffffff); px(8,7,1,1,0xffffff); }
  if (sig.includes('poison_gland')) { px(1,10,1,1,0x6fdf4a); px(7,10,1,1,0x6fdf4a); px(11,9,1,1,0x6fdf4a); px(3,2,1,1,0xa855f7); }
  if (sig.includes('regeneration')) { px(4,1,1,1,0xffffff,0.9); px(3,2,1,1,0xffffff,0.7); px(5,2,1,1,0xffffff,0.7); }
  if (sig.includes('fast_legs')) { px(2,10,1,1,pal.dark); px(5,10,1,1,pal.dark); px(9,10,1,1,pal.dark); }
  if (sig.includes('pheromone')) { px(5,-2,1,2,0xffcf3f); px(7,-2,1,2,0xffcf3f); px(9,-2,1,2,0xffcf3f); px(5,0,5,1,0xe0a91a); }
  if (cat==='good') { px(4,0,1,1,0xe6ffe0,0.9); px(9,1,1,1,0xe6ffe0,0.8); }
  else if (cat==='bad') { px(6,2,1,1,0x2a2018,0.7); px(7,3,1,1,0x2a2018,0.6); px(3,5,1,1,0x2a2018,0.5); }
  else if (cat==='dual') { px(10,3,1,1,0xc49ee0,0.8); }
}
```

> 음수 y(`pheromone`의 왕관 `y=-2`)는 generateTexture 캔버스(16×10) 밖이라 잘릴 수 있음. 구현 시 `g.fillRect`가 음수 y를 그리는지 확인하고, 잘리면 왕관을 `y=0~1`로 내려 그릴 것(텍스처 상단 안쪽). 캔버스 높이를 키우지 말 것(스프라이트 정렬 깨짐).

- [ ] **Step 3: 검증(문법)** — `node test/check-syntax.mjs` → `syntax ok`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 슬라임 텍스처에 돌연변이 시그니처/기조 오버레이"
```

---

## Task 3: addIndividualSprite — 개체 텍스처 + 큰/작은 몸집 스케일

**Files:**
- Modify: `index.html` (`addIndividualSprite`)

- [ ] **Step 1: 텍스처 호출 + 스케일 변경**

`addIndividualSprite`의 다음 두 줄:
```js
    const key = this.createCreatureTexture(getBodyColor(individual));
    const baseScale = clamp(0.55 + individual.stats.hp / 100 * 0.40, 0.60, 1.55);
```
을 다음으로 교체:
```js
    const key = this.createCreatureTexture(individual);
    let baseScale = clamp(0.55 + individual.stats.hp / 100 * 0.40, 0.60, 1.55);
    const muts = individual.mutations || [];
    if (muts.includes('large_body')) baseScale *= 1.35;
    if (muts.includes('small_body')) baseScale *= 0.7;
```

- [ ] **Step 2: 다른 호출부 확인**

`createCreatureTexture(` 를 grep 하여 `getBodyColor`를 인자로 넘기는 **다른 호출부가 없는지** 확인. 있으면 모두 개체를 넘기도록 수정. (없으면 통과.)

- [ ] **Step 3: 검증(문법)** — `node test/check-syntax.mjs` → `syntax ok`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 슬라임 스프라이트 개체기반 텍스처 + 큰/작은 몸집 스케일"
```

---

## Task 4: 보스 비주얼 데이터(BOSS_VISUAL 10종) + 스모크

**Files:**
- Modify: `index.html` (`BOSS_ROSTER` 정의 뒤), `test/smoke-visual.mjs`

- [ ] **Step 1: BOSS_VISUAL 추가**

`function bossById(id){ ... }` 줄 **뒤**에 삽입:

```js
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
  primordial: { shape:'amorphous',   pal:{d:0x2a2030,m:0x7a4aa0,l:0xffffff,a:0xffffff}, parts:['prism','multiEyes'],         eyes:5, eyeCol:0xffffff, prism:true },
};
```

- [ ] **Step 2: 스모크에 보스 데이터 단언 추가**

`test/smoke-visual.mjs`의 `return {…}` 에 `BOSS_VISUAL, BOSS_ROSTER` 를 추가하고(즉 `...creatureTextureKey, getBodyColor, BOSS_VISUAL, BOSS_ROSTER }`), 파일 하단 `if (process.exitCode)` 직전에 삽입:

```js
// 모든 보스가 비주얼 설정을 가짐
for (const b of api.BOSS_ROSTER) {
  const v = api.BOSS_VISUAL[b.id];
  if (!v) { fail('보스 비주얼 누락: '+b.id); continue; }
  if (!v.pal || ['d','m','l','a'].some(k => typeof v.pal[k] !== 'number')) fail('팔레트 불완전: '+b.id);
  if (!v.shape || !Array.isArray(v.parts)) fail('shape/parts 누락: '+b.id);
}
if (Object.keys(api.BOSS_VISUAL).length !== 10) fail('BOSS_VISUAL 개수 != 10');
```

- [ ] **Step 3: 검증**

```
node test/check-syntax.mjs   # → syntax ok
node test/smoke-visual.mjs   # → smoke-visual ok (보스 데이터 포함)
```

- [ ] **Step 4: Commit**

```bash
git add index.html test/smoke-visual.mjs
git commit -m "feat: 보스 비주얼 설정(BOSS_VISUAL 10종) + 스모크"
```

---

## Task 5: createBossTexture — 파츠 조립 드로잉

**Files:**
- Modify: `index.html` (`ArenaScene`에 `createBossTexture` 추가)

- [ ] **Step 1: createBossTexture 추가**

`ArenaScene`에 `createCreatureTexture` 근처로 추가:

```js
// 보스 픽셀 텍스처(파츠 조립). 키 boss_${id}로 캐시.
createBossTexture(bossId) {
  const key = `boss_${bossId}`;
  if (this.textures.exists(key)) return key;
  const v = BOSS_VISUAL[bossId]; const S = 5;
  const g = this.make.graphics({ add: false });
  const W = 16, Hh = 13; // 그리드(셀)
  const px=(x,y,w,h,c,a=1)=>{ g.fillStyle(c,a); g.fillRect(x*S,y*S,w*S,h*S); };
  // 몸통 블롭 (shape별 약간 변형)
  const P = v.pal;
  const wide = v.shape==='bulky' || v.shape==='amorphous';
  const top = wide ? 2 : 4;
  px(top+1,1,W-2*(top+1)+2,2,P.m); px(top-1,3,W-2*(top-1),2,P.m); px(1,5,W-2,5,P.m); px(2,10,W-4,2,P.m);
  px(1,11,W-2,1,P.d); px(W-3,8,2,3,P.d); px(2,3,3,2,P.l);
  // 프리즘(히든): 몸통을 색 세그먼트로 덮음
  if (v.prism) { const cols=[0xe0604a,0xff9b3a,0x6fcf4a,0x4fa0e6,0x9460b8]; for (let i=0;i<cols.length;i++) px(1+i*3,5,3,5,cols[i]); }
  // 파츠
  const parts = v.parts;
  if (parts.includes('lavaCracks')) { px(3,5,3,1,P.a); px(9,7,3,1,P.a); px(5,9,4,1,0xffd23f); }
  if (parts.includes('poisonDrips')) { px(3,12,1,1,P.a); px(8,12,1,1,P.a); px(12,11,1,1,P.a); }
  if (parts.includes('spores')) { px(2,0,2,1,P.a); px(7,0,2,1,P.a); px(11,1,1,1,P.a); }
  if (parts.includes('shellPlates')) { px(2,0,W-4,1,P.d); px(3,1,3,1,P.l); px(9,1,3,1,P.l); }
  if (parts.includes('spikes')) { px(2,-1,1,1,P.d); px(6,-1,1,1,P.d); px(10,-1,1,1,P.d); px(13,0,1,1,P.d); }
  if (parts.includes('iceCrown')) { px(3,-2,1,2,P.l); px(7,-3,1,3,0xffffff); px(11,-2,1,2,P.l); }
  if (parts.includes('heavyBrows')) { px(3,4,3,1,P.d); px(9,4,3,1,P.d); }
  if (parts.includes('legs')) { px(2,12,1,1,P.d); px(6,12,1,1,P.d); px(10,12,1,1,P.d); px(13,12,1,1,P.d); }
  if (parts.includes('streaks')) { px(0,6,1,1,P.l,0.7); px(0,8,1,1,P.l,0.5); px(15,6,1,1,P.l,0.7); }
  if (parts.includes('tentacles')) { px(1,12,1,1,P.m); px(4,12,1,1,P.m); px(11,12,1,1,P.m); px(14,12,1,1,P.m); px(2,11,1,1,P.l); }
  if (parts.includes('wings')) { px(0,4,2,3,P.d); px(14,4,2,3,P.d); }
  if (parts.includes('lure')) { px(7,-2,2,2,P.a); px(7,0,1,2,P.l); }
  // 눈
  const eyeY=6, slots=[4,7,10,5,9];
  for (let i=0;i<v.eyes;i++){ const ex=slots[i%slots.length], ey=eyeY+(i>=3?2:0); px(ex,ey,1,1,0xffffff); px(ex,ey,1,1,v.eyeCol,0.85); }
  g.generateTexture(key, W*S, Hh*S);
  g.destroy();
  return key;
}
```

> 음수 y(왕관/가시 `y=-1~-3`)가 잘리면 해당 파츠 y를 0 이상으로 내려라(캔버스 높이 유지). 보스는 큰 스케일로 그려지므로 1셀 차이는 무방.

- [ ] **Step 2: 검증(문법)** — `node test/check-syntax.mjs` → `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: createBossTexture 파츠 조립 픽셀 드로잉"
```

---

## Task 6: spawnBoss — 이모지 → 보스 텍스처 교체

**Files:**
- Modify: `index.html` (`spawnBoss`)

- [ ] **Step 1: 스프라이트 생성 교체**

`spawnBoss()`의 다음 줄:
```js
  const sprite = this.add.text(sx, sy, boss.ico, { fontSize:'56px' }).setOrigin(0.5).setDepth(20);
```
을 다음으로 교체:
```js
  const sprite = this.add.image(sx, sy, this.createBossTexture(boss.id)).setOrigin(0.5).setDepth(20).setScale(2.5);
```

- [ ] **Step 2: 검증(문법)** — `node test/check-syntax.mjs` → `syntax ok`. `bossChaseTick`이 `b.sprite.setPosition(...)`을, `resolveBoss`가 `b.sprite.destroy()`를 부르는데 `add.image`도 동일 인터페이스라 호환됨(확인).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: 보스 스프라이트를 이모지에서 픽셀 텍스처로 교체"
```

---

## Task 7: 브라우저 시각 확인 + 미세조정

**Files:**
- Modify: `index.html` (필요 시 색/위치 조정)

- [ ] **Step 1: 서버 띄우고 확인**

```
node test/check-syntax.mjs
node test/smoke-visual.mjs
node test/smoke-boss.mjs
```
모두 통과 후, 사용자가 `python -m http.server 8000`로 띄워 `http://localhost:8000` 에서:
- 슬라임에 돌연변이 외형(껍질/무늬/이빨/독돌기/광택/발/왕관, 큰·작은 몸집 스케일, bad 칙칙) 표시되는지.
- 보스 출현 시 이모지 대신 테마 픽셀 몬스터가 나오는지(10종 각각). `window._arenaScene`로 `s.startBossWarning(bossById('glacier'),'mid'); s._dueBossHp=80; s.spawnBoss();` 등으로 강제 확인 가능.

- [ ] **Step 2: 미세조정**

잘리는 파츠(음수 y), 너무 작아 안 보이는 시그니처, 보스 스케일 등 체감 이상치를 조정. 변경 사유를 커밋 메시지에 기록.

- [ ] **Step 3: 콘솔 오류 + 텍스처 폭증 점검**

브라우저 콘솔 오류 없는지, `window._arenaScene.textures.list` 키 수가 비정상 증가하지 않는지 확인(슬라임 조합 캐시).

- [ ] **Step 4: 최종 Commit**

```bash
git add index.html
git commit -m "polish: 크리처/보스 비주얼 시각 확인·미세조정"
```

---

## Self-Review 결과

- **스펙 커버리지:** §3.2 시그니처(T2) · §3.3 기조type(T1,T2) · §3.4 캐시키(T1) · §3.5 스케일(T3) · §4.1 createBossTexture(T5) · §4.2 BOSS_VISUAL 10종(T4) · §4.3 보스 스케일(T6) · §5 연결점(전 Task). 모든 절 대응.
- **플레이스홀더:** 없음. 드로잉 op는 구체 픽셀 좌표/색으로 명시. 음수 y 리스크는 각 Task에 처리 지침 포함.
- **식별자 일관성:** `MUTATION_SIG_IDS`/`signatureMutations`/`dominantMutationType`/`creatureTextureKey`/`drawMutationOverlay`/`createCreatureTexture(individual)`/`BOSS_VISUAL`/`createBossTexture` 전 Task 통일. 기존 `getBodyColor`/`MUTATIONS`/`individual.mutations`/`add.image`/`make.graphics`/`generateTexture` 재사용.
- **주의(실행 시):** `getBodyColor`의 개체 입력 형태(T1 Step2 주석), 음수 y 클리핑(T2/T5), `createCreatureTexture` 다른 호출부 유무(T3 Step2)를 구현 시 확인.
