# 슬라임 글로우 위험 표시 — 설계 문서

작성일: 2026-06-24
대상: `gene-pool-arena-mobile/index.html`

## 1. 목적

기존 타일 색 오버레이(주황/빨강 fill) 를 제거하고, 취약 슬라임의 스프라이트 외곽선 글로우로 위험을 표현한다. Phaser 3.60 `preFX.addGlow()` 를 사용해 스프라이트 실제 윤곽을 따라 글로우가 적용된다.

## 2. 시각 변화

| 단계 | 기존 | 변경 후 |
|------|------|---------|
| 경고 (warning) | 타일 주황 펄스 fill + ⚠️ 텍스트 | 취약 슬라임 노랑 글로우 (0xffcc00) |
| 위험 (active) | 타일 빨강 fill + ⚠️ 텍스트 | 취약 슬라임 빨강 글로우 (0xff3333) |
| 타일 아이콘 | 지형 이모지 Phaser Text | 유지 (제거하지 않음) |
| 타일 fill | fillRect 색채우기 | 제거 |

## 3. 글로우 스펙

```
경고 (warning): color=0xffcc00, outerStrength=4, innerStrength=0, knockout=false
위험 (active):  color=0xff3333, outerStrength=6, innerStrength=0, knockout=false
```

- `preFX.addGlow(color, outerStrength, innerStrength, knockout)` — Phaser 3.60 WebGL FX
- 단계 전환(warning→active) 시 glow 제거 후 재생성 (색상 변경)
- 슬라임이 죽거나 위험 단계 종료 시 glow 제거

## 4. 데이터 구조 변경

### 제거
- `this._dangerMarkers: Map<id, Phaser.Text>` → 삭제
- `this._atRiskIds: Set<id>` → 삭제

### 추가
- `this._atRiskPhaseMap: Map<id, 'warning'|'active'>` — 취약 개체 id + 현재 단계
- `this._dangerGlows: Map<id, {glow: Phaser.FX.Glow, phase: string}>` — 활성 글로우 추적

## 5. 수정 위치

### initTerrainDanger() (line ~3411-3413)
```js
// 제거:
this._dangerMarkers = new Map();
this._atRiskIds = new Set();
// 추가:
this._atRiskPhaseMap = new Map();
this._dangerGlows = new Map();
```

### updateTerrainDanger(dt) (line ~3418, 3454)
```js
// 제거: this._atRiskIds.clear();
// 추가: this._atRiskPhaseMap.clear();

// 제거: if (d.event.predicate(ind)) this._atRiskIds.add(ind.id);
// 추가: if (d.event.predicate(ind)) this._atRiskPhaseMap.set(ind.id, d.phase);
```

### _drawDangerOverlay() — 타일 fill 제거
- `g.fillStyle(...)` + `g.fillRect(...)` 블록 제거
- `_dangerIcons` (t.ico 텍스트) 는 유지

### _syncDangerMarkers() — 글로우로 교체
```js
_syncDangerMarkers() {
  // 1. 더 이상 취약하지 않은 슬라임 글로우 제거
  for (const [id, entry] of this._dangerGlows.entries()) {
    if (!this._atRiskPhaseMap.has(id)) {
      const sprEntry = this.individualSprites.get(id);
      if (sprEntry) sprEntry.sprite.preFX.remove(entry.glow);
      this._dangerGlows.delete(id);
    }
  }

  // 2. 취약 슬라임 글로우 추가/갱신
  for (const [id, phase] of this._atRiskPhaseMap) {
    const sprEntry = this.individualSprites.get(id);
    if (!sprEntry) continue;

    const existing = this._dangerGlows.get(id);

    if (existing && existing.phase !== phase) {
      // 단계 변경: 기존 글로우 제거 후 재생성
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

### _clearAllDangerVisuals()
- `_dangerMarkers` 관련 코드 제거
- 모든 `_dangerGlows` 제거:
```js
if (this._dangerGlows) {
  for (const [id, entry] of this._dangerGlows) {
    const sprEntry = this.individualSprites.get(id);
    if (sprEntry) sprEntry.sprite.preFX.remove(entry.glow);
  }
  this._dangerGlows.clear();
}
this._atRiskPhaseMap?.clear();
```

## 6. 범위 밖

- 식량 이벤트 슬라임 글로우 없음 (predicate 없는 이벤트는 `_atRiskPhaseMap`에 추가 안 됨 — 기존 동작 유지)
- 타일 경계선 strokeRect 없음 (사용자가 오버레이 전체 제거 요청)
- AI 집단 글로우 없음 (플레이어 집단에만 해당 지형 이벤트 시 플레이어 집단이 영향받는 경우만)

## 7. 주의

`preFX` 는 Phaser 3.60 WebGL 렌더러 전용. Canvas 폴백 없음. 해당 게임은 Phaser 3.60 WebGL로 동작하므로 문제없음.
