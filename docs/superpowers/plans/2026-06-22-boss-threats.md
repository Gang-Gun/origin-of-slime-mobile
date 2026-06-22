# 단계별 보스 위협 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유전학 생존 게임에 개체군을 추격하는 보스 10종(+히든)을 추가하여, 지형 대피로 유전자 빈도를 정비하고 싸우고/도망/번식하며 공략하는 위협 시스템을 만든다.

**Architecture:** 단일 파일 `index.html`(Phaser 3 classic script) 내에 보스 데이터(`BOSS_ROSTER`)·스케줄·전용 상태머신(`warning → chase → resolve`)을 추가한다. 도태/반격은 기존 유전 함수(`hasDominant`, `getGenotypeLabel`, `calcDiversity`)를 재사용한다. 보스 이벤트는 기존 `recordAlleleSnapshot()`/`showMessage(text, true)`로 결과 그래프에 자동 기록된다.

**Tech Stack:** Phaser 3.60 (CDN), 순수 JS, 단일 HTML. 테스트/검증은 preview_* 도구(브라우저 미리보기 + `preview_eval`)로 수행. 최상위 `<script>`의 `const`/함수는 전역이라 `preview_eval`에서 직접 호출 가능.

---

## 검증 방식 (전 작업 공통)

이 게임은 단일 HTML Phaser 앱이라 유닛테스트 프레임워크가 없다. 각 작업은 **브라우저 미리보기**에서 검증한다:

- 최초 1회 `preview_start`로 서버 기동 후 게임 로드.
- 코드 수정 후 `preview_eval: window.location.reload()`로 새로고침.
- 로직은 `preview_eval`로 전역 함수/데이터를 직접 호출해 단언.
- 연출/UI는 `preview_snapshot`·`preview_screenshot`·`preview_console_logs`로 확인.
- 보스를 분 단위로 기다리지 않도록, 게임 시작 후 `window._arenaScene`(기존 전역)로 보스 메서드를 직접 호출해 강제 트리거한다.

게임 시작 트리거 헬퍼(검증 시 사용): `preview_eval: startGame()` 호출 후 잠시 뒤 `window._arenaScene` 준비됨.

---

## File Structure

- **Modify only:** `gene-pool-arena-mobile/index.html`
  - 상수 블록(~1271): `METEOR_TIME`/`METEOR_WARN_TIME` 변경, 보스 상수 추가.
  - 데이터 영역(상수 블록 뒤): `BOSS_ROSTER`, `BOSS_SCHEDULE` 추가.
  - `ArenaScene` 클래스: 보스 상태머신 메서드 + `update()` 훅 + `create()/init` 초기화.
  - HTML body: `#boss-banner`, `#boss-hp`, `#boss-arrow` DOM.
  - CSS: 보스 배너/HP 바 스타일.

모든 변경이 한 파일이라 작업마다 즉시 새로고침으로 검증 가능. 새 파일 없음(프로젝트의 단일 파일 패턴 유지).

---

## Task 1: 게임 시간 10분으로 연장

**Files:**
- Modify: `index.html` (상수 `METEOR_TIME`, `METEOR_WARN_TIME`)

- [ ] **Step 1: 검증 — 현재 값 확인 (변경 전)**

`preview_start` → `preview_eval: startGame()` → 대기 → `preview_eval: METEOR_TIME`
Expected (변경 전): `300000`

- [ ] **Step 2: 상수 변경**

`index.html`의 다음 두 줄을 수정:

```js
const METEOR_TIME = 600000;   // 10분 후 운석 멸종
const METEOR_WARN_TIME = 585000; // 9분 45초 경고 시작
```

- [ ] **Step 3: 검증 — 변경 후**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → `preview_eval: METEOR_TIME`
Expected: `600000`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 게임 시간 5분 → 10분"
```

---

## Task 2: 보스 데이터(BOSS_ROSTER 10종) + 안전 조건

**Files:**
- Modify: `index.html` (상수 블록 뒤, `TERRAIN_LIST` 정의 다음 줄에 삽입)

각 보스는 `safe(ind, group)` 함수로 "도태에서 보호되는 개체" 여부를 판정한다. 형질 보스는 개체 형질로, 히든은 집단 다양성으로 판정.

- [ ] **Step 1: 검증 — 데이터 없음 확인**

`preview_eval: typeof BOSS_ROSTER`
Expected: `"undefined"`

- [ ] **Step 2: BOSS_ROSTER + 상수 추가**

`index.html`에서 `const TERRAIN_LIST = Object.values(TERRAIN);` 줄 **바로 아래**에 삽입:

```js
// ── 보스 위협 시스템 ─────────────────────────────────
const BOSS_WARN_TIME = 20000;       // 경고 카운트다운 20초
const BOSS_RETREAT_TIME = 90000;    // 중간보스 퇴각 제한 90초
const BOSS_RANGE = 240;             // 보스 공격범위(거리)
const BOSS_MIN_POP = 3;             // 이 미만으로 떨어지면 게임오버
const HIDDEN_BOSS_CHANCE = 0.02;    // 최종 슬롯 히든 등장 확률 2%
const DIVERSITY_REQ = 0.6;          // 히든 보스 요구 다양성

const BOSS_ROSTER = [
  // 단일 유전자 6 (지형 대피 1:1)
  { id:'lava',   name:'용암 거인',   ico:'🔥', reqText:'붉은몸(RR)', refuge:'volcano', refugeText:'🌋 화산',  safe:i=>getGenotypeLabel(i,'color')==='RR' },
  { id:'sand',   name:'모래 폭군',   ico:'🏜️', reqText:'푸른몸(BB)', refuge:'desert',  refugeText:'🏜️ 사막',  safe:i=>getGenotypeLabel(i,'color')==='BB' },
  { id:'glacier',name:'빙하 군주',   ico:'❄️', reqText:'갑옷(A)',    refuge:'snow',    refugeText:'❄️ 눈밭',  safe:i=>i.hasDominant('armor') },
  { id:'spore',  name:'독포자 마수', ico:'☠️', reqText:'독성(P)',    refuge:'swamp',   refugeText:'🐸 독성늪', safe:i=>i.hasDominant('poison') },
  { id:'gale',   name:'질풍 추적자', ico:'💨', reqText:'속도(S)',    refuge:'river',   refugeText:'💧 강가',  safe:i=>i.hasDominant('speed') },
  { id:'charmer',name:'매혹 포식자', ico:'💗', reqText:'매력(C)',    refuge:'forest',  refugeText:'🌳 숲',    safe:i=>i.hasDominant('charm') },
  // 복합 압력 3
  { id:'steel',  name:'강철 질주병', ico:'🛡️', reqText:'갑옷+속도(A·S)', refuge:'snow',  refugeText:'❄️ 눈밭', safe:i=>i.hasDominant('armor')&&i.hasDominant('speed') },
  { id:'plague', name:'화염 역병룡', ico:'🐲', reqText:'붉은몸+독성(R·P)', refuge:'volcano', refugeText:'🌋 화산', safe:i=>getGenotypeLabel(i,'color')==='RR'&&i.hasDominant('poison') },
  { id:'siren',  name:'심연 세이렌', ico:'🌊', reqText:'푸른몸+매력(B·C)', refuge:'desert', refugeText:'🏜️ 사막', safe:i=>getGenotypeLabel(i,'color')==='BB'&&i.hasDominant('charm') },
  // 히든 (다양성 요구)
  { id:'primordial', name:'태초의 포식자', ico:'🌈', hidden:true, reqText:'유전적 다양성', refuge:null, refugeText:'균형 유지(한 형질 몰빵 금지)',
    safe:(i,g)=> g.calcDiversity() >= DIVERSITY_REQ },
];
function bossById(id){ return BOSS_ROSTER.find(b=>b.id===id); }
```

- [ ] **Step 3: 검증 — 데이터 무결성**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → 대기 →
`preview_eval: [BOSS_ROSTER.length, BOSS_ROSTER.filter(b=>b.hidden).length, bossById('lava').name]`
Expected: `[10, 1, "용암 거인"]`

- [ ] **Step 4: 검증 — safe 조건 동작 (합성 개체)**

`preview_eval`:
```js
(()=>{const mk=(arr)=>({genes:{},_a:arr,hasDominant(g){return this._a.includes(g[0].toUpperCase());}});
return null;})()
```
대신 실제 게임 개체로 확인: `preview_eval: bossById('glacier').safe(window._arenaScene.player.individuals[0])`
Expected: `true` 또는 `false` (불리언 반환 — 오류 없이 동작하면 통과)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 10종 데이터(BOSS_ROSTER) + 안전조건"
```

---

## Task 3: 보스 스케줄 추첨 + 상태 초기화

**Files:**
- Modify: `index.html` (`BOSS_ROSTER` 아래에 `BOSS_SCHEDULE`; `ArenaScene` 초기화부)

- [ ] **Step 1: BOSS_SCHEDULE 상수 추가**

`bossById` 함수 아래에 삽입:

```js
// 10분 기준 보스 등장 시각(ms)과 슬롯
const BOSS_SCHEDULE = [
  { at:150000, slot:'mid',   hp:80  },  // 2:30
  { at:330000, slot:'mid',   hp:80  },  // 5:30
  { at:480000, slot:'final', hp:160 },  // 8:00
];
```

- [ ] **Step 2: rollBossSchedule 메서드 추가**

`ArenaScene` 클래스 안(아무 메서드 사이, 예: `showMessage` 정의 위)에 추가:

```js
// 이번 판 보스 3종을 중복 없이 추첨. 최종 슬롯은 확률적으로 히든 대체.
rollBossSchedule() {
  const regular = BOSS_ROSTER.filter(b => !b.hidden);
  const pool = [...regular];
  // 셔플
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
  return BOSS_SCHEDULE.map((s, idx) => {
    let boss = pool[idx];
    if (s.slot === 'final' && Math.random() < HIDDEN_BOSS_CHANCE) {
      boss = BOSS_ROSTER.find(b => b.hidden);
    }
    return { at: s.at, slot: s.slot, hp: s.hp, bossId: boss.id, fired: false };
  });
}
```

- [ ] **Step 3: init/create에서 상태 초기화**

`create()` 안, `this.terrainEventCount = {};` 줄 아래(보스 상태 묶음)에 추가:

```js
// 보스 위협 상태
this.bossSchedule = this.rollBossSchedule();
this.bossPhase = 'idle';   // idle | warning | chase
this.activeBoss = null;    // 현재 보스 정의
this.bossEntity = null;    // { x, y, hp, hpMax, sprite, hpUntil }
this.bossSlot = null;      // 'mid' | 'final'
this.bossPhaseUntil = 0;   // 현재 단계 종료 시각(elapsed 기준)
```

- [ ] **Step 4: 검증 — 스케줄 추첨 정상**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → 대기 →
`preview_eval: [window._arenaScene.bossSchedule.length, new Set(window._arenaScene.bossSchedule.map(s=>s.bossId)).size, window._arenaScene.bossPhase]`
Expected: `[3, 3, "idle"]` (3종, 전부 서로 다름, idle 시작)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 스케줄 추첨 + 상태 초기화"
```

---

## Task 4: 보스 배너 DOM/CSS + warning 트리거

**Files:**
- Modify: `index.html` (HTML body, CSS, `update()` 훅, `startBossWarning`)

- [ ] **Step 1: HTML 추가**

`<div id="event-message"></div>` 다음 줄에 추가:

```html
<div id="boss-banner"></div>
<div id="boss-arrow"></div>
<div id="boss-hp"><div id="boss-hp-fill"></div><span id="boss-hp-label"></span></div>
```

- [ ] **Step 2: CSS 추가**

`#event-message` 규칙 근처에 추가:

```css
#boss-banner { position:fixed; top:64px; left:50%; transform:translateX(-50%); z-index:26;
  display:none; padding:10px 16px; border-radius:12px; background:rgba(120,20,20,.92);
  color:#fff; font-family:'Jua',sans-serif; font-size:14px; text-align:center; max-width:90vw;
  box-shadow:0 4px 14px rgba(0,0,0,.35); pointer-events:none; line-height:1.4; }
#boss-banner.show { display:block; animation:msgPop .3s cubic-bezier(.34,1.56,.64,1); }
#boss-hp { position:fixed; top:108px; left:50%; transform:translateX(-50%); z-index:26;
  display:none; width:min(300px,80vw); height:16px; border-radius:999px;
  background:rgba(0,0,0,.4); overflow:hidden; }
#boss-hp.show { display:block; }
#boss-hp-fill { height:100%; width:100%; background:linear-gradient(90deg,#ff6b6b,#c92a2a);
  transition:width .15s; }
#boss-hp-label { position:absolute; inset:0; text-align:center; font-size:10px;
  color:#fff; font-weight:900; line-height:16px; }
#boss-arrow { position:fixed; z-index:26; display:none; font-size:30px; pointer-events:none;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
#boss-arrow.show { display:block; }
```

- [ ] **Step 3: startBossWarning 메서드 추가**

`ArenaScene`에 추가:

```js
startBossWarning(boss, slot) {
  this.bossPhase = 'warning';
  this.activeBoss = boss;
  this.bossSlot = slot;
  this.bossPhaseUntil = this.elapsed + BOSS_WARN_TIME;
  const banner = document.getElementById('boss-banner');
  banner.innerHTML = `${boss.ico} <b>${boss.name}</b> 접근!<br>요구: <b>${boss.reqText}</b> · 대피: <b>${boss.refugeText}</b>`;
  banner.classList.add('show');
  this.showMessage(`${boss.ico} ${boss.name} 접근! ${boss.reqText} 없는 개체는 도태됩니다`, true);
  if (navigator.vibrate) navigator.vibrate([60,40,60]);
  Audio.sfxMeteor && Audio.sfxMeteor();
}
```

- [ ] **Step 4: update()에 스케줄 체크 훅 추가**

`update(_time, dt)` 안에서 운석 경고 체크(`if (this.elapsed >= METEOR_WARN_TIME ...)`) **바로 위**에 추가:

```js
// 보스 스케줄 체크
if (this.bossPhase === 'idle') {
  const due = this.bossSchedule.find(s => !s.fired && this.elapsed >= s.at);
  if (due) { due.fired = true; this.startBossWarning(bossById(due.bossId), due.slot); this._dueBossHp = due.hp; }
}
```

- [ ] **Step 5: 검증 — 배너 강제 트리거**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → 대기 →
`preview_eval: window._arenaScene.startBossWarning(bossById('glacier'),'mid'); document.getElementById('boss-banner').classList.contains('show')`
Expected: `true`
`preview_snapshot`으로 배너 텍스트("빙하 군주 접근! 요구: 갑옷(A)") 확인.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: 보스 경고 배너 + warning 트리거"
```

---

## Task 5: warning 단계 — 카운트다운·대비 게이지·대피 화살표

**Files:**
- Modify: `index.html` (`bossWarningTick`, `update()` 훅, `refugeDirection` 헬퍼)

- [ ] **Step 1: 헬퍼 + bossWarningTick 추가**

`ArenaScene`에 추가:

```js
// 가장 가까운 대피 지형 방향으로 화면가장자리 화살표 갱신
updateBossArrow(boss) {
  const arrow = document.getElementById('boss-arrow');
  if (!boss.refuge) { arrow.classList.remove('show'); return; }
  const target = this.nearestTerrainOf(boss.refuge);
  if (!target) { arrow.classList.remove('show'); return; }
  const cam = this.cameras.main;
  const ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
  const cx = window.innerWidth/2, cy = window.innerHeight/2, r = Math.min(cx,cy)*0.7;
  arrow.textContent = boss.refugeText.slice(0,2);
  arrow.style.left = (cx + Math.cos(ang)*r - 16) + 'px';
  arrow.style.top  = (cy + Math.sin(ang)*r - 16) + 'px';
  arrow.classList.add('show');
}

// 월드에서 지정 지형 타일의 가장 가까운 월드좌표(근사) — 없으면 null
nearestTerrainOf(terrainId) {
  if (!this.terrainGrid) return null;
  const T = TILE; let best = null, bestD = Infinity;
  for (let gy = 0; gy < this.terrainGrid.length; gy += 3) {
    for (let gx = 0; gx < this.terrainGrid[gy].length; gx += 3) {
      if (this.terrainGrid[gy][gx] !== terrainId) continue;
      const wx = gx*T + T/2, wy = gy*T + T/2;
      const d = (wx-this.player.x)**2 + (wy-this.player.y)**2;
      if (d < bestD) { bestD = d; best = { x: wx, y: wy }; }
    }
  }
  return best;
}

bossWarningTick() {
  const boss = this.activeBoss;
  const remain = Math.max(0, Math.ceil((this.bossPhaseUntil - this.elapsed)/1000));
  // 대비도 = 요구 형질 보유 비율
  const g = this.player, n = g.individuals.length || 1;
  const ready = Math.round(g.individuals.filter(i => boss.safe(i, g)).length / n * 100);
  const banner = document.getElementById('boss-banner');
  banner.innerHTML = `${boss.ico} <b>${boss.name}</b> ${remain}초 후 출현!<br>요구: <b>${boss.reqText}</b> · 대피: <b>${boss.refugeText}</b><br>대비도 <b>${ready}%</b>`;
  this.updateBossArrow(boss);
  if (this.elapsed >= this.bossPhaseUntil) this.spawnBoss();
}
```

> 참고: `TILE`과 `this.terrainGrid`는 기존 코드에 존재(지형 그리드). `generateTerrain()`가 2차원 배열을 반환한다고 가정. 만약 접근자 이름이 다르면 기존 `terrainAt()` 구현을 참고해 좌표→타일 변환을 맞출 것.

- [ ] **Step 2: update()에서 warning tick 호출**

Task 4에서 추가한 스케줄 체크 블록 **아래**에 추가:

```js
if (this.bossPhase === 'warning') this.bossWarningTick();
```

- [ ] **Step 3: spawnBoss 임시 스텁(다음 Task에서 채움)**

`ArenaScene`에 임시 추가(검증용):

```js
spawnBoss() {
  this.bossPhase = 'chase';
  document.getElementById('boss-arrow').classList.remove('show');
  // TODO Task 6에서 실제 보스 개체 생성
}
```

- [ ] **Step 4: 검증 — 카운트다운/대비도/화살표**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → 대기 →
`preview_eval: window._arenaScene.startBossWarning(bossById('glacier'),'mid'); window._arenaScene.bossWarningTick(); document.getElementById('boss-banner').innerHTML.includes('대비도')`
Expected: `true`
`preview_eval: document.getElementById('boss-arrow').classList.contains('show')`
Expected: `true` (대피 지형이 맵에 존재할 때)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 경고 카운트다운·대비 게이지·대피 화살표"
```

---

## Task 6: 보스 개체 생성 + 추격 AI + HP 바

**Files:**
- Modify: `index.html` (`spawnBoss` 실제 구현, `bossChaseTick` 이동/HP, `update()` 훅)

- [ ] **Step 1: spawnBoss 실제 구현**

Task 5의 스텁을 교체:

```js
spawnBoss() {
  const boss = this.activeBoss;
  document.getElementById('boss-banner').classList.remove('show');
  document.getElementById('boss-arrow').classList.remove('show');
  // 화면 밖 가장자리에서 등장
  const ang = Math.random()*Math.PI*2;
  const sx = this.player.x + Math.cos(ang)*900;
  const sy = this.player.y + Math.sin(ang)*900;
  const sprite = this.add.text(sx, sy, boss.ico, { fontSize:'56px' })
    .setOrigin(0.5).setDepth(20);
  const hpMax = this._dueBossHp || 80;
  this.bossEntity = { x:sx, y:sy, hp:hpMax, hpMax, sprite, speed: 0.85 };
  this.bossPhase = 'chase';
  this.bossPhaseUntil = this.elapsed + (this.bossSlot === 'final' ? (METEOR_TIME - this.elapsed) : BOSS_RETREAT_TIME);
  document.getElementById('boss-hp').classList.add('show');
  this.showMessage(`${boss.ico} ${boss.name} 출현! 도망치며 번식해 빈도를 올리세요`, true);
  this.recordAlleleSnapshot();
  if (navigator.vibrate) navigator.vibrate(120);
  this.cameras.main.shake(400, 0.01);
}
```

- [ ] **Step 2: bossChaseTick — 이동 + HP 바 (전투는 Task 7)**

`ArenaScene`에 추가:

```js
bossChaseTick(dt) {
  const b = this.bossEntity; if (!b) return;
  // 집단 중심을 향해 추격 (집단보다 살짝 느림)
  const baseSpd = (this.player.average('speed') / 80) * 165 * (dt/1000);
  const ang = Math.atan2(this.player.y - b.y, this.player.x - b.x);
  b.x += Math.cos(ang) * baseSpd * b.speed;
  b.y += Math.sin(ang) * baseSpd * b.speed;
  b.sprite.setPosition(b.x, b.y);
  // HP 바 갱신
  const pct = Math.max(0, b.hp / b.hpMax * 100);
  document.getElementById('boss-hp-fill').style.width = pct + '%';
  document.getElementById('boss-hp-label').textContent = `${this.activeBoss.ico} ${this.activeBoss.name}  ${Math.ceil(b.hp)}/${b.hpMax}`;
}
```

> `this.player.average('speed')`는 기존 이동 코드(`movePlayer`)에서 사용하는 패턴과 동일. 존재 확인됨.

- [ ] **Step 3: update()에서 chase tick 호출**

warning tick 호출 줄 아래에 추가:

```js
if (this.bossPhase === 'chase') this.bossChaseTick(dt);
```

- [ ] **Step 4: 검증 — 보스 추격(거리 감소)**

`preview_eval: window.location.reload()` → `preview_eval: startGame()` → 대기 →
```
preview_eval: (()=>{const s=window._arenaScene; s.startBossWarning(bossById('lava'),'mid'); s._dueBossHp=80; s.spawnBoss(); const b=s.bossEntity; const d0=Math.hypot(b.x-s.player.x,b.y-s.player.y); return [!!b, b.hp, Math.round(d0)];})()
```
Expected: `[true, 80, ~900]` (보스 생성, HP 80, 초기 거리 ~900)
잠시 뒤 `preview_eval: Math.round(Math.hypot(window._arenaScene.bossEntity.x-window._arenaScene.player.x, window._arenaScene.bossEntity.y-window._arenaScene.player.y))`
Expected: 이전보다 **작아짐**(추격 중). `preview_screenshot`으로 보스 이모지 + HP 바 확인.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 개체 생성 + 추격 AI + HP 바"
```

---

## Task 7: 전투 루프 — 접촉 도태 + 반격 + 선택압 오라

**Files:**
- Modify: `index.html` (`bossChaseTick`에 전투 로직 추가, `bossCullTick` 분리)

- [ ] **Step 1: bossChaseTick에 전투 호출 추가**

`bossChaseTick` 끝(HP 바 갱신 다음)에 추가:

```js
  // 공격범위 안일 때만 도태/반격
  const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
  if (dist <= BOSS_RANGE) this.bossCombatTick(dt);
```

- [ ] **Step 2: bossCombatTick 추가**

`ArenaScene`에 추가:

```js
// 접촉 중: 안전조건 미충족 개체 도태 + 보유 개체 비례 반격
bossCombatTick(dt) {
  const boss = this.activeBoss, g = this.player, b = this.bossEntity;
  if (!g.individuals.length) return;
  const safeFn = (i) => boss.safe(i, g);
  // 도태: 미충족 개체 일부에 피해 (한 번에 전멸 방지: 틱당 최대 3마리)
  const unsafe = g.individuals.filter(i => !safeFn(i));
  const cullN = Math.min(unsafe.length, Math.ceil(3 * (dt/1000) * 6));
  for (let k = 0; k < cullN; k++) {
    const v = unsafe[k]; if (!v) break;
    v.hp -= 6; if (v.hp <= 0) v.dead = true;
  }
  g.individuals = g.individuals.filter(i => !i.dead);
  if (cullN > 0) this.burst(g.x, g.y, 0xff5555, 6, 80);
  // 반격: 안전(보유) 개체 수 비례로 보스 HP 감소
  const safeCount = g.individuals.filter(safeFn).length;
  b.hp -= safeCount * 0.9 * (dt/1000) * 6;
  if (b.hp <= 0) this.resolveBoss(true);
}
```

> 선택압 오라(강가→S, 숲→C)는 별도 지형 효과를 추가하지 않고, **보스 도태가 곧 선택압**이므로 자동 충족된다. 유리 지형으로 이동해 번식하면 안전 개체 비율이 오르고, 불리 개체는 보스 접촉 시 도태된다. (스펙 §3 "선택압 오라"의 통일 메커니즘 실현)

- [ ] **Step 3: resolveBoss 임시 스텁(다음 Task에서 확장)**

```js
resolveBoss(win) {
  this.bossPhase = 'idle';
  if (this.bossEntity) { this.bossEntity.sprite.destroy(); this.bossEntity = null; }
  document.getElementById('boss-hp').classList.remove('show');
  this.activeBoss = null;
}
```

- [ ] **Step 4: 검증 — 접촉 시 도태/반격 발생**

`preview_eval`로 보스를 집단 위에 붙이고 한 틱 강제:
```
preview_eval: (()=>{const s=window._arenaScene; s.startBossWarning(bossById('glacier'),'mid'); s._dueBossHp=80; s.spawnBoss(); const b=s.bossEntity; b.x=s.player.x; b.y=s.player.y; const pop0=s.player.individuals.length, hp0=b.hp; s.bossCombatTick(1000); return [pop0, s.player.individuals.length, hp0, Math.round(b.hp)];})()
```
Expected: 개체수 감소(도태) 또는 보스 HP 감소(반격) 중 최소 하나 발생 — `[pop0, pop1<=pop0, 80, hp1<=80]`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 전투 루프 — 접촉 도태 + 비례 반격"
```

---

## Task 8: resolve — 승리/게임오버/퇴각 + 보상 + 그래프 기록

**Files:**
- Modify: `index.html` (`resolveBoss` 완성, `bossChaseTick`에 퇴각/게임오버 체크)

- [ ] **Step 1: resolveBoss 완성**

Task 7의 스텁을 교체:

```js
resolveBoss(win, reason) {
  const boss = this.activeBoss, slot = this.bossSlot;
  if (this.bossEntity) { this.bossEntity.sprite.destroy(); this.bossEntity = null; }
  document.getElementById('boss-hp').classList.remove('show');
  document.getElementById('boss-banner').classList.remove('show');
  this.bossPhase = 'idle';
  this.recordAlleleSnapshot();
  if (win) {
    let score = slot === 'final' ? 600 : 200;
    if (boss.hidden) score = 1500;
    this.bossBonus = (this.bossBonus || 0) + score;
    this.showMessage(`🏆 ${boss.name} 처치! +${score}점`, true);
    this.showToast && this.showToast(`🏆 ${boss.name} 처치 +${score}`, 'ach');
    if (boss.hidden && this.gainedMutationsThisGame) { /* 고유 돌연변이/해금 훅: 후속 */ }
    if (navigator.vibrate) navigator.vibrate([80,40,120]);
    this.cameras.main.flash(220, 255, 240, 180);
  } else if (reason === 'retreat') {
    this.showMessage(`${boss.ico} ${boss.name}가 물러갑니다… (보상 없음)`, true);
  }
  this.activeBoss = null;
  this.bossSlot = null;
}
```

- [ ] **Step 2: bossChaseTick에 퇴각/게임오버 체크 추가**

`bossChaseTick`에서 `bossCombatTick` 호출 **다음**에 추가:

```js
  // 게임오버: 개체수 임계 미만
  if (this.player.individuals.length < BOSS_MIN_POP) { this.resolveBoss(false, 'wipe'); return this.endGame(); }
  // 중간보스 퇴각: 제한시간 초과(최종보스는 운석까지 추격이라 사실상 미발동)
  if (this.bossSlot !== 'final' && this.elapsed >= this.bossPhaseUntil) this.resolveBoss(false, 'retreat');
```

- [ ] **Step 3: 점수에 bossBonus 반영**

`endGame()`의 `score` 계산식 끝에 `+ (this.bossBonus || 0)` 추가하고, 점수 구성 카드에 한 줄 추가(기존 다양성/도전과제 보너스 행 옆):

```js
// score 계산식의 합산 항에 추가
+ (this.bossBonus || 0)
```
그리고 점수 구성 HTML에:
```js
${this.bossBonus ? `<div class="row"><span>보스 처치 보너스</span><strong class="good">+${this.bossBonus.toLocaleString()}</strong></div>` : ''}
```

- [ ] **Step 4: 검증 — 승리/게임오버 분기**

승리: `preview_eval: (()=>{const s=window._arenaScene; s.startBossWarning(bossById('lava'),'mid'); s._dueBossHp=80; s.spawnBoss(); s.bossEntity.hp=0.1; s.bossEntity.x=s.player.x; s.bossEntity.y=s.player.y; s.bossCombatTick(1000); return [s.bossPhase, s.bossBonus];})()`
Expected: `["idle", 200]` (처치 → idle, 보너스 200)

게임오버: 개체를 임계 미만으로 만들고 한 틱 →
`preview_eval: (()=>{const s=window._arenaScene; s.startBossWarning(bossById('glacier'),'mid'); s._dueBossHp=80; s.spawnBoss(); s.player.individuals.length=2; s.bossChaseTick(16); return s.gameOver;})()`
Expected: `true` (멸종 엔딩). `preview_snapshot`으로 결과창 표시 확인.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 보스 판정(승리/게임오버/퇴각) + 보너스 점수 + 그래프 기록"
```

---

## Task 9: 복합·히든 보스 통합 검증 + 운석 연동

**Files:**
- Modify: `index.html` (운석 트리거가 보스 활성 중이면 양보)

- [ ] **Step 1: 운석이 보스 chase와 겹칠 때 보스 우선**

`update()`의 운석 트리거(`if (this.elapsed >= METEOR_TIME && !this.meteorActive)`) 조건에 보스 미활성 가드 추가:

```js
if (this.elapsed >= METEOR_TIME && !this.meteorActive && this.bossPhase === 'idle') {
  return this.triggerMeteor();
}
```

> 최종보스를 운석 시각까지 못 잡으면, 운석은 보스가 정리된(처치/게임오버) 다음 틱에 발동한다.

- [ ] **Step 2: 검증 — 복합 보스 safe 동작**

`preview_eval: (()=>{const s=window._arenaScene, g=s.player; const b=bossById('steel'); const i=g.individuals[0]; return typeof b.safe(i,g)==='boolean';})()`
Expected: `true` (오류 없이 불리언)

- [ ] **Step 3: 검증 — 히든 보스 다양성 판정**

`preview_eval: (()=>{const s=window._arenaScene, g=s.player; const b=bossById('primordial'); return [b.hidden, b.safe(g.individuals[0], g) === (g.calcDiversity()>=DIVERSITY_REQ)];})()`
Expected: `[true, true]` (다양성 기준과 일치)

- [ ] **Step 4: 검증 — 히든 등장 확률 분포(통계)**

`preview_eval: (()=>{let h=0; for(let k=0;k<5000;k++){const sc=window._arenaScene.rollBossSchedule(); if(sc.some(x=>bossById(x.bossId).hidden)) h++;} return (h/5000);})()`
Expected: 약 `0.02` 근방(0.01~0.03). (2% 확률 확인)

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 복합·히든 보스 통합 + 운석 연동"
```

---

## Task 10: 실플레이 통합 점검 + 폴리시

**Files:**
- Modify: `index.html` (필요 시 연출/밸런스 미세조정)

- [ ] **Step 1: 빠른 스케줄로 전체 흐름 점검**

`preview_eval`로 스케줄을 앞당겨 실제 플레이 흐름을 빠르게 확인:
```
preview_eval: (()=>{const s=window._arenaScene; s.bossSchedule=[{at:s.elapsed+2000,slot:'mid',hp:60,bossId:'glacier',fired:false},{at:s.elapsed+30000,slot:'final',hp:140,bossId:'lava',fired:false}]; return s.bossSchedule.map(x=>x.bossId);})()
```
이후 실제로 조이스틱 없이 두면 보스가 추격→도태하는지 `preview_screenshot` 연속 확인. 눈밭/화산으로 이동(필요 시 `preview_eval`로 `s.player.x/y` 이동)했을 때 대비도 상승·보스 HP 하락 확인.

- [ ] **Step 2: 콘솔 오류 점검**

`preview_console_logs`로 보스 전 과정에서 오류 없는지 확인. 오류 있으면 해당 메서드 수정 후 재검증.

- [ ] **Step 3: 연출 점검**

경고 진동/배너, 출현 `shake`, 도태 `burst`, 처치 `flash`가 모두 보이는지 `preview_screenshot`으로 확인.

- [ ] **Step 4: 밸런스 메모**

§10 튜닝 숫자(보스 속도 0.85, 범위 240, 도태 6dmg, 반격 0.9, mid HP 80/final 160, 퇴각 90초, 임계 3, 히든 2%) 중 체감 이상치를 조정. 변경 시 사유를 커밋 메시지에 기록.

- [ ] **Step 5: 최종 Commit**

```bash
git add index.html
git commit -m "polish: 보스 위협 시스템 실플레이 점검·밸런스 조정"
```

---

## Self-Review 결과

- **스펙 커버리지:** §2 시간10분(T1) · §3 보스10종+히든(T2,T9) · §4 추격 상태머신/타이밍(T3,T4,T6) · §5 전투루프(T7) · §6 판정·보상(T8) · §7 UI/연출(T4,T5,T6,T10) · §8 연결점(전 Task) · 운석연동(T9). 모든 절에 대응 Task 존재.
- **플레이스홀더:** 히든 "고유 돌연변이/해금"은 T8에서 점수 보상으로 구현하고 돌연변이/도감 해금은 후속(스펙 §9 도감 후속과 일치)으로 명시 — 의도된 범위 밖 표시.
- **식별자 일관성:** `BOSS_ROSTER`/`bossById`/`bossSchedule`/`bossPhase`/`activeBoss`/`bossEntity`/`bossSlot`/`bossPhaseUntil`/`startBossWarning`/`bossWarningTick`/`spawnBoss`/`bossChaseTick`/`bossCombatTick`/`resolveBoss`/`bossBonus`/`_dueBossHp` 전 Task 통일. 기존 함수 `getGenotypeLabel`·`hasDominant`·`calcDiversity`·`recordAlleleSnapshot`·`showMessage(text,true)`·`burst`·`average` 재사용 확인.
- **주의(실행 시 확인 필요):** `this.terrainGrid`/`TILE`의 실제 접근 방식은 기존 `terrainAt()`/`generateTerrain()` 구현을 보고 맞출 것(T5 Step1 주석). 다르면 좌표 변환만 조정.
