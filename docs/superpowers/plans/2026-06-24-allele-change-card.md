# 유전자 빈도 변화 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지형 이벤트 직후 플레이어 집단의 대립유전자 빈도 변화를 우측 상단 팝업 카드(카운트업 애니메이션)로 즉시 피드백한다.

**Architecture:** `_applyDangerEvent` 실행 전후로 `geneFrequency()` 를 캡처하고, 변화한 유전자가 있으면 `showAlleleChangeCard` 로 DOM 오버레이 카드를 표시한다. Phaser 오브젝트 아님 — 순수 HTML/CSS/rAF.

**Tech Stack:** Phaser 3.60 single-file game (`index.html`), vanilla JS DOM API, requestAnimationFrame

---

## Files

- **Modify:** `index.html`
  - `showAlleleChangeCard(terrain, before, after)` 추가 (line ~4962, `showToast` 바로 아래)
  - `_applyDangerEvent(terrain)` 수정 (line ~3549, before/after 캡처 + 카드 호출)

---

### Task 1: showAlleleChangeCard 함수 추가

**Files:**
- Modify: `index.html` (line 4962, `showToast` 끝난 직후)

- [ ] **Step 1: 문법 기준점 확인**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 2: showAlleleChangeCard 메서드 추가**

`showToast(text, kind = 'ach') { ... }` 블록이 끝나는 `}` 바로 아래 (line ~4962)에 추가:

```js
showAlleleChangeCard(terrain, before, after) {
  // 기존 카드 즉시 제거
  document.getElementById('allele-change-card')?.remove();

  const GENE_META = {
    color:  { ico: '🔴', col: '#ef5555' },
    speed:  { ico: '⚡', col: '#22c55e' },
    poison: { ico: '☠️', col: '#a78bfa' },
    armor:  { ico: '🛡️', col: '#60a5fa' },
    charm:  { ico: '💗', col: '#f472b6' },
  };

  const changed = Object.keys(GENE_META).filter(
    k => Math.abs((after[k] || 0) - (before[k] || 0)) >= 2
  );
  if (!changed.length) return;

  const isPredicate = !!terrain._danger?.event?.predicate;
  const label = isPredicate ? '도태 후' : '식량 변화 후';

  const card = document.createElement('div');
  card.id = 'allele-change-card';
  card.style.cssText = [
    'position:fixed', 'top:80px', 'right:12px', 'z-index:9999',
    'background:rgba(10,10,20,0.93)', 'border:1px solid rgba(255,255,255,0.12)',
    'border-radius:12px', 'padding:12px 16px', 'min-width:180px',
    'font-family:inherit', 'pointer-events:none', 'transition:opacity 0.4s',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText = 'font-size:11px;color:#888;margin-bottom:8px;letter-spacing:0.5px;';
  header.textContent = `${terrain.ico} ${label}`;
  card.appendChild(header);

  const targets = [];
  for (const key of changed) {
    const meta = GENE_META[key];
    const b = Math.round(before[key] || 0);
    const a = Math.round(after[key] || 0);
    const delta = a - b;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:13px;';

    const ico = document.createElement('span');
    ico.textContent = meta.ico;

    const beforeVal = document.createElement('span');
    beforeVal.style.color = '#888';
    beforeVal.textContent = `${b}%`;

    const arrow = document.createElement('span');
    arrow.style.cssText = 'color:#555;font-size:11px;';
    arrow.textContent = '→';

    const afterVal = document.createElement('span');
    afterVal.style.cssText = `font-weight:bold;color:${delta > 0 ? meta.col : '#aaa'};`;
    afterVal.textContent = `${b}%`;

    const badge = document.createElement('span');
    badge.style.cssText = `background:rgba(128,128,128,0.15);color:${delta > 0 ? meta.col : '#888'};border-radius:4px;padding:0 5px;font-size:11px;`;
    badge.textContent = delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`;

    row.appendChild(ico); row.appendChild(beforeVal);
    row.appendChild(arrow); row.appendChild(afterVal); row.appendChild(badge);
    card.appendChild(row);
    targets.push({ el: afterVal, from: b, to: a });
  }

  document.body.appendChild(card);

  const duration = 600;
  const startTime = performance.now();
  function tick(now) {
    const p = Math.min((now - startTime) / duration, 1);
    for (const { el, from, to } of targets) {
      el.textContent = `${Math.round(from + (to - from) * p)}%`;
    }
    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(() => {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 400);
      }, 1500);
    }
  }
  requestAnimationFrame(tick);
}
```

- [ ] **Step 3: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 유전자 빈도 변화 카드 컴포넌트 추가"
```

---

### Task 2: _applyDangerEvent에 before/after 캡처 + 카드 호출 연결

**Files:**
- Modify: `index.html` (line ~3549, `_applyDangerEvent` 메서드)

- [ ] **Step 1: _applyDangerEvent 수정**

현재 코드 (line 3549):
```js
_applyDangerEvent(terrain) {
  const event = terrain._danger.event;
  if (!event) return;

  const t = terrain;
  this.terrainEventCount[t.id] = (this.terrainEventCount[t.id] || 0) + 1;

  let playerDeaths = 0;
```

아래로 교체:
```js
_applyDangerEvent(terrain) {
  const event = terrain._danger.event;
  if (!event) return;

  const t = terrain;
  this.terrainEventCount[t.id] = (this.terrainEventCount[t.id] || 0) + 1;

  const freqBefore = this.player.individuals.length ? this.player.geneFrequency() : null;

  let playerDeaths = 0;
```

그리고 메서드 마지막 `this.recordAlleleSnapshot();` 줄 아래에 추가:
```js
    if (freqBefore && this.player.individuals.length) {
      this.showAlleleChangeCard(t, freqBefore, this.player.geneFrequency());
    }
```

최종 메서드 끝부분:
```js
    // 도태 토스트 (플레이어 집단이 해당 지형에 있었고 사망 발생 시)
    if (event.predicate && playerDeaths > 0 && this.showToast) {
      this.showToast(`${t.ico} ×${playerDeaths} 💀`, 'ach');
    }

    this.recordAlleleSnapshot();

    if (freqBefore && this.player.individuals.length) {
      this.showAlleleChangeCard(t, freqBefore, this.player.geneFrequency());
    }
  }
```

- [ ] **Step 2: 문법 검증**

```bash
node test/check-syntax.mjs
```
Expected: `syntax ok — 1 inline script(s) checked`

- [ ] **Step 3: 브라우저 동작 확인**

게임을 브라우저에서 열고 콘솔에서:
```js
window._arenaScene._forceDanger('volcano')
```
5초 후 경고 → 8초 후 도태 실행 → 우측 상단에 카드 등장, 숫자가 카운트업되는지 확인.

변화가 없는 경우(플레이어가 화산 지형 없음) 카드 미표시 확인.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: 지형 이벤트 후 유전자 빈도 변화 카드 표시"
```
