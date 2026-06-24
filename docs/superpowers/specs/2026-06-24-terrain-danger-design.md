# 지형 위험 시스템 재설계 — 설계 문서

작성일: 2026-06-24  
대상: `gene-pool-arena-mobile/index.html`

## 1. 목적

기존 `terrainEventTick()` (10초 단일 틱, 텍스트 메시지) 방식을 **지형별 독립 위험 사이클**로 교체한다.  
핵심 문제:
- 갑작스러운 도태 → 플레이어가 이유를 납득 못 함
- 텍스트 메시지 스팸 → 읽기 전에 사라짐

## 2. 구조 — 지형별 독립 타이머

기존 전역 `TERRAIN_EVENT_INTERVAL` 틱을 폐기하고, 각 지형 타일 영역이 자체 `dangerTimer`를 보유한다.

```
[쿨타임 15~25초 랜덤] → 경고(5초) → 위험(8초) → 도태 → [다음 쿨타임]
```

- 총 사이클: 28~38초 (쿨타임 포함)
- 쿨타임이 지형마다 다르게 초기화되어 동시 다발 자연스럽게 분산
- 이벤트 종류: 사이클 시작 시 해당 지형 풀에서 랜덤 1개 선택 (기존 `TERRAIN_EVENTS` 재사용)

## 3. 단계별 동작

### 3.1 경고 단계 (5초)

- 해당 지형 타일에 **주황 펄스 오버레이** (Phaser Graphics로 타일 영역 위에 반투명 주황 사각형, alpha 0.0→0.4 왕복)
- 타일 위에 **이벤트 이모지 크게** 떠오름 (예: 🌋, ❄️, ☠️) — Phaser `add.text`로 월드좌표
- 해당 지형에 있는 플레이어 집단의 **취약 개체에 ⚠️ 마커** (개체 스프라이트 위 small text)
- `navigator.vibrate(40)` 약한 진동
- 텍스트 메시지: **없음**

`predicate` 없는 식량 이벤트(foodDelta/foodRatio)는 경고 단계만 수행 후 바로 식량 변화 적용 (도태 단계 없음). 타일 오버레이 색을 **초록(foodDelta>0) 또는 노랑(foodRatio)** 으로 구분.

### 3.2 위험 단계 (8초)

- 타일 오버레이 **빨간색**으로 전환 (alpha 0.5 고정)
- ⚠️ 마커 유지 + 취약 개체 미약한 흔들림 (Phaser tweens로 x ±2px 반복)
- 8초 후 도태 실행

### 3.3 도태

- 기존 `killRate` 비율 도태 로직 유지 (`applyTerrainEvent` 내부 사망 계산 재사용)
- 죽은 개체 위치에 기존 `burst()` 파티클
- **이모지 토스트**: `🌋 ×3 💀` 형식 (지형 이모지 + 사망 수). 사망 없으면 토스트 없음
- 오버레이·마커·이모지 제거
- 다음 쿨타임(15~25초 랜덤) 시작

## 4. 데이터 구조

각 지형 엔트리(`TERRAIN_LIST` 각 항목)에 런타임 상태 객체 추가:

```js
// 게임 초기화 시 각 terrain에 붙임
terrain._danger = {
  phase: 'cooldown',   // 'cooldown' | 'warning' | 'active'
  until: 0,            // 현재 단계 종료 elapsed(ms)
  event: null,         // 선택된 TERRAIN_EVENTS[id][n]
  overlay: null,       // Phaser Graphics 오버레이
  icon: null,          // Phaser Text 이모지
  markers: [],         // ⚠️ 마커 Phaser Text 배열
};
```

## 5. 구현 연결점

- **제거**: `terrainEventTick()`, `applyTerrainEvent()` 의 메시지 출력 부분, `TERRAIN_EVENT_INTERVAL` 상수, `showMessage` 호출
- **유지**: `TERRAIN_EVENTS` 데이터(이벤트 풀), `applyTerrainEvent()` 의 도태 계산 로직 (메시지만 제거)
- **추가**: `initTerrainDanger()` — 게임 시작 시 각 지형 `_danger` 초기화, 쿨타임 랜덤 분산
- **추가**: `updateTerrainDanger(dt)` — `update()` 루프에서 매 틱 호출, 단계 전이 처리
- **추가**: `showDangerToast(terrain, deathCount)` — 이모지 토스트 (기존 `showToast` 재사용)
- **추가**: `clearDangerVisuals(terrain)` — 오버레이·마커·아이콘 제거

## 6. 지형 오버레이 렌더링

Phaser Graphics 오브젝트로 타일 영역(월드좌표)을 덮는 반투명 사각형.  
지형 타일 영역은 기존 `terrainAt()` + `terrainGrid`로 좌표 범위 계산.  
월드 카메라 따라 움직이므로 `setScrollFactor(1)` 기본값 유지.

## 7. 이모지 토스트 포맷

```
도태 이벤트: "[지형.emoji] ×[N] 💀"   예: "🌋 ×3 💀"
식량 증가:   "[지형.emoji] +[N] 🍎"   예: "🌿 +55 🍎"
식량 감소:   "[지형.emoji] −[N]% 🍎"  예: "🏜️ −30% 🍎"
```

기존 `showToast(text, type)` 함수 재사용. 최대 1개 동시 표시(스택 제한).

## 8. 범위 밖 (YAGNI)

- 지형별 고정 이벤트 타입 — 랜덤 풀 유지
- 위험 지형 미니맵 표시 — 별도 기능
- 플레이어가 위험 지형에 있을 때만 경고 — 모든 지형 동일하게 처리
