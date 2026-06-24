# 슬라임 글로우 위험 표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 타일 색 오버레이를 제거하고, 취약 슬라임에 Phaser 3.60 preFX 글로우(경고=노랑, 위험=빨강)를 적용해 위험을 직관적으로 표현한다.

**Architecture:** `_atRiskIds`(Set)를 `_atRiskPhaseMap`(Map<id, phase>)으로 교체해 단계별 글로우 색 결정에 활용. `_dangerMarkers`(Text Map)를 `_dangerGlows`(Glow Map)로 교체. `_drawDangerOverlay`에서 fillRect 제거, `_syncDangerMarkers`에서 Text 대신 `sprite.preFX.addGlow()` 사용.

**Tech Stack:** Phaser 3.60 WebGL preFX API (`preFX.addGlow`), single-file `index.html`

---

## Files

- **Modify:** `index.html`
  - `initTerrainDanger()` — 데이터 구조 교체 (line ~3410-3413)
  - `updateTerrainDanger(dt)` — atRiskIds → atRiskPhaseMap (line ~3418, 3454)
  - `_drawDangerOverlay()` — fillRect 제거 (line ~3464-3518)
  - `_syncDangerMarkers()` — Text → preFX glow (line ~3519-3547)
  - `_clearAllDangerVisuals()` — glow 정리 (line ~3616-3629)

---

### Task 1: 데이터 구조 교체 (initTerrainDanger + updateTerrainDanger)

**Files:**
- Modify: `index.html` (lines ~3410-3413, ~3418, ~3454)

- [ ] **Step 1: initTerrainDanger 끝부분 교체**

현재 (line ~3410-3413):
```js
  // ⚠️ 마커 관리 Map (individual.id → Phaser.Text)
  this._dangerMarkers = new Map();
  // 현재 위험/경고 중인 지형의 취약 개체 id Set
  this._atRiskIds = new Set();
```

교체:
```js
  // 취약 개체 id → 현재 단계 ('warning'|'active')
  this._atRiskPhaseMap = new Map();
  // 활성 글로우 추적: id → { glow: Phaser.FX.Glow, phase: string }
  this._dangerGlows = new Map();
```

- [ ] **Step 2: updateTerrainDanger clear 교체**

현재 (line ~3418):
```js
    this._atRiskIds.clear();
```

교체:
```js
    this._atRiskPhaseMap.clear();
```

- [ ] **Step 3: updateTerrainDanger at-risk 수집 교체**

현재 (line ~3454):
```js
            if (d.event.predicate(ind)) this._atRiskIds.add(ind.id);
```

교체:
```js
            if (d.event.predicate(ind)) this._atRiskPhaseMap.set(ind.id, d.phase);
```

- [ ] **Step 4: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "refactor: atRiskIds→atRiskPhaseMap, dangerMarkers→dangerGlows 구조 교체"
```

---

### Task 2: _drawDangerOverlay — fillRect 제거

**Files:**
- Modify: `index.html` (lines ~3464-3518)

- [ ] **Step 1: fillRect 블록 제거 후 아이콘만 유지**

현재 `_drawDangerOverlay()` 전체를 아래로 교체:

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

      // 이벤트 아이콘: 타일 중심 근처 1개
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
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: 타일 색 오버레이 제거, 아이콘만 유지"
```

---

### Task 3: _syncDangerMarkers — preFX 글로우로 교체

**Files:**
- Modify: `index.html` (lines ~3519-3547)

- [ ] **Step 1: _syncDangerMarkers 전체 교체**

현재 `_syncDangerMarkers()` 전체를 아래로 교체:

```js
  _syncDangerMarkers() {
    // 1. 더 이상 취약하지 않은 슬라임 글로우 제거
    for (const [id, entry] of this._dangerGlows.entries()) {
      if (!this._atRiskPhaseMap.has(id)) {
        const sprEntry = this.individualSprites.get(id);
        if (sprEntry?.sprite?.preFX) sprEntry.sprite.preFX.remove(entry.glow);
        this._dangerGlows.delete(id);
      }
    }

    // 2. 취약 슬라임 글로우 추가/단계 변경
    for (const [id, phase] of this._atRiskPhaseMap) {
      const sprEntry = this.individualSprites.get(id);
      if (!sprEntry?.sprite?.preFX) continue;

      const existing = this._dangerGlows.get(id);

      if (existing && existing.phase !== phase) {
        // 단계 전환: 기존 글로우 제거 후 재생성
        sprEntry.sprite.preFX.remove(existing.glow);
        this._dangerGlows.delete(id);
      }

      if (!this._dangerGlows.has(id)) {
        const color = phase === 'active' ? 0xff3333 : 0xffcc00;
        const strength = phase === 'active' ? 6 : 4;
        const glow = sprEntry.sprite.preFX.addGlow(color, strength, 0, false);
        this._dangerGlows.set(id, { glow, phase });
      }
    }
  }
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: ⚠️ 텍스트 마커 → preFX 글로우 외곽선 교체"
```

---

### Task 4: _clearAllDangerVisuals — 글로우 정리

**Files:**
- Modify: `index.html` (lines ~3616-3629)

- [ ] **Step 1: _clearAllDangerVisuals 교체**

현재:
```js
  _clearAllDangerVisuals() {
    if (this._dangerGfx) {
      this._dangerGfx.clear();
    }
    if (this._dangerIcons) {
      for (const txt of this._dangerIcons) txt.destroy();
      this._dangerIcons = [];
    }
    if (this._dangerMarkers) {
      for (const txt of this._dangerMarkers.values()) txt.destroy();
      this._dangerMarkers.clear();
    }
    this._atRiskIds?.clear();
  }
```

교체:
```js
  _clearAllDangerVisuals() {
    if (this._dangerGfx) {
      this._dangerGfx.clear();
    }
    if (this._dangerIcons) {
      for (const txt of this._dangerIcons) txt.destroy();
      this._dangerIcons = [];
    }
    if (this._dangerGlows) {
      for (const [id, entry] of this._dangerGlows) {
        const sprEntry = this.individualSprites.get(id);
        if (sprEntry?.sprite?.preFX) sprEntry.sprite.preFX.remove(entry.glow);
      }
      this._dangerGlows.clear();
    }
    this._atRiskPhaseMap?.clear();
  }
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: 게임 종료 시 글로우 정리"
```
