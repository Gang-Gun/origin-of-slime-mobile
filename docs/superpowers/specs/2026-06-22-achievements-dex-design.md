# 도전과제 도감 탭 — 설계 문서

작성일: 2026-06-22
대상: `gene-pool-arena-mobile/index.html`

## 1. 목적

기존 Dex 모달(돌연변이/이벤트 탭)에 **🏆 도전과제** 탭을 추가한다.
- 초기에는 모든 도전과제가 **잠금(힌트 모드)**: 이름·설명 가림, 카테고리·보너스만 표시.
- 게임 중 달성하면 그 즉시 **영구 해금**: 세션이 끊겨도 `localStorage`에 유지.
- 달성한 도전과제는 결과 화면에서도 확인할 수 있다(기존 동작 유지).

## 2. 현재 구조 (기준점)

- `ACHIEVEMENTS`: 29개 항목. 필드 `{ id, name, desc, bonus, check }`.
  - 그룹: 생존(4) / 집단 크기(4) / 세대(2) / 전투(4) / 포섭(2) / 식량(3) / 유전자(8) / 지형(2).
- `this.achievements`: 현재 세션 달성 Set (index.html 내 ArenaScene).
- `checkAchievements()`: 매 틱 달성 여부 확인 → `this.achievements.add(id)` → toast 표시.
- `localStorage` 키 접두사: `gpa_`.
- Dex 모달 탭 패턴: `.dex-tab[data-tab=X]` 버튼 + 패널 div, `switchDexTab(tab, btn)` 분기.

## 3. 데이터 변경

### 3.1 ACHIEVEMENTS에 `cat` 필드 추가

카테고리 한국어 라벨 (잠금 힌트 표시용):

| id 그룹 | cat 값 |
|---|---|
| rookie / survivor / veteran / last_stand | `'생존'` |
| colony / empire / near_death / comeback | `'집단'` |
| gen5 / gen15 | `'세대'` |
| first_blood / warlord / pacifist / escapist | `'전투'` |
| charmer / diplomat | `'포섭'` |
| rich / feast / no_starve | `'식량'` |
| red_wave / blue_wave / speed_evo / poison_evo / charm_evo / dominant_all / diverse / mutant6 / mutant10 / pure_blood | `'유전자'` |
| volcano_win / explorer | `'지형'` |

### 3.2 영구 해금 저장소

```
localStorage key: 'gpa_ach_unlocked'
value: JSON 문자열 — 해금된 id 배열 (예: '["rookie","colony"]')
```

헬퍼 함수(전역):
- `loadUnlockedAch()` → `Set<string>`: localStorage 파싱, 실패 시 빈 Set.
- `markAchUnlocked(id)`: id를 Set에 추가 → 배열로 직렬화 → localStorage 저장.

### 3.3 checkAchievements 후크

`this.achievements.add(id)` 직후 `markAchUnlocked(id)` 호출. 이것으로 달성 즉시 영구 저장.

## 4. DOM 변경

### 4.1 탭 버튼 추가

기존:
```html
<button class="dex-tab active" data-tab="mutation" ...>🔬 돌연변이</button>
<button class="dex-tab" data-tab="event" ...>🌍 이벤트</button>
```

추가:
```html
<button class="dex-tab" data-tab="achieve" onclick="switchDexTab('achieve',this)">🏆 도전과제</button>
```

### 4.2 패널 div 추가

`#dex-event-panel` 아래에:
```html
<div id="dex-achieve-panel" style="display:none">
  <div id="dex-achieve-header"></div>
  <div id="dex-achieve-list"></div>
</div>
```

## 5. 렌더 로직 `renderAchieveDex()`

```
unlocked = loadUnlockedAch()
전체/달성/미달성 필터(_achFilter 전역 변수, 기본 'all')
진행도: unlocked.size / ACHIEVEMENTS.length
```

### 5.1 카드 형태

**해금 카드** (`unlocked.has(ach.id)` === true):
```
🏆 이름
설명
+보너스점  ✅
```
스타일: 밝게(불투명), `--leaf` 계열 테두리.

**잠금 카드** (미해금):
```
🔒 [카테고리]
???
+보너스점
```
스타일: 흐리게(opacity 0.55), 회색 테두리, 이름·설명 가림.

### 5.2 필터

`#ach-filters` 필터 버튼 3개: 전체 / ✅ 달성 / 🔒 미달성.
`_achFilter` 전역 변수로 관리. `setAchFilter(filter, btn)` 함수.

## 6. switchDexTab 확장

기존 `if (tab === 'event') … else …` 구조를:

```
if (tab === 'achieve') → achieve 패널만 표시, renderAchieveDex()
else if (tab === 'event') → event 패널만 표시, renderEventDex()
else → mutation 패널만 표시, renderDex()
```

패널 3개의 `style.display` / `style.cssText`를 각 분기에서 명시 처리.

## 7. CSS

기존 `.dex-card`, `.dex-filter`, `.dex-tab` CSS 재사용.

추가 CSS:
```css
#dex-achieve-header { padding:10px 14px 0; font-size:13px; color:var(--ink-soft); }
#dex-achieve-list { flex:1; overflow-y:auto; padding:0 10px 14px; display:flex; flex-direction:column; gap:8px; }
.ach-card { border-radius:12px; padding:10px 12px; border:1.5px solid; }
.ach-card.unlocked { border-color:var(--leaf-dk); background:rgba(110,196,106,.12); }
.ach-card.locked { border-color:#ccc; background:rgba(200,200,200,.12); opacity:0.7; }
.ach-card .ach-title { font-weight:800; font-size:14px; }
.ach-card .ach-desc { font-size:12px; color:var(--ink-soft); margin-top:2px; }
.ach-card .ach-bonus { font-size:12px; color:var(--honey-dk); font-weight:800; margin-top:4px; }
```

## 8. 테스트 (smoke-ach.mjs)

node 스크립트:
1. ACHIEVEMENTS 모든 항목에 `cat` 필드 존재 확인
2. `loadUnlockedAch()` — 빈 localStorage 시 빈 Set 반환
3. `markAchUnlocked` 왕복: 저장 후 `loadUnlockedAch()` 재호출 → id 포함 확인
4. `renderAchieveDex`는 브라우저 DOM 의존 → node 테스트 대상 아님(브라우저 확인)

## 9. 범위 밖 (YAGNI)

- 도전과제 달성 시 도감 탭 배지 표시 (탭 버튼에 미확인 뱃지)
- 달성 날짜·시각 기록
- 도전과제 공유 기능
