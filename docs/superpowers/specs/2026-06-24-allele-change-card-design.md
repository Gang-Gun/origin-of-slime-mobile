# 유전자 빈도 변화 카드 — 설계 문서

작성일: 2026-06-24  
대상: `gene-pool-arena-mobile/index.html`

## 1. 목적

지형 이벤트(도태·식량) 직후 플레이어 집단의 대립유전자 빈도 변화를 즉시 시각적으로 피드백한다.

핵심 문제:
- 이벤트가 발생해도 유전자 풀이 어떻게 바뀌었는지 플레이어가 알기 어려움
- 결과 화면까지 기다려야만 확인 가능

## 2. 동작

`_applyDangerEvent` 실행 전후로 플레이어 집단의 `geneFrequency()`를 캡처하고, 변화한 유전자만 골라 우측 상단에 팝업 카드로 표시한다.

### 표시 조건

- 변화 임계값: |after − before| ≥ 2% 인 유전자만 표시
- 플레이어 집단(`this.player`) 기준
- 변화한 유전자가 0개면 카드 미표시

### 카드 내용

```
🌋 화산 도태 후
🔴  54% → 68%  ↑14
⚡  48% → 45%  ↓3
```

- 헤더: `terrain.ico` + `"도태 후"` 또는 `"식량 변화 후"`
- 유전자 행: 아이콘 · 이전값% · → · 이후값%(카운트업) · 델타 배지
- 델타 배지: 증가 시 빨강 `↑N`, 감소 시 회색 `↓N`

### 유전자 메타

| 키 | 아이콘 | 색 |
|----|--------|-----|
| color | 🔴 | #ef5555 |
| speed | ⚡ | #22c55e |
| poison | ☠️ | #a78bfa |
| armor | 🛡️ | #60a5fa |
| charm | 💗 | #f472b6 |

## 3. 카운트업 애니메이션

- 시작값: `before[gene]` (정수 %)
- 끝값: `after[gene]` (정수 %)
- 속도: 총 600ms 안에 완료 (requestAnimationFrame, 매 프레임 값 증감)
- 카운트업 완료 후 1500ms hold
- 0.4초 fade-out (CSS `opacity` transition) 후 DOM 제거

## 4. UI 구현

순수 HTML/CSS DOM 오버레이. Phaser 오브젝트 아님.

```
position: fixed
top: 80px
right: 12px
z-index: 9999
```

- 배경: `rgba(10,10,20,0.93)`
- 테두리: `1px solid rgba(255,255,255,0.12)`
- border-radius: 12px
- 폰트: 기존 게임 폰트 상속
- 카드 폭: max-content, min-width 180px

## 5. 구현 연결점

- **수정:** `_applyDangerEvent(terrain)` — before/after 캡처 + `showAlleleChangeCard` 호출 추가
- **추가:** `showAlleleChangeCard(terrain, before, after)` — DOM 카드 생성·애니메이션·제거
- **제거 없음:** 기존 토스트(`showToast`)와 공존, 충돌 없음

## 6. 범위 밖

- 보스 이벤트·날씨 이벤트 후에는 미표시 (지형 이벤트 한정)
- AI 집단 미표시 (플레이어만)
- 카드 클릭 인터랙션 없음
- 동시 여러 카드 스택 없음 — 이전 카드가 있으면 즉시 제거 후 새 카드 표시
