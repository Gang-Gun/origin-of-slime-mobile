# 지형 위험 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 10초 단일 틱 + 텍스트 메시지 방식을 지형별 독립 위험 사이클(경고 5초 → 위험 8초 → 도태 → 쿨타임 15~25초)로 교체한다.

**Architecture:** 단일 파일 `index.html`. 기존 `terrainEventTick()` / `applyTerrainEvent()` 메시지 부분 제거. 각 TERRAIN 객체에 런타임 `_danger` 상태 추가. `update()` 루프에 `updateTerrainDanger()` 호출 삽입. Phaser Graphics로 타일 오버레이, `individualSprites` Map 확장으로 ⚠️ 마커 관리.

**Tech Stack:** Phaser 3.60 (CDN), 순수 JS, 단일 HTML. 검증: `node test/check-syntax.mjs` + 브라우저 `preview_eval`.

---

## 검증 방식 (공통)

- 매 작업: `node test/check-syntax.mjs` → `syntax ok` 필수.
- 브라우저 검증: `preview_start` → `preview_eval: startGame()` → `window._arenaScene` 준비 후 메서드 직접 호출.
- 지형 위험 직접 트리거: `preview_eval: window._arenaScene._forceDanger('volcano')` (Task 3에서 추가할 헬퍼).

---

## File Structure

- **Modify only:** `index.html`
  - 상수 블록(~1994): 기존 `TERRAIN_EVENT_INTERVAL` 제거, 신규 위험 상수 추가
  - `create()` (~3059): `lastTerrainEventAt` 제거, `initTerrainDanger()` 호출 추가
  - `update()` (~3821): 기존 틱 체크 제거, `updateTerrainDanger(dt)` 추가
  - `terrainEventTick()` (~4133): 완전 제거
  - `applyTerrainEvent()` (~4164): `showMessage` 두 줄 제거, 반환값 유지
  - 신규 메서드: `initTerrainDanger()`, `updateTerrainDanger(dt)`, `_drawDangerOverlay()`, `_applyDangerEvent(terrain)`, `_clearDangerVisuals(terrain)`, `_forceDanger(terrainId)` (디버그)

---

## Task 1: 상수 교체 + 구 틱 제거

**Files:**
- Modify: `index.html` (~1994, ~3059, ~3821, ~4133)

- [ ] **Step 1: 상수 교체**

`index.html`에서 `const TERRAIN_EVENT_INTERVAL = 10000;` 줄을 찾아 다음으로 교체:

```js
const DANGER_WARN_MS    = 5000;   // 경고 단계 5초
const DANGER_ACTIVE_MS  = 8000;   // 위험 단계 8초
const DANGER_CD_MIN     = 15000;  // 쿨타임 최소 15초
const DANGER_CD_MAX     = 25000;  // 쿨타임 최대 25초
```

- [ ] **Step 2: create()에서 lastTerrainEventAt 제거**

`create()` 안 `this.lastTerrainEventAt = Date.now();` 줄 제거.

- [ ] **Step 3: update() 틱 체크 제거**

`update()` 안 아래 3줄 제거:
```js
if (now - this.lastTerrainEventAt >= TERRAIN_EVENT_INTERVAL) {
  this.lastTerrainEventAt = now;
  this.terrainEventTick();
}
```

- [ ] **Step 4: terrainEventTick() 전체 제거**

`terrainEventTick()` 메서드 전체(line ~4133~4162) 제거.

- [ ] **Step 5: applyTerrainEvent()에서 showMessage 제거**

`applyTerrainEvent()` 안 메시지 블록 제거:
```js
// 제거할 블록 (if playerAffected ~ 끝):
if (playerAffected) {
  if (event.predicate) {
    const suffix = playerDeaths > 0 ? ` (${playerDeaths}마리 사망)` : ' (피해 없음 — 이 집단엔 해당 개체 없음)';
    this.showMessage(`[${targetTerrain.name}] ${event.name}: ${event.message}${suffix}`, true);
  } else {
    this.showMessage(`[${targetTerrain.name}] ${event.name}: ${event.message}`, true);
  }
}
```

- [ ] **Step 6: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "refactor: 지형 이벤트 구 틱 시스템 제거"
```

---

## Task 2: 지형 타일 좌표 사전계산 + _danger 상태 초기화

**Files:**
- Modify: `index.html` (`initTerrainDanger` 신규, `create()` 호출 추가)

- [ ] **Step 1: initTerrainDanger 메서드 추가**

`ArenaScene` 안 `terrainAt()` 메서드 바로 위에 추가:

```js
initTerrainDanger() {
  // 각 지형의 타일 픽셀 좌표 사전계산 (overlay 그리기용)
  this._terrainTiles = {};
  const rows = this.terrainGrid.length;
  const cols = this.terrainGrid[0].length;
  for (const t of TERRAIN_LIST) {
    this._terrainTiles[t.id] = [];
  }
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const t = this.terrainGrid[gy][gx];
      this._terrainTiles[t.id].push({ px: gx * TILE, py: gy * TILE });
    }
  }

  // 위험 오버레이용 단일 Graphics (depth 5, 타일 레이어 위)
  this._dangerGfx = this.add.graphics().setDepth(5).setScrollFactor(1);

  // 지형별 독립 위험 상태 초기화 (TERRAIN_EVENTS 있는 지형만)
  const terrainIds = Object.keys(TERRAIN_EVENTS);
  terrainIds.forEach((id, idx) => {
    const t = TERRAIN[id];
    if (!t) return;
    // 쿨타임을 지형마다 다르게 시작해서 동시 다발 방지
    const offset = idx * 4000;
    t._danger = {
      phase: 'cooldown',
      until: this.elapsed + DANGER_CD_MIN + offset,
      event: null,
    };
  });

  // ⚠️ 마커 관리 Map (individual.id → Phaser.Text)
  this._dangerMarkers = new Map();
  // 현재 위험/경고 중인 지형의 취약 개체 id Set
  this._atRiskIds = new Set();
}
```

- [ ] **Step 2: create()에서 호출**

`create()` 안 `this.bossSchedule = this.rollBossSchedule();` 줄 **바로 아래**에 추가:

```js
this.initTerrainDanger();
```

- [ ] **Step 3: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 4: 런타임 검증**

`preview_eval: startGame()` → 대기 →
```js
preview_eval: (()=>{const s=window._arenaScene; return [!!s._dangerGfx, !!s._terrainTiles.volcano, s._terrainTiles.volcano.length > 0, TERRAIN.volcano._danger?.phase];})()
```
Expected: `[true, true, true, "cooldown"]`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 지형 위험 상태 초기화 + 타일 좌표 사전계산"
```

---

## Task 3: updateTerrainDanger — 상태 전이 + 강제 트리거 헬퍼

**Files:**
- Modify: `index.html` (`updateTerrainDanger` 신규, `update()` 훅 추가)

- [ ] **Step 1: updateTerrainDanger 메서드 추가**

`initTerrainDanger()` 바로 아래에 추가:

```js
updateTerrainDanger(dt) {
  const now = this.elapsed;
  this._atRiskIds.clear();

  for (const id of Object.keys(TERRAIN_EVENTS)) {
    const t = TERRAIN[id];
    if (!t || !t._danger) continue;
    const d = t._danger;

    if (d.phase === 'cooldown' && now >= d.until) {
      // 사이클 시작: 이벤트 선택 후 경고 단계
      d.event = choose(TERRAIN_EVENTS[id]);
      d.phase = 'warning';
      d.until = now + DANGER_WARN_MS;
      if (navigator.vibrate) navigator.vibrate(40);
    } else if (d.phase === 'warning' && now >= d.until) {
      // 식량 이벤트는 경고 단계에서 즉시 처리 후 쿨타임
      if (!d.event.predicate) {
        this._applyDangerEvent(t);
        d.phase = 'cooldown';
        d.until = now + DANGER_CD_MIN + Math.random() * (DANGER_CD_MAX - DANGER_CD_MIN);
        d.event = null;
      } else {
        d.phase = 'active';
        d.until = now + DANGER_ACTIVE_MS;
      }
    } else if (d.phase === 'active' && now >= d.until) {
      this._applyDangerEvent(t);
      d.phase = 'cooldown';
      d.until = now + DANGER_CD_MIN + Math.random() * (DANGER_CD_MAX - DANGER_CD_MIN);
      d.event = null;
    }

    // 경고/위험 단계: 취약 개체 id 수집
    if ((d.phase === 'warning' || d.phase === 'active') && d.event?.predicate) {
      for (const group of this.groups) {
        if (this.terrainAt(group.x, group.y).id !== id) continue;
        for (const ind of group.individuals) {
          if (d.event.predicate(ind)) this._atRiskIds.add(ind.id);
        }
      }
    }
  }

  this._drawDangerOverlay();
  this._syncDangerMarkers();
}
```

- [ ] **Step 2: 디버그 헬퍼 추가 (검증용)**

같은 위치 아래에 추가:

```js
_forceDanger(terrainId) {
  const t = TERRAIN[terrainId];
  if (!t || !t._danger) return 'unknown terrain';
  t._danger.event = choose(TERRAIN_EVENTS[terrainId]);
  t._danger.phase = 'warning';
  t._danger.until = this.elapsed + DANGER_WARN_MS;
  return `forced ${terrainId} → warning`;
}
```

- [ ] **Step 3: update()에 훅 추가**

`update()` 안 기존 `if (now - this.lastWeatherAt >= WEATHER_INTERVAL)` 줄 **바로 위**에 추가:

```js
this.updateTerrainDanger(dt);
```

- [ ] **Step 4: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 5: 상태 전이 검증**

```js
preview_eval: (()=>{
  const s=window._arenaScene;
  s._forceDanger('volcano');
  const phase0 = TERRAIN.volcano._danger.phase;
  // 경고 단계 즉시 종료 시뮬레이션
  TERRAIN.volcano._danger.until = s.elapsed - 1;
  s.updateTerrainDanger(16);
  return [phase0, TERRAIN.volcano._danger.phase];
})()
```
Expected: `["warning", "active"]`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: 지형 위험 상태 전이 + updateTerrainDanger"
```

---

## Task 4: 오버레이 렌더링 + 이벤트 아이콘

**Files:**
- Modify: `index.html` (`_drawDangerOverlay` 신규, `_clearDangerVisuals` 신규)

- [ ] **Step 1: _drawDangerOverlay 추가**

`updateTerrainDanger` 바로 아래에 추가:

```js
_drawDangerOverlay() {
  const g = this._dangerGfx;
  g.clear();

  // 기존 아이콘 텍스트 제거
  if (this._dangerIcons) {
    for (const txt of this._dangerIcons) txt.destroy();
  }
  this._dangerIcons = [];

  for (const id of Object.keys(TERRAIN_EVENTS)) {
    const t = TERRAIN[id];
    if (!t?._danger) continue;
    const d = t._danger;
    if (d.phase === 'cooldown') continue;

    const tiles = this._terrainTiles[id] || [];
    const isActive = d.phase === 'active';

    // 펄스 알파: 경고=주황 깜빡, 위험=빨강 고정
    let alpha, color;
    if (isActive) {
      color = 0xff2222;
      alpha = 0.38;
    } else {
      // warning: sin 파 펄스 (경고)
      const pulse = 0.20 + 0.15 * Math.sin(this.elapsed / 300);
      color = 0xff8800;
      alpha = pulse;
    }

    // 식량 이벤트는 다른 색
    if (d.event && !d.event.predicate) {
      color = d.event.foodDelta > 0 ? 0x44cc44 : 0xddaa00;
      alpha = isActive ? 0.30 : 0.15 + 0.10 * Math.sin(this.elapsed / 300);
    }

    g.fillStyle(color, alpha);
    for (const { px, py } of tiles) {
      g.fillRect(px, py, TILE, TILE);
    }

    // 이벤트 아이콘: 타일 중심 근처 1개 (지형 중심 계산)
    if (tiles.length > 0 && d.event) {
      const mid = tiles[Math.floor(tiles.length / 2)];
      const ico = this.add.text(
        mid.px + TILE / 2,
        mid.py + TILE / 2,
        t.ico,
        { fontSize: '36px' }
      ).setOrigin(0.5).setDepth(6).setScrollFactor(1).setAlpha(0.85);
      this._dangerIcons.push(ico);
    }
  }
}
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 3: 시각 검증**

```js
preview_eval: window._arenaScene._forceDanger('volcano')
```
→ `preview_screenshot` 으로 화산 타일에 주황 오버레이 + 🌋 아이콘 보이는지 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 지형 위험 타일 오버레이 + 이벤트 아이콘"
```

---

## Task 5: ⚠️ 마커 — 취약 슬라임 표시

**Files:**
- Modify: `index.html` (`_syncDangerMarkers` 신규)

- [ ] **Step 1: _syncDangerMarkers 추가**

`_drawDangerOverlay` 바로 아래에 추가:

```js
_syncDangerMarkers() {
  const live = new Set();

  for (const ind of this._atRiskIds) {
    live.add(ind);
  }

  // 기존 마커 중 더 이상 필요 없는 것 제거
  for (const [id, txt] of this._dangerMarkers.entries()) {
    if (!live.has(id)) {
      txt.destroy();
      this._dangerMarkers.delete(id);
    }
  }

  // 취약 개체 마커 생성/위치 갱신
  for (const id of live) {
    const entry = this.individualSprites.get(id);
    if (!entry) continue;
    if (!this._dangerMarkers.has(id)) {
      const txt = this.add.text(0, 0, '⚠️', { fontSize: '12px' })
        .setOrigin(0.5, 1).setDepth(18).setScrollFactor(1);
      this._dangerMarkers.set(id, txt);
    }
    const txt = this._dangerMarkers.get(id);
    txt.x = entry.sprite.x;
    txt.y = entry.sprite.y - 22 * entry.baseScale;
  }
}
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 3: 마커 검증**

```js
preview_eval: (()=>{
  const s = window._arenaScene;
  s._forceDanger('volcano');       // 화산 경고 강제
  s.updateTerrainDanger(16);       // 한 틱 돌려서 _atRiskIds 채움
  return [s._atRiskIds.size, s._dangerMarkers.size];
})()
```
Expected: `_atRiskIds.size` > 0 (플레이어가 화산에 있을 때) 또는 0 (없을 때). `preview_screenshot`으로 화산 위 슬라임에 ⚠️ 뜨는지 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 취약 슬라임 ⚠️ 마커"
```

---

## Task 6: 도태 실행 + 이모지 토스트

**Files:**
- Modify: `index.html` (`_applyDangerEvent` 신규)

- [ ] **Step 1: _applyDangerEvent 추가**

`_forceDanger` 바로 아래에 추가:

```js
_applyDangerEvent(terrain) {
  const event = terrain._danger.event;
  if (!event) return;

  const t = terrain;
  this.terrainEventCount[t.id] = (this.terrainEventCount[t.id] || 0) + 1;

  let playerDeaths = 0;

  for (const group of this.groups) {
    if (this.terrainAt(group.x, group.y).id !== t.id) continue;

    if (event.predicate) {
      const atRisk = group.individuals.filter(i => event.predicate(i));
      if (atRisk.length) {
        const rate = event.killRate ?? 0.60;
        const n = Math.max(1, Math.round(atRisk.length * rate));
        const victims = atRisk.sort(() => Math.random() - 0.5).slice(0, n);
        const ids = new Set(victims.map(i => i.id));
        group.individuals = group.individuals.filter(i => !ids.has(i.id));
        group.terrainEventDeaths += victims.length;
        if (group.isPlayer) {
          playerDeaths += victims.length;
          this.burst(group.x, group.y, 0xff4444, 8, 60);
        }
      }
    } else if (event.foodDelta !== undefined) {
      const before = group.food;
      group.food = clamp(group.food + event.foodDelta, 0, FOOD_CAP);
      if (group.isPlayer && this.showToast) {
        const delta = Math.round(group.food - before);
        const sign = delta >= 0 ? '+' : '';
        this.showToast(`${t.ico} ${sign}${delta} 🍎`, 'ach');
      }
    } else if (event.foodRatio !== undefined) {
      const before = group.food;
      group.food = Math.floor(group.food * event.foodRatio);
      if (group.isPlayer && this.showToast) {
        const pct = Math.round((1 - event.foodRatio) * 100);
        this.showToast(`${t.ico} −${pct}% 🍎`, 'ach');
      }
    }
  }

  // 도태 토스트 (플레이어 집단이 해당 지형에 있었고 사망 발생 시)
  if (event.predicate && playerDeaths > 0 && this.showToast) {
    this.showToast(`${t.ico} ×${playerDeaths} 💀`, 'ach');
  }

  this.recordAlleleSnapshot();
}
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 3: 도태 검증**

플레이어를 화산으로 이동 후:
```js
preview_eval: (()=>{
  const s = window._arenaScene;
  const pop0 = s.player.individuals.length;
  s._forceDanger('volcano');
  TERRAIN.volcano._danger.phase = 'active';
  TERRAIN.volcano._danger.until = s.elapsed - 1;
  s.updateTerrainDanger(16);
  return [pop0, s.player.individuals.length];
})()
```
Expected: 화산 위에 있을 때 개체수 감소. `preview_screenshot`으로 토스트 `🌋 ×N 💀` 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 지형 위험 도태 실행 + 이모지 토스트"
```

---

## Task 7: 게임 종료 시 visuals 정리

**Files:**
- Modify: `index.html` (`endGame()` 또는 scene 재시작 시 cleanup)

- [ ] **Step 1: _clearAllDangerVisuals 추가**

`_applyDangerEvent` 바로 아래에 추가:

```js
_clearAllDangerVisuals() {
  if (this._dangerGfx) this._dangerGfx.clear();
  if (this._dangerIcons) {
    for (const txt of this._dangerIcons) txt.destroy();
    this._dangerIcons = [];
  }
  if (this._dangerMarkers) {
    for (const txt of this._dangerMarkers.values()) txt.destroy();
    this._dangerMarkers.clear();
  }
  // _danger 상태 리셋 (재시작 대비)
  for (const id of Object.keys(TERRAIN_EVENTS)) {
    const t = TERRAIN[id];
    if (t) delete t._danger;
  }
}
```

- [ ] **Step 2: endGame()에서 호출**

`endGame()` 메서드 첫 줄에 추가:

```js
this._clearAllDangerVisuals();
```

- [ ] **Step 3: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok`

- [ ] **Step 4: 통합 검증 — 전체 흐름**

`preview_eval: startGame()` → 30초 대기 →
```js
preview_eval: (()=>{
  const s = window._arenaScene;
  const phases = Object.keys(TERRAIN_EVENTS).map(id => [id, TERRAIN[id]._danger?.phase]);
  return phases;
})()
```
Expected: 각 지형이 `cooldown` / `warning` / `active` 중 하나.

`preview_screenshot`으로 경고 중인 지형에 오버레이 보이는지 확인.
`preview_console_logs`로 오류 없는지 확인.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: 지형 위험 시스템 visuals 정리 + 통합 완료"
```

---

## Self-Review

**스펙 커버리지:**
- §2 독립 타이머: Task 2 `initTerrainDanger` ✓
- §3.1 경고 5초 + 주황 오버레이 + 이모지 + ⚠️ 마커 + 진동: Task 3(전이) + Task 4(오버레이) + Task 5(마커) ✓
- §3.2 위험 8초 + 빨간 오버레이: Task 4 ✓
- §3.3 도태 + burst + 토스트: Task 6 ✓
- §4 _danger 상태 구조: Task 2 ✓
- §5 연결점(제거/추가): Task 1(제거) + Task 2~6(추가) ✓
- §6 오버레이 렌더링 방식: Task 4 ✓
- §7 토스트 포맷: Task 6 ✓
- §3.1 식량 이벤트 별도 처리: Task 3(경고 단계 즉시 적용) + Task 6(_applyDangerEvent foodDelta/foodRatio) ✓

**식별자 일관성:**
- `_dangerGfx`, `_terrainTiles`, `_dangerMarkers`, `_atRiskIds`, `_dangerIcons` — 전 Task 통일
- `updateTerrainDanger`, `_drawDangerOverlay`, `_syncDangerMarkers`, `_applyDangerEvent`, `_clearAllDangerVisuals`, `_forceDanger` — 전 Task 통일
- `DANGER_WARN_MS`, `DANGER_ACTIVE_MS`, `DANGER_CD_MIN`, `DANGER_CD_MAX` — Task 1에서 정의, Task 3에서 사용

**주의사항:**
- `this._atRiskIds`는 `individual.id`(숫자) Set이지만 `_syncDangerMarkers`의 `live`도 같은 타입. 일관됨.
- `_dangerIcons`는 매 `_drawDangerOverlay` 호출 시 destroy + 재생성. 매 틱 호출되므로 성능 주의 → 실제로는 phase가 cooldown일 때 skip이라 문제 없음.
- `terrainEventCount` 는 기존 결과 그래프에서 사용되므로 `_applyDangerEvent`에서 유지.
