# 연구소 (Lab) Meta Progression System Design

## Overview

A persistent upgrade screen accessible from the main menu. Players spend boss-drop currencies to permanently unlock upgrades that carry over across runs. The UI is a bottom-to-top phylogenetic tree with organic bezier branches.

## Currencies

- **파편 🔷** (Fragment): Dropped by mid-bosses on defeat. Amount: 10–15 per kill. Stored in `gpa_frag` localStorage (integer).
- **정수 💠** (Essence): Dropped by final/hidden bosses on defeat. Amount: 1–2 per kill. Stored in `gpa_ess` localStorage (integer).

## Drop Logic (in `resolveBoss`)

```
if (win) {
  if (slot === 'mid') {
    drop 10 + random(0..5) fragments → add to gpa_frag
    show toast "🔷 파편 +N"
  }
  if (slot === 'final' || boss.hidden) {
    drop 1 + random(0..1) essence → add to gpa_ess
    show toast "💠 정수 +N"
  }
}
```

## Purchased Upgrades Storage

`gpa_lab_purchased`: JSON array of purchased node IDs. e.g. `["hp1","pop1","sur1"]`

## Lab Screen

### Entry Point
- New "⚗️ 연구소" button in `#title-menu` (lilac style), opens `#lab-screen` overlay
- Back button returns to title screen

### UI Structure
```
[header: ⚗️ 연구소]
[currency bar: 🔷 N | 💠 N]
[tabs: 🔷 파편 트리 | 💠 정수 트리]
[scrollable tree canvas]
[hint: ← 스와이프 →]
```

### Tree Rendering
- Canvas: absolute-positioned nodes + SVG bezier branches
- Layout: bottom-to-top, root centered at bottom
- Node states: `unlocked`(green) / `available`(color) / `locked`(gray ???)
- Locked nodes show ??? until parent purchased
- On tap available node: show confirm popup → deduct currency → mark purchased → re-render

## Upgrade Tree Data

### 파편 트리 (frag)
Root: 생명의 씨앗 (always unlocked, no effect)

| ID | Parent | Name | Cost | Effect |
|----|--------|------|------|--------|
| hp1 | root | 생명력 I | 🔷×4 | startHP ×1.10 |
| hp2 | hp1 | 생명력 II | 🔷×8 | startHP ×1.20 |
| hp3 | hp2 | 생명력 III | 🔷×14 | startHP ×1.35 |
| hp4 | hp3 | 생명력 IV | 🔷×22 | startHP ×1.55 |
| hp5 | hp4 | 생명력 V | 🔷×34 | startHP ×1.80 |
| hb1 | hp3 | 혈통 I | 🔷×26 | enemy recruit resistance +20% |
| hb2 | hb1 | 혈통 II | 🔷×42 | enemy recruit resistance +40% |
| pop1 | root | 군집 I | 🔷×3 | startCount +1 |
| pop2 | pop1 | 군집 II | 🔷×6 | startCount +2 |
| pop3 | pop2 | 군집 III | 🔷×11 | startCount +3 |
| pop4 | pop3 | 군집 IV | 🔷×19 | startCount +5 |
| pop5 | pop4 | 군집 V | 🔷×32 | startCount +7 |
| col1 | pop3 | 채집 I | 🔷×16 | gather +4 |
| col2 | col1 | 채집 II | 🔷×28 | gather +8 |
| col3 | col2 | 채집 III | 🔷×46 | gather +14 |
| br1 | root | 번식 I | 🔷×3 | breedCost ×0.95 |
| br2 | br1 | 번식 II | 🔷×7 | breedCost ×0.90 |
| br3 | br2 | 번식 III | 🔷×13 | breedCost ×0.82 |
| tw1 | br3 | 쌍둥이 I | 🔷×22 | twin chance 15% |
| tw2 | tw1 | 쌍둥이 II | 🔷×36 | twin chance 25% |
| bs1 | br3 | 번식속도 I | 🔷×20 | breedCost ×0.72 |
| bs2 | bs1 | 번식속도 II | 🔷×34 | breedCost ×0.60 |
| bt1 | root | 전투력 I | 🔷×4 | baseAttack +3 |
| bt2 | bt1 | 전투력 II | 🔷×9 | baseAttack +6 |
| bt3 | bt2 | 전투력 III | 🔷×17 | baseAttack +10 |
| bt4 | bt3 | 전투력 IV | 🔷×28 | baseAttack +16 |
| bt5 | bt4 | 전투력 V | 🔷×44 | baseAttack +24 |
| rc1 | bt1 | 포섭 I | 🔷×8 | recruitBonus +5% |
| rc2 | rc1 | 포섭 II | 🔷×16 | recruitBonus +12% |
| rc3 | rc2 | 포섭 III | 🔷×28 | recruitBonus +20% |
| rc4 | rc3 | 포섭 IV | 🔷×46 | recruitBonus +30% |

### 정수 트리 (ess)
Root: 진화의 눈 (always unlocked, no effect)

| ID | Parent | Name | Cost | Effect |
|----|--------|------|------|--------|
| sur1 | eroot | 생존 I | 💠×1 | meteor timer +20s |
| sur2 | sur1 | 생존 II | 💠×2 | meteor timer +40s |
| sur3 | sur2 | 생존 III | 💠×4 | meteor timer +65s |
| sur4 | sur3 | 생존 IV | 💠×8 | meteor timer +95s |
| sur5 | sur4 | 생존 V | 💠×14 | meteor timer +130s |
| gen1 | eroot | 유전자 I | 💠×1 | start with 1 chosen dominant gene |
| gen2 | gen1 | 유전자 II | 💠×2 | start with 2 chosen genes |
| gen3 | gen2 | 유전자 III | 💠×5 | start with 3 chosen genes |
| gen4 | gen3 | 유전자 IV | 💠×10 | boss required gene revealed +20s early |
| gp1 | gen1 | 보스 예지 | 💠×3 | boss required gene type shown on warning |
| gp2 | gp1 | 예지 II | 💠×8 | boss countdown shown 30s before warning |
| bos1 | eroot | 보스저항 I | 💠×1 | safe individuals immune to boss instant-kill |
| bos2 | bos1 | 저항 II | 💠×3 | on battle defeat, 30% captured return |
| bos3 | bos2 | 저항 III | 💠×6 | safe individual boss damage -50% |
| bos4 | bos3 | 저항 IV | 💠×11 | on boss kill all individuals +30% HP |
| bos5 | bos4 | 저항 V | 💠×20 | boss instant-kill threshold: 2 unsafe needed |
| evo1 | eroot | 선택적 진화 | 💠×1 | enables mutation selection system |
| prob1 | evo1 | 감지 I | 💠×1 | 15% chance mutation window appears |
| prob2 | prob1 | 감지 II | 💠×2 | 30% chance |
| prob3 | prob2 | 감지 III | 💠×4 | 50% chance |
| prob4 | prob3 | 감지 IV | 💠×8 | 75% chance |
| prob5 | prob4 | 감지 V | 💠×14 | 100% chance (always shows) |
| pick1 | evo1 | 선택 I | 💠×1 | window shows 1 mutation: accept/skip |
| pick2 | pick1 | 선택 II | 💠×2 | window shows 2 mutations to choose |
| pick3 | pick2 | 선택 III | 💠×5 | window shows 3 mutations to choose |
| pick4 | pick3 | 선택 IV | 💠×10 | window shows 4 mutations to choose |

## Effect Application

At game start (in `create()` or `initGame()`), read `gpa_lab_purchased` and compute `LAB_BUFFS`:

```javascript
LAB_BUFFS = {
  hpMult: 1.0,       // multiplier on individual.stats.hp at spawn
  extraPop: 0,       // added to initial population count
  gatherBonus: 0,    // added to gather stat
  breedCostMult: 1.0, // multiplier on breed food cost
  twinChance: 0,     // 0..1 probability
  attackBonus: 0,    // added to attack stat
  recruitBonus: 0,   // 0..1 additive bonus to recruit chance
  meteorBonus: 0,    // seconds added to GAME_DURATION
  chosenGenes: 0,    // number of genes player can pre-select (0 = none)
  bossEarlyReveal: false,
  bossResist: 0,     // 0=none, 1=immune, 2=half-dmg, 3=+HP on kill, 4=2-unsafe threshold
  captureReturn: 0,  // 0..1 probability captured return on defeat
  mutationChance: 0, // 0..1 probability selection window appears
  mutationChoices: 0, // 0=none, 1=accept/skip, 2=pick2, 3=pick3, 4=pick4
}
```

### Hook Points

1. **startHP**: when spawning individuals, multiply `stats.hp` by `LAB_BUFFS.hpMult`
2. **extraPop**: add to `INIT_POP` constant equivalent
3. **gatherBonus**: add to individual `stats.gather` at spawn
4. **breedCostMult**: multiply `BREED_COST` at breed time
5. **twinChance**: after successful breed, roll for twin
6. **attackBonus**: add to individual `stats.attack` at spawn
7. **recruitBonus**: add to recruit success rate calculation
8. **meteorBonus**: add to `GAME_DURATION` / timer
9. **chosenGenes**: show gene-select popup before game starts (if >0)
10. **mutationChance + mutationChoices**: when mutation event fires, roll chance; if hit, pause and show selection popup

## Mutation Selection Window

When a mutation would naturally occur:
1. Roll `Math.random() < LAB_BUFFS.mutationChance`
2. If true: pause mutation; generate N random candidates (N = mutationChoices)
3. Show popup with candidates (name, icon, description)
4. Player picks one (or skips if pick=1)
5. Apply chosen mutation; resume game

## Files to Touch

- `index.html` (single-file game): all changes here
  - CSS: `#lab-screen`, `.lab-node`, `.lab-branch-svg`, `.mutation-picker`
  - HTML: `#lab-screen` div, lab button in `#title-menu`
  - JS constants: `LAB_FRAG_TREE`, `LAB_ESS_TREE`, `LAB_NODE_MAP`
  - JS functions: `openLab()`, `closeLab()`, `renderLabTree()`, `buyLabNode()`, `computeLabBuffs()`, `applyLabBuffs()`
  - Modified: `resolveBoss()` (add drops), `create()` (apply buffs), breed logic (cost mult, twin), recruit logic (bonus), mutation logic (selection window), GAME_DURATION (meteor bonus)
