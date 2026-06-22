# 도전과제 도감 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Dex 모달에 🏆 도전과제 탭을 추가하고, 달성 시 영구 해금(localStorage 유지)되는 힌트 잠금 카드 시스템을 구현한다.

**Architecture:** `ACHIEVEMENTS` 배열에 `cat` 필드를 추가하고, `loadUnlockedAch()`/`markAchUnlocked()` 전역 헬퍼로 `gpa_ach_unlocked` localStorage 키를 관리한다. `checkAchievements()`에 영구저장 훅을 추가하고, Dex 모달에 세 번째 탭 + 패널 + `renderAchieveDex()` 함수를 추가한다. 기존 `.dex-tab`/`.dex-filter`/`.dex-card` CSS 패턴을 최대한 재사용한다.

**Tech Stack:** Vanilla JS, HTML/CSS (Phaser 3.60 단일 파일 구조), Node.js 테스트(smoke 스크립트)

---

## 파일 구조

- **Modify:** `gene-pool-arena-mobile/index.html` — 모든 변경이 이 한 파일에 집중됨
- **Create:** `gene-pool-arena-mobile/test/smoke-ach.mjs` — 순수 로직 검증 (localStorage 헬퍼, cat 필드)

---

### Task 1: ACHIEVEMENTS에 cat 필드 추가

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` (ACHIEVEMENTS 배열, ~line 1369)
- Create: `gene-pool-arena-mobile/test/smoke-ach.mjs`

- [ ] **Step 1: smoke 테스트 작성 (failing)**

`gene-pool-arena-mobile/test/smoke-ach.mjs` 파일을 새로 만든다:

```javascript
// 도전과제 도감 탭 순수 로직 검증 (DOM/Phaser 없이)
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const m = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(html);
if (!m) { console.error('인라인 스크립트를 찾지 못함'); process.exit(1); }
const code = m[1];

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
    code + '\n;return { ACHIEVEMENTS, loadUnlockedAch, markAchUnlocked };'
  );
  api = factory(Phaser, stub, stub, stub, lsStub, stub, function(){return 0;});
} catch (e) {
  console.error('스크립트 부팅 실패:', e.name, e.message);
  process.exit(1);
}

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };

// 1) 모든 ACHIEVEMENTS 항목에 cat 필드 존재
const VALID_CATS = new Set(['생존','집단','세대','전투','포섭','식량','유전자','지형']);
for (const a of api.ACHIEVEMENTS) {
  if (!a.cat) fail(`${a.id}: cat 필드 없음`);
  else if (!VALID_CATS.has(a.cat)) fail(`${a.id}: cat 값 "${a.cat}" 불명 (유효: ${[...VALID_CATS].join('/')})`);
}

// 2) loadUnlockedAch — 빈 localStorage → 빈 Set
const empty = api.loadUnlockedAch();
if (!(empty instanceof Set)) fail('loadUnlockedAch()가 Set을 반환하지 않음');
if (empty.size !== 0) fail(`빈 저장소인데 size=${empty.size}`);

// 3) markAchUnlocked → 저장 → loadUnlockedAch 재확인
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

if (process.exitCode) {
  console.error('smoke-ach FAILED');
} else {
  console.log(`smoke-ach ok — cat필드 ${api.ACHIEVEMENTS.length}개, localStorage 왕복 확인`);
}
```

- [ ] **Step 2: 테스트 실패 확인**

```
node gene-pool-arena-mobile/test/smoke-ach.mjs
```

기대: `스크립트 부팅 실패` 또는 `cat 필드 없음` 오류. `loadUnlockedAch`/`markAchUnlocked`도 미정의 오류 발생.

- [ ] **Step 3: ACHIEVEMENTS에 cat 필드 추가**

`index.html` 내 `const ACHIEVEMENTS = [` 블록(~line 1369)을 찾아 각 항목에 `cat` 필드를 추가한다. 아래가 완성 형태:

```javascript
const ACHIEVEMENTS = [
  // ── 생존 ──────────────────────────────────────────────
  { id:'rookie',      cat:'생존', name:'🌱 첫 발걸음',    desc:'1분 생존',                     bonus:80,
    check:(g,el)=>el>=60000 },
  { id:'survivor',    cat:'생존', name:'🏅 생존자',       desc:'2분 생존',                     bonus:150,
    check:(g,el)=>el>=120000 },
  { id:'veteran',     cat:'생존', name:'🎖️ 베테랑',      desc:'4분 생존',                     bonus:300,
    check:(g,el)=>el>=240000 },
  { id:'last_stand',  cat:'생존', name:'🕯️ 마지막 불꽃', desc:'운석 30초 전(4분30초)까지 생존', bonus:500,
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
  { id:'escapist',    cat:'전투', name:'🏃 도주의 달인', desc:'전투 도망 3회',                bonus:150,
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

  // ── 유전자 — 대립유전자 빈도 ──────────────────────────
  { id:'red_wave',    cat:'유전자', name:'🔴 붉은 물결',   desc:'R 대립유전자 빈도 70%+',       bonus:200,
    check:(g)=>(g.geneFrequency()['color']||0)>=70 },
  { id:'blue_wave',   cat:'유전자', name:'🔵 푸른 물결',   desc:'B 대립유전자 빈도 70%+',       bonus:200,
    check:(g)=>(g.geneFrequency()['color']||0)<=30 },
  { id:'speed_evo',   cat:'유전자', name:'⚡ 속도 진화',   desc:'S 대립유전자 빈도 75%+',       bonus:200,
    check:(g)=>(g.geneFrequency()['speed']||0)>=75 },
  { id:'poison_evo',  cat:'유전자', name:'☠️ 독성 진화',   desc:'P 대립유전자 빈도 75%+',       bonus:200,
    check:(g)=>(g.geneFrequency()['poison']||0)>=75 },
  { id:'charm_evo',   cat:'유전자', name:'💗 매력 진화',   desc:'C 대립유전자 빈도 75%+',       bonus:200,
    check:(g)=>(g.geneFrequency()['charm']||0)>=75 },
  { id:'dominant_all',cat:'유전자', name:'👑 우성 지배',   desc:'모든 유전자 우성 대립유전자 60%+', bonus:500,
    check:(g)=>Object.values(g.geneFrequency()).every(p=>p>=60) },

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
];
```

- [ ] **Step 4: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 5: smoke 테스트 — cat 필드만 통과 여부 확인**

```
node gene-pool-arena-mobile/test/smoke-ach.mjs
```

기대: `loadUnlockedAch` / `markAchUnlocked` undefined 오류(아직 구현 안 됨). cat 필드 관련 오류는 없어야 함.

---

### Task 2: localStorage 헬퍼 함수 추가

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` — `let _dexFilter = 'all';` 위에 헬퍼 2개 삽입 (~line 4363)

- [ ] **Step 1: 헬퍼 함수 삽입**

`let _dexFilter = 'all';` 바로 위(~line 4363)에 다음을 추가한다:

```javascript
// ── 도전과제 영구 해금 저장소 ─────────────────────────────
function loadUnlockedAch() {
  try {
    const raw = localStorage.getItem('gpa_ach_unlocked');
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function markAchUnlocked(id) {
  const set = loadUnlockedAch();
  set.add(id);
  localStorage.setItem('gpa_ach_unlocked', JSON.stringify([...set]));
}

let _achFilter = 'all';
```

- [ ] **Step 2: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok`

- [ ] **Step 3: smoke 테스트 전체 통과 확인**

```
node gene-pool-arena-mobile/test/smoke-ach.mjs
```

기대: `smoke-ach ok — cat필드 29개, localStorage 왕복 확인`

---

### Task 3: checkAchievements에 영구저장 훅 추가

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` — `checkAchievements()` 메서드 (~line 3180)

- [ ] **Step 1: markAchUnlocked 훅 삽입**

`checkAchievements()` 메서드 내 `this.achievements.add(ach.id);` 라인 바로 다음에 `markAchUnlocked(ach.id);`를 추가한다:

현재:
```javascript
        if (ach.check(g, this.elapsed, this.achieveData)) {
          this.achievements.add(ach.id);
          this.showToast(`🏆 ${ach.name} +${ach.bonus}`, 'ach');
```

변경 후:
```javascript
        if (ach.check(g, this.elapsed, this.achieveData)) {
          this.achievements.add(ach.id);
          markAchUnlocked(ach.id);
          this.showToast(`🏆 ${ach.name} +${ach.bonus}`, 'ach');
```

- [ ] **Step 2: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok`

---

### Task 4: CSS 추가 — 도전과제 카드 스타일

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` — CSS 섹션 (`.dex-card` 블록 ~line 608 아래)

- [ ] **Step 1: CSS 삽입**

`.dex-card { … }` 블록이 끝나는 부분(`.dex-badge` 끝, ~line 632) 바로 뒤에 다음 CSS를 추가한다:

```css
/* ── 도전과제 도감 탭 ─── */
#dex-achieve-panel { flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
#dex-achieve-header { padding:10px 14px 0; font-size:13px; color:var(--ink-soft); flex-shrink:0; }
#ach-filters { display:flex; gap:5px; padding:8px 14px; flex-shrink:0; overflow-x:auto; scrollbar-width:none; }
#dex-achieve-list { flex:1; min-height:0; overflow-y:auto; padding:4px 12px 18px; display:flex; flex-direction:column; gap:8px; }
.ach-card { border-radius:13px; padding:10px 13px; border:1.5px solid; display:flex; flex-direction:column; gap:3px; transition:opacity .15s; }
.ach-card.unlocked { border-color:rgba(61,138,58,.45); background:rgba(110,196,106,.13); }
.ach-card.locked { border-color:rgba(180,180,180,.5); background:rgba(200,200,200,.10); opacity:0.68; }
.ach-title { font-family:'Jua',sans-serif; font-size:14px; color:var(--ink); }
.ach-title.locked-title { color:var(--ink-soft); letter-spacing:.5px; }
.ach-desc { font-size:11.5px; color:var(--ink-soft); }
.ach-footer { display:flex; align-items:center; justify-content:space-between; margin-top:2px; }
.ach-bonus { font-size:12px; color:var(--honey-dk); font-weight:800; }
.ach-badge { font-size:10px; font-weight:900; padding:2px 8px; border-radius:999px; background:var(--leaf-dk); color:#fff; }
```

- [ ] **Step 2: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok`

---

### Task 5: DOM — 도전과제 탭 버튼 + 패널 추가

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` — dex-modal DOM (~line 1004)

- [ ] **Step 1: 탭 버튼 추가**

`#dex-tabs` 내부에 `🌍 이벤트` 버튼 뒤에 추가한다:

현재:
```html
        <button class="dex-tab" data-tab="event" onclick="switchDexTab('event',this)">🌍 이벤트</button>
      </div>
```

변경 후:
```html
        <button class="dex-tab" data-tab="event" onclick="switchDexTab('event',this)">🌍 이벤트</button>
        <button class="dex-tab" data-tab="achieve" onclick="switchDexTab('achieve',this)">🏆 도전과제</button>
      </div>
```

- [ ] **Step 2: 도전과제 패널 div 추가**

`#dex-event-panel` 닫는 태그(`</div>`) 뒤, `</div>` (dex-sheet 닫기) 앞에 패널을 추가한다:

현재:
```html
      <div id="event-dex-list"></div>
    </div>
  </div>
</div>
```

변경 후:
```html
      <div id="event-dex-list"></div>
    </div>
    <div id="dex-achieve-panel" style="display:none">
      <div id="dex-achieve-header"></div>
      <div id="ach-filters">
        <button class="dex-filter active" onclick="setAchFilter('all',this)">전체</button>
        <button class="dex-filter" onclick="setAchFilter('done',this)">✅ 달성</button>
        <button class="dex-filter" onclick="setAchFilter('locked',this)">🔒 미달성</button>
      </div>
      <div id="dex-achieve-list"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok`

---

### Task 6: renderAchieveDex + setAchFilter + switchDexTab 확장

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` — `switchDexTab` 함수 (~line 4432), 그 아래에 신규 함수 추가

- [ ] **Step 1: renderAchieveDex + setAchFilter 함수 추가**

`function switchDexTab(tab, btn) {` 바로 위에 다음 두 함수를 추가한다:

```javascript
function renderAchieveDex() {
  const unlocked = loadUnlockedAch();
  const header = document.getElementById('dex-achieve-header');
  const list   = document.getElementById('dex-achieve-list');
  if (!header || !list) return;

  header.textContent = `해금 ${unlocked.size} / ${ACHIEVEMENTS.length}`;

  const filtered = ACHIEVEMENTS.filter(a => {
    if (_achFilter === 'done')   return unlocked.has(a.id);
    if (_achFilter === 'locked') return !unlocked.has(a.id);
    return true;
  });

  list.innerHTML = filtered.map(a => {
    const isUnlocked = unlocked.has(a.id);
    if (isUnlocked) {
      return `<div class="ach-card unlocked">
        <div class="ach-title">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
        <div class="ach-footer">
          <span class="ach-bonus">+${a.bonus}점</span>
          <span class="ach-badge">✅ 달성</span>
        </div>
      </div>`;
    } else {
      return `<div class="ach-card locked">
        <div class="ach-title locked-title">🔒 [${a.cat}]</div>
        <div class="ach-desc">???</div>
        <div class="ach-footer">
          <span class="ach-bonus">+${a.bonus}점</span>
        </div>
      </div>`;
    }
  }).join('') || '<div style="text-align:center;color:var(--ink-soft);padding:24px">해당 도전과제 없음</div>';
}

function setAchFilter(filter, btn) {
  _achFilter = filter;
  document.querySelectorAll('#ach-filters .dex-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderAchieveDex();
}
```

- [ ] **Step 2: switchDexTab 확장**

`switchDexTab` 함수를 세 탭을 처리하도록 교체한다. 현재 코드:

```javascript
function switchDexTab(tab, btn) {
  document.querySelectorAll('.dex-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const mutPanel = document.getElementById('dex-mutation-panel');
  const evPanel  = document.getElementById('dex-event-panel');
  if (tab === 'event') {
    mutPanel.style.display = 'none';
    evPanel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    renderEventDex();
  } else {
    evPanel.style.display = 'none';
    mutPanel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    renderDex();
  }
}
```

변경 후:
```javascript
function switchDexTab(tab, btn) {
  document.querySelectorAll('.dex-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const mutPanel = document.getElementById('dex-mutation-panel');
  const evPanel  = document.getElementById('dex-event-panel');
  const achPanel = document.getElementById('dex-achieve-panel');
  mutPanel.style.display = 'none';
  evPanel.style.display  = 'none';
  if (achPanel) achPanel.style.display = 'none';
  if (tab === 'achieve') {
    if (achPanel) achPanel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    renderAchieveDex();
  } else if (tab === 'event') {
    evPanel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    renderEventDex();
  } else {
    mutPanel.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden';
    renderDex();
  }
}
```

- [ ] **Step 3: 문법 검사**

```
node gene-pool-arena-mobile/test/check-syntax.mjs
```

기대: `syntax ok`

- [ ] **Step 4: smoke 테스트 전체 재확인**

```
node gene-pool-arena-mobile/test/smoke-ach.mjs
```

기대: `smoke-ach ok`

---

### Task 7: 기존 smoke 테스트들 이상 없는지 확인 + 커밋

**Files:**
- Modify: `gene-pool-arena-mobile/index.html` (이미 완료)

- [ ] **Step 1: 기존 smoke 테스트 전체 실행**

```
node gene-pool-arena-mobile/test/check-syntax.mjs && node gene-pool-arena-mobile/test/smoke-boss.mjs && node gene-pool-arena-mobile/test/smoke-ach.mjs
```

기대 (각 줄):
```
syntax ok — 1 inline script(s) checked
smoke-boss ok — 로스터10/히든1, safe조건, 히든등장률 ~2%
smoke-ach ok — cat필드 29개, localStorage 왕복 확인
```

- [ ] **Step 2: 커밋**

```
git -C gene-pool-arena-mobile add index.html test/smoke-ach.mjs
git -C gene-pool-arena-mobile commit -m "feat: 도전과제 도감 탭 — 힌트 잠금/영구 해금"
```

- [ ] **Step 3: 브라우저에서 확인 (수동)**

로컬 서버 실행 후(`python -m http.server 3210` → `gene-pool-arena-mobile/` 디렉토리):
1. 도감 버튼(🔬) 클릭 → **🏆 도전과제** 탭 보임
2. 탭 클릭 → 카드 29개 표시, 전부 🔒 [카테고리] / ??? / +N점 형태
3. 달성 필터 클릭 → "해당 도전과제 없음"
4. 게임 플레이 중 1분 이상 생존 → 🌱 첫 발걸음 toast 표시 확인
5. 도감 도전과제 탭 열기 → 🌱 첫 발걸음 카드가 해금 상태(이름·설명 표시)로 전환
6. 페이지 새로고침 후 도전과제 탭 재확인 → 해금 상태 유지
