# 보스 비주얼 + 돌연변이 슬라임 외형 — 설계 문서

작성일: 2026-06-22
대상: `gene-pool-arena-mobile/index.html`

## 1. 목적

(1) 보스 10종을 게임의 절차적 픽셀아트 스타일에 맞는 **테마별 몬스터 텍스처**로 렌더(현재 이모지 텍스트 대체).
(2) 슬라임이 **보유 돌연변이에 따라 외형이 달라지게** 한다(현재 color 유전자 몸색만 반영).

기존 렌더 방식 준수: `make.graphics()` → `generateTexture()` → 캐시 → `add.image()`. 외부 에셋 없음.

## 2. 현재 구조 (기준점)

- `createCreatureTexture(bodyColor)` (index.html ~2632): 몸색 기반 16×10 픽셀 그리드 베이크, `creature_${bodyColor}` 키로 캐시.
- `getBodyColor(individual)`: color 유전자(RR/RB/BB)로 몸색 결정.
- `addIndividualSprite(individual, group)` (~2682): 텍스처 생성 후 hp 비례 스케일로 `add.image`.
- 보스: `spawnBoss()`에서 `this.add.text(sx, sy, boss.ico, {fontSize:'56px'})` — 이모지.
- 돌연변이: `MUTATIONS` 20종(good/dual/bad), `individual.mutations`(id 배열). 현재 외형 미반영.

## 3. 돌연변이 슬라임 외형

### 3.1 원칙
- **몸색 = color 유전자 그대로** (유전 교육 핵심). 돌연변이는 그 위에 픽셀 오버레이 + 약한 기조색만 추가.
- 베이크 합성: `createCreatureTexture`를 개체 기반으로 확장. 오버레이 스프라이트(개체당 다중 스프라이트)는 성능상 채택 안 함.

### 3.2 시그니처 돌연변이 → 픽셀 효과
외형이 직관적인 9종만 고유 픽셀. 나머지 stat-only는 기조색만.

| 돌연변이 id | 효과 |
|---|---|
| `large_body` | 스프라이트 스케일 ×1.35 (실루엣 큼) |
| `small_body` | 스프라이트 스케일 ×0.7 |
| `hard_shell` | 머리 위 갑각 플레이트 픽셀(회색 2~3px) |
| `bright_pattern` | 몸에 대비색 점박이 3~4px |
| `strong_jaw` | 입 자리에 큰 이빨(흰 픽셀 2개) |
| `poison_gland` | 하단 독 돌기(연녹) + 보라 거품 2px |
| `regeneration` | 몸 상단 반짝 광택 하이라이트 십자 |
| `fast_legs` | 바닥에 작은 발/다리 픽셀 2개 |
| `pheromone` / `bright_pattern`+`pheromone` | 머리 위 금색 왕관/뿔 |

> `pheromone`(지배 페로몬)만 왕관. `high_fertility` 등 나머지는 기조색만.

### 3.3 type 기조색 (개체의 우세 돌연변이 type)
개체 돌연변이를 type별로 세어 최다 type 1개를 골라 약한 오버레이(동수면 우선순위 `bad` > `dual` > `good`):
- `good`: 몸 상단에 밝은 생기 점 1~2px(연한 흰녹)
- `bad`: 칙칙화(몸색을 회색쪽으로 10% 블렌드) + 균열 픽셀 1~2개(어두운 선)
- `dual`: 보라끼 점 1px

무돌연변이 개체는 기존과 동일(기조 없음).

### 3.4 텍스처 캐시 키
```
creature_${bodyColor}_${sig}_${cat}
```
- `bodyColor`: getBodyColor 결과(16진).
- `sig`: 보유한 **시그니처 돌연변이 id**만 정렬·조인(예: `hard_shell.poison_gland`). 없으면 `none`.
- `cat`: 기조 type(`good`/`bad`/`dual`/`none`).
- `large_body`/`small_body`는 텍스처가 아니라 **스케일**에만 영향 → 키에서 제외(스케일은 `addIndividualSprite`에서 처리). 단 그리는 픽셀이 동일하므로 텍스처 공유.

조합 공간: 시그니처 7종(스케일 2종 제외) 부분집합 × 3색 × 4기조 → 상한 있으나, 실제 동시 보유 수가 적어 캐시 수는 제한적. 그래도 안전상 텍스처 캐시가 비정상 증가하지 않는지 구현 시 콘솔로 확인.

### 3.5 스케일 처리
`addIndividualSprite`의 `baseScale`에 곱: `large_body`→×1.35, `small_body`→×0.7(둘 다면 상쇄). 기존 hp 비례 스케일과 곱연산.

## 4. 보스 비주얼

### 4.1 구조 — 파츠 조립 제너레이터
`createBossTexture(bossId)` (신규): `BOSS_VISUAL[bossId]` 설정을 읽어 공유 파츠 라이브러리로 큰 픽셀 그리드를 베이크. 키 `boss_${bossId}`로 캐시.

파츠 라이브러리(함수들이 graphics에 그림): `bodyBlob(pal, shape)`, `eyes(pal, count)`, `crown(pal)`, `hornsIce(pal)`, `spikes(pal)`, `shellPlates(pal)`, `tentacles(pal)`, `lavaCracks()`, `poisonDrips()`, `prismSegments()`, `wings(pal)`, `legs(pal)`. 각 보스는 `parts` 배열로 필요한 것만 선택.

`shape`: `blob` | `bulky` | `sleek` | `armored` | `crystalline` | `draconic` | `tentacled` | `amorphous`.
보스 그리드 기본 ~20×18(S=4 → 80×72), `scale` 필드로 추가 확대.

### 4.2 BOSS_VISUAL 10종
팔레트 `{dark, mid, light, accent}`(16진), shape, parts, eyeCount.

| id | shape | dark/mid/light/accent | parts | eyes |
|---|---|---|---|---|
| `lava` | bulky | #3a2420/#6a3a2a/#8a4a36/#ff7a1a | lavaCracks, heavyBrows | 2 (붉은) |
| `sand` | armored | #7a5a32/#c2964a/#e6c483/#5a3a1a | shellPlates, spikes | 2 |
| `glacier` | crystalline | #3a6aa0/#8fc0e8/#dcf0ff/#ffffff | crown(ice), hornsIce | 2 (청) |
| `spore` | bulky | #4a2a6a/#7a4aa0/#b48ad0/#6fcf4a | poisonDrips, spikes(spore) | 4 (연녹) |
| `gale` | sleek | #2f6f7a/#4fb0c0/#9fe0e8/#dffcff | legs, motionStreaks | 2 |
| `charmer` | tentacled | #a83a7a/#e060a0/#ffb0d8/#ffd23f | tentacles, bigEyes | 2 (큰) |
| `steel` | armored | #4a5a6a/#8a9aaa/#c2d2e2/#5a6a7a | shellPlates, legs | 1 (단안) |
| `plague` | draconic | #5a1a1a/#a83a2a/#e0604a/#6fcf4a | wings, lavaCracks, poisonDrips | 2 (용) |
| `siren` | tentacled | #1a3a5a/#2f6f9a/#6fb0d8/#aef0ff | tentacles, lure(glow) | 2 (큰) |
| `primordial` | amorphous | prism(시간변색) | prismSegments, multiEyes(5+), prismAura | 5+ |

> 히든 `primordial`: 단일 팔레트 대신 무지개 세그먼트. 시간에 따라 색이 도는 연출은 보스 스프라이트에 옅은 tint 애니(`tweens.addCounter`)로 후속 처리(필수 아님).

### 4.3 연출
- 크기: 보스 스프라이트는 슬라임보다 크게(스케일 ~2.5×). HP 바·등장 shake는 기존 spawnBoss 유지.
- 보스 idle 바운스/추격 방향에 따른 좌우 반전(`setFlipX`)으로 생동감(선택).

## 5. 기존 코드 연결점

- **데이터**: `MUTATION_VISUAL`(시그니처 id→그리기 op 맵), `MUTATION_SIG_IDS`(시그니처 id 집합), `BOSS_VISUAL`(10종 설정), 파츠 그리기 함수들.
- **`createCreatureTexture(bodyColor)` → `createCreatureTexture(individual)`**: 내부에서 `getBodyColor` + 시그니처/기조 계산 → 키 생성 → 기존 그리드 그린 뒤 오버레이 op 적용. 시그니처 없고 무돌연변이면 기존과 동일 결과.
- **`addIndividualSprite`**: 텍스처 키 호출부를 개체 기반으로 변경. `baseScale`에 large/small_body 배율 곱.
- **번식/돌연변이 변화 시 텍스처 갱신**: 돌연변이는 출생 시 확정이라 개체 생성 시 1회 결정으로 충분. (런타임 중 돌연변이 추가 경로 없으면 재생성 불필요 — 구현 시 확인.)
- **`spawnBoss()`**: `this.add.text(... boss.ico ...)` → `this.add.image(sx, sy, this.createBossTexture(boss.id))`로 교체, 스케일 적용. `bossEntity.sprite` 인터페이스(setPosition/destroy) 동일하게 유지.
- **`createBossTexture(bossId)`**: 신규 메서드 + 파츠 함수들.

## 6. 범위 밖 (YAGNI)

- color 외 유전자(speed/poison/armor/charm)의 몸 외형 반영 — 이번엔 돌연변이만(유전자형 분포는 기존 몸색/통계로 충분).
- 보스 다단계 애니메이션(걷기 프레임) — 정적 텍스처 + 바운스/반전만.
- 돌연변이 1:1 전수 시각화 — 시그니처 9종 + 기조만(§3.2).

## 7. 조정 가능 숫자

large/small_body 스케일(1.35/0.7), 보스 스케일(2.5×), 시그니처 픽셀 색/위치, 기조 블렌드 비율(10%), 히든 시간변색 on/off.
