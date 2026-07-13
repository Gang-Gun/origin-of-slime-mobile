'use strict';
// ════════════════════════════════════════════
//  오디오 매니저 — WebAudio 합성 효과음 + 앰비언트
// ════════════════════════════════════════════
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.lastSfx = {};
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = parseInt(Save.get('gpa_sfx_vol') ?? '50') / 100 * 0.7;
      this.masterGain.connect(this.ctx.destination);
      this.startAmbient();
    } catch (e) { this.ctx = null; }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // 톤 생성 헬퍼
  tone(freq, dur, type = 'sine', vol = 0.3, sweep = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(t); osc.stop(t + dur);
  }
  // 노이즈 (충돌/폭발)
  noise(dur, vol = 0.3, filterFreq = 1000) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(filter); filter.connect(g); g.connect(this.masterGain);
    src.start(t);
  }
  // 쓰로틀 (동일 효과음 연타 방지)
  throttle(key, ms = 60) {
    const now = performance.now();
    if (this.lastSfx[key] && now - this.lastSfx[key] < ms) return false;
    this.lastSfx[key] = now; return true;
  }

  sfxCollect() { if (this.throttle('collect', 50)) this.tone(660 + Math.random()*120, 0.12, 'triangle', 0.22, 200); }
  sfxBreed()   { this.tone(523, 0.1, 'sine', 0.3); setTimeout(()=>this.tone(784, 0.14, 'sine', 0.3), 80); }
  sfxHit()     { if (this.throttle('hit', 40)) this.noise(0.08, 0.18, 1800); }
  sfxRecruit() { this.tone(880, 0.1, 'sine', 0.28); setTimeout(()=>this.tone(1175, 0.16, 'sine', 0.28), 90); }
  sfxWin()     { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>this.tone(f,0.18,'triangle',0.3),i*110)); }
  sfxLose()    { [392,330,262].forEach((f,i)=>setTimeout(()=>this.tone(f,0.22,'sawtooth',0.22),i*130)); }
  sfxDeath()   { if (this.throttle('death', 80)) this.tone(200, 0.2, 'sawtooth', 0.18, -120); }
  sfxBattle()  { this.tone(330, 0.15, 'square', 0.2); setTimeout(()=>this.tone(247, 0.25, 'square', 0.2), 120); }
  sfxAchieve() { [659,784,988,1319].forEach((f,i)=>setTimeout(()=>this.tone(f,0.16,'sine',0.32),i*90)); }
  sfxThunder() { this.noise(0.6, 0.4, 600); }
  sfxQuake()   { this.tone(60, 1.8, 'sawtooth', 0.35, 20); this.noise(1.8, 0.25, 300); }
  sfxMeteor()  { this.tone(800, 1.0, 'sawtooth', 0.3, -700); }
  sfxImpact()  { this.noise(1.5, 0.5, 400); this.tone(50, 1.2, 'sine', 0.4); }

  // 부드러운 앰비언트 패드 (낮은 볼륨 지속음)
  startAmbient() {
    if (!this.ctx) return;
    const makePad = (freq, vol) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      g.gain.value = vol;
      lfo.frequency.value = 0.1; lfoGain.gain.value = vol * 0.5;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      osc.connect(g); g.connect(this.masterGain);
      osc.start(); lfo.start();
    };
    makePad(130.81, 0.04); // C3
    makePad(196.00, 0.03); // G3
  }

  startBgm() {
    if (this._bgm || this._synthBgmActive) return;
    const audio = new window.Audio('assets/bgm.mp3');
    audio.loop = true;
    audio.volume = parseInt(Save.get('gpa_bgm_vol') ?? '45') / 100;
    audio.muted = this.muted;
    if (Save.get('gpa_bgm_off') !== '1') {
      audio.play().then(() => { this._bgm = audio; }).catch(() => this._startSynthBgm());
    } else {
      this._bgm = audio; // 저장만
    }
  }

  // Web Audio 합성 BGM: 자연/생태 테마 펜타토닉 멜로디 루프
  _startSynthBgm() {
    if (!this.ctx || this._synthBgmActive || Save.get('gpa_bgm_off') === '1') return;
    this._synthBgmActive = true;
    const vol = parseInt(Save.get('gpa_bgm_vol') ?? '45') / 100 * 0.5;

    // 펜타토닉 음계 C장조: C4 D4 E4 G4 A4 C5 D5 E5
    const NOTES = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    // 멜로디 패턴 (인덱스)
    const MELODY = [0,2,4,2,5,3,4,2, 1,3,5,3,6,4,5,3, 0,4,2,4,3,1,2,0];
    const BPM = 90, BEAT = 60 / BPM;
    let step = 0;

    const bgmGain = this.ctx.createGain();
    bgmGain.gain.value = this.muted ? 0 : vol;
    bgmGain.connect(this.ctx.destination);
    this._synthBgmGain = bgmGain;

    // 베이스 패드 (지속 화음)
    const bassPad = (freq, v) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq / 2;
      g.gain.value = v; o.connect(g); g.connect(bgmGain); o.start();
      return o;
    };
    this._synthOscs = [bassPad(261.63, 0.08), bassPad(392.00, 0.05), bassPad(523.25, 0.04)];

    // 멜로디 스케줄러
    const scheduleMelody = () => {
      if (!this._synthBgmActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = NOTES[MELODY[step % MELODY.length]];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(vol * 0.4, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + BEAT * 0.85);
      o.connect(g); g.connect(bgmGain);
      o.start(now); o.stop(now + BEAT);
      step++;
      this._synthBgmTimer = setTimeout(scheduleMelody, BEAT * 900);
    };
    scheduleMelody();
  }

  _stopSynthBgm() {
    this._synthBgmActive = false;
    if (this._synthBgmTimer) clearTimeout(this._synthBgmTimer);
    if (this._synthBgmGain) { try { this._synthBgmGain.gain.value = 0; } catch(e){} }
    if (this._synthOscs) { for (const o of this._synthOscs) { try { o.stop(); } catch(e){} } }
    this._synthOscs = null; this._synthBgmGain = null;
  }
  stopBgm() {
    if (this._bgm) { this._bgm.pause(); this._bgm.currentTime = 0; this._bgm = null; }
    this._stopSynthBgm();
  }
  pauseBgm() {
    if (this._bgm) this._bgm.pause();
    if (this._synthBgmGain) { try { this._synthBgmGain.gain.value = 0; } catch(e){} }
  }
  resumeBgm() {
    if (Save.get('gpa_bgm_off') === '1') return;
    if (this._bgm) this._bgm.play().catch(() => {});
    if (this._synthBgmGain && !this.muted) {
      const vol = parseInt(Save.get('gpa_bgm_vol') ?? '45') / 100 * 0.5;
      try { this._synthBgmGain.gain.value = vol; } catch(e){}
    }
    if (!this._bgm && !this._synthBgmActive) this._startSynthBgm();
  }
  setMuted(m) {
    this.muted = m;
    if (this.masterGain) {
      const sfxVol = parseInt(Save.get('gpa_sfx_vol') ?? '50') / 100 * 0.7;
      this.masterGain.gain.value = m ? 0 : sfxVol;
    }
    if (this._bgm) this._bgm.muted = m;
  }
}
const Audio = new AudioManager();

class ArenaScene extends Phaser.Scene {
  constructor() {
    super('ArenaScene');
  }

  create() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setZoom(0.45);
    this.terrainGrid = this.generateTerrain();
    this.drawTerrain();
    this.foodSprites = [];
    this.foods = [];
    this.individualSprites = new Map();
    this.shadowGraphics = this.add.graphics().setDepth(2); // 슬라임 바닥 그림자
    this.hpGraphics = this.add.graphics().setDepth(5);
    computeLabBuffs();
    this.player = new Group(WORLD_W / 2, WORLD_H / 2, true, '나의 집단');
    // 강이 중앙을 관통하므로 시작 지점이 강물이면 강가(초원)로 밀어냄
    if (this.terrainAt(this.player.x, this.player.y).id === 'river') {
      for (let off = TILE; off < WORLD_W / 2; off += TILE) {
        const lx = clamp(this.player.x - off, 60, WORLD_W - 60);
        if (this.terrainAt(lx, this.player.y).id !== 'river') { this.player.x = lx; break; }
        const rxp = clamp(this.player.x + off, 60, WORLD_W - 60);
        if (this.terrainAt(rxp, this.player.y).id !== 'river') { this.player.x = rxp; break; }
      }
    }
    const _diff = getDiffConfig();
    const _startPop = Math.max(5, START_INDIVIDUALS + (LAB_BUFFS ? LAB_BUFFS.extraPop : 0) + _diff.startPop);
    this.initGroup(this.player, _startPop);
    this.aiGroups = [];
    const _aiPoints = [[380,380],[4620,380],[380,4620],[4620,4620],[2500,280],[2500,4720],[800,2500],[4200,2500]];
    const _aiCount  = Math.min(_aiPoints.length, 8 + _diff.extraEnemies);
    for (let index = 0; index < _aiCount; index++) {
      const point = _aiPoints[index % _aiPoints.length];
      const ai = new Group(point[0] + (index >= 8 ? (Math.random()-0.5)*800 : 0),
                           point[1] + (index >= 8 ? (Math.random()-0.5)*800 : 0), false, `AI-${index + 1}`);
      this.initGroup(ai, 10 + Math.floor(Math.random() * 8));
      this.aiGroups.push(ai);
    }
    this.groups = [this.player, ...this.aiGroups];
    this.cameraTarget = this.add.rectangle(this.player.x, this.player.y, 1, 1, 0, 0);
    this.cameras.main.startFollow(this.cameraTarget, true, 0.08, 0.08);
    this.groupLayer = this.add.container(0, 0).setDepth(3);
    this.rebuildIndividualSprites();
    for (let i = 0; i < 200; i += 1) this.spawnFood();
    this.battles = [];
    // 실시간 전투 상태: 스킬 쿨다운·버프·시전 위력(돌연변이 보유 비율)·콤보
    this.combat = { cdUntil: {}, activeUntil: {}, power: {}, combo: 0, comboUntil: 0, bestCombo: 0 };
    this.elapsed = 0;
    this.lastFoodAt = Date.now();
    this.lastSurvivalAt = Date.now();
    this.lastBattleCheckAt = Date.now();
    this.lastAiSpawnAt = Date.now();
    this.gameOver = false;
    window._arenaScene = this; // 순위표 버튼에서 endScoreData 접근용
    this.initialMutationFrequency = { ...this.player.mutationFrequency() };
    // 도전과제 추적
    this.achievements = new Set();
    // 게임 중 획득한 돌연변이 추적
    this.gainedMutationsThisGame = new Set();
    // 첫 돌연변이 보장: 3번 번식해도 못 얻으면 4번째 확정
    this._breedsWithoutMutation = 0;
    // 이번 런 최대 개체수 추적 (패인 분석용)
    this._peakPopulation = 0;
    // 지형별 이벤트 발생 횟수 추적
    this.terrainEventCount = {};
    // 특수 이벤트 타이머
    this._specialEventNextAt = 90000 + Math.random() * 60000; // 90~150초 사이 첫 발생
    this._specialEventMutStormUntil = 0; // 돌연변이 폭풍 만료 시각
    this._specialEventLevel = (LAB_BUFFS && LAB_BUFFS.specialEvents) || 0;
    // 황금 슬라임 등장 조건 추적 (BB/RR + 유전자 3종 100% 달성)
    this._genesMaxedEver = new Set();
    this._goldenConditionMet = false;
    // 진화 게이지 (먹기·전투 → EXP → 레벨업 → 집단 진화 선택)
    this.evoLevel = 1;
    this.evoExp = 0;
    this._evoPickerQueued = false;
    // 보스 위협 상태
    this._waveIdx = 0;
    this._nextBossAt = WAVE_FIRST_AT;
    this._waveFired = false;
    this._waveList = this._rollWaveList();
    this.initTerrainDanger();
    this.tutorialActive = false; // 튜토리얼 진행 중 — 사망 시스템 일시 정지
    this.bossPhase = 'idle';   // idle | warning | chase
    this.bossInCombat = false; // 보스가 실제 교전 사거리 안에 있는지 (도망/번식 버튼 토글용)
    this._bossPools = [];      // 보스 독 웅덩이 잔류 지대
    this._bossSlowUntil = 0;   // 빙결 노바 이동 감속 만료 시각
    this.activeBoss = null;    // 현재 보스 정의
    this.bossEntity = null;    // { x, y, hp, hpMax, sprite, speed }
    this.bossSlot = null;      // 'mid' | 'final'
    this.bossPhaseUntil = 0;   // 현재 단계 종료 시각(elapsed 기준)
    // 대립유전자 빈도 시계열 + 이벤트 로그 (결과 그래프용)
    this.alleleHistory = [];
    this.eventLog = [];
    this.lastAlleleSnapAt = 0;
    this.recordAlleleSnapshot();
    this.achieveData = {
      evoLevel: 1,           // 진화 게이지 레벨 (도전과제용)
      hadNeardeath: false,   // 3마리 이하로 떨어진 적 있는지
      volcanoWin: false,     // 화산지대에서 전쟁 승리
      visitedTerrains: new Set(), // 방문한 지형 ID
      bossKills: 0,          // 처치한 보스 수
      bossHiddenKilled: false, // 태초의 포식자 처치
      bossNoLossKill: false,  // 개체 손실 없이 보스 처치
      bossQuickKill: false,   // 60초 이내 보스 처치
    };
    // Feature 1: 유전자 완전 고정 추적
    this._fixedGenes = new Set();
    this._lastFixCheck = 0;
    // Feature 2: 멸종 직전 플래그
    this._nearExtinct = false;

    // 날씨/낮밤 시스템
    this.weather = WEATHERS.sunny;
    this.lastWeatherAt = Date.now();
    this.dayPhase = 'day';
    this.fxParticles = []; // 떠다니는 분위기 파티클 (꽃잎/눈/비)

    // 데미지 숫자 풀
    this.floatTexts = [];

    // 오디오 (사용자 제스처로 시작됨)
    Audio.init(); Audio.resume();

    // 낮밤 오버레이 (월드 위 반투명 레이어)
    this.nightOverlay = this.add.rectangle(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H, 0x1a2a4a, 0)
      .setDepth(22).setScrollFactor(1);
    this.weatherTint = this.add.rectangle(WORLD_W/2, WORLD_H/2, WORLD_W, WORLD_H, 0x000000, 0)
      .setDepth(21).setScrollFactor(1);

    this.setupJoystick();
    this.setupKeyboard();
    this.setupPinchZoom();
    // 방향 전환 시 Phaser 카메라 뷰포트 자동 갱신
    this.scale.on('resize', this._onSceneResize, this);
    // pointerdown 사용: 멀티터치 중(조이스틱 유지) click 합성이 막혀도 즉시 동작
    document.getElementById('breed-btn').addEventListener('pointerdown', e => { e.preventDefault(); this.handleAction(); });
    // 이벤트 메시지 접기/펼치기 (보스 모드)
    const _evtEl = document.getElementById('event-message');
    _evtEl.addEventListener('click', () => {
      if (_evtEl.classList.contains('boss-mode') && _evtEl.classList.contains('evt-collapsed')) {
        _evtEl.classList.remove('evt-collapsed');
        clearTimeout(this._evtCollapseTimer);
        this._evtCollapseTimer = setTimeout(() => _evtEl.classList.add('evt-collapsed'), 4000);
      }
    });
    document.getElementById('evt-collapse-btn').addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('event-message').classList.add('evt-collapsed');
      clearTimeout(this._evtCollapseTimer);
    });
    this.showMessage('🌱 슬라임 집단을 이끌고\n먹이를 모으세요!');
    // 튜토리얼 자동 시작 (첫 게임)
    if (!Save.get('gpa_tutorial_done')) {
      setTimeout(() => Tutorial.start(this), 800);
    }
  }

  generateTerrain() {
    const W = Math.floor(WORLD_W / TILE);
    const H = Math.floor(WORLD_H / TILE);

    // 큰 바이옴 구역 (반경 확대, 더 넓고 뚜렷한 지형)
    const zones = [
      { cx:.14, cy:.14, r:.32, terrain: TERRAIN.forest  },  // 좌상 숲
      { cx:.86, cy:.14, r:.28, terrain: TERRAIN.desert  },  // 우상 사막
      { cx:.14, cy:.86, r:.28, terrain: TERRAIN.snow    },  // 좌하 눈밭
      { cx:.86, cy:.86, r:.30, terrain: TERRAIN.forest  },  // 우하 숲
      { cx:.5,  cy:.08, r:.18, terrain: TERRAIN.volcano },  // 상단 화산
      { cx:.08, cy:.5,  r:.18, terrain: TERRAIN.swamp   },  // 좌측 늪
      { cx:.92, cy:.5,  r:.16, terrain: TERRAIN.desert  },  // 우측 사막
      { cx:.5,  cy:.5,  r:.36, terrain: TERRAIN.plain   },  // 중앙 초원
    ];

    // 강 경로: 초원 한가운데(x≈0.5)를 관통하며 상단→하단으로 구불구불 흐름
    const riverPath = [];
    let rx = 0.5 + (Math.random() - 0.5) * 0.05; // 중앙에서 시작
    for (let step = 0; step <= H; step++) {
      riverPath.push(rx);
      rx += (Math.random() - 0.5) * 0.05;          // 편향 없이 부드럽게 사행
      rx += (0.5 - rx) * 0.06;                      // 중앙으로 되돌리는 힘 — 초원 가운데 유지
      rx = clamp(rx, 0.42, 0.58);
    }
    const RIVER_W = 0.13; // 강 너비 (비율) — 기존 0.075에서 확대

    const grid = [];
    for (let y = 0; y < H; y++) {
      grid[y] = [];
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;

        // 강 우선 판정 (구불구불 경로)
        const pathX = riverPath[y];
        const distToRiver = Math.abs(nx - pathX);
        // 강 양쪽은 강가 지형
        if (distToRiver < RIVER_W * 0.5) {
          grid[y][x] = TERRAIN.river; continue;
        }
        if (distToRiver < RIVER_W * 1.4) {
          grid[y][x] = TERRAIN.plain; continue; // 강가
        }

        // 바이옴 구역 판정
        let picked = TERRAIN.plain, score = 0.12;
        for (const z of zones) {
          const s = 1 - Math.hypot(nx - z.cx, ny - z.cy) / z.r;
          if (s > score) { score = s; picked = z.terrain; }
        }

        // 극소수 노이즈 (0.3%)
        if (Math.random() < 0.003) picked = choose(TERRAIN_LIST);
        grid[y][x] = picked;
      }
    }
    return grid;
  }

  // 색을 흰색 쪽으로 f(0~1) 만큼 보간
  _lighten(c, f) {
    const r = ((c >> 16) & 0xFF), gg = ((c >> 8) & 0xFF), b = (c & 0xFF);
    return (Math.floor(r + (255 - r) * f) << 16)
         | (Math.floor(gg + (255 - gg) * f) << 8)
         |  Math.floor(b + (255 - b) * f);
  }

  drawTerrain() {
    const rows = this.terrainGrid.length;
    const cols = this.terrainGrid[0]?.length || 0;
    const g = this.add.graphics().setDepth(0);

    // Pass 1: 타일 단위 은은한 색 변주 — 대비를 크게 줄여 자연스럽게
    //  대부분 기본색, 가끔 아주 살짝 밝거나 어두운 패치 (색상별 그룹핑으로 배치 유지)
    const byColor = new Map();
    const push = (c, px, py, w, h) => {
      if (!byColor.has(c)) byColor.set(c, []);
      byColor.get(c).push([px, py, w, h]);
    };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = this.terrainGrid[y][x];
        const lt = this._lighten(t.color, 0.06);   // 아주 살짝 밝게
        const dk = this._lighten(t.color, -0.05);  // 아주 살짝 어둡게
        // 기본색 비중을 높여 거의 균일하게, 가끔만 변주
        const tones = [t.color, t.color, t.color, lt, t.color, dk];
        const seed = ((x * 73856093) ^ (y * 19349663)) >>> 0;
        const pick = tones[(seed >>> 4) % tones.length];
        push(pick, x * TILE, y * TILE, TILE, TILE);
      }
    }
    for (const [color, rects] of byColor) {
      g.fillStyle(color, 1);
      for (const [px, py, w, h] of rects) g.fillRect(px, py, w, h);
    }

    // Pass 2: 지형 디테일 — 해시 기반 난수로 무작위 배치 (정렬 패턴 제거)
    const rng = (x, y, salt) => {
      let h = ((x + 1) * 374761393 + (y + 1) * 668265263 + salt * 2246822519) >>> 0;
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
      h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296; // 0..1
    };
    // ── 자연물: 한 번만 텍스처로 굽고 정적 스프라이트로 배치 ──
    //  (매 프레임 수백 개 원·삼각형을 다시 그리지 않음 → 부드럽게 동작)
    this.buildNatureTextures();
    const oy = this._natureOriginY;
    const place = (key, cx, cy) => this.add.image(cx, cy, key).setOrigin(0.5, oy).setDepth(1);
    const density = { forest:0.13, swamp:0.10, plain:0.11, river:0.06, volcano:0.09, desert:0.08, snow:0.07 };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = this.terrainGrid[y][x];
        if (rng(x, y, 1) > (density[t.id] ?? 0.10)) continue;
        const px = x * TILE, py = y * TILE;
        const cx = px + 20 + Math.floor(rng(x, y, 2) * (TILE - 40));
        const cy = py + 24 + Math.floor(rng(x, y, 3) * (TILE - 44));
        const v = rng(x, y, 4);   // 종류 선택용
        const r = rng(x, y, 5);   // 색·변형용
        let key;
        switch (t.id) {
          case 'forest':  key = r < 0.45 ? 'nat_tree_autumn' : 'nat_tree_green'; break;
          case 'desert':  key = v < 0.7 ? 'nat_cactus' : 'nat_rock'; break;
          case 'volcano': key = v < 0.6 ? 'nat_lava' : 'nat_rock'; break;
          case 'snow':    key = v < 0.7 ? 'nat_snow' : 'nat_rock'; break;
          case 'river':   key = v < 0.5 ? 'nat_lily' : 'nat_reed'; break;
          case 'swamp':   key = v < 0.6 ? 'nat_reed' : 'nat_grass'; break;
          case 'plain':
          default:
            if (v < 0.66)      key = 'nat_grass';
            else if (v < 0.80) key = 'nat_flower' + (Math.floor(r * 4) % 4);
            else if (v < 0.92) key = r < 0.45 ? 'nat_tree_autumn' : 'nat_tree_green';
            else               key = 'nat_rock';
            break;
        }
        place(key, cx, cy);
      }
    }

    // Pass 3: 부드러운 바이옴 경계 (검은 선 → 어두운 반투명 얇은 선)
    g.fillStyle(0x2a2018, 0.18);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const id = this.terrainGrid[y][x].id;
        if (this.terrainGrid[y]?.[x+1]?.id !== id) g.fillRect((x+1)*TILE-1, y*TILE, 2, TILE);
        if (this.terrainGrid[y+1]?.[x]?.id !== id)  g.fillRect(x*TILE, (y+1)*TILE-1, TILE, 2);
      }
    }
  }

  // 자연물 텍스처를 한 번만 굽는다 (원점 기준으로 그린 뒤 2.2배 확대해 베이크)
  buildNatureTextures() {
    if (this._natureBuilt) return;
    this._natureBuilt = true;
    const W = 160, H = 180, CX = 80, CY = 110, S = 2.2;
    this._natureOriginY = CY / H;
    const bake = (key, draw) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ add: false });
      g.save(); g.translateCanvas(CX, CY); g.scaleCanvas(S, S);
      draw(g);
      g.restore();
      g.generateTexture(key, W, H);
      g.destroy();
    };
    const shadow = (g, cx, cy, w, h) => { g.fillStyle(0x000000, 0.12); g.fillEllipse(cx, cy, w, h); };

    // 나무 (3겹 음영: 어두움→중간→하이라이트)
    const tree = (g, pal) => {
      shadow(g, 0, 16, 32, 11);
      g.fillStyle(0x5a3c22, 1); g.fillRect(-3, 2, 6, 16);          // 줄기
      g.fillStyle(0x7a5230, 1); g.fillRect(-3, 2, 3, 16);          // 줄기 밝음
      g.fillStyle(pal.d, 1);
      g.fillCircle(-10, -2, 12); g.fillCircle(10, -2, 12); g.fillCircle(0, -12, 13);
      g.fillStyle(pal.m, 1);
      g.fillCircle(-8, -4, 9); g.fillCircle(8, -4, 9); g.fillCircle(0, -13, 10);
      g.fillStyle(pal.l, 1);
      g.fillCircle(-4, -13, 5); g.fillCircle(4, -9, 4);
    };
    bake('nat_tree_green',  g => tree(g, { d: 0x276b27, m: 0x3d8c3d, l: 0x6cc154 }));
    bake('nat_tree_autumn', g => tree(g, { d: 0xb5572f, m: 0xe28a3c, l: 0xf6bd63 }));

    // 풀 다발
    bake('nat_grass', g => {
      g.fillStyle(0x3a7a2c, 1);
      g.fillTriangle(-7, 6, -5, -6, -3, 6);
      g.fillTriangle(2, 6, 5, -4, 8, 6);
      g.fillStyle(0x68b945, 1);
      g.fillTriangle(-2, 6, 0, -9, 2, 6);
    });

    // 선인장
    bake('nat_cactus', g => {
      shadow(g, 0, 13, 20, 7);
      g.fillStyle(0x2f7d3a, 1);
      g.fillRoundedRect(-5, -14, 10, 28, 4);
      g.fillRoundedRect(-12, -5, 7, 6, 3); g.fillRect(-12, -3, 5, 11);
      g.fillRoundedRect(5, -10, 7, 6, 3); g.fillRect(7, -10, 5, 14);
      g.fillStyle(0x53a657, 1); g.fillRect(-3, -11, 3, 22);
    });

    // 바위
    bake('nat_rock', g => {
      shadow(g, 0, 8, 24, 8);
      g.fillStyle(0x82828c, 1); g.fillCircle(-5, 0, 8); g.fillCircle(6, 1, 7);
      g.fillStyle(0xb2b2bc, 1); g.fillCircle(-5, -3, 4); g.fillCircle(6, -2, 3);
    });

    // 눈더미
    bake('nat_snow', g => {
      shadow(g, 0, 7, 22, 7);
      g.fillStyle(0xdce8f5, 1); g.fillCircle(-5, 0, 8); g.fillCircle(6, 1, 7);
      g.fillStyle(0xffffff, 1); g.fillCircle(-5, -3, 4); g.fillCircle(6, -2, 3);
    });

    // 용암 바위
    bake('nat_lava', g => {
      shadow(g, 0, 8, 22, 7);
      g.fillStyle(0x4a3026, 1); g.fillCircle(-4, 0, 8); g.fillCircle(6, 1, 6);
      g.fillStyle(0x6b4636, 1); g.fillCircle(-4, -2, 4);
      g.fillStyle(0xff6a1a, 1); g.fillRect(-3, -1, 10, 3); g.fillRect(2, -5, 3, 9);
      g.fillStyle(0xffd23f, 1); g.fillRect(-1, 0, 5, 1.5);
    });

    // 갈대
    bake('nat_reed', g => {
      g.fillStyle(0x2f7d3a, 1);
      g.fillRect(-1, -14, 2, 18); g.fillRect(-5, -9, 2, 13); g.fillRect(4, -10, 2, 14);
      g.fillStyle(0x8a5a2a, 1);
      g.fillEllipse(0, -14, 4, 7); g.fillEllipse(5, -10, 4, 7);
    });

    // 수련잎
    bake('nat_lily', g => {
      g.fillStyle(0x2f8f4f, 1); g.fillCircle(0, 0, 8);
      g.fillStyle(0x6fb8d8, 1); g.fillTriangle(0, 0, 9, -5, 9, 5);
      g.fillStyle(0x49a96a, 1); g.fillCircle(-2, -2, 3);
      g.fillStyle(0xff8fb0, 1); g.fillCircle(0, 0, 2.6);
      g.fillStyle(0xffd6e4, 1); g.fillCircle(0, 0, 1.2);
    });

    // 꽃 4색
    const fcols = [0xff6f91, 0xffd23f, 0xff9f4d, 0xe07bff];
    fcols.forEach((c, i) => bake('nat_flower' + i, g => {
      g.fillStyle(0x3a7a2c, 1); g.fillRect(-1, 0, 2, 7);
      g.fillStyle(c, 1);
      g.fillCircle(-3, -2, 2.5); g.fillCircle(3, -2, 2.5);
      g.fillCircle(0, -5, 2.5); g.fillCircle(0, 1, 2.5);
      g.fillStyle(0xfff3b0, 1); g.fillCircle(0, -2, 1.8);
    }));
  }

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
      until: this.elapsed + DANGER_CD_MIN * getDiffConfig().cdMult + offset,
      event: null,
      lastKillAt: 0,
      freqBefore: null,
      ticksLeft: 0,
    };
  });

  // 취약 개체 id → 현재 단계 ('warning'|'active')
  this._atRiskPhaseMap = new Map();
  // 활성 틴트 펄스 추적: id → { tween: Phaser.Tween, phase: string }
  this._dangerGlows = new Map(); // id → { glow: Phaser.FX.Glow, phase: string }
  this._dangerMsgText = null;
  this._showingDangerMsg = false;
}

  updateTerrainDanger(dt) {
    const now = this.elapsed;
    this._atRiskPhaseMap.clear();

    for (const id of Object.keys(TERRAIN_EVENTS)) {
      const t = TERRAIN[id];
      if (!t || !t._danger) continue;
      const d = t._danger;

      if (d.phase === 'cooldown' && now >= d.until) {
        // 사이클 시작: 이벤트 선택 → 경고 단계
        d.event = choose(TERRAIN_EVENTS[id]);
        d.phase = 'warning';
        d.until = now + DANGER_WARN_MS;
        d.lastKillAt = 0;
        d.freqBefore = null;
        if (navigator.vibrate) navigator.vibrate(40);
        // 경고 예고: event-message로 표시됨 (토스트 생략)

      } else if (d.phase === 'warning' && now >= d.until) {
        // 경고 종료 → 활성 단계: 모든 이벤트 타입이 active를 거침
        d.phase = 'active';
        if (d.event.predicate) {
          // 도태 이벤트: 15초 동안 점진적 도태
          d.until = now + DANGER_ACTIVE_MS;
          d.freqBefore = this.player.individuals.length ? this.player.geneFrequency() : null;
          this.terrainEventCount[t.id] = (this.terrainEventCount[t.id] || 0) + 1;
          d.lastKillAt = now - DANGER_KILL_INTERVAL; // 즉시 첫 틱 실행되도록
          d.ticksLeft = Math.round(DANGER_ACTIVE_MS / DANGER_KILL_INTERVAL); // 총 틱 수
        } else {
          // 식량 이벤트: 즉시 처리 후 3초 결과 표시
          d.until = now + DANGER_FOOD_ACTIVE_MS;
          this._applyFoodEvent(t);
        }

      } else if (d.phase === 'active') {
        // 도태 이벤트: 2.5초마다 비례적 도태 틱
        if (d.event?.predicate && now - d.lastKillAt >= DANGER_KILL_INTERVAL) {
          d.lastKillAt = now;
          this._killOneTick(t);
          d.ticksLeft = Math.max(0, d.ticksLeft - 1);
        }
        // 활성 단계 종료
        if (now >= d.until) {
          // 결과 토스트: 해당 지형에 있을 때만
          // 이벤트 종료: event-message 사라짐으로 충분 (토스트 생략)
          if (d.freqBefore && this.player.individuals.length) {
            this.recordAlleleSnapshot();
          }
          d.phase = 'cooldown';
          d.until = now + (DANGER_CD_MIN + Math.random() * (DANGER_CD_MAX - DANGER_CD_MIN)) * getDiffConfig().cdMult;
          d.event = null;
          d.freqBefore = null;
        }
      }

      // 경고/위험 단계: 플레이어 집단의 취약 개체 id만 수집 (글로우는 내 개체만)
      if ((d.phase === 'warning' || d.phase === 'active') && d.event?.predicate) {
        if (this.terrainAt(this.player.x, this.player.y).id === id) {
          for (const ind of this.player.individuals) {
            if (d.event.predicate(ind)) this._atRiskPhaseMap.set(ind.id, d.phase);
          }
        }
      }
    }

    this._drawDangerOverlay();
    this._syncDangerMarkers();

    // ── 이벤트 진행 중: 알림 표시 (모드별) + 가장자리 글로우 ──
    // 알림 모드: 'compact'(기본, 작은 칩) | 'full'(자세한 문장 박스) | 'off'(칩 없음)
    // 어느 모드든 위험 개체 글로우(_syncDangerMarkers)는 유지 → 어떤 개체가 위험한지는 항상 보임
    const _mode = Save.get('gpa_terrain_notify') || 'compact';
    const _pt = this.terrainAt(this.player.x, this.player.y);
    const _pd = _pt?._danger;
    const _inEvent = _pd?.event && (_pd.phase === 'warning' || _pd.phase === 'active');
    const _isActive = _inEvent && _pd.phase === 'active' && !!_pd.event?.predicate;
    const _newText = _inEvent
      ? (_pd.phase === 'warning' ? _pd.event.warning : (_pd.event.message || _pd.event.warning))
      : null;
    const _dv = document.getElementById('danger-vignette');
    const _alert = document.getElementById('terrain-alert');

    // 가장자리 글로우: off 모드는 실제 도태 중일 때만(경고는 조용히), 그 외엔 경고부터 표시
    if (_dv) {
      if (!_inEvent) _dv.className = '';
      else if (_mode === 'off') _dv.className = _isActive ? 'danger-active' : '';
      else _dv.className = _isActive ? 'danger-active' : 'danger-warning';
    }

    // 컴팩트 칩: 위험 종류(이벤트 이름)만 짧게 — compact 모드 전용
    // 보스 진행 중(경고·교전)엔 상단을 보스 UI에 양보하고 칩 숨김 (위험 개체 글로우는 유지)
    if (_alert) {
      if (_inEvent && _mode === 'compact' && this.bossPhase === 'idle') {
        const key = `${_isActive ? '🩸' : '⚠️'} ${_pd.event.name}`;
        if (_alert.dataset.k !== key) {
          _alert.dataset.k = key;
          _alert.textContent = key;
          _alert.classList.remove('warn', 'active');
          void _alert.offsetWidth; // 리플로우로 애니메이션 재시작
          _alert.classList.add(_isActive ? 'active' : 'warn');
          _alert.style.display = 'block';
        }
      } else if (_alert.style.display !== 'none') {
        _alert.style.display = 'none';
        _alert.classList.remove('warn', 'active');
        _alert.dataset.k = '';
      }
    }

    // 자세한 문장 박스: full 모드에서만 조작 (showMessage와 공유하는 요소이므로 다른 모드는 건드리지 않음)
    if (_mode === 'full' && _inEvent) {
      this._dangerMsgText = _newText;
      this._showingDangerMsg = true;
      const el = document.getElementById('event-message');
      const _evtText = document.getElementById('evt-text');
      const _curText = _evtText ? _evtText.textContent : el.textContent;
      if (el.style.display === 'none' || _curText !== _newText) {
        const textChanged = _curText !== _newText;
        if (_evtText) _evtText.textContent = _newText; else el.textContent = _newText;
        el.classList.remove('evt-collapsed');
        el.style.display = 'block';
        if (textChanged) { el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
        clearTimeout(this.messageTimer);
        const _ba = this.bossPhase === 'warning' || this.bossPhase === 'chase';
        if (_ba) {
          const _bb = document.getElementById('boss-banner');
          clearTimeout(this._bossCollapseTimer);
          this._bossCollapseTimer = setTimeout(() => _bb.classList.add('boss-collapsed'), 800);
        }
      }
    } else if (this._showingDangerMsg) {
      // full 모드 이벤트 종료, 또는 모드가 바뀌어 남은 박스 정리
      this._showingDangerMsg = false;
      this._dangerMsgText = null;
      const _dEl = document.getElementById('event-message');
      if (_dEl) { _dEl.style.display = 'none'; _dEl.classList.remove('evt-collapsed'); }
      clearTimeout(this._bossCollapseTimer);
      document.getElementById('boss-banner').classList.remove('boss-collapsed');
    }
  }

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
      void tiles;
    }
  }
  _syncDangerMarkers() {
    const view = this.cameras.main.worldView;

    // 1. 취약하지 않거나 화면 밖 슬라임 글로우 제거
    for (const [id, entry] of this._dangerGlows.entries()) {
      const sprEntry = this.individualSprites.get(id);
      const spr = sprEntry?.sprite;
      const offScreen = !spr?.active || !Phaser.Geom.Rectangle.Contains(view, spr.x, spr.y);
      if (!this._atRiskPhaseMap.has(id) || offScreen) {
        if (spr?.preFX) spr.preFX.remove(entry.glow);
        this._dangerGlows.delete(id);
      }
    }

    // 2. 화면 안 취약 슬라임에 글로우 추가 (단계 전환 시 재생성)
    for (const [id, phase] of this._atRiskPhaseMap) {
      const sprEntry = this.individualSprites.get(id);
      const spr = sprEntry?.sprite;
      if (!spr?.active || !spr.preFX) continue;
      if (!Phaser.Geom.Rectangle.Contains(view, spr.x, spr.y)) continue;

      const existing = this._dangerGlows.get(id);
      if (existing && existing.phase !== phase) {
        spr.preFX.remove(existing.glow);
        this._dangerGlows.delete(id);
      }

      if (!this._dangerGlows.has(id)) {
        const color  = phase === 'active' ? 0xff3333 : 0xffcc00;
        const base   = phase === 'active' ? 6 : 4;
        const glow   = spr.preFX.addGlow(color, base, 0, false);
        this._dangerGlows.set(id, { glow, phase, base });
      }
    }

    // 3. 펄스: Tween 없이 수식으로 outerStrength 갱신 (매 프레임, CPU만 사용)
    const t = (Math.sin(this.elapsed / 350) + 1) * 0.5; // 0→1 사인 파형
    for (const entry of this._dangerGlows.values()) {
      entry.glow.outerStrength = entry.base * (0.4 + 0.6 * t);
    }
  }

  // 식량 이벤트 처리 (활성 단계 진입 시 즉시 호출)
  _applyFoodEvent(terrain) {
    const event = terrain._danger.event;
    if (!event || event.predicate) return;
    const t = terrain;
    this.terrainEventCount[t.id] = (this.terrainEventCount[t.id] || 0) + 1;

    for (const group of this.groups) {
      if (this.terrainAt(group.x, group.y).id !== t.id) continue;
      if (event.foodDelta !== undefined) {
        group.food = clamp(group.food + event.foodDelta, 0, FOOD_CAP);
      } else if (event.foodRatio !== undefined) {
        group.food = Math.floor(group.food * event.foodRatio);
      }
    }
    this.recordAlleleSnapshot();
  }

  // 점진적 도태 틱: 2.5초마다 호출, 그룹 규모 비례 (10%, 최소 1명)
  _killOneTick(terrain) {
    const event = terrain._danger.event;
    if (!event?.predicate) return;
    const t = terrain;

    for (const group of this.groups) {
      if (this.terrainAt(group.x, group.y).id !== t.id) continue;
      const atRisk = group.individuals.filter(i => event.predicate(i));
      if (!atRisk.length) continue;

      // 그룹 규모에 비례: 10%, 최소 1명 / 최대 at-risk의 50%
      // 남은 틱 수로 나눠 끝까지 머물면 전멸 보장
      const ticks = Math.max(1, t._danger.ticksLeft);
      const n = Math.ceil(atRisk.length / ticks);
      const victims = atRisk.sort(() => Math.random() - 0.5).slice(0, n);
      for (const v of victims) {
        const entry = this._dangerGlows.get(v.id);
        if (entry) {
          const se = this.individualSprites.get(v.id);
          if (se?.sprite?.preFX) se.sprite.preFX.remove(entry.glow);
          this._dangerGlows.delete(v.id);
        }
      }
      const ids = new Set(victims.map(i => i.id));
      group.individuals = group.individuals.filter(i => !ids.has(i.id));
      group.terrainEventDeaths = (group.terrainEventDeaths || 0) + victims.length;

      if (group.isPlayer && victims.length > 0) {
        this.burst(group.x, group.y, 0xff4444, Math.min(victims.length * 3, 15), 55);
      }
    }
  }

  _forceDanger(terrainId) {
    const t = TERRAIN[terrainId];
    if (!t || !t._danger) return 'unknown terrain';
    t._danger.event = choose(TERRAIN_EVENTS[terrainId]);
    t._danger.phase = 'warning';
    t._danger.until = this.elapsed + DANGER_WARN_MS;
    return `forced ${terrainId} → warning`;
  }

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

  terrainAt(x, y) {
    const tileX = clamp(Math.floor(x / TILE), 0, this.terrainGrid[0].length - 1);
    const tileY = clamp(Math.floor(y / TILE), 0, this.terrainGrid.length - 1);
    return this.terrainGrid[tileY][tileX];
  }

  initGroup(group, count) {
    // AI 집단: 랜덤 특성 초기 보유 (난이도에 따라 추가)
    const _aiMutCount = group.isPlayer ? 0 : 1 + (CURRENT_DIFFICULTY > 0 ? getDiffConfig().aiMutExtra : 0);
    const aiBias = group.isPlayer ? [] :
      Array.from({length: _aiMutCount + (Math.random() < 0.5 ? 1 : 0)}, () => choose(MUTATIONS).id)
        .filter((v, i, a) => a.indexOf(v) === i); // dedupe

    // 균등 유전자 배분: 각 유전자마다 우성·열성이 집단 전체에서 정확히 50%씩
    // 동형접합(RR/BB) + 이형접합(RB) 조합이 고르게 분포되도록 배정
    const shuffle = arr => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const makeBalancedPool = (def, n) => {
      const half = Math.floor(n / 2);
      const pool = [
        ...Array(half).fill(def.dominant),
        ...Array(n - half).fill(def.recessive)
      ];
      return shuffle(pool);
    };

    // 각 유전자별로 두 개의 균등 배분 풀 생성 (첫 번째·두 번째 유전자 슬롯용)
    const balancedGenes = {};
    for (const [name, def] of Object.entries(GENES)) {
      const pool1 = makeBalancedPool(def, count);
      const pool2 = makeBalancedPool(def, count);
      balancedGenes[name] = pool1.map((a, i) => combineAlleles(name, a, pool2[i]));
    }

    for (let i = 0; i < count; i += 1) {
      const angle = i / count * Math.PI * 2;
      const startMuts = group.isPlayer ? [] : aiBias.filter(() => Math.random() < 0.40);

      // 플레이어·AI 모두 균등 유전자 사용 (더 공평한 시작 조건)
      const genes = Object.fromEntries(
        Object.keys(GENES).map(name => [name, balancedGenes[name][i]])
      );

      const ind = new Individual(
        group.id,
        group.x + Math.cos(angle) * 44,
        group.y + Math.sin(angle) * 44,
        genes, startMuts
      );
      // Apply lab buffs to player's starting individuals
      if (group.isPlayer && LAB_BUFFS) {
        if (LAB_BUFFS.hpMult > 1) {
          ind.stats.hp     = Math.round(ind.stats.hp     * LAB_BUFFS.hpMult);
          ind.hp           = ind.stats.hp;
        }
        if (LAB_BUFFS.attackBonus > 0) {
          ind.stats.attack = Math.min(ind.stats.attack + LAB_BUFFS.attackBonus, 200);
        }
        if (LAB_BUFFS.gatherBonus > 0) {
          ind.stats.gather = Math.min(ind.stats.gather + LAB_BUFFS.gatherBonus, 100);
        }
        if (LAB_BUFFS.mutRateBonus > 0) {
          ind.stats.mutationRate = Math.min(ind.stats.mutationRate + LAB_BUFFS.mutRateBonus, MAX_STATS.mutationRate);
        }
      }
      // 플레이어는 e등급 대립유전자 품질로 시작
      if (group.isPlayer) {
        ind.geneQuality = { color:'e', speed:'e', poison:'e', armor:'e', charm:'e' };
        ind.stats = ind.calculateStats();
        ind.hp    = ind.stats.hp;
      }
      // AI는 난이도에 따른 대립유전자 품질 적용 — 번식으로 자손에 유전
      if (!group.isPlayer) {
        const db = getDiffConfig();
        const gq = db.aiGeneQuality || 'e';
        ind.geneQuality = { color:gq, speed:gq, poison:gq, armor:gq, charm:gq };
        ind.stats = ind.calculateStats();
        ind.hp    = ind.stats.hp;
      }
      group.individuals.push(ind);
    }
  }

  // 픽셀아트 슬라임: 넓적한 돔형, 흰 눈 + 동공, 혀, 하이라이트
  _buildCreatureTexture(individual) {
    const key = creatureTextureKey(individual);
    if (this.textures.exists(key)) return key;
    const sig = signatureMutations(individual.mutations).filter(id => id!=='large_body' && id!=='small_body');
    const cat = dominantMutationType(individual.mutations);
    const rawColor = getBodyColor(individual);
    const S = 4;
    let c = rawColor;
    if (cat === 'bad') {
      const ri=(c>>16)&0xFF, gi=(c>>8)&0xFF, bi=c&0xFF, gray=0x88;
      const bl=(a,b)=>Math.round(a*0.9+b*0.1);
      c=(bl(ri,gray)<<16)|(bl(gi,gray)<<8)|bl(bi,gray);
    }
    const ri=(c>>16)&0xFF, gi=(c>>8)&0xFF, bi=c&0xFF;
    const dark =(Math.floor(ri*.45)<<16)|(Math.floor(gi*.45)<<8)|Math.floor(bi*.45);
    const light=(Math.min(255,Math.floor(ri*1.55))<<16)|(Math.min(255,Math.floor(gi*1.55))<<8)|Math.min(255,Math.floor(bi*1.55));
    const _ = null, D = dark, L = light, H = 0xffffff;
    const E = 0xffffff, PL = 0x111111, M = 0x111111, T = 0xff88aa;
    const grid = [
      [_,_,_,D,D,D,D,D,D,D,D,D,_,_,_,_],
      [_,_,D,L,L,L,L,L,L,L,L,L,D,_,_,_],
      [_,D,L,H,H,L,L,L,L,L,L,L,L,D,_,_],
      [D,L,L,H,L,L,L,L,L,L,L,L,L,L,D,_],
      [D,L,L,L,E,E,L,L,L,E,E,L,L,L,D,_],
      [D,L,L,L,E,PL,L,L,L,E,PL,L,L,L,D,_],
      [D,L,L,L,E,E,L,L,L,E,E,L,L,L,D,_],
      [D,L,L,L,L,M,M,L,M,M,L,L,L,L,D,_],
      [_,D,L,L,L,L,T,T,T,L,L,L,L,D,_,_],
      [_,_,D,D,D,D,D,D,D,D,D,D,D,_,_,_],
    ];
    const g = this.make.graphics({ add: false });
    for (let row=0; row<grid.length; row++) for (let col=0; col<grid[row].length; col++) {
      const cl=grid[row][col]; if (cl===null) continue;
      g.fillStyle(cl,1); g.fillRect(col*S, row*S, S, S);
    }
    this.drawMutationOverlay(g, S, sig, cat, { dark, light, body: c });
    g.generateTexture(key, 16*S, 10*S);
    g.destroy();
    return key;
  }

  createCreatureTexture(individual) {
    return this._buildCreatureTexture(individual);
  }

  drawMutationOverlay(g, S, sig, cat, pal) {
    const px=(x,y,w,h,c,a=1)=>{ g.fillStyle(c,a); g.fillRect(x*S,y*S,w*S,h*S); };
    const D = pal.dark, L = pal.light;
    if (sig.includes('hard_shell')) {
      px(2,0,9,1,0x6e7080); px(1,0,1,1,0x9090a0); px(11,0,1,1,0x9090a0);
      px(3,1,3,1,0xa0a0b2); px(7,1,4,1,0xa0a0b2); px(4,0,3,1,0xd0d0e0);
      px(2,2,2,1,0x6e7080,0.8); px(9,2,2,1,0x6e7080,0.8);
    }
    if (sig.includes('bright_pattern')) {
      px(3,3,2,2,0xffd23f); px(9,3,2,2,0xffd23f); px(5,6,3,2,0xffb000);
      px(2,6,1,1,0xffd23f,0.7); px(11,6,1,1,0xffd23f,0.7);
      px(4,2,1,1,0xffffff,0.8); px(10,2,1,1,0xffffff,0.8);
    }
    if (sig.includes('strong_jaw')) {
      px(3,7,2,1,0xffffff); px(7,7,1,1,0xffffff); px(10,7,2,1,0xffffff);
      px(4,8,1,2,0xffffff); px(8,8,1,2,0xffffff); px(11,8,1,1,0xffffff);
      px(2,7,1,2,D,0.8); px(12,7,1,2,D,0.8);
    }
    if (sig.includes('poison_gland')) {
      px(1,8,2,2,0x4fdf2a); px(10,8,2,2,0x4fdf2a); px(6,8,2,2,0x6fdf4a);
      px(2,7,1,1,0x9aff60,0.7); px(11,7,1,1,0x9aff60,0.7);
      px(3,1,2,2,0xa855f7); px(8,2,2,1,0xa855f7,0.7); px(4,0,1,1,0xd070ff,0.8);
    }
    if (sig.includes('regeneration')) {
      px(0,3,1,1,0xb0ffb0,0.9); px(0,5,1,1,0xb0ffb0,0.7); px(0,7,1,1,0xb0ffb0,0.5);
      px(13,3,1,1,0xb0ffb0,0.9); px(13,5,1,1,0xb0ffb0,0.7); px(13,7,1,1,0xb0ffb0,0.5);
      px(3,0,3,1,0x70ff70,0.8); px(8,0,3,1,0x70ff70,0.8);
      px(4,1,1,2,0xffffff,0.9); px(5,1,2,1,0xffffff,0.9);
      px(9,1,1,2,0xffffff,0.9); px(9,2,1,1,0xffffff,0.9);
    }
    if (sig.includes('fast_legs')) {
      px(2,9,1,1,D); px(5,9,1,1,D); px(8,9,1,1,D); px(11,9,1,1,D);
      px(1,8,1,1,D,0.5); px(4,8,1,1,D,0.5); px(7,8,1,1,D,0.5);
      px(0,5,1,1,L,0.7); px(0,7,1,1,L,0.5); px(13,5,1,1,L,0.7); px(13,7,1,1,L,0.5);
    }
    if (sig.includes('pheromone')) {
      px(5,0,1,1,0xffef8a); px(7,0,2,1,0xffef8a); px(10,0,1,1,0xffef8a);
      px(5,1,6,1,0xffd23f); px(6,2,1,1,0xffb000,0.8); px(9,2,1,1,0xffb000,0.8);
      px(4,0,1,1,0xffffff,0.9); px(11,0,1,1,0xffffff,0.7);
    }
    // ── 이점(good) ──────────────────────────────────────
    if (sig.includes('acid_spit')) {          // 산성 타액: 입가에 흘러내리는 초록 침
      px(6,7,2,1,0x7fff3a,0.85); px(5,8,1,1,0x9fff5a,0.9); px(9,8,1,2,0x5fdf2a,0.9); px(4,8,1,1,0x9fff5a,0.6);
    }
    if (sig.includes('thick_fur')) {          // 두꺼운 털: 돔 가장자리 갈색 털 뭉치
      px(2,1,1,1,0xd9a86a); px(4,0,1,1,0xd9a86a); px(7,0,1,1,0xc79150); px(10,0,1,1,0xd9a86a); px(12,1,1,1,0xc79150);
      px(0,4,1,1,0xd9a86a,0.9); px(13,4,1,1,0xd9a86a,0.9); px(1,3,1,1,0xc79150,0.8); px(14,3,1,1,0xc79150,0.8);
    }
    if (sig.includes('echolocation')) {       // 반향 탐지: 머리 옆 음파 링 + 귀 돌기
      px(3,0,1,1,D); px(11,0,1,1,D);
      px(0,2,1,1,0xffffff,0.75); px(1,1,1,1,0xffffff,0.5); px(14,2,1,1,0xffffff,0.75); px(13,1,1,1,0xffffff,0.5);
    }
    if (sig.includes('solar_skin')) {         // 태양 피부: 정수리 햇살 무늬
      px(5,0,1,1,0xffe066); px(8,0,1,1,0xffe066); px(6,1,1,1,0xfff0a0,0.9); px(3,2,1,1,0xffe066,0.7); px(11,2,1,1,0xffe066,0.7);
    }
    if (sig.includes('crab_claw')) {          // 집게발: 양옆 주황 집게
      px(0,4,1,2,0xff7a45); px(0,6,1,1,0xffb080,0.85); px(14,4,1,2,0xff7a45); px(15,5,1,1,0xffb080,0.85);
    }
    if (sig.includes('chitin_layer')) {       // 키틴 장갑: 몸통 아래 갈색 판 마디
      px(2,6,4,1,0x8a6a3a,0.85); px(8,6,4,1,0x8a6a3a,0.85); px(2,8,3,1,0x8a6a3a,0.8); px(9,8,3,1,0x8a6a3a,0.8);
      px(1,7,1,1,0x6a4a2a,0.8); px(13,7,1,1,0x6a4a2a,0.8);
    }
    if (sig.includes('keen_eyes')) {          // 예리한 눈: 금빛 아이라인 + 반짝임
      px(4,3,2,1,0xffd23f,0.9); px(9,3,2,1,0xffd23f,0.9); px(3,2,1,1,0xffffff,0.9);
    }
    if (sig.includes('adrenal_gland')) {      // 아드레날린샘: 왼쪽 옆구리 붉은 번개
      px(2,4,1,1,0xff4030); px(3,5,1,1,0xff4030); px(2,6,1,1,0xff4030); px(3,3,1,1,0xff7050,0.8);
    }
    if (sig.includes('symbiotic_algae')) {    // 공생 조류: 등 위 초록 조류 알갱이
      px(6,0,1,1,0x3fae4a); px(8,1,1,1,0x54c95f); px(10,1,1,1,0x3fae4a,0.85); px(7,2,1,1,0x7adf85,0.8); px(12,2,1,1,0x54c95f,0.75);
    }
    if (sig.includes('iron_stomach')) {       // 강철 위장: 배의 금속판 + 리벳
      px(5,8,5,1,0x9aa0ac); px(5,8,1,1,0xcfd4dc); px(9,8,1,1,0xcfd4dc);
    }
    if (sig.includes('pack_instinct')) {      // 무리 본능: 이마의 흰 발자국 문양
      px(7,2,1,1,0xffffff,0.95); px(6,1,1,1,0xffffff,0.8); px(8,1,1,1,0xffffff,0.8);
    }
    if (sig.includes('rapid_healing')) {      // 급속 치유: 분홍 십자 + 반짝임
      px(11,5,1,3,0xff9ec4); px(10,6,3,1,0xff9ec4); px(12,4,1,1,0xffffff,0.9);
    }
    if (sig.includes('sixth_sense')) {        // 육감: 이마의 제3의 눈 (보라 동공)
      px(7,1,1,1,0xffffff); px(7,2,1,1,0x7040c0);
    }
    if (sig.includes('sticky_slime')) {       // 끈끈한 점액: 늘어지는 점액 방울
      px(1,7,1,2,0x9adf6a,0.85); px(12,8,1,1,0x9adf6a,0.85); px(6,9,1,1,0xbdf58a,0.9); px(2,7,1,1,0xdfffb0,0.8);
    }
    if (sig.includes('spring_legs')) {        // 용수철 다리: 노란 코일 발
      px(3,9,2,1,0xffd23f); px(9,9,2,1,0xffd23f); px(4,8,1,1,0xffb000,0.8); px(10,8,1,1,0xffb000,0.8);
    }
    if (sig.includes('vital_core')) {         // 생명의 핵: 몸 중앙에서 빛나는 주황 심장
      px(6,5,1,1,0xff8030); px(8,5,1,1,0xff8030); px(7,6,1,1,0xff6020); px(7,5,1,1,0xffc060); px(7,4,1,1,0xffa040,0.75);
    }
    if (sig.includes('efficient_metabolism')) { // 효율 대사: 볼의 초록 잎사귀
      px(2,5,1,1,0x4faf3a); px(3,4,1,1,0x6fcf4a); px(3,5,1,1,0x8fef6a,0.8);
    }
    // ── 양면(dual) ──────────────────────────────────────
    if (sig.includes('high_fertility')) {     // 높은 번식력: 볼의 분홍 하트
      px(2,5,1,1,0xff7ba9); px(3,5,1,1,0xff7ba9); px(2,6,1,1,0xff5b8f,0.9);
    }
    if (sig.includes('unstable_dna')) {       // 불안정 DNA: 무지갯빛 글리치 픽셀
      px(3,3,1,1,0x40e0d0,0.9); px(11,6,1,1,0xff40a0,0.9); px(6,0,1,1,0xa0ff40,0.85); px(12,4,1,1,0x8040ff,0.85); px(1,6,1,1,0xffe040,0.8);
    }
    if (sig.includes('venomous_bite')) {      // 독성 이빨: 입가의 보라 송곳니 + 독방울
      px(5,7,1,2,0xd070ff); px(9,7,1,2,0xd070ff); px(5,9,1,1,0xa855f7,0.7);
    }
    if (sig.includes('camouflage')) {         // 위장술: 녹갈색 얼룩 반점
      px(2,3,2,2,0x6a8f4a,0.7); px(8,2,3,1,0x6a8f4a,0.55); px(10,6,3,2,0x8a6f4a,0.55); px(5,3,2,1,0x8a6f4a,0.5); px(12,4,1,2,0x6a8f4a,0.65);
    }
    if (sig.includes('magnetism')) {          // 자기장: 양옆 자석 극 (빨강 N / 파랑 S)
      px(0,3,1,2,0xff5040,0.9); px(0,5,1,2,0x4060ff,0.9); px(13,3,1,2,0xff5040,0.9); px(13,5,1,2,0x4060ff,0.9); px(1,2,1,1,0xffffff,0.7);
    }
    if (sig.includes('deep_roots')) {         // 뿌리 감각: 바닥으로 뻗는 갈색 뿌리
      px(2,9,1,1,0x7a5a34); px(5,9,1,1,0x7a5a34); px(9,9,1,1,0x7a5a34); px(12,9,1,1,0x7a5a34); px(1,8,1,1,0x7a5a34,0.8); px(13,8,1,1,0x7a5a34,0.8);
    }
    if (sig.includes('night_vision')) {       // 야시증: 어둠 속에서 빛나는 연두 눈
      px(4,4,2,2,0xbfff40,0.85); px(9,4,2,2,0xbfff40,0.85); px(5,5,1,1,0x1a3a10); px(10,5,1,1,0x1a3a10);
    }
    if (sig.includes('molting')) {            // 탈피 주기: 벗겨지는 허물 조각
      px(3,1,2,1,0xd8d0c0,0.8); px(9,2,2,1,0xd8d0c0,0.7); px(6,3,1,1,0xd8d0c0,0.6); px(4,2,1,1,D,0.7); px(10,1,1,1,D,0.7);
    }
    if (sig.includes('oversized_claw')) {     // 거대 집게: 왼쪽의 커다란 집게팔
      px(0,4,1,4,0xff7a45); px(1,4,1,1,0xff7a45); px(1,7,1,1,0xff7a45); px(0,4,1,1,0xffb080);
    }
    if (sig.includes('barbed_shell')) {       // 가시 껍질: 돔 위 검은 가시
      px(4,0,1,1,0x2a2a36); px(7,0,1,1,0x2a2a36); px(10,0,1,1,0x2a2a36); px(2,1,1,1,0x2a2a36); px(12,1,1,1,0x2a2a36);
    }
    if (sig.includes('biolumin')) {           // 생체 발광: 청록빛 발광 점 아크
      px(2,2,1,1,0x40e8ff,0.95); px(5,1,1,1,0x40e8ff,0.9); px(9,1,1,1,0x40e8ff,0.9); px(12,2,1,1,0x40e8ff,0.95); px(13,5,1,1,0x40e8ff,0.8); px(0,5,1,1,0x40e8ff,0.8);
    }
    if (sig.includes('cold_blood')) {         // 냉혈 체질: 얼음 결정 + 바닥 서리
      px(3,2,1,1,0xbfe8ff); px(4,1,1,1,0xdff4ff,0.9); px(10,2,1,1,0xbfe8ff); px(11,1,1,1,0xdff4ff,0.8); px(2,8,2,1,0xbfe8ff,0.6); px(10,8,2,1,0xbfe8ff,0.6);
    }
    if (sig.includes('hyper_metab')) {        // 과열 대사: 달아오른 볼 + 김
      px(2,6,2,1,0xff6050,0.75); px(11,6,2,1,0xff6050,0.75); px(13,0,1,1,0xffffff,0.6); px(14,1,1,1,0xffffff,0.45); px(12,1,1,1,0xffffff,0.5);
    }
    if (sig.includes('burrowing')) {          // 굴파기 본능: 흙 묻은 발 + 삽 발톱
      px(2,9,3,1,0x8a6a42,0.9); px(9,9,3,1,0x8a6a42,0.9); px(1,8,1,1,0x8a6a42,0.7); px(12,8,2,1,0x8a6a42,0.7);
      px(4,8,1,1,0xd8c8a8,0.9); px(10,8,1,1,0xd8c8a8,0.9);
    }
    if (sig.includes('gluttony')) {           // 폭식가: 커다란 입 + 흘린 부스러기
      px(5,7,5,1,0x111111,0.9); px(10,8,1,1,0xbfe8ff,0.8); px(3,8,1,1,0xffd23f,0.9); px(11,8,1,1,0xff9a4a,0.9);
    }
    if (sig.includes('parasite_spore')) {     // 기생 포자: 머리에 돋아난 분홍 버섯
      px(8,0,3,1,0xc05a8a); px(9,1,1,1,0xe8d8c0); px(9,0,1,1,0xe890b8); px(3,1,1,1,0xc05a8a,0.9);
    }
    if (sig.includes('silk_gland')) {         // 거미줄샘: 모서리 거미줄 + 실
      px(0,0,1,1,0xffffff,0.7); px(1,1,1,1,0xffffff,0.55); px(0,2,1,1,0xffffff,0.5); px(2,0,1,1,0xffffff,0.5);
      px(14,3,1,1,0xffffff,0.5); px(15,4,1,1,0xffffff,0.4); px(7,9,1,1,0xffffff,0.6);
    }
    if (sig.includes('armored_tail')) {       // 갑옷 꼬리: 오른쪽의 강철 꼬리
      px(14,7,1,2,0x9090a0); px(15,6,1,2,0x6e7080); px(15,5,1,1,0xc0c0d0,0.9);
    }
    if (sig.includes('toxic_skin')) {         // 독성 피부: 병든 연두 반점
      px(3,6,2,1,0x7fbf3a,0.8); px(10,3,2,1,0x7fbf3a,0.7); px(6,2,1,1,0x9fdf4a,0.7); px(12,7,1,1,0x7fbf3a,0.8); px(1,4,1,1,0x9fdf4a,0.6);
    }
    if (sig.includes('swarm_body')) {         // 군체화: 양옆에 붙은 미니 분열체
      px(0,7,2,2,pal.body); px(0,7,2,1,L,0.6); px(1,8,1,1,0xffffff,0.95);
      px(13,7,2,2,pal.body); px(13,7,2,1,L,0.6); px(14,8,1,1,0xffffff,0.95);
    }
    if (sig.includes('giant_antennae')) {     // 거대 더듬이: 양쪽 위로 뻗은 더듬이 + 노란 마디
      px(2,1,1,1,0x7a5a34); px(1,0,1,1,0x7a5a34); px(0,0,1,1,0xffb000);
      px(12,1,1,1,0x7a5a34); px(13,0,1,1,0x7a5a34); px(14,0,1,1,0xffb000);
    }
    if (sig.includes('mimic_pattern')) {      // 의태 무늬: 몸통의 가짜 눈알 점
      px(2,6,2,2,0xffd23f,0.85); px(3,7,1,1,0x111111); px(11,6,2,2,0xffd23f,0.85); px(12,7,1,1,0x111111);
    }
    // ── 불이익(bad) ─────────────────────────────────────
    if (sig.includes('weak_jaw')) {           // 약한 턱: 입을 덮은 붕대
      px(6,7,3,2,0xf0e0c0,0.9); px(7,8,1,1,0xd0b090);
    }
    if (sig.includes('thin_shell')) {         // 얇은 껍질: 잔금 간 균열
      px(3,2,1,1,D,0.9); px(4,3,1,1,D,0.8); px(10,1,1,1,D,0.9); px(11,2,1,1,D,0.8); px(7,3,1,1,D,0.7);
    }
    if (sig.includes('slow_legs')) {          // 느린 다리: 식은땀 + 처진 몸
      px(12,3,1,1,0x9adfff,0.9); px(12,4,1,1,0x9adfff,0.6); px(1,8,1,1,D,0.7); px(12,8,1,1,D,0.7);
    }
    if (sig.includes('weak_immunity')) {      // 약한 면역: 병색 도는 연두 반점
      px(3,5,1,1,0x9fdf4a,0.85); px(11,4,1,1,0x9fdf4a,0.85); px(7,2,1,1,0x9fdf4a,0.7);
    }
    if (sig.includes('low_fertility')) {      // 낮은 번식력: 볼의 잿빛 깨진 하트
      px(2,5,1,1,0x8a8a96); px(3,5,1,1,0x8a8a96); px(3,6,1,1,0x8a8a96,0.7);
    }
    if (sig.includes('frail_body')) {         // 약한 체질: 핏기 없는 창백한 얼룩
      px(4,2,2,1,0xe8e8ee,0.55); px(8,3,2,1,0xe8e8ee,0.5); px(6,6,2,1,0xe8e8ee,0.45);
    }
    if (sig.includes('timid')) {              // 겁 많은 성향: 찡그린 눈썹 + 식은땀
      px(3,3,2,1,0x333340,0.8); px(9,3,2,1,0x333340,0.8); px(12,2,1,1,0x9adfff,0.95); px(12,3,1,1,0xcfefff,0.7);
    }
    if (sig.includes('bad_metabolism')) {     // 불완전 대사: 메스꺼운 초록 기운 + 침
      px(2,4,1,1,0x9fdf4a,0.8); px(3,3,1,1,0x9fdf4a,0.6); px(8,8,1,1,0xbfe8ff,0.8);
    }
    if (sig.includes('brittle_bones')) {      // 약한 뼈: 하얗게 비치는 골절선
      px(4,6,1,1,0xffffff,0.75); px(3,7,1,1,0xffffff,0.7); px(10,6,1,1,0xffffff,0.75); px(11,7,1,1,0xffffff,0.6);
    }
    if (sig.includes('nearsighted')) {        // 근시: 동그란 흰 안경테
      px(4,3,2,1,0xffffff,0.9); px(9,3,2,1,0xffffff,0.9);
      px(3,4,1,2,0xffffff,0.9); px(6,4,1,2,0xffffff,0.9); px(8,4,1,2,0xffffff,0.9); px(11,4,1,2,0xffffff,0.9);
      px(7,4,1,1,0xffffff,0.9);
    }
    if (sig.includes('heavy_bones')) {        // 무거운 뼈: 배를 두른 잿빛 벨트
      px(3,8,8,1,0x6e7080,0.9); px(7,8,1,1,0xc0c0d0);
    }
    if (sig.includes('anemia')) {             // 빈혈: 창백한 이마 + 어지럼 별
      px(4,1,3,1,0xe8e8ee,0.5); px(12,0,1,1,0xc0c0d0,0.85); px(13,1,1,1,0xc0c0d0,0.6);
    }
    if (sig.includes('picky_eater')) {        // 편식: 볼의 흰/검 체크 (싫어! 표시)
      px(11,5,1,1,0xffffff,0.9); px(12,6,1,1,0xffffff,0.9); px(12,5,1,1,0x333340,0.85); px(11,6,1,1,0x333340,0.85);
    }
    if (sig.includes('brittle_claw')) {       // 무른 집게: 금 간 잿빛 집게
      px(0,5,1,2,0xc0b0a0); px(0,6,1,1,0x6a5a4a);
    }
    if (sig.includes('dull_senses')) {        // 둔한 감각: 졸린 zzz
      px(12,0,1,1,0xffffff,0.85); px(13,1,1,1,0xffffff,0.7); px(14,2,1,1,0xffffff,0.55);
    }
    if (sig.includes('thin_membrane')) {      // 얇은 막: 반투명하게 비치는 막
      px(9,6,3,1,0xffffff,0.35); px(2,3,2,2,0xffffff,0.3);
    }
    if (sig.includes('sterile_line')) {       // 불임 계통: 이마의 파란 물방울
      px(7,1,1,1,0x6fa0d0); px(7,2,1,1,0x9fc8e8,0.8);
    }
    if (cat==='good') { px(4,0,1,1,0xe6ffe0,0.9); px(9,1,1,1,0xe6ffe0,0.8); }
    else if (cat==='bad') { px(6,2,1,1,0x2a2018,0.7); px(7,3,1,1,0x2a2018,0.6); px(3,5,1,1,0x2a2018,0.5); }
    else if (cat==='dual') { px(10,3,1,1,0xc49ee0,0.8); }
  }

  createBossTexture(bossId) {
  const key = `boss_${bossId}`;
  if (this.textures.exists(key)) return key;
  const v = BOSS_VISUAL[bossId] || BOSS_VISUAL.primordial; // 비주얼 미정의 보스 방어 (검은화면 방지)
  const S = 5, W = 16, Hh = 13, PAD = 1;
  const TW = (W + PAD*2) * S, TH = (Hh + PAD*2) * S;
  const g = this.make.graphics({ add: false });
  const P = v.pal;
  const wide = v.shape==='bulky' || v.shape==='amorphous';
  const top = wide ? 2 : 4;
  const od = P.d;
  const outlineCol = (Math.floor(((od>>16)&0xFF)*0.6)<<16)|(Math.floor(((od>>8)&0xFF)*0.6)<<8)|Math.floor((od&0xFF)*0.6);

  const drawBody = (ox, oy, over) => {
    const px = (x,y,w,h,c,a=1) => { g.fillStyle(over??c, over?1:a); g.fillRect((x+ox)*S,(y+oy)*S,w*S,h*S); };
    const parts = v.parts;
    px(top+1,1,W-2*(top+1)+2,2,P.m); px(top-1,3,W-2*(top-1),2,P.m); px(1,5,W-2,5,P.m); px(2,10,W-4,2,P.m);
    px(1,11,W-2,1,P.d); px(W-3,8,2,3,P.d); px(2,3,3,2,P.l);
    if (v.prism) { const cols=[0xe0604a,0xff9b3a,0x6fcf4a,0x4fa0e6,0x9460b8]; for (let i=0;i<cols.length;i++) px(1+i*3,5,3,5,cols[i]); }
    if (parts.includes('lavaCracks'))  { px(3,5,3,1,P.a); px(9,7,3,1,P.a); px(5,9,4,1,0xffd23f); }
    if (parts.includes('poisonDrips')) { px(3,12,1,1,P.a); px(8,12,1,1,P.a); px(12,11,1,1,P.a); }
    if (parts.includes('spores'))      { px(2,0,2,1,P.a); px(7,0,2,1,P.a); px(11,1,1,1,P.a); }
    if (parts.includes('shellPlates')) { px(2,0,W-4,1,P.d); px(3,1,3,1,P.l); px(9,1,3,1,P.l); }
    if (parts.includes('spikes'))      { px(2,0,1,1,P.d); px(6,0,1,1,P.d); px(10,0,1,1,P.d); px(13,1,1,1,P.d); }
    if (parts.includes('iceCrown'))    { px(3,0,1,1,P.l); px(7,0,1,1,0xffffff); px(11,0,1,1,P.l); px(5,1,1,1,P.l); px(9,1,1,1,P.l); }
    if (parts.includes('heavyBrows'))  { px(3,4,3,1,P.d); px(9,4,3,1,P.d); }
    if (parts.includes('legs'))        { px(2,12,1,1,P.d); px(6,12,1,1,P.d); px(10,12,1,1,P.d); px(13,12,1,1,P.d); }
    if (parts.includes('streaks'))     { px(0,6,1,1,P.l,0.7); px(0,8,1,1,P.l,0.5); px(15,6,1,1,P.l,0.7); }
    if (parts.includes('tentacles'))   { px(1,12,1,1,P.m); px(4,12,1,1,P.m); px(11,12,1,1,P.m); px(14,12,1,1,P.m); px(2,11,1,1,P.l); }
    if (parts.includes('wings'))       { px(0,4,2,3,P.d); px(14,4,2,3,P.d); }
    if (parts.includes('lure'))        { px(7,0,2,1,P.a); px(7,1,1,1,P.l); }
    const slots=[4,7,10,5,9];
    for (let i=0;i<v.eyes;i++){ const ex=slots[i%slots.length], ey=6+(i>=3?2:0); px(ex,ey,1,1,0xffffff); px(ex,ey,1,1,v.eyeCol,0.85); }
  };

  // 윤곽선: 8방향 1셀 오프셋으로 outline color 먼저 그리기
  for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])
    drawBody(PAD+dx, PAD+dy, outlineCol);
  // 몸체
  drawBody(PAD, PAD, null);

  g.generateTexture(key, TW, TH);
  g.destroy();
  return key;
}

  rebuildIndividualSprites() {
    this.groupLayer.removeAll(true);
    this.individualSprites.clear();
    for (const group of this.groups) {
      for (const individual of group.individuals) this.addIndividualSprite(individual, group);
    }
  }

  addIndividualSprite(individual, group) {
    if (this.individualSprites.has(individual.id)) return;
    const key = this.createCreatureTexture(individual);
    let baseScale = clamp(0.55 + individual.stats.hp / 100 * 0.40, 0.60, 1.55);
    const muts = individual.mutations || [];
    if (muts.includes('large_body')) baseScale *= 1.35;
    if (muts.includes('small_body')) baseScale *= 0.7;
    const sprite = this.add.image(individual.x, individual.y, key).setScale(baseScale);
    this.groupLayer.add(sprite);
    // 개체별 고유 위상 → 통통 튀는 타이밍이 제각각이라 자연스러움
    const idStr = String(individual.id);
    let h = 0; for (let i = 0; i < idStr.length; i++) h = (h * 31 + idStr.charCodeAt(i)) & 0xffff;
    const phase = (h / 0xffff) * Math.PI * 2;
    this.individualSprites.set(individual.id, { sprite, groupId: group.id, baseScale, phase });
  }

  ensureSprites(group) {
    for (const individual of group.individuals) this.addIndividualSprite(individual, group);
  }

  // 먹이 = 노란 사과 텍스처 (한 번만 생성, 모든 먹이가 공유 → 배치 렌더)
  createFoodTexture() {
    const key = 'food_apple';
    if (this.textures.exists(key)) return key;
    const g = this.make.graphics({ add: false });
    g.fillStyle(0x000000, 0.16); g.fillEllipse(12, 21, 16, 5);   // 바닥 그림자
    g.fillStyle(0xcf9a1c, 1);   g.fillCircle(8, 13, 7); g.fillCircle(16, 13, 7);  // 외곽(어두움)
    g.fillStyle(0xf6cb38, 1);   g.fillCircle(8, 12, 6); g.fillCircle(16, 12, 6);  // 사과 두 볼(노랑)
    g.fillStyle(0xf6cb38, 1);   g.fillRect(8, 7, 8, 11);                          // 가운데 메움
    g.fillStyle(0xfde07a, 1);   g.fillEllipse(9, 9, 6, 6);       // 상단 광택
    g.fillStyle(0xffffff, 0.9); g.fillCircle(8, 8, 2);           // 하이라이트
    g.fillStyle(0x6b3f1f, 1);   g.fillRect(11, 3, 2, 5);         // 꼭지
    g.fillStyle(0x2f7d2f, 1);   g.fillEllipse(16, 5, 9, 5);      // 잎(어두움)
    g.fillStyle(0x57b347, 1);   g.fillEllipse(16, 4, 7, 4);      // 잎(밝음)
    g.generateTexture(key, 24, 24);
    g.destroy();
    return key;
  }

  spawnFood() {
    let x;
    let y;
    let terrain;
    do {
      x = 70 + Math.random() * (WORLD_W - 140);
      y = 70 + Math.random() * (WORLD_H - 140);
      terrain = this.terrainAt(x, y);
    } while (terrain.id === 'river');
    const amount = Math.floor((18 + Math.random() * 18) * terrain.food);
    const key = this.createFoodTexture();
    const scale = clamp(0.62 + amount / 46, 0.62, 1.25);
    const sprite = this.add.image(x, y, key).setDepth(1).setScale(scale);
    this.foods.push({ x, y, amount, sprite });
  }

  getPointerClientPosition(pointer) {
    const event = pointer.event;
    const touch = event?.changedTouches?.[0] || event?.touches?.[0];
    return {
      x: touch?.clientX ?? event?.clientX ?? pointer.x,
      y: touch?.clientY ?? event?.clientY ?? pointer.y
    };
  }

  setupJoystick() {
    this.input.addPointer(2); // 멀티터치: 조이스틱 + 버튼 동시 입력 허용
    this.joystick = {
      active: false,
      pointerId: null,
      baseX: 94,
      baseY: this.scale.height - 132,
      knobX: 0,
      knobY: 0,
      radius: 56,
      dirX: 0,
      dirY: 0
    };
    this.input.on('pointerdown', pointer => {
      const event = pointer.event;
      if (_paused) return;
      if (event && event.button === 2) return; // 우클릭은 조이스틱 제외
      // 조이스틱은 게임 캔버스를 직접 터치했을 때만 소환.
      // (예전 방식은 "무시할 UI 목록"이라 새 버튼이 생길 때마다 조이스틱이 UI를 가리는 버그가 재발했음.
      //  HTML UI는 pointer-events:auto라 터치 target이 캔버스가 아니므로 이 한 줄로 전부 걸러진다.
      //  단, #hud 안에 새 인터랙티브 요소를 만들 땐 pointer-events:auto를 켜야 터치를 받는다 — #hud는 none.)
      if (event && event.target && String(event.target.tagName).toUpperCase() !== 'CANVAS') return;
      const { x: clientX, y: clientY } = this.getPointerClientPosition(pointer);
      Object.assign(this.joystick, { active: true, pointerId: pointer.id, baseX: clientX, baseY: clientY, knobX: 0, knobY: 0, dirX: 0, dirY: 0 });
      this.updateJoystickDom();
    });
    this.input.on('pointermove', pointer => {
      if (!this.joystick.active || pointer.id !== this.joystick.pointerId) return;
      const { x: clientX, y: clientY } = this.getPointerClientPosition(pointer);
      const dx = clientX - this.joystick.baseX;
      const dy = clientY - this.joystick.baseY;
      const distance = Math.hypot(dx, dy) || 1;
      const factor = Math.min(1, this.joystick.radius / distance);
      this.joystick.knobX = dx * factor;
      this.joystick.knobY = dy * factor;
      this.joystick.dirX = this.joystick.knobX / this.joystick.radius;
      this.joystick.dirY = this.joystick.knobY / this.joystick.radius;
      this.updateJoystickDom();
    });
    this.input.on('pointerup', pointer => {
      if (pointer.id !== this.joystick.pointerId) return;
      Object.assign(this.joystick, { active: false, pointerId: null, knobX: 0, knobY: 0, dirX: 0, dirY: 0 });
      this.hideJoystickDom();
    });
  }

  updateJoystickDom() {
    const joy = this.joystick;
    const root = document.getElementById('joystick-dom');
    const knob = document.getElementById('joystick-knob');
    root.style.display = 'block';
    root.style.left = `${joy.baseX}px`;
    root.style.top = `${joy.baseY}px`;
    knob.style.left = `${56 + joy.knobX}px`;
    knob.style.top = `${56 + joy.knobY}px`;
  }

  hideJoystickDom() {
    document.getElementById('joystick-dom').style.display = 'none';
  }

  // 방향 전환 / 리사이즈 시 Phaser 씬 내부 정리
  _onSceneResize(gameSize) {
    // 카메라는 자동으로 새 뷰포트에 맞게 갱신됨
    // 활성 조이스틱만 취소
    if (this.joystick?.active) {
      Object.assign(this.joystick, { active: false, pointerId: null, knobX: 0, knobY: 0, dirX: 0, dirY: 0 });
      this.hideJoystickDom();
    }
  }

  setupKeyboard() {
    this._bindMoveKeys();
    // 스페이스바 → 번식 (후퇴는 이동으로)
    this.input.keyboard.on('keydown-SPACE', () => {
      if (!_paused && !this.gameOver) this.handleAction();
    });
  }

  // 이동 키를 KEYMAP(js/keymap.js)에서 읽어 바인딩 — 리바인딩 시 재호출된다
  _bindMoveKeys() {
    if (this.keys) for (const k of Object.values(this.keys)) this.input.keyboard.removeKey(k);
    const code = ch => Phaser.Input.Keyboard.KeyCodes[ch] ?? ch.toUpperCase().charCodeAt(0);
    this.keys = this.input.keyboard.addKeys({
      up: code(KEYMAP.move.up),
      left: code(KEYMAP.move.left),
      down: code(KEYMAP.move.down),
      right: code(KEYMAP.move.right)
    });
  }

  setupPinchZoom() {
    const ZOOM_MAX = 1.5;
    const cam = () => this.cameras.main;
    // 맵이 화면 밖으로 나가지 않는 최소 줌: 가로·세로 중 큰 쪽 기준
    const zoomMin = () => Math.max(
      this.scale.width  / WORLD_W,
      this.scale.height / WORLD_H
    );
    const clampZoom = z => Phaser.Math.Clamp(z, zoomMin(), ZOOM_MAX);

    // ── 모바일: 두 손가락 핀치 ──────────────────────────
    const pinch = { active: false, lastDist: 0 };
    const pinchDist = touches =>
      Math.hypot(touches[0].clientX - touches[1].clientX,
                 touches[0].clientY - touches[1].clientY);

    this.game.canvas.addEventListener('touchstart', e => {
      if (e.touches.length >= 2) {
        pinch.active = true;
        pinch.lastDist = pinchDist(e.touches);
        // 조이스틱 취소 (핀치 중 드리프트 방지)
        if (this.joystick.active) {
          Object.assign(this.joystick, { active: false, pointerId: null, knobX: 0, knobY: 0, dirX: 0, dirY: 0 });
          this.hideJoystickDom();
        }
      }
    }, { passive: true });

    this.game.canvas.addEventListener('touchmove', e => {
      if (!pinch.active || e.touches.length < 2) return;
      const dist = pinchDist(e.touches);
      const ratio = dist / pinch.lastDist;
      cam().setZoom(clampZoom(cam().zoom * ratio));
      pinch.lastDist = dist;
    }, { passive: true });

    this.game.canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) pinch.active = false;
    }, { passive: true });

    // ── 데스크탑: 마우스 휠 ────────────────────────────
    this.game.canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      cam().setZoom(clampZoom(cam().zoom * factor));
    }, { passive: false });

    // ── 마우스 이동 (LoL식): 우클릭 = 목적지 이동, 우클릭 유지 = 커서 쪽으로 계속 따라옴 ──
    this._clickTarget = null;
    this._rmbHeld = false;              // 우클릭 유지 여부
    this._mouseClient = null;          // 최신 커서 화면 좌표 (유지 추종용)
    this._clickMarker = this.add.graphics().setDepth(7).setScrollFactor(1);
    // 우클릭 컨텍스트 메뉴 차단
    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.game.canvas.addEventListener('mousedown', e => {
      if (e.button !== 2) return;                 // 우클릭만
      if (_paused || this.gameOver) return;
      if (getMoveMode() !== 'mouse') return;      // 마우스 이동 모드에서만
      e.preventDefault();
      this._rmbHeld = true;
      this._mouseClient = { x: e.clientX, y: e.clientY };
      this._applyMouseMoveTarget(true);           // 즉시 한 번 목적지 설정 + 마커 표시
    });
    this.game.canvas.addEventListener('mousemove', e => {
      this._mouseClient = { x: e.clientX, y: e.clientY };
    });
    // 버튼을 떼면 추종 중지 (캔버스 밖에서 떼도 잡히도록 window에 등록)
    window.addEventListener('mouseup', e => { if (e.button === 2) this._rmbHeld = false; });
  }

  // 현재 커서 화면 좌표 → 월드 좌표를 목적지로 설정 (마우스 이동 모드)
  // drawMarker는 최초 클릭 때만 true — 유지 추종(매 프레임) 중엔 마커·타이머를 쌓지 않음
  _applyMouseMoveTarget(drawMarker = false) {
    if (!this._mouseClient) return;
    const rect = this.game.canvas.getBoundingClientRect();
    const sx = this._mouseClient.x - rect.left;
    const sy = this._mouseClient.y - rect.top;
    const world = this.cameras.main.getWorldPoint(sx, sy);
    this._clickTarget = { x: world.x, y: world.y };
    if (drawMarker) this._drawClickMarker(world.x, world.y);
  }

  update(_time, dt) {
    if (this.gameOver || this.meteorActive) return;
    const _speedMult = (LAB_BUFFS?.gameSpeedUnlock > 0) ? (parseFloat(Save.get('gpa_speed_val') || '1')) : 1;
    const gameDt = dt * _speedMult;
    this.elapsed += gameDt;
    const now = Date.now();
    // 대립유전자 빈도 시계열 스냅샷 (1.5초마다)
    if (this.elapsed - this.lastAlleleSnapAt >= 1500) {
      this.lastAlleleSnapAt = this.elapsed;
      this.recordAlleleSnapshot();
      this._checkGoldenCondition();
    }
    // Feature 1: 유전자 완전 고정 체크 (5초마다)
    if (this.elapsed - this._lastFixCheck > 5000 && this.player.individuals.length > 0) {
      this._lastFixCheck = this.elapsed;
      const geneNames = { color:'몸색', speed:'속도', poison:'독성', armor:'갑옷', charm:'매력' };
      const freq = this.player.geneFrequency();
      for (const gene of Object.keys(geneNames)) {
        const pct = freq[gene] || 0;
        // 완전 고정: 100% 우성 또는 0% 우성(=100% 열성)
        const fixed = (pct >= 100 || pct <= 0);
        if (fixed && !this._fixedGenes.has(gene)) {
          this._fixedGenes.add(gene);
          this.cameras.main.flash(400, 255, 255, 100);
          this.showMessage(`🧬 [${geneNames[gene]}] 완전 고정! 집단이 하나가 되었습니다`);
        }
      }
    }
    // Feature 2: 멸종 직전 긴장감 연출
    {
      const cnt = this.player.individuals.length;
      const nowNear = cnt > 0 && cnt <= 3;
      if (nowNear !== this._nearExtinct) {
        this._nearExtinct = nowNear;
        const cEl = document.getElementById('c-count');
        const ov  = document.getElementById('near-extinct-overlay');
        if (nowNear) {
          if (cEl) { cEl.style.color = '#ef4444'; cEl.style.fontWeight = '900'; }
          if (ov)  ov.style.background = 'radial-gradient(ellipse at center, transparent 60%, rgba(239,68,68,.35) 100%)';
        } else {
          if (cEl) { cEl.style.color = ''; cEl.style.fontWeight = ''; }
          if (ov)  ov.style.background = 'transparent';
        }
      }
    }
    // 웨이브 보스 스케줄 체크
    if (!this.tutorialActive && this.bossPhase === 'idle' && !this._waveFired && this._waveIdx < this._waveList.length && this.elapsed >= this._nextBossAt) {
      this._waveFired = true;
      const isFinal = GAME_MODE !== 'infinite' && this._waveIdx === this._waveList.length - 1;
      let bossId = this._waveList[this._waveIdx];
      if (isFinal && this._goldenConditionMet) bossId = 'golden';
      const slot = isFinal ? 'final' : 'mid';
      this.startBossWarning(bossById(bossId), slot);
      const hpMult = getDiffConfig().bossHpMult;
      const baseHp = WAVE_HP[Math.min(this._waveIdx, WAVE_HP.length - 1)];
      const infMult = GAME_MODE === 'infinite' ? (this._infiniteHpMult || 1.0) : 1.0;
      this._dueBossHp = Math.round(baseHp * hpMult * infMult);
    }
    if (this.bossPhase === 'warning') this.bossWarningTick();
    if (this.bossPhase === 'chase') this.bossChaseTick(dt);
    // 운석 멸종 이벤트 (연구소 생존 업그레이드 반영)
    const _labMB = (LAB_BUFFS && LAB_BUFFS.meteorBonus) || 0;
    if (this.elapsed >= METEOR_WARN_TIME + _labMB && !this.meteorWarned) {
      this.meteorWarned = true;
      this.startMeteorWarning();
    }
    if (GAME_MODE !== 'infinite' && this.elapsed >= METEOR_TIME + _labMB && !this.meteorActive && this.bossPhase === 'idle') {
      return this.triggerMeteor();
    }
    if (!this.player.individuals.length) return this.endGame();
    // ── 특수 이벤트 틱 ──
    if (this._specialEventLevel > 0 && !this.gameOver) this._tickSpecialEvent();
    // 진화 게이지 가득 참 → 진화 선택창 (다른 모달과 겹치지 않게 틱에서 처리)
    if (this._evoPickerQueued) this.maybeOpenEvolutionPicker();
    this.movePlayer(dt);
    for (const ai of this.aiGroups) ai.aiTick(dt);
    this.moveIndividuals(gameDt);
    this.syncSprites();
    this.drawHealthBars();
    this.collectFood();
    // 튜토리얼 중 번식 단계 항상 가능하도록 식량 최솟값 보장
    if (this.tutorialActive && this.player) {
      const _minFood = this.player.need() + 30;
      if (this.player.food < _minFood) this.player.food = _minFood;
    }
    // 튜토리얼 중엔 굶주림·지형 피해·전쟁·도태 등 사망 시스템 정지 (설명 읽다 굶어 죽는 것 방지)
    const _lethal = !this.tutorialActive;
    if (_lethal) this.applyTerrainDamage(dt);
    if (now - this.lastFoodAt >= FOOD_INTERVAL) {
      this.lastFoodAt = now;
      if (this.foods.length < 350) for (let i = 0; i < 15; i += 1) this.spawnFood();
    }
    if (_lethal && now - this.lastSurvivalAt >= SURVIVAL_INTERVAL) {
      this.lastSurvivalAt = now;
      this.survivalTick();
    }
    if (_lethal && now - this.lastBattleCheckAt >= 550) {
      this.lastBattleCheckAt = now;
      this.checkBattles();
    }
    if (_lethal) this.updateTerrainDanger(dt);
    if (now - this.lastWeatherAt >= WEATHER_INTERVAL) {
      this.lastWeatherAt = now;
      this.changeWeather();
    }
    this.updateDayNight();
    this.updateFloatTexts(dt);
    // 전투 중 적 집단 추격: 플레이어가 도망치면 따라온다 — 속도 유전자가 이탈 성패를 가름
    for (const battle of this.battles) {
      if (!battle.active || !battle.isPlayerBattle) continue;
      const enemy = battle.groupA.isPlayer ? battle.groupB : battle.groupA;
      const pdx = this.player.x - enemy.x, pdy = this.player.y - enemy.y;
      const pdist = Math.hypot(pdx, pdy) || 1;
      if (pdist > 70) {
        const chase = (enemy.average('speed') / 80) * BATTLE_PURSUIT_SPEED * (dt / 1000);
        enemy.x = clamp(enemy.x + pdx / pdist * chase, 60, WORLD_W - 60);
        enemy.y = clamp(enemy.y + pdy / pdist * chase, 60, WORLD_H - 60);
      }
    }
    // 콤보 만료 체크
    if (this.combat.combo > 0 && this.elapsed >= this.combat.comboUntil) this.combat.combo = 0;
    for (const battle of this.battles) battle.tick();
    const ended = this.battles.filter(battle => !battle.active);
    for (const battle of ended) this.handleBattleEnd(battle);
    this.battles = this.battles.filter(battle => battle.active);
    this.aiGroups = this.aiGroups.filter(group => group.individuals.length > 0);
    this.groups = [this.player, ...this.aiGroups];
    if (this.aiGroups.length < 7 && now - this.lastAiSpawnAt >= 5000) { this.lastAiSpawnAt = now; this.spawnAIGroup(); }
    this.cameraTarget.x = this.player.x;
    this.cameraTarget.y = this.player.y;
    this.drawJoystick();
    this.updateHud();
    // 집단 위기 경고 (3마리 이하)
    const aliveCount = this.player.individuals.filter(i => !i.dead).length;
    if (aliveCount > this._peakPopulation) this._peakPopulation = aliveCount;
    if (aliveCount <= 3 && !this._crisisWarned && !this.gameOver) {
      this._crisisWarned = true;
      this.cameras.main.flash(400, 220, 30, 30);
      this.showMessage('⚠️ 집단 위기! 개체가 3마리 이하\n🥚 빨리 번식하세요!', true);
    } else if (aliveCount > 5) {
      this._crisisWarned = false;
    }
  }

  movePlayer(dt) {
    // 실시간 전투: 전투·보스 교전 중에도 이동 가능 — 카이팅·회피·후퇴가 모두 플레이어 손에
    const terrain = this.terrainAt(this.player.x, this.player.y);
    const geneSpd = this.calcGeneTerrainSpeedBonus(this.player, terrain);
    const weatherSpd = this.weather ? this.weather.spdMult : 1;
    const hasteSpd = this.combatBuffActive('haste') ? 1.5 : 1; // 질주 스킬: 이동 속도 +50%
    const frostSpd = (this._bossSlowUntil && this.elapsed < this._bossSlowUntil) ? 0.55 : 1; // 빙결 노바 피격: 감속
    const speed = (this.player.average('speed') / 80) * 165 * (dt / 1000) * terrain.speed * geneSpd * weatherSpd * hasteSpd * frostSpd;
    const moveMode = getMoveMode();
    // WASD 모드에서만 키보드 방향 사용 (마우스 모드에선 WASD 이동 비활성)
    const keyX = moveMode === 'wasd' ? ((this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0)) : 0;
    const keyY = moveMode === 'wasd' ? ((this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0)) : 0;
    // 조이스틱(터치)·게임패드 왼스틱은 두 모드 모두에서 항상 동작
    const padV = GamepadInput.moveVec();
    let dirX = this.joystick.dirX + keyX + padV.x;
    let dirY = this.joystick.dirY + keyY + padV.y;

    // 마우스 이동 모드: 우클릭 유지 시 매 프레임 커서 쪽으로 목적지 갱신(LoL식 추종)
    if (moveMode === 'mouse' && this._rmbHeld && Math.hypot(dirX, dirY) < 0.05) {
      this._applyMouseMoveTarget();
    }

    // 목적지(우클릭) 이동 — 조이스틱 입력이 없을 때만
    if (this._clickTarget && Math.hypot(dirX, dirY) < 0.05) {
      const tdx = this._clickTarget.x - this.player.x;
      const tdy = this._clickTarget.y - this.player.y;
      const dist = Math.hypot(tdx, tdy);
      if (dist < speed + 4) {
        // 도착: 유지 중이 아니면 목적지 해제 (유지 중이면 다음 프레임 커서로 재설정)
        if (!this._rmbHeld) { this._clickTarget = null; this._clickMarker?.clear(); }
      } else {
        dirX = tdx / dist;
        dirY = tdy / dist;
      }
    } else if (this._clickTarget && Math.hypot(dirX, dirY) >= 0.05) {
      // 조이스틱 입력 시 목적지 취소
      this._clickTarget = null;
      this._clickMarker?.clear();
    }

    const length = Math.hypot(dirX, dirY);
    if (length > 1) {
      dirX /= length;
      dirY /= length;
    }
    this.player.x = clamp(this.player.x + dirX * speed, 54, WORLD_W - 54);
    this.player.y = clamp(this.player.y + dirY * speed, 54, WORLD_H - 54);
  }

  _drawClickMarker(wx, wy) {
    const g = this._clickMarker;
    g.clear();
    g.lineStyle(2, 0xffffff, 0.9);
    g.strokeCircle(wx, wy, 14);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeCircle(wx, wy, 6);
    // 1.2초 후 자동 소거
    this.time.delayedCall(1200, () => { if (this._clickMarker) this._clickMarker.clear(); });
  }

  moveIndividuals(dt) {
    const baseSpeed = 170 * (dt / 1000);
    for (const group of this.groups) {
      const battle = group.state === 'battle' ? this.battles.find(item => item.id === group.battleId) : null;
      for (const individual of group.individuals) {
        if (individual.dead) continue;
        if (battle && battle.active) {
          // 일반 집단전: 가장 가까운 적 개체를 향해 이동
          // 단, 집단 중심(플레이어 위치)에서 너무 멀어지면 복귀 — 플레이어 이동이 곧 부대 지휘 (후퇴·재배치)
          const cdx = group.x - individual.x;
          const cdy = group.y - individual.y;
          const cdist = Math.hypot(cdx, cdy);
          if (cdist > BATTLE_LEASH_DIST) {
            const step = Math.min(cdist, (individual.stats.speed / 80) * baseSpeed * 1.4);
            individual.x += cdx / cdist * step;
            individual.y += cdy / cdist * step;
            continue;
          }
          const foes = (battle.groupA === group ? battle.groupB.individuals : battle.groupA.individuals).filter(foe => !foe.dead);
          const target = nearest(individual, foes);
          if (!target) continue;
          const dx = target.x - individual.x;
          const dy = target.y - individual.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance > 26) {
            const step = Math.min(distance, (individual.stats.speed / 80) * baseSpeed);
            individual.x += dx / distance * step;
            individual.y += dy / distance * step;
          }
        } else {
          // 일반 이동: 집단 중심 + 랜덤 오프셋 (보스전 중에도 동일)
          const targetX = group.x + individual.offsetX;
          const targetY = group.y + individual.offsetY;
          const dx = targetX - individual.x;
          const dy = targetY - individual.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance > 5) {
            const step = Math.min(distance, (individual.stats.speed / 80) * baseSpeed * 1.35);
            individual.x += dx / distance * step;
            individual.y += dy / distance * step;
          }
          if (Math.random() < .01) {
            individual.offsetX = (Math.random() - .5) * FOLLOW_RADIUS * 2;
            individual.offsetY = (Math.random() - .5) * FOLLOW_RADIUS * 2;
          }
          // 보스 사거리 안 안전 개체: 일반 전투 쿨다운으로 보스 공격
          if (this.bossEntity && this.bossPhase === 'chase' && this.activeBoss) {
            const bDist = Math.hypot(this.bossEntity.x - individual.x, this.bossEntity.y - individual.y);
            if (bDist <= BOSS_RANGE + 120 && this.activeBoss.safe(individual, group)) {
              const now = Date.now();
              const isPlayerGrp = group.isPlayer;
              const onslaught = isPlayerGrp && this.combatBuffActive('onslaught');
              const atkCd = onslaught ? ATTACK_COOLDOWN * 0.6 : ATTACK_COOLDOWN; // 돌격: 보스전에서도 공속 +40%
              if (!individual.lastAttackAt || now - individual.lastAttackAt >= atkCd) {
                individual.lastAttackAt = now;
                const terrain = this.terrainAt(group.x, group.y);
                const bonus = Battle.calcTerrainBattleBonus(group, terrain);
                let dmg = Math.max(1, individual.stats.attack * bonus - BOSS_DEFENSE);
                if (onslaught) dmg *= 1 + 0.4 * (this.combat.power.onslaught || 1);
                if (isPlayerGrp && Math.random() < CRIT_CHANCE) dmg *= CRIT_MULT;
                this.bossEntity.hp = Math.max(0, this.bossEntity.hp - dmg);
              }
            }
          }

          // AABB 분리: 실제 스프라이트 픽셀 크기 기준 (보스전·일반 모두 적용)
          const SLIME_HW = 32, SLIME_HH = 20;
          const scaleI = clamp(0.55 + individual.stats.hp / 100 * 0.40, 0.60, 1.55);
          const hwI = SLIME_HW * scaleI, hhI = SLIME_HH * scaleI;

          const enemies = group.isPlayer ? this.aiGroups : (this.player.state !== 'battle' ? [this.player] : []);
          for (const eg of enemies) {
            if (Math.hypot(eg.x - group.x, eg.y - group.y) > 500) continue;
            for (const foe of eg.individuals) {
              const ex = individual.x - foe.x, ey = individual.y - foe.y;
              const scaleF = clamp(0.55 + foe.stats.hp / 100 * 0.40, 0.60, 1.55);
              const hwF = SLIME_HW * scaleF, hhF = SLIME_HH * scaleF;
              const overlapX = (hwI + hwF) - Math.abs(ex);
              const overlapY = (hhI + hhF) - Math.abs(ey);
              if (overlapX > 0 && overlapY > 0) {
                if (overlapX <= overlapY) {
                  individual.x += (ex >= 0 ? 1 : -1) * overlapX;
                } else {
                  individual.y += (ey >= 0 ? 1 : -1) * overlapY;
                }
              }
            }
          }
          // 보스 AABB: 텍스처 90×75 × Phaser scale 2.0 → 180×150, 반폭 90 / 반높이 75
          if (this.bossEntity) {
            const bx = individual.x - this.bossEntity.x;
            const by = individual.y - this.bossEntity.y;
            const overlapX = (hwI + 90) - Math.abs(bx);
            const overlapY = (hhI + 75) - Math.abs(by);
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX <= overlapY) {
                individual.x += (bx >= 0 ? 1 : -1) * overlapX;
              } else {
                individual.y += (by >= 0 ? 1 : -1) * overlapY;
              }
            }
          }

          // 같은 집단 peer separation: 전투 중에만 펼쳐지도록
          const SEP = group.state === 'battle' ? 36 : 0;
          if (SEP > 0) {
            for (const peer of group.individuals) {
              if (peer === individual || peer.dead) continue;
              const px = individual.x - peer.x, py = individual.y - peer.y;
              const pd = Math.hypot(px, py) || 0.01;
              if (pd < SEP) {
                const push = (SEP - pd) * 0.5;
                individual.x += (px / pd) * push;
                individual.y += (py / pd) * push;
              }
            }
          }
        }
      }
    }
  }

  syncSprites() {
    const live = new Set();
    const t = (this.elapsed || 0) / 1000;
    const sg = this.shadowGraphics;
    if (sg) { sg.clear(); sg.fillStyle(0x000000, 0.24); }
    for (const group of this.groups) {
      for (const individual of group.individuals) {
        live.add(individual.id);
        if (!this.individualSprites.has(individual.id)) this.addIndividualSprite(individual, group);
        const entry = this.individualSprites.get(individual.id);
        const bs = entry.baseScale;
        // 통통 튀는 젤리: 위로 살짝 호핑 + 사인파 스쿼시(가로↔세로)
        const s = Math.sin(t * 4.2 + entry.phase);
        const hop = Math.max(0, s);                 // 위로 솟는 구간만
        entry.sprite.x = individual.x;
        entry.sprite.y = individual.y - hop * 4 * bs;
        entry.sprite.scaleX = bs * (1 - 0.08 * s);
        entry.sprite.scaleY = bs * (1 + 0.08 * s);
        // 바닥 그림자(발밑 고정) — 점프할수록 작아져 입체감
        if (sg) sg.fillEllipse(individual.x, individual.y + 20 * bs, (30 - hop * 7) * bs, (11 - hop * 3) * bs);
      }
    }
    for (const [id, entry] of this.individualSprites.entries()) {
      if (!live.has(id)) {
        entry.sprite.destroy();
        this.individualSprites.delete(id);
      }
    }
  }

  drawHealthBars() {
    this.hpGraphics.clear();
    for (const group of this.groups) {
      for (const individual of group.individuals) {
        const ratio = individual.hp / individual.stats.hp;
        if (group.state !== 'battle' && ratio > .82) continue;
        this.hpGraphics.fillStyle(0x0f172a, .85);
        this.hpGraphics.fillRect(individual.x - 10, individual.y - 22, 20, 4);
        this.hpGraphics.fillStyle(ratio > .5 ? 0x22c55e : 0xef4444, 1);
        this.hpGraphics.fillRect(individual.x - 10, individual.y - 22, 20 * ratio, 4);
      }
    }
  }

  collectFood() {
    const weatherFood = this.weather ? this.weather.foodMult : 1;
    for (const group of this.groups) {
      if (group.state === 'battle' || !group.individuals.length) continue;
      const terrain = this.terrainAt(group.x, group.y);
      const gatherBonus = Math.max(0.2, 1 + (group.average('gather') - 5) * 0.1);
      const geneMult = this.calcGeneTerrainFoodBonus(group, terrain);
      for (let index = this.foods.length - 1; index >= 0; index -= 1) {
        const food = this.foods[index];
        if (Phaser.Math.Distance.Between(group.x, group.y, food.x, food.y) > COLLECT_RADIUS) continue;
        const gain = Math.max(1, Math.floor(food.amount * gatherBonus * terrain.food * geneMult * weatherFood));
        group.food = Math.min(FOOD_CAP, group.food + gain);
        // 플레이어 채집 연출 (진화 EXP는 전투로만 획득)
        if (group.isPlayer) {
          Audio.sfxCollect();
          this.spawnFloatText(food.x, food.y - 8, `+${gain}`, '#4e9a4a', 16);
          this.burst(food.x, food.y, 0x7cc674, 5, 30);
        }
        food.sprite.destroy();
        this.foods.splice(index, 1);
      }
    }
  }

  // 자연선택: 지형에 맞는 유전자 보유 비율에 따라 채집량 최대 +35% 보너스
  calcGeneTerrainFoodBonus(group, terrain) {
    if (!group.individuals.length) return 1;
    const n = group.individuals.length;
    const ratio = (pred) => group.individuals.filter(pred).length / n;
    switch (terrain.id) {
      case 'volcano': return 1 + ratio(i => getGenotypeLabel(i, 'color') === 'RR') * 0.35;
      case 'desert':  return 1 + ratio(i => getGenotypeLabel(i, 'color') === 'BB') * 0.35;
      case 'forest':  return 1 + ratio(i => i.hasDominant('charm')) * 0.15
                               + ratio(i => i.hasDominant('speed')) * 0.10; // 빠른 채집
      case 'snow':    return 1 + ratio(i => i.hasDominant('armor')) * 0.20;
      case 'swamp':   return 1 + ratio(i => i.hasDominant('poison')) * 0.30;
      default:        return 1;
    }
  }

  // 자연선택: 사막-BB, 눈밭-갑옷 이동 속도 보너스
  calcGeneTerrainSpeedBonus(group, terrain) {
    if (!group.individuals.length) return 1;
    const n = group.individuals.length;
    const ratio = (pred) => group.individuals.filter(pred).length / n;
    switch (terrain.id) {
      case 'desert': return 1 + ratio(i => getGenotypeLabel(i, 'color') === 'BB') * 0.20;
      case 'snow':   return 1 - ratio(i => !i.hasDominant('armor')) * 0.10;
      case 'swamp':  return 1 + ratio(i => i.hasDominant('speed')) * 0.15;
      default:       return 1;
    }
  }

  applyTerrainDamage(dt) {
    if (Math.random() > 0.25 * (dt / 1000)) return;
    for (const group of this.groups) {
      const terrain = this.terrainAt(group.x, group.y);
      if (!terrain.damage || !group.individuals.length) continue;
      const target = choose(group.individuals);
      let dmg = terrain.damage;
      // 자연선택: 유리한 형질이 지형 피해 감소
      if (terrain.id === 'swamp' && target.hasDominant('poison')) dmg = Math.ceil(dmg * 0.25); // 독성 저항
      if (terrain.id === 'volcano' && getGenotypeLabel(target, 'color') === 'RR') dmg = Math.ceil(dmg * 0.40); // 붉은 몸 화산 저항
      if (terrain.id === 'snow' && target.hasDominant('armor')) dmg = Math.ceil(dmg * 0.50); // 갑옷 눈밭 보호
      target.hp -= dmg;
      if (target.hp <= 0) target.dead = true;
      group.individuals = group.individuals.filter(individual => !individual.dead);
    }
  }

  survivalTick() {
    for (const group of this.groups) {
      if (!group.individuals.length) continue;
      const result = group.survivalTick();
      if (group.isPlayer) {
        if (result.consumed > 0) {
          this.spawnHudFloat('b-food', `-${Math.round(result.consumed)}🍓`, '#d97030');
        }
        if (result.deaths > 0) {
          Audio.sfxDeath();
          if (this.showToast) this.showToast(`💀 굶주림 ×${result.deaths}`, 'ach');
        }
      }
    }
    for (const ai of this.aiGroups) {
      if (ai.canBreed() && Math.random() < 0.48) {
        ai.breed();
        this.ensureSprites(ai);
      }
    }
    // 현재 플레이어 집단에 있는 모든 돌연변이를 획득 목록에 누적
    for (const ind of this.player.individuals) {
      for (const mutId of ind.mutations) this.gainedMutationsThisGame.add(mutId);
    }
    this.checkAchievements();
  }

  checkAchievements() {
    const g = this.player;
    const d = this.achieveData;
    // 특수 조건 갱신
    if (g.count <= 3) d.hadNeardeath = true;
    d.visitedTerrains.add(this.terrainAt(g.x, g.y).id);
    for (const ach of ACHIEVEMENTS) {
      if (this.achievements.has(ach.id)) continue;
      try {
        if (ach.check(g, this.elapsed, this.achieveData)) {
          this.achievements.add(ach.id);
          markAchUnlocked(ach.id);
          this.showToast(`🏆 ${ach.name} +${ach.bonus}`, 'ach');
          Audio.sfxAchieve();
        }
      } catch(e) { /* 안전하게 무시 */ }
    }
  }




  applyTerrainEvent(targetTerrain, event) {
    // 지형별 이벤트 횟수 누적
    this.terrainEventCount[targetTerrain.id] = (this.terrainEventCount[targetTerrain.id] || 0) + 1;
    let playerDeaths = 0;
    let totalDeaths = 0;
    let playerAffected = false;
    for (const group of this.groups) {
      if (!group.individuals.length) continue;
      const groupTerrain = this.terrainAt(group.x, group.y);
      if (groupTerrain.id !== targetTerrain.id) continue;
      playerAffected = playerAffected || group.isPlayer;

      if (event.predicate) {
        // 개체 사망 이벤트: killRate 비율만 실제 사망 (기본 60%)
        const atRisk = group.individuals.filter(i => event.predicate(i));
        if (atRisk.length) {
          const rate = event.killRate ?? 0.60;
          const n = Math.max(1, Math.round(atRisk.length * rate));
          const victims = atRisk.sort(() => Math.random() - 0.5).slice(0, n);
          const ids = new Set(victims.map(i => i.id));
          group.individuals = group.individuals.filter(i => !ids.has(i.id));
          group.terrainEventDeaths += victims.length;
          totalDeaths += victims.length;
          if (group.isPlayer) playerDeaths += victims.length;
        }
      } else if (event.foodDelta !== undefined) {
        // 식량 증감 이벤트
        group.food = clamp(group.food + event.foodDelta, 0, FOOD_CAP);
      } else if (event.foodRatio !== undefined) {
        // 식량 비율 이벤트
        group.food = Math.floor(group.food * event.foodRatio);
      }
    }

    return totalDeaths;
  }

  checkBattles() {
    for (let i = 0; i < this.groups.length; i += 1) {
      const groupA = this.groups[i];
      if (groupA.state !== 'normal' || !groupA.individuals.length) continue;
      for (let j = i + 1; j < this.groups.length; j += 1) {
        const groupB = this.groups[j];
        if (groupB.state !== 'normal' || !groupB.individuals.length) continue;
        if (Phaser.Math.Distance.Between(groupA.x, groupA.y, groupB.x, groupB.y) <= BATTLE_DISTANCE) {
          if ((groupA.isPlayer || groupB.isPlayer) && this._bossFleeGraceUntil && this.elapsed < this._bossFleeGraceUntil) continue;
          const tA = this.terrainAt(groupA.x, groupA.y);
          const tB = this.terrainAt(groupB.x, groupB.y);
          const battle = new Battle(groupA, groupB, tA, tB);
          this.battles.push(battle);
          if (groupA.isPlayer || groupB.isPlayer) {
            const enemy = groupA.isPlayer ? groupB : groupA;
            // 전투 시작은 배너·비네트·전투 펄스·효과음·화면 흔들림으로 전달 — 중앙 메시지 생략
            ContextHint.show('first_battle','⚔️','다른 집단과 전쟁이 시작됐어요!\n🧬 집단이 가진 돌연변이가 전투 스킬이 됩니다.\n잠긴 스킬(🔒)을 누르면 필요한 돌연변이를 알려줘요.\n멀리 달아나면 전투에서 이탈할 수 있어요!');
            document.getElementById('battle-banner').style.display = 'block';
            document.getElementById('battle-vignette').classList.add('active');
            document.getElementById('combat-pulse').classList.add('active');
            Audio.sfxBattle();
            this.cameras.main.shake(250, 0.008);
            battle.onHit = (x, y) => this.spawnHitEffect(x, y);
          }
        }
      }
    }
    const playerInBattle = this.battles.some(battle => battle.active && (battle.groupA.isPlayer || battle.groupB.isPlayer));
    if (!playerInBattle) {
      document.getElementById('battle-banner').style.display = 'none';
      document.getElementById('battle-vignette').classList.remove('active');
      document.getElementById('combat-pulse').classList.remove('active');
    }
  }

  handleBattleEnd(battle) {
    if (battle.groupA.isPlayer || battle.groupB.isPlayer) {
      // 거리 이탈: 승패 없이 전투 종료 — 식량 손실 없음, 잠시 재교전 유예
      if (battle.endReason === 'disengage') {
        this.player.escapes += 1; // 거리 이탈 = 도망 (도전과제 집계)
        this._bossFleeGraceUntil = this.elapsed + 2500;
        document.getElementById('battle-banner').style.display = 'none';
        document.getElementById('battle-vignette').classList.remove('active');
        document.getElementById('combat-pulse').classList.remove('active');
        // 이탈은 배너·비네트가 사라지는 것으로 전달 — 메시지 생략
        return;
      }
      const pgIsA  = battle.groupA.isPlayer;
      const pg     = pgIsA ? battle.groupA : battle.groupB;
      // battle 객체에 기록된 이 전투만의 포섭 수 사용 (group 카운터는 리셋되어 부정확)
      const pgRec  = pgIsA ? battle.recruitsA : battle.recruitsB;
      const envRec = pgIsA ? battle.recruitsB : battle.recruitsA;
      const won  = battle.winner === pg;
      const draw = !battle.winner;

      // 화산지대 승리 조건 기록
      if (won && this.terrainAt(pg.x, pg.y).id === 'volcano') {
        this.achieveData.volcanoWin = true;
      }

      let result = draw ? '🤝 무승부' : (won ? '⚔️ 전쟁 승리!' : '💀 전쟁 패배');
      const details = [];
      if (pgRec  > 0) details.push(`포섭 +${pgRec} 🤝`);
      if (envRec > 0) details.push(`빼앗김 -${envRec} 😢`);
      if (won) {
        details.push('식량 획득 🌾');
        // 포식 보상: 전쟁 승리 = 진화 EXP
        this.gainEvoExp(EVO_BATTLE_EXP);
        details.push(`진화 +${EVO_BATTLE_EXP} 🧬`);
      }
      this.showMessage(details.length ? `${result}\n${details.join(' · ')}` : result);
      document.getElementById('battle-banner').style.display = 'none';
      document.getElementById('battle-vignette').classList.remove('active');
      document.getElementById('combat-pulse').classList.remove('active');
      // 연출
      if (won) { Audio.sfxWin(); this.burst(this.player.x, this.player.y, 0xffd97d, 16, 90); this.cameras.main.flash(180, 255, 240, 180); }
      else if (!draw) { Audio.sfxLose(); this.cameras.main.shake(300, 0.012); }
      if (pgRec > 0) Audio.sfxRecruit();
      // Feature 3: 전쟁 승리 후 패배 집단 영입 옵션
      if (won && !draw) {
        const loserGroup = pgIsA ? battle.groupB : battle.groupA;
        const survivors = loserGroup.individuals.filter(i => !i.dead);
        if (survivors.length > 0) {
          window._pendingRecruit = { group: loserGroup, count: survivors.length, scene: this };
          showRecruit(loserGroup, survivors.length);
        }
      }
    }
  }

  spawnAIGroup() {
    const edgePoints = [
      [Math.random() * WORLD_W, 80],
      [Math.random() * WORLD_W, WORLD_H - 80],
      [80, Math.random() * WORLD_H],
      [WORLD_W - 80, Math.random() * WORLD_H]
    ];
    const [x, y] = choose(edgePoints);
    const ai = new Group(x, y, false, `AI-${nextGroupId + 1}`);
    this.initGroup(ai, 8 + Math.floor(Math.random() * 8));
    this.aiGroups.push(ai);
    this.groups.push(ai);
    this.ensureSprites(ai);
  }

  handleBreed() {
    if (!this.player.canBreed()) {
      // 실패 이유 피드백
      const g = this.player;
      const bc = LAB_BUFFS ? Math.max(1, Math.round(10 * LAB_BUFFS.breedCostMult)) : 10;
      const minFood = bc * 10;
      let reason = '';
      if (g.state !== 'normal') reason = '⚔️ 전투 중 번식 불가 — 멀리 이동해 전투에서 이탈하세요';
      else if (g.count < 5) reason = `👥 개체 5마리 필요 (현재 ${g.count}마리)`;
      else if (g.surplus() < minFood) reason = `🍖 식량 부족 (필요 ${minFood}, 현재 ${Math.floor(g.food)})`;
      else if (g.count >= g._maxPop()) reason = `🏟️ 개체 한도 초과 (최대 ${g._maxPop()}마리)`;
      if (reason) this.showToast(reason, 'warn');
      return;
    }
    // 첫 돌연변이 보장: 3번 연속으로 돌연변이 없으면 다음 번식 때 확정 발생
    if (this._breedsWithoutMutation >= 3 && this.gainedMutationsThisGame.size === 0) {
      this.player._guaranteeNextMutation = true;
    }
    const before = this.player.individuals.length;
    const count = this.player.breed();
    for (let i = before; i < this.player.individuals.length; i += 1) this.addIndividualSprite(this.player.individuals[i], this.player);
    this.player._guaranteeNextMutation = false;
    const gained = this.player.lastGainedMutations || [];
    const pending = this.player._pendingMutChildren || [];
    this.player._pendingMutChildren = [];
    if (gained.length > 0 || pending.length > 0) { this._breedsWithoutMutation = 0; } else { this._breedsWithoutMutation++; }
    // 번식 카운트 토스트(🥚 +N)는 잦아서 생략 — 개체수 HUD·출생 이펙트·효과음으로 전달
    Audio.sfxBreed();
    ContextHint.show('first_breed','🥚','자손이 태어났어요!\n부모의 특성을 물려받고\n가끔 돌연변이로 새 능력이 생겨요.\n🔬 돌연변이가 쌓일수록 집단이 강해집니다!');
    this.burst(this.player.x, this.player.y, 0xffb4a2, 12, 70);
    // 멘델 재조합으로 새로 발현된 형질 토스트
    gained.forEach((id, i) => {
      const m = mutationById(id);
      if (!m) return;
      const ico = m.type === 'good' ? '✅' : m.type === 'bad' ? '❌' : '🔵';
      setTimeout(() => this.showToast(`🧬 ${ico} ${m.name}`, 'mut'), i * 350);
    });
    // 신규 돌연변이가 발생했다면 플레이어가 정체를 선택 (건너뛰기 = 무작위)
    if (pending.length > 0) showBreedMutationPicker(this, pending);
  }

  // 선택창 결과 적용: 대기 중인 자손들에게 선택한 돌연변이(또는 무작위)를 발현
  _applyBreedMutation(children, chosenId) {
    const gained = [];
    for (const child of children) {
      let slots = child._pendingNewMut || 0;
      child._pendingNewMut = 0;
      let preferred = chosenId;
      while (slots-- > 0) {
        let pick = null;
        if (preferred && !(child.mutationGenes[preferred] && child.mutationGenes[preferred].includes('M'))) {
          pick = preferred;
        } else {
          const avail = MUTATIONS.filter(m => !(child.mutationGenes[m.id] && child.mutationGenes[m.id].includes('M')));
          if (!avail.length) break;
          pick = choose(avail).id;
        }
        preferred = null; // 선택 형질은 자손당 1슬롯
        const existing = child.mutationGenes[pick] || ['m', 'm'];
        const idx = existing.indexOf('m');
        if (idx >= 0) existing[idx] = 'M';
        child.mutationGenes[pick] = existing;
        if (!child.newlyGained.includes(pick)) child.newlyGained.push(pick);
        if (!gained.includes(pick)) gained.push(pick);
      }
      child.stats = child.calculateStats();
      child.hp = child.stats.hp;
      // 시그니처 돌연변이는 외형에 반영 — 스프라이트 재생성
      const entry = this.individualSprites.get(child.id);
      if (entry) { entry.sprite.destroy(); this.individualSprites.delete(child.id); }
    }
    this.ensureSprites(this.player);
    if (!this.player.lastGainedMutations) this.player.lastGainedMutations = [];
    for (const id of gained) {
      if (!this.player.lastGainedMutations.includes(id)) this.player.lastGainedMutations.push(id);
      this.gainedMutationsThisGame.add(id);
    }
    gained.forEach((id, i) => {
      const m = mutationById(id);
      if (!m) return;
      const ico = m.type === 'good' ? '✅' : m.type === 'bad' ? '❌' : '🔵';
      setTimeout(() => this.showToast(`🧬 ${ico} ${m.name}`, 'mut'), i * 350);
    });
  }

  _isInBattle() {
    if (this.player.state === 'battle') return true;
    // 보스 chase 중이라도 실제 교전 사거리 안일 때만 전투로 간주 → 멀면 번식 가능
    if (this.bossPhase === 'chase' && this.bossInCombat) return true;
    return false;
  }

  // 도망 버튼 제거 — 후퇴는 오직 이동(거리 이탈)으로. 버튼·키는 항상 번식
  handleAction() {
    this.handleBreed();
  }

  // ── 실시간 전투 스킬 ──────────────────────────────────
  combatBuffActive(id) {
    return !!this.combat && this.elapsed < (this.combat.activeUntil[id] || 0);
  }

  useCombatSkill(id) {
    const def = COMBAT_SKILLS[id];
    if (!def || this.gameOver || _paused || !this._isInBattle()) return;
    const alive = this.player.individuals.filter(i => !i.dead);
    // 돌연변이 해금 검사: 계열 돌연변이 보유 개체가 있어야 사용 가능
    const carriers = combatSkillCarriers(this.player, id);
    if (carriers <= 0) {
      this.showToast(`🔒 ${def.ico} ${def.name} — 필요 돌연변이: ${combatSkillReqText(id)}`, 'warn');
      return;
    }
    const c = this.combat;
    if (this.elapsed < (c.cdUntil[id] || 0)) return;
    c.cdUntil[id] = this.elapsed + def.cd;
    if (def.dur > 0) c.activeUntil[id] = this.elapsed + def.dur;
    // 보유 비율에 따라 강해짐: ×1.0(소수 보유) ~ ×1.5(전원 보유)
    const power = 1 + 0.5 * (carriers / Math.max(1, alive.length));
    c.power[id] = power;
    // 스킬 발동 피드백은 시각 이펙트·효과음·스킬바 버프 표시로 전달 (토스트 생략 — 화면 정리)
    if (id === 'onslaught') {
      this.burst(this.player.x, this.player.y, 0xff6b35, 18, 110);
      this.cameras.main.flash(120, 255, 120, 60, false);
      Audio.sfxBattle();
    } else if (id === 'rally') {
      this.burst(this.player.x, this.player.y, 0x7cc674, 18, 110);
      Audio.sfxRecruit();
    } else if (id === 'heal') {
      const ratio = 0.25 * power;
      for (const ind of alive) ind.hp = Math.min(ind.stats.hp, ind.hp + ind.stats.hp * ratio);
      this.burst(this.player.x, this.player.y, 0xff9ec4, 22, 130);
      this.cameras.main.flash(120, 160, 255, 170, false);
      Audio.sfxRecruit();
    } else if (id === 'haste') {
      this.burst(this.player.x, this.player.y, 0xffe066, 16, 100);
      Audio.sfxCollect();
    } else if (id === 'fear') {
      // 주변 적 밀쳐내기 (지속 공속 감소는 Battle.attack/보스 틱에서 처리)
      for (const battle of this.battles) {
        if (!battle.active || !battle.isPlayerBattle) continue;
        const enemy = battle.groupA.isPlayer ? battle.groupB : battle.groupA;
        for (const foe of enemy.individuals) {
          if (foe.dead) continue;
          const fdx = foe.x - this.player.x, fdy = foe.y - this.player.y;
          const fd = Math.hypot(fdx, fdy);
          if (fd > 340) continue;
          const kn = 70 * power;
          foe.x = clamp(foe.x + fdx / (fd || 1) * kn, 20, WORLD_W - 20);
          foe.y = clamp(foe.y + fdy / (fd || 1) * kn, 20, WORLD_H - 20);
        }
      }
      this.burst(this.player.x, this.player.y, 0xc49ee0, 24, 200);
      this.cameras.main.shake(180, 0.008);
      Audio.sfxBattle();
    } else if (id === 'burst') {
      const avgAtk = this.player.average('attack');
      let kills = 0, hits = 0;
      // 주변 적 개체 피해 + 넉백
      for (const battle of this.battles) {
        if (!battle.active || !battle.isPlayerBattle) continue;
        const enemy = battle.groupA.isPlayer ? battle.groupB : battle.groupA;
        for (const foe of enemy.individuals) {
          if (foe.dead) continue;
          const fdx = foe.x - this.player.x, fdy = foe.y - this.player.y;
          const fd = Math.hypot(fdx, fdy);
          if (fd > 300) continue;
          hits++;
          foe.takeHit((avgAtk * 2.5 + 12) * power);
          const kn = 55;
          foe.x = clamp(foe.x + fdx / (fd || 1) * kn, 20, WORLD_W - 20);
          foe.y = clamp(foe.y + fdy / (fd || 1) * kn, 20, WORLD_H - 20);
          this.spawnHitEffect(foe.x, foe.y);
          if (foe.dead) { kills++; this.registerPlayerKill(foe.x, foe.y); }
        }
        enemy.individuals = enemy.individuals.filter(i => !i.dead);
      }
      // 보스에게도 유효
      if (this.bossEntity && this.bossPhase === 'chase') {
        const bd = Math.hypot(this.bossEntity.x - this.player.x, this.bossEntity.y - this.player.y);
        if (bd <= 500) {
          const bossDmg = Math.round(avgAtk * Math.max(6, alive.length * 0.8) * power);
          this.bossEntity.hp = Math.max(0, this.bossEntity.hp - bossDmg);
          this.spawnFloatText(this.bossEntity.x, this.bossEntity.y - 60, `💥 ${bossDmg}`, '#ffd97d', 20);
          hits++;
        }
      }
      this.burst(this.player.x, this.player.y, 0x8de3ff, 30, 300);
      this.cameras.main.shake(250, 0.012);
      if (Audio.sfxQuake) Audio.sfxQuake();
    }
    this.updateSkillBar();
  }

  // 플레이어 개체가 적을 처치 — 콤보 증가 + 진화 EXP (콤보가 높을수록 추가 EXP)
  registerPlayerKill(x, y) {
    const c = this.combat;
    c.combo += 1;
    c.comboUntil = this.elapsed + COMBO_WINDOW;
    if (c.combo > c.bestCombo) c.bestCombo = c.combo;
    const bonus = Math.min(10, Math.floor(c.combo / 3));
    this.gainEvoExp(EVO_KILL_EXP + bonus);
    const label = c.combo >= 2 ? `+${EVO_KILL_EXP + bonus} 🧬 🔥${c.combo}` : `+${EVO_KILL_EXP} 🧬`;
    if (this.spawnFloatText) this.spawnFloatText(x, y - 12, label, c.combo >= 5 ? '#ff9440' : '#9b6fc4', c.combo >= 5 ? 16 : 14);
  }

  // 스킬바 표시/쿨다운/잠금 갱신 (updateHud에서 호출)
  updateSkillBar() {
    const bar = document.getElementById('skill-bar');
    if (!bar) return;
    const show = !this.gameOver && this._isInBattle();
    bar.classList.toggle('show', show);
    if (!show) return;
    for (const [id, def] of Object.entries(COMBAT_SKILLS)) {
      const btn = document.getElementById(`sk-${id}`);
      const cdEl = document.getElementById(`skcd-${id}`);
      if (!btn || !cdEl) continue;
      // 돌연변이 미보유 → 잠금 표시
      const carriers = combatSkillCarriers(this.player, id);
      const locked = carriers <= 0;
      btn.classList.toggle('locked', locked);
      const _k = skillKeyFor(id);
      btn.title = locked
        ? `${def.name} (${_k}) 🔒 필요 돌연변이: ${combatSkillReqText(id)}`
        : `${def.name} (${_k}): ${def.desc} — 보유 ${carriers}마리`;
      if (locked) {
        btn.classList.remove('cooling', 'buff-on');
        cdEl.textContent = '';
        continue;
      }
      const remain = (this.combat.cdUntil[id] || 0) - this.elapsed;
      if (remain > 0) {
        btn.classList.add('cooling');
        cdEl.textContent = Math.ceil(remain / 1000);
      } else {
        btn.classList.remove('cooling');
        cdEl.textContent = '';
      }
      btn.classList.toggle('buff-on', this.combatBuffActive(id));
    }
  }

  // ── 진화 게이지 ──────────────────────────────────────
  gainEvoExp(amount) {
    if (this.gameOver || !(amount > 0)) return;
    this.evoExp += amount;
    if (this.evoExp >= evoExpNeedFor(this.evoLevel)) this._evoPickerQueued = true;
  }

  // 게이지가 가득 찼고 다른 모달이 없으면 진화 선택창 열기 (tick에서 호출)
  maybeOpenEvolutionPicker() {
    if (!this._evoPickerQueued || this.gameOver || this.tutorialActive) return;
    if (document.getElementById('mutation-picker').classList.contains('open')) return;
    if (this.evoExp < evoExpNeedFor(this.evoLevel)) { this._evoPickerQueued = false; return; }
    this._evoPickerQueued = false;
    // 선택창 OFF 옵션: 무작위 후보 자동 발현
    if (Save.get('gpa_mutpick_off') === '1') {
      const auto = rollEvolutionCandidates(this.player, 1)[0];
      if (auto) { this._applyEvolution(auto); return; }
    }
    if (!showEvolutionPicker(this)) {
      // 후보 없음(완전 진화) — 레벨만 올리고 게이지 소모
      this.evoExp -= evoExpNeedFor(this.evoLevel);
      this.evoLevel += 1;
      if (this.achieveData) this.achieveData.evoLevel = this.evoLevel;
    }
  }

  // 선택한 형질을 살아있는 집단 전체에 발현 (동형접합 MM → 자손에게 항상 유전)
  _applyEvolution(mid) {
    const m = mutationById(mid);
    if (!m) return;
    this.evoExp -= evoExpNeedFor(this.evoLevel);
    this.evoLevel += 1;
    if (this.achieveData) this.achieveData.evoLevel = this.evoLevel;
    for (const ind of this.player.individuals) {
      if (ind.dead) continue;
      ind.mutationGenes[mid] = ['M', 'M'];
      ind.stats = ind.calculateStats();
      ind.hp = Math.min(ind.hp, ind.stats.hp);
    }
    this.gainedMutationsThisGame && this.gainedMutationsThisGame.add(mid);
    this.refreshGroupTextures(this.player);
    const ico = m.type === 'good' ? '✅' : m.type === 'bad' ? '❌' : '🔵';
    this.showToast(`✨ Lv.${this.evoLevel} 집단 진화! ${ico} ${m.name}`, 'mut');
    this.showMessage(`✨ 집단 진화 — 모든 개체가 [${m.name}]을(를) 얻었습니다`);
    this.cameras.main.flash(350, 220, 180, 255);
    this.burst(this.player.x, this.player.y, 0xc49ee0, 22, 110);
    Audio.sfxAchieve();
    this._checkGoldenCondition && this._checkGoldenCondition();
    ContextHint.show('first_evolution', '✨', '집단 진화!\n선택한 형질이 모든 개체에 발현되고\n자손에게도 물려집니다.\n⚔️ 전투에서 이길수록 게이지가 빨리 차요!');
  }

  // 돌연변이 발현 후 외형 갱신: 스프라이트를 새 텍스처로 재생성
  refreshGroupTextures(group) {
    for (const ind of group.individuals) {
      const entry = this.individualSprites.get(ind.id);
      if (!entry) continue;
      entry.sprite.destroy();
      this.individualSprites.delete(ind.id);
    }
    this.ensureSprites(group);
  }

  drawJoystick() {
    const joy = this.joystick;
    if (!joy.active) return;
    this.updateJoystickDom();
  }

  // 현재 대립유전자(우성) 빈도 스냅샷을 시계열에 기록
  recordAlleleSnapshot() {
    if (!this.alleleHistory) return;
    if (!this.player.individuals.length) return; // 전멸 시점엔 빈도 0 왜곡 → 직전 값 유지
    const f = this.player.geneFrequency();
    this.alleleHistory.push({
      t: this.elapsed || 0,
      color: f.color || 0, speed: f.speed || 0, poison: f.poison || 0,
      armor: f.armor || 0, charm: f.charm || 0,
      pop: this.player.count,
    });
  }

  // 월드에서 지정 지형의 가장 가까운 좌표(근사) — 기존 terrainAt 샘플링. 없으면 null
  nearestTerrainOf(terrainId) {
    let best = null, bestD = Infinity;
    const step = 320;
    for (let wy = step/2; wy < WORLD_H; wy += step) {
      for (let wx = step/2; wx < WORLD_W; wx += step) {
        const t = this.terrainAt(wx, wy);
        if (!t || t.id !== terrainId) continue;
        const d = (wx - this.player.x)**2 + (wy - this.player.y)**2;
        if (d < bestD) { bestD = d; best = { x: wx, y: wy }; }
      }
    }
    return best;
  }

  // 가장 가까운 대피 지형 방향으로 화면 가장자리 화살표 갱신
  updateBossArrow(_boss) {
    document.getElementById('boss-arrow').classList.remove('show');
  }

  // 경고 단계 매 프레임: 카운트다운 + 대비도 + 화살표, 종료 시 보스 소환
  bossWarningTick() {
    const boss = this.activeBoss;
    const remain = Math.max(0, Math.floor((this.bossPhaseUntil - this.elapsed)/1000));
    const g = this.player, n = g.individuals.length || 1;
    const safeCnt = g.individuals.filter(i => boss.safe(i, g)).length;
    const ready = Math.round(safeCnt / n * 100);
    const readyCol = ready >= 80 ? '#4ade80' : ready >= 50 ? '#fbbf24' : '#f87171';
    const banner = document.getElementById('boss-banner');
    document.getElementById('boss-banner-text').innerHTML = `${boss.ico} <b>${boss.name}</b> ${remain}초 후 출현!<br>요구: <b>${boss.reqText}</b><br>🛡 안전 <b style="color:${readyCol}">${safeCnt}/${n} (${ready}%)</b> — 조건 미충족 개체는 도태!`;
    if (this.elapsed >= this.bossPhaseUntil) this.spawnBoss();
  }

  spawnBoss() {
    const boss = this.activeBoss;
    document.getElementById('boss-banner').classList.remove('show');
    document.getElementById('boss-arrow').classList.remove('show');
    // 화면 밖 가장자리에서 등장
    const ang = Math.random()*Math.PI*2;
    const sx = this.player.x + Math.cos(ang)*900;
    const sy = this.player.y + Math.sin(ang)*900;
    const sprite = this.add.image(sx, sy, this.createBossTexture(boss.id)).setOrigin(0.5).setDepth(20).setScale(2.0);
    const shadow = this.add.ellipse(sx, sy + 10, 90, 28, 0x000000, 0.35).setDepth(18);
    const hpMax = this._dueBossHp || 2500;
    this.bossEntity = { x:sx, y:sy, hp:hpMax, hpMax, sprite, shadow, lastAttackAt: 0,
      moveState:'charge', chargeTimer:0, chargeDuration: 1200 + Math.random()*400,
      jumpStart:null, jumpTarget:null, jumpProgress:0, jumpDuration:0, jumpHeight:160,
      nextSpecialAt: this.elapsed + BOSS_SPECIAL_FIRST_AT * (getDiffConfig().bossSpecialMult || 1), special: null, _lastSpecial: null, phase2: false };
    this._bossPools = [];      // 독 웅덩이 잔류 지대
    this._bossSlowUntil = 0;   // 빙결 노바 이동 감속 만료 시각
    if (!this.bossFx) this.bossFx = this.add.graphics().setDepth(19);
    const _hpFill = document.getElementById('boss-hp-fill');
    if (_hpFill) _hpFill.style.background = ''; // 이전 보스의 2페이즈 색 초기화
    this._bossSpawnCount = this.player.individuals.length;
    this._bossSpawnTime  = this.elapsed;
    this.bossPhase = 'chase';
    this.bossPhaseUntil = this.elapsed + (this.bossSlot === 'final' ? (METEOR_TIME + ((LAB_BUFFS&&LAB_BUFFS.meteorBonus)||0) - this.elapsed) : BOSS_RETREAT_TIME);
    document.getElementById('boss-hp').classList.add('show');
    // 출현은 보스 등장·HP바·화면 흔들림·상단 배너 전환으로 전달 — 중앙 팝업 생략(첫 보스만 힌트)
    ContextHint.show('first_boss','👹','거대 보스가 당신 집단만 노려요!\n조이스틱으로 도망 다니며(⚡질주 스킬 유용) 🥚 번식하세요.\n🔬 도감 > 보스 탭에서 안전 조건을 확인하세요.');
    this.recordAlleleSnapshot();
    if (navigator.vibrate) navigator.vibrate(120);
    this.cameras.main.shake(400, 0.01);
  }

  // 2페이즈 돌입: 복합·최종·히든 보스 전용 강화 상태
  _enterBossPhase2(b) {
    b.phase2 = true;
    b.nextSpecialAt = Math.min(b.nextSpecialAt, this.elapsed + 2500); // 곧바로 특수 패턴
    this.showMessage(`🔥 ${this.activeBoss.name} 2페이즈! 더 빠르고 강해집니다`, true);
    // 중복 토스트 제거 — 중앙 메시지 + 붉은 섬광·오라로 충분
    ContextHint.show('boss_phase2', '🔥', '보스가 2페이즈에 돌입했어요!\n여러 특수 패턴을 번갈아 쓰고\n공격이 훨씬 빨라집니다. 집중하세요!');
    this.cameras.main.shake(500, 0.03);
    this.cameras.main.flash(250, 255, 80, 30, false);
    this.burst(b.x, b.y, 0xff3020, 26, 150);
    if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    if (Audio.sfxMeteor) Audio.sfxMeteor();
    const fill = document.getElementById('boss-hp-fill');
    if (fill) fill.style.background = 'linear-gradient(90deg,#ff7a1a,#ff2020)';
  }

  // 특수 패턴 시작: 텔레그래프 상태로 전환
  _startBossSpecial(b) {
    const own = BOSS_PATTERNS[this.activeBoss.id] || 'shockwave';
    // 'all'(최종·히든): 전 패턴 무작위 / 2페이즈: 고유 패턴 + 보조 패턴(충격파·돌진) 교대
    let pool;
    if (own === 'all') pool = BOSS_SPECIAL_ALL;
    else if (b.phase2) pool = [own, (own === 'dash' || own === 'multi_dash') ? 'shockwave' : 'dash'];
    else pool = [own];
    const avail = pool.length > 1 ? pool.filter(t => t !== b._lastSpecial) : pool;
    const type = choose(avail);
    b._lastSpecial = type;
    b.moveState = 'special_warn';
    b.special = { type, fireAt: this.elapsed + BOSS_SPECIAL_WARN };
    const sp = b.special;
    if (type === 'dash' || type === 'multi_dash') {
      this._aimBossDash(b, sp);
      if (type === 'multi_dash') sp.chain = b.phase2 ? 2 : 1; // 추가 돌진 횟수
    } else if (type === 'eruption') {
      sp.zones = this._rollBossZones(b.phase2 ? 5 : 4, 110);
    } else if (type === 'poison_pools') {
      sp.zones = this._rollBossZones(b.phase2 ? 4 : 3, 95);
    }
    const def = BOSS_SPECIAL_DEFS[type];
    // 특수공격 예고는 화면의 붉은 텔레그래프(범위/선)와 효과음으로 전달 — 매번 뜨던 '준비!' 토스트 생략
    // 첫 특수공격 때만 1회성 힌트로 회피 방법 안내
    ContextHint.show('boss_special', '⚠️', `보스가 특수 공격을 준비해요!\n${def.hint}!`);
    if (Audio.sfxBattle) Audio.sfxBattle();
  }

  // 돌진 목표선 계산 (플레이어 방향 관통)
  _aimBossDash(b, sp) {
    const dx = this.player.x - b.x, dy = this.player.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const len = Math.min(750, d + 260);
    sp.tx = clamp(b.x + dx / d * len, 60, WORLD_W - 60);
    sp.ty = clamp(b.y + dy / d * len, 60, WORLD_H - 60);
  }

  // 폭격·웅덩이 낙하 지점: 살아있는 플레이어 개체 주변에 뿌리기
  _rollBossZones(n, r) {
    const alive = this.player.individuals.filter(i => !i.dead);
    const zones = [];
    for (let k = 0; k < n; k++) {
      const t = alive.length ? choose(alive) : this.player;
      zones.push({
        x: clamp(t.x + (Math.random() - 0.5) * 220, 40, WORLD_W - 40),
        y: clamp(t.y + (Math.random() - 0.5) * 220, 40, WORLD_H - 40),
        r,
      });
    }
    return zones;
  }

  // 특수 패턴 종료 공통 처리: 대기 상태 복귀 + 난이도 배율 쿨다운
  _bossSpecialDone(b) {
    b.moveState = 'charge';
    b.chargeTimer = 0;
    b.chargeDuration = (1400 + Math.random() * 600) * (b.phase2 ? PHASE2_CHARGE_MULT : 1);
    b.nextSpecialAt = this.elapsed + this._bossSpecialCd(b);
  }

  // 특수 패턴 쿨다운: 난이도가 높을수록 자주 사용 (일반 ×1 → 심연 ×0.5)
  _bossSpecialCd(b) {
    const diffMult = getDiffConfig().bossSpecialMult || 1;
    return (BOSS_SPECIAL_CD + Math.random() * 3000) * diffMult * (b.phase2 ? PHASE2_SPECIAL_CD_MULT : 1);
  }

  // 텔레그래프 종료: 패턴별 발동
  _fireBossSpecial(b) {
    const sp = b.special;
    const boss = this.activeBoss;
    const aliveHit = (pred, mult) => {
      let kills = 0, hits = 0;
      for (const i of this.player.individuals) {
        if (i.dead || !pred(i)) continue;
        hits++;
        if (this._applyBossHit(i, boss.safe(i, this.player), mult)) kills++;
      }
      this.player.individuals = this.player.individuals.filter(i => !i.dead);
      return { kills, hits };
    };
    // 특수공격 결과는 폭발 이펙트·화면 흔들림·개체 도태로 시각 전달 — 매번 뜨던 결과 토스트 생략

    if (sp.type === 'shockwave') {
      aliveHit(i => Math.hypot(i.x - b.x, i.y - b.y) <= SHOCKWAVE_RADIUS, 0.9);
      this.burst(b.x, b.y, 0xff5030, 30, SHOCKWAVE_RADIUS * 0.8);
      this.cameras.main.shake(450, 0.04);
      this.cameras.main.flash(120, 255, 60, 40, false);
      if (navigator.vibrate) navigator.vibrate(200);
      if (Audio.sfxQuake) Audio.sfxQuake();
      this._bossSpecialDone(b);

    } else if (sp.type === 'eruption') {
      // 용암 폭격: 예고된 지점 전부 동시 폭발
      for (const z of sp.zones) {
        aliveHit(i => Math.hypot(i.x - z.x, i.y - z.y) <= z.r, 0.85);
        this.burst(z.x, z.y, 0xff7a1a, 14, z.r * 0.8);
      }
      this.cameras.main.shake(400, 0.03);
      if (navigator.vibrate) navigator.vibrate(160);
      if (Audio.sfxQuake) Audio.sfxQuake();
      this._bossSpecialDone(b);

    } else if (sp.type === 'frost_nova') {
      // 빙결 노바: 피해는 낮지만 맞으면 집단 이동 속도 감소 (파란 섬광으로 전달)
      const r = aliveHit(i => Math.hypot(i.x - b.x, i.y - b.y) <= FROST_NOVA_RADIUS, 0.45);
      if (r.hits) this._bossSlowUntil = this.elapsed + 5000;
      this.burst(b.x, b.y, 0x9adfff, 26, FROST_NOVA_RADIUS * 0.7);
      this.cameras.main.flash(150, 120, 190, 255, false);
      if (navigator.vibrate) navigator.vibrate(140);
      if (Audio.sfxQuake) Audio.sfxQuake();
      this._bossSpecialDone(b);

    } else if (sp.type === 'poison_pools') {
      // 독 웅덩이: 잔류 지대 생성 — 밟고 있으면 지속 피해 (보라색 웅덩이로 시각 전달)
      for (const z of sp.zones) {
        this._bossPools.push({ ...z, until: this.elapsed + 6500 });
        this.burst(z.x, z.y, 0xa040f0, 10, z.r * 0.7);
      }
      if (navigator.vibrate) navigator.vibrate(120);
      this._bossSpecialDone(b);

    } else if (sp.type === 'pull') {
      // 유혹의 손짓: 범위 내 개체를 보스 곁으로 끌어당김 + 소량 피해
      for (const i of this.player.individuals) {
        if (i.dead) continue;
        const dx = i.x - b.x, dy = i.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d > PULL_RADIUS || d < 10) continue;
        const nd = Math.max(90, d * 0.3); // 보스 바로 앞까지 끌려옴
        i.x = b.x + dx / d * nd;
        i.y = b.y + dy / d * nd;
        this._applyBossHit(i, boss.safe(i, this.player), 0.3);
      }
      this.player.individuals = this.player.individuals.filter(i => !i.dead);
      this.burst(b.x, b.y, 0xff6ad8, 24, 180);
      this.cameras.main.shake(300, 0.02);
      if (navigator.vibrate) navigator.vibrate(150);
      if (Audio.sfxBattle) Audio.sfxBattle();
      this._bossSpecialDone(b);

    } else {
      // dash · multi_dash: 관통 돌진 개시 (완료 처리는 dashing 상태에서)
      b.moveState = 'dashing';
      sp.sx = b.x; sp.sy = b.y;
      sp.progress = 0;
      sp.hit = new Set();
      sp.kills = 0;
      if (Audio.sfxQuake) Audio.sfxQuake();
    }
  }

  bossChaseTick(dt) {
    const b = this.bossEntity; if (!b) return;
    if (this.bossFx) this.bossFx.clear();
    // 특수 상태 중에도 슬라임 공격으로 죽을 수 있음
    if (b.hp <= 0) { this.resolveBoss(true); return; }

    // 2페이즈 돌입 체크 (복합·최종·히든 보스, HP 50% 이하)
    if (!b.phase2 && bossHasPhase2(this.activeBoss) && b.hp <= b.hpMax * PHASE2_HP_RATIO) {
      this._enterBossPhase2(b);
    }
    // 2페이즈 오라: 보스 발밑에 맥동하는 붉은 기운
    if (b.phase2 && this.bossFx) {
      const pulse = 0.22 + 0.10 * Math.sin(this.elapsed / 140);
      this.bossFx.fillStyle(0xff3020, pulse);
      this.bossFx.fillEllipse(b.x, b.y + 12, 150, 52);
    }

    // 독 웅덩이: 잔류 표시 + 밟고 있는 개체에게 틱 피해
    if (this._bossPools && this._bossPools.length) {
      this._bossPools = this._bossPools.filter(p => this.elapsed < p.until);
      if (this.bossFx) {
        for (const p of this._bossPools) {
          this.bossFx.fillStyle(0xa040f0, 0.18 + 0.06 * Math.sin(this.elapsed / 120));
          this.bossFx.fillCircle(p.x, p.y, p.r);
          this.bossFx.lineStyle(2, 0xc070ff, 0.8);
          this.bossFx.strokeCircle(p.x, p.y, p.r);
        }
      }
      if (!this._bossPoolNextTick || this.elapsed >= this._bossPoolNextTick) {
        this._bossPoolNextTick = this.elapsed + 450;
        let poolHits = 0;
        for (const i of this.player.individuals) {
          if (i.dead) continue;
          if (this._bossPools.some(p => Math.hypot(i.x - p.x, i.y - p.y) <= p.r)) {
            this._applyBossHit(i, this.activeBoss.safe(i, this.player), 0.10);
            poolHits++;
          }
        }
        if (poolHits) this.player.individuals = this.player.individuals.filter(i => !i.dead);
      }
    }

    // 특수 패턴 트리거: 대기(charge) 중 + 쿨다운 경과 + 플레이어가 사거리권일 때
    if (b.moveState === 'charge' && this.elapsed >= b.nextSpecialAt) {
      const pd = Math.hypot(this.player.x - b.x, this.player.y - b.y);
      if (pd <= 650) this._startBossSpecial(b);
      else b.nextSpecialAt = this.elapsed + 1500; // 멀면 잠시 뒤 재시도
    }

    if (b.moveState === 'charge') {
      // ── 기 모으기: 제자리에서 납작해지며 진동 ──
      b.chargeTimer += dt;
      const t = Math.min(1, b.chargeTimer / b.chargeDuration);
      if (!b._chargePlayed) {
        b.sprite.scaleX = 2.0 + t * 0.6;
        b.sprite.scaleY = 2.0 - t * 0.5;
        if (t > 0.5) {
          const f = (t - 0.5) * 2;
          const cg = Math.floor(255 * (1 - f * 0.75));
          b.sprite.setTint((255 << 16) | (cg << 8) | cg);
        } else {
          b.sprite.clearTint();
        }
      }
      const vib = t > 0.45 ? (Math.random() - 0.5) * 7 * (t - 0.45) : 0;
      b.sprite.setPosition(b.x + vib, b.y);
      if (b.shadow) { b.shadow.setPosition(b.x, b.y + 10); b.shadow.setAlpha(0.28 + t * 0.12); b.shadow.setScale(1); }

      if (b.chargeTimer >= b.chargeDuration) {
        // 발사!
        b.moveState = 'jump';
        b.jumpStart  = { x: b.x, y: b.y };
        const MAX_JUMP = 250; // 느린 보스: 플레이어가 도망치면 따라잡기 어려움
        // 오직 플레이어 집단만 추적
        const _tg = this.player;
        const _pdx = _tg.x - b.jumpStart.x;
        const _pdy = _tg.y - b.jumpStart.y;
        const _pd  = Math.hypot(_pdx, _pdy);
        b.jumpTarget = _pd > MAX_JUMP
          ? { x: b.jumpStart.x + _pdx/_pd*MAX_JUMP, y: b.jumpStart.y + _pdy/_pd*MAX_JUMP }
          : { x: _tg.x, y: _tg.y };
        const jd = Math.min(_pd, MAX_JUMP);
        b.jumpDuration = Math.max(700, Math.min(1500, jd * 1.1));
        b.jumpHeight   = 120 + jd * 0.12;
        b.jumpProgress = 0;
        if (!b._chargePlayed) b.sprite.clearTint();
        if (navigator.vibrate) navigator.vibrate(55);
      }

    } else if (b.moveState === 'special_warn') {
      // ── 특수 패턴 텔레그래프: 붉은 위험 범위 표시 + 보스 진동 ──
      const sp = b.special;
      const t = clamp(1 - Math.max(0, sp.fireAt - this.elapsed) / BOSS_SPECIAL_WARN, 0, 1);
      if (this.bossFx) {
        const blink = 0.45 + 0.35 * Math.abs(Math.sin(t * 14));
        if (sp.type === 'shockwave') {
          this.bossFx.fillStyle(0xff3030, 0.10 + 0.10 * t);
          this.bossFx.fillCircle(b.x, b.y, SHOCKWAVE_RADIUS);
          this.bossFx.lineStyle(4, 0xff3030, blink);
          this.bossFx.strokeCircle(b.x, b.y, SHOCKWAVE_RADIUS);
          this.bossFx.lineStyle(3, 0xffa040, 0.9);
          this.bossFx.strokeCircle(b.x, b.y, SHOCKWAVE_RADIUS * t); // 안쪽에서 차오르는 링
        } else if (sp.type === 'frost_nova') {
          this.bossFx.fillStyle(0x6ac8ff, 0.10 + 0.10 * t);
          this.bossFx.fillCircle(b.x, b.y, FROST_NOVA_RADIUS);
          this.bossFx.lineStyle(4, 0x6ac8ff, blink);
          this.bossFx.strokeCircle(b.x, b.y, FROST_NOVA_RADIUS);
          this.bossFx.lineStyle(3, 0xdff4ff, 0.9);
          this.bossFx.strokeCircle(b.x, b.y, FROST_NOVA_RADIUS * t);
        } else if (sp.type === 'eruption' || sp.type === 'poison_pools') {
          const col = sp.type === 'eruption' ? 0xff7a1a : 0xa040f0;
          for (const z of sp.zones) {
            this.bossFx.fillStyle(col, 0.12 + 0.12 * t);
            this.bossFx.fillCircle(z.x, z.y, z.r);
            this.bossFx.lineStyle(3, col, blink);
            this.bossFx.strokeCircle(z.x, z.y, z.r);
            this.bossFx.lineStyle(2, 0xffffff, 0.5 + 0.4 * t);
            this.bossFx.strokeCircle(z.x, z.y, z.r * t);
          }
        } else if (sp.type === 'pull') {
          this.bossFx.lineStyle(4, 0xff6ad8, blink);
          this.bossFx.strokeCircle(b.x, b.y, PULL_RADIUS);
          this.bossFx.lineStyle(3, 0xff9ee8, 0.8);
          this.bossFx.strokeCircle(b.x, b.y, PULL_RADIUS * (1 - t * 0.8)); // 안쪽으로 조여드는 링
          this.bossFx.fillStyle(0xff6ad8, 0.05 + 0.06 * t);
          this.bossFx.fillCircle(b.x, b.y, PULL_RADIUS);
        } else { // dash · multi_dash
          this.bossFx.lineStyle(DASH_HIT_WIDTH * 2, 0xff3030, 0.12 + 0.10 * t);
          this.bossFx.lineBetween(b.x, b.y, sp.tx, sp.ty);
          this.bossFx.lineStyle(3, 0xff3030, blink);
          this.bossFx.lineBetween(b.x, b.y, sp.tx, sp.ty);
        }
      }
      b.sprite.setTint(0xff5544);
      b.sprite.setPosition(b.x + (Math.random() - 0.5) * 7, b.y);
      if (b.shadow) b.shadow.setPosition(b.x, b.y + 10);
      if (this.elapsed >= sp.fireAt) { b.sprite.clearTint(); b.sprite.setPosition(b.x, b.y); this._fireBossSpecial(b); }

    } else if (b.moveState === 'dashing') {
      // ── 돌진: 예고선 방향으로 빠르게 관통, 경로상 개체 타격(개체당 1회) ──
      const sp = b.special;
      sp.progress = Math.min(1, sp.progress + dt / 420);
      b.x = sp.sx + (sp.tx - sp.sx) * sp.progress;
      b.y = sp.sy + (sp.ty - sp.sy) * sp.progress;
      b.sprite.setPosition(b.x, b.y);
      b.sprite.scaleX = 2.6; b.sprite.scaleY = 1.6; // 납작하게 질주
      if (b.shadow) { b.shadow.setPosition(b.x, b.y + 10); b.shadow.setScale(1); }
      if (this.bossFx) {
        this.bossFx.lineStyle(DASH_HIT_WIDTH * 2, 0xff6040, 0.18);
        this.bossFx.lineBetween(b.x, b.y, sp.tx, sp.ty);
      }
      for (const i of this.player.individuals) {
        if (i.dead || sp.hit.has(i.id)) continue;
        if (Math.hypot(i.x - b.x, i.y - b.y) <= DASH_HIT_WIDTH) {
          sp.hit.add(i.id);
          if (this._applyBossHit(i, this.activeBoss.safe(i, this.player), 0.8)) sp.kills++;
        }
      }
      if (sp.progress >= 1) {
        this.player.individuals = this.player.individuals.filter(i => !i.dead);
        this.cameras.main.shake(300, 0.03);
        if (navigator.vibrate) navigator.vibrate(120);
        this.tweens.add({ targets: b.sprite, scaleX: 2.0, scaleY: 2.0, duration: 220, ease: 'Back.Out' });
        if (sp.chain > 0) {
          // 연속 돌진: 짧은 재예고 후 플레이어를 다시 조준해 한 번 더
          sp.chain -= 1;
          this._aimBossDash(b, sp);
          sp.fireAt = this.elapsed + 700;
          b.moveState = 'special_warn';
        } else {
          this._bossSpecialDone(b);
        }
      }

    } else {
      // ── 포물선 점프: 보스는 호(arc), 그림자는 직선 ──
      b.jumpProgress = Math.min(1, b.jumpProgress + dt / b.jumpDuration);
      const p    = b.jumpProgress;
      const ease = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2; // easeInOut
      b.x = b.jumpStart.x + (b.jumpTarget.x - b.jumpStart.x) * ease;
      b.y = b.jumpStart.y + (b.jumpTarget.y - b.jumpStart.y) * ease;

      const arcT = Math.sin(p * Math.PI);              // 0→1→0
      const yOff = arcT * b.jumpHeight;
      const land = p > 0.75 ? (p - 0.75) / 0.25 : 0;  // 착지 직전 납작

      if (!b._chargePlayed) {
        b.sprite.scaleX = 2.0 * (1 - 0.22 * arcT + 0.32 * land);
        b.sprite.scaleY = 2.0 * (1 + 0.32 * arcT - 0.45 * land);
      }
      b.sprite.setPosition(b.x, b.y - yOff);

      // 그림자: p 기준 직선 이동, 보스 높이에 따라 축소
      if (b.shadow) {
        const shx = b.jumpStart.x + (b.jumpTarget.x - b.jumpStart.x) * p;
        const shy = b.jumpStart.y + (b.jumpTarget.y - b.jumpStart.y) * p;
        const ss  = Math.max(0.25, 1 - arcT * 0.75);
        b.shadow.setPosition(shx, shy + 10);
        b.shadow.setScale(ss);
        b.shadow.setAlpha(ss * 0.42);
      }

      if (b.jumpProgress >= 1) {
        // 착지!
        b.sprite.setPosition(b.x, b.y);
        this.cameras.main.shake(320, 0.028);
        if (navigator.vibrate) navigator.vibrate([0, 80, 40, 40]);
        if (!b._chargePlayed) {
          b.sprite.scaleX = 2.5; b.sprite.scaleY = 1.5;
          this.tweens.add({ targets: b.sprite, scaleX: 2.0, scaleY: 2.0, duration: 220, ease: 'Back.Out' });
        }
        b.moveState      = 'charge';
        b.chargeTimer    = 0;
        b.chargeDuration = (1200 + Math.random() * 700) * (b.phase2 ? PHASE2_CHARGE_MULT : 1);
        if (b.shadow) { b.shadow.setScale(1); b.shadow.setAlpha(0.35); b.shadow.setPosition(b.x, b.y + 10); }
      }
    }

    // HP 바 갱신
    const pct = Math.max(0, b.hp / b.hpMax * 100);
    document.getElementById('boss-hp-fill').style.width = pct + '%';
    document.getElementById('boss-hp-label').textContent = `${this.activeBoss.ico} ${this.activeBoss.name}${b.phase2 ? ' 🔥2페이즈' : ''}  ${Math.ceil(b.hp)}/${b.hpMax}`;
    const _bb = document.getElementById('battle-banner');
    const inGrace = this._bossFleeGraceUntil && this.elapsed < this._bossFleeGraceUntil;
    // 보스는 플레이어만 상대 — 플레이어 개체가 사거리 안이고 회피 유예가 아닐 때만 전투 활성 (멀면 번식 가능)
    const playerNear = this.player.individuals.some(i => Math.hypot(b.x - i.x, b.y - i.y) <= BOSS_RANGE + 120);
    this.bossInCombat = playerNear && !inGrace;
    // '보스 전투 중' 배너는 상단 보스 HP바(이름·HP 표시)와 중복 → 표시하지 않음 (화면 정리)
    _bb.style.display = 'none';
    if (playerNear && !inGrace) {
      // 특수 패턴(텔레그래프·돌진) 중에는 기본 공격 중지 — 회피 기회 제공
      if (b.moveState !== 'special_warn' && b.moveState !== 'dashing') this.bossCombatTick(dt);
    }
    if (this.bossPhase !== 'chase') return; // 전투 중 처치되어 이미 종료됨
  // 게임오버: 개체수 임계 미만
  if (this.player.individuals.length < BOSS_MIN_POP) { this.resolveBoss(false, 'wipe'); return this.endGame(); }
  // 제한시간 초과: 중간보스 퇴각 / 최종보스는 운석 시각(bossPhaseUntil=METEOR_TIME) 도달 시 양보 → 다음 프레임 운석 발동
  if (this.elapsed >= this.bossPhaseUntil) this.resolveBoss(false, 'retreat');
  }

// ── 보스 피해 공식 ─────────────────────────────────────
// 안전 조건 = 무적이 아니라 "피해 70% 감소". 불안전 개체는 원피해(대부분 1방)지만
// 고HP·고방어 빌드는 한 번 버틸 수 있다. 웨이브가 진행될수록 원피해 상승.
_bossRawHit(mult = 1) {
  return BOSS_ATK_STAT * (4 + Math.min(this._waveIdx || 0, 4)) * mult; // w0:160 w1:200 w2:240
}
// 개체에게 보스 타격 적용. 죽었으면 true 반환.
_applyBossHit(ind, safe, mult = 1) {
  let dmg = this._bossRawHit(mult);
  if (this.bossEntity && this.bossEntity.phase2) dmg *= PHASE2_DMG_MULT; // 2페이즈: 피해 +25%
  if (safe) dmg *= 0.3;                                 // 안전 조건: 피해 70% 감소
  if (LAB_BUFFS && LAB_BUFFS.bossDmgHalf) dmg *= 0.5;   // 계통수 저항 III: 보스 피해 -50%
  if (this.combatBuffActive && this.combatBuffActive('rally')) dmg *= 0.5; // 결집 태세: 받는 피해 -50%
  const hpBefore = ind.hp;
  ind.takeHit(dmg);
  // 계통수 보스저항 I: 안전 개체는 체력이 넉넉했다면 한 방에 죽지 않음 (1 HP 잔류)
  if (safe && LAB_BUFFS && LAB_BUFFS.bossResist1 && ind.dead && hpBefore > ind.stats.hp * 0.3) {
    ind.hp = 1;
    ind.dead = false;
  }
  return ind.dead;
}

// 보스 전투: 일반 집단전과 동일한 쿨다운 방식
// - 슬라임 공격: moveIndividuals에서 개체별 ATTACK_COOLDOWN마다 처리
// - 보스 공격: BOSS_ATK_CD마다 가장 가까운 개체 최대 10마리 타격
bossCombatTick(dt) {
  const boss = this.activeBoss, b = this.bossEntity;

  // 보스 사망 체크 (슬라임들의 누적 공격으로 HP 소진)
  if (b.hp <= 0) { this.resolveBoss(true); return; }

  const now = Date.now();
  let atkCd = b.phase2 ? BOSS_ATK_CD * PHASE2_ATK_CD_MULT : BOSS_ATK_CD; // 2페이즈: 공격 주기 -30%
  if (this.combatBuffActive('fear')) atkCd *= 1.6; // 위협: 보스 공격 속도 감소

  // 공격 직전 350ms: 충전 연출
  const timeToAtk = atkCd - (now - b.lastAttackAt);
  if (timeToAtk <= 350 && !b._chargePlayed) {
    b._chargePlayed = true;
    b.sprite.setTint(0xff4444);
    // 공격 직전: 가로 스쿼시(납작) → 공격 순간 세로 스트레치(솟구침)
    this.tweens.add({
      targets: b.sprite, scaleX: 2.8, scaleY: 1.4, duration: 250, ease: 'Power2',
      onComplete: () => {
        this.tweens.add({ targets: b.sprite, scaleX: 1.6, scaleY: 3.0, duration: 100, yoyo: true, ease: 'Power3' });
      }
    });
  }

  if (now - b.lastAttackAt < atkCd) return;
  b.lastAttackAt = now;
  b._chargePlayed = false;
  b.sprite.clearTint();

  // 보스는 오직 플레이어 집단만 공격 (AI 집단은 무시)
  // 범위 내 플레이어 개체를 가까운 순으로 최대 10마리 공격
  // 불안전 개체: 원피해(대부분 도태) / 안전 개체: 피해 70% 감소 — _applyBossHit 참고
  const allSlimes = (this.player.individuals.length > 0 ? this.player.individuals : [])
    .filter(i => Math.hypot(b.x - i.x, b.y - i.y) <= BOSS_RANGE + 120)
    .map(i => ({ i, g: this.player, safe: boss.safe(i, this.player) }));
  if (!allSlimes.length) return;

  const targets = allSlimes
    .sort((a, c) => Math.hypot(b.x - a.i.x, b.y - a.i.y) - Math.hypot(b.x - c.i.x, b.y - c.i.y))
    .slice(0, 10);

  let killed = 0;
  for (const { i, safe } of targets) {
    if (this._applyBossHit(i, safe)) killed++;
  }

  const affectedGroups = new Set(targets.map(({ g }) => g));
  for (const g of affectedGroups) g.individuals = g.individuals.filter(i => !i.dead);

  const hitCount = targets.length;
  const cx = targets.reduce((s, { i }) => s + i.x, 0) / hitCount;
  const cy = targets.reduce((s, { i }) => s + i.y, 0) / hitCount;

  this.burst(cx, cy, 0xff1111, 20 + hitCount * 2, 140);
  this.burst(cx, cy, 0xff8800, 10, 80);
  this.cameras.main.shake(500, 0.045);
  this.cameras.main.flash(100, 255, 40, 40, false);
  if (navigator.vibrate) navigator.vibrate(180);
  this.tweens.add({ targets: b.sprite, scaleX: 3.8, scaleY: 2.8, duration: 80, yoyo: true, ease: 'Power3' });
  const msg = killed > 0 ? `${boss.ico} ${killed}마리 도태!` : `${boss.ico} ${hitCount}마리 피해!`;
  if (this.showToast) this.showToast(msg, 'warn');
}

_tickSpecialEvent() {
  if (this.elapsed < this._specialEventNextAt) return;
  const lvl = this._specialEventLevel;
  const events = [];
  if (lvl >= 1) events.push('abundance');
  if (lvl >= 2) events.push('mut_storm');
  if (lvl >= 3 && this.bossPhase !== 'idle') events.push('evacuation');
  if (!events.length) return;
  const picked = events[Math.floor(Math.random() * events.length)];
  this._specialEventNextAt = this.elapsed + 90000 + Math.random() * 60000;
  if (picked === 'abundance') {
    this.player.food = Math.min(this.player.food + 150, 9999);
    this.showMessage('🌸 풍요의 봄! 식량 +150', true);
    this.showToast('🌸 +150 식량', 'ach');
  } else if (picked === 'mut_storm') {
    this._specialEventMutStormUntil = this.elapsed + 30000;
    this.showMessage('🌪️ 돌연변이 폭풍! 30초간 돌연변이 확률 3배', true);
    this.showToast('🌪️ 돌연변이 폭풍 30초', 'ach');
  } else if (picked === 'evacuation') {
    // 보스 경고 중 피난: 플레이어를 보스 피난 지형 근처로 이동
    const refuge = this.activeBoss && this.activeBoss.refuge;
    if (refuge) {
      const tiles = this._terrainTiles ? (this._terrainTiles[refuge] || []) : [];
      if (tiles.length) {
        const t = tiles[Math.floor(Math.random() * tiles.length)];
        this.player.x = t.px; this.player.y = t.py;
        this.showMessage('🚁 긴급 피난! 안전한 곳으로 대피했습니다', true);
      }
    }
  }
  this.cameras.main.flash(300, 255, 255, 200);
}

_rollWaveList() {
  const single = BOSS_ROSTER.filter(b => !b.hidden && !b.final && !b.reqText.includes('+'));
  const dual   = BOSS_ROSTER.filter(b => !b.hidden && !b.final &&  b.reqText.includes('+'));
  const final  = BOSS_ROSTER.find(b => b.final);
  const pick1  = single[Math.floor(Math.random() * single.length)];
  const pick2  = dual[Math.floor(Math.random() * dual.length)];
  return [pick1.id, pick2.id, final.id];
}

resolveBoss(win, reason) {
  const boss = this.activeBoss, slot = this.bossSlot;
  const bx = this.bossEntity ? this.bossEntity.x : this.player.x;
  const by = this.bossEntity ? this.bossEntity.y : this.player.y;
  if (this.bossEntity) { this.bossEntity.sprite.destroy(); if (this.bossEntity.shadow) this.bossEntity.shadow.destroy(); this.bossEntity = null; }
  if (this.bossFx) this.bossFx.clear(); // 특수 패턴 텔레그래프 잔상 제거
  this._bossPools = [];    // 독 웅덩이 제거
  this._bossSlowUntil = 0; // 빙결 감속 해제
  document.getElementById('boss-hp').classList.remove('show');
  document.getElementById('boss-banner').classList.remove('show');
  document.getElementById('boss-arrow').classList.remove('show');
  document.getElementById('battle-banner').style.display = 'none';
  this.bossPhase = 'idle';
  this.bossInCombat = false;
  this.recordAlleleSnapshot();
  if (win) {
    let score = slot === 'final' ? 3000 : 200;
    if (boss.hidden) score = 5000;
    this.bossBonus = (this.bossBonus || 0) + score;
    // ── 연구소 재화 드롭 (바닥 아이템 산란) ──
    this.spawnCurrencyDrops(bx, by, slot, boss.hidden);
    // 격파 보상: 식량+100, 전 개체 HP 20% 회복 (bos4 추가 회복은 기존대로)
    this.player.food += 100;
    for (const ind of this.player.individuals) {
      if (!ind.dead) ind.hp = Math.min(ind.stats.hp, ind.hp + ind.stats.hp * 0.20);
    }
    // 포식 보상: 보스 처치 = 진화 게이지 1레벨 분량
    this.gainEvoExp(evoExpNeedFor(this.evoLevel));
    this.showMessage(`🏆 ${boss.name} 처치! +${score}점\n🍖 식량+100 · 전 개체 HP+20% 회복 · 🧬 진화 게이지 충전!`, true);
    // 중복 처치 토스트 제거 — 중앙 메시지로 일원화
    if (navigator.vibrate) navigator.vibrate([80,40,120]);
    this.cameras.main.flash(220, 255, 240, 180);
    // 보스 도전과제 추적
    const d = this.achieveData;
    d.bossKills = (d.bossKills || 0) + 1;
    if (boss.hidden) d.bossHiddenKilled = true;
    markBossKilled(boss.id);
    if (this.player.individuals.length >= (this._bossSpawnCount || 0)) d.bossNoLossKill = true;
    if ((this.elapsed - (this._bossSpawnTime || 0)) <= 60000) d.bossQuickKill = true;
    this.checkAchievements();
    // 최종 슬롯 처치 → 2초 후 엔딩 (황금 슬라임이 중간 슬롯이면 엔딩 없음)
    if (slot === 'final') {
      if (GAME_MODE === 'infinite') {
        // 무한 모드: 최종 보스도 처치 후 다음 웨이브로
        this.cameras.main.flash(400, 255, 220, 180);
        this._waveIdx++;
        this._waveFired = false;
        this._infiniteWave = (this._infiniteWave || 1) + 1;
        this._infiniteHpMult = 1 + (this._infiniteWave - 1) * 0.10;
        const infSlowdown = (LAB_BUFFS && LAB_BUFFS.infiniteBossSlowdown) || 1.0;
        this._nextBossAt = this.elapsed + WAVE_COOLDOWN * infSlowdown;
        const normalBosses = BOSS_ROSTER.filter(b => !b.final);
        const next = normalBosses[Math.floor(Math.random() * normalBosses.length)];
        this._waveList.push(next.id);
        this.showMessage(`🌈 ${boss.name} 처치! 무한 ${this._infiniteWave}웨이브 시작!`, true);
      } else {
        this.cameras.main.flash(600, 255, 255, 180);
        const endType = boss.id === 'golden' ? 'golden' : 'primordial';
        this._newlyUnlockedDiff = unlockNextDiff(CURRENT_DIFFICULTY);
        this.time.delayedCall(2000, () => this.endGame(endType));
      }
    }
  } else if (reason === 'retreat') {
    // 퇴각한 보스는 잠시 후 재도전 — _waveFired를 반드시 리셋해야 다음 출현이 예약됨
    // (리셋 누락 시 이후 복합·최종 보스가 영영 등장하지 않는 진행 불가 버그)
    this._waveFired = false;
    const _rSlow = (LAB_BUFFS && LAB_BUFFS.infiniteBossSlowdown) || 1.0;
    this._nextBossAt = this.elapsed + WAVE_COOLDOWN * _rSlow;
    this.showMessage(`${boss.ico} ${boss.name}가 물러갑니다… (보상 없음)\n⏳ ${Math.round(WAVE_COOLDOWN * _rSlow / 1000)}초 후 다시 옵니다 — 처치해야 다음으로 진행!`, true);
    this.cameras.main.flash(300, 120, 120, 180);
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }
  this.activeBoss = null;
  this.bossSlot = null;
  // 웨이브 진행: 처치 시 다음 보스 예약
  if (win && slot !== 'final') {
    this._waveIdx++;
    this._waveFired = false;
    const infSlowdown = (LAB_BUFFS && LAB_BUFFS.infiniteBossSlowdown) || 1.0;
    this._nextBossAt = this.elapsed + WAVE_COOLDOWN * infSlowdown;
    // 무한 모드: 웨이브 끝나면 다음 보스 자동 추가 (난이도 점진 상승)
    if (GAME_MODE === 'infinite' && this._waveIdx >= this._waveList.length) {
      const normalBosses = BOSS_ROSTER.filter(b => !b.final);
      const next = normalBosses[Math.floor(Math.random() * normalBosses.length)];
      this._waveList.push(next.id);
      this._infiniteWave = (this._infiniteWave || 1) + 1;
      // HP scaling: +10% per extra wave beyond 3
      this._infiniteHpMult = 1 + (this._infiniteWave - 1) * 0.10;
    }
    // 다음 보스 예고는 별도 팝업 없이, 다음 보스의 접근 배너가 시작될 때 안내됨 (처치 메시지와 연달아 뜨던 팝업 제거)
  }
}

  // 보스 처치 시 재화 아이템을 바닥에 산란시키고 자동 수거
  spawnCurrencyDrops(bx, by, slot, isHidden) {
    const mult = isHidden ? 10 : 1;
    const drops = [];
    if (slot === 'mid') {
      const n = (10 + Math.floor(Math.random() * 6)) * mult;
      for (let i = 0; i < n; i++) drops.push('frag');
    }
    if (slot === 'final' || isHidden) {
      const n = (1 + Math.floor(Math.random() * 2)) * mult;
      for (let i = 0; i < n; i++) drops.push('ess');
    }
    if (!drops.length) return;

    const fragTotal = drops.filter(d => d === 'frag').length;
    const essTotal  = drops.filter(d => d === 'ess').length;

    drops.forEach((type, idx) => {
      const ico  = type === 'frag' ? '🔷' : '💠';
      const item = this.add.text(bx, by, ico, {
        fontSize: type === 'frag' ? '18px' : '22px',
        stroke: '#ffffff', strokeThickness: 2
      }).setOrigin(0.5).setDepth(22);

      // 부채꼴로 고르게 산란
      const baseAngle = (idx / drops.length) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.7;
      const dist  = 70 + Math.random() * 150;
      const tx = bx + Math.cos(angle) * dist;
      const ty = by + Math.sin(angle) * dist;
      const delay = idx * 35;

      // X: 직선 / Y: 포물선(위로 솟았다 떨어짐)
      this.tweens.add({ targets: item, x: tx, duration: 500, delay, ease: 'Power1.Out' });
      this.tweens.add({
        targets: item, y: ty - 110, duration: 250, delay, ease: 'Power2.Out',
        onComplete: () => {
          this.tweens.add({
            targets: item, y: ty, duration: 280, ease: 'Bounce.Out',
            onComplete: () => {
              // 지면 pulse
              this.tweens.add({
                targets: item, scaleX: 1.28, scaleY: 1.28,
                duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut'
              });
              // 자동 수거
              const collectAt = 1600 + Math.random() * 700;
              this.time.delayedCall(collectAt, () => {
                if (!item.active) return;
                this.tweens.killTweensOf(item);
                this.tweens.add({
                  targets: item,
                  x: this.player.x, y: this.player.y,
                  scaleX: 0, scaleY: 0, alpha: 0,
                  duration: 360, ease: 'Power2.In',
                  onComplete: () => {
                    if (item.active) item.destroy();
                    if (type === 'frag') Save.set('gpa_frag', labGetFrag() + 1);
                    else                Save.set('gpa_ess',  labGetEss()  + 1);
                  }
                });
              });
            }
          });
        }
      });
    });

    // 전체 수거 후 토스트
    const toastDelay = drops.length * 35 + 2600;
    if (fragTotal > 0) this.time.delayedCall(toastDelay,       () => { if (this.showToast) this.showToast(`🔷 파편 ×${fragTotal} 수거!`, 'ach'); });
    if (essTotal  > 0) this.time.delayedCall(toastDelay + 350, () => { if (this.showToast) this.showToast(`💠 정수 ×${essTotal} 수거!`,  'ach'); });
  }

  startBossWarning(boss, slot) {
    this.bossPhase = 'warning';
    this.activeBoss = boss;
    this.bossSlot = slot;
    this.bossPhaseUntil = this.elapsed + BOSS_WARN_TIME;
    const banner = document.getElementById('boss-banner');
    document.getElementById('boss-banner-text').innerHTML = `${boss.ico} <b>${boss.name}</b> 접근!<br>요구: <b>${boss.reqText}</b>`;
    banner.classList.add('show');
    // 접근 정보는 상단 배너(카운트다운·안전% 실시간 갱신)로 상시 표시 — 중앙 팝업 생략
    if (navigator.vibrate) navigator.vibrate([60,40,60]);
    if (Audio.sfxMeteor) Audio.sfxMeteor();
  }

  // 돌연변이 3종 이상이 집단의 70% 이상에게 보급되면 황금 슬라임 조건 달성
  // (동시에 충족할 필요 없음 — 게임 중 누적 기록)
  _checkGoldenCondition() {
    if (this._goldenConditionMet) return;
    const aliveInds = this.player.individuals.filter(i => !i.dead);
    if (!aliveInds.length) return;
    const mutFreq = {};
    for (const ind of aliveInds) {
      for (const id of (ind.mutations || [])) mutFreq[id] = (mutFreq[id] || 0) + 1;
    }
    for (const [id, cnt] of Object.entries(mutFreq)) {
      if (cnt / aliveInds.length >= 0.7) this._genesMaxedEver.add(id);
    }
    if (this._genesMaxedEver.size >= 3) {
      this._goldenConditionMet = true;
      if (this.showToast) this.showToast('✨ 황금 슬라임의 기운이 느껴진다…', 'ach');
    }
  }


  showMessage(text, env = false) {
    if (this.eventLog && !this.gameOver) {
      const clean = String(text).replace(/\n/g, ' ');
      // 번식/출생 메시지는 너무 잦아 이벤트 목록에서 제외
      if (!/번식 성공|자손|태어/.test(clean)) {
        this.eventLog.push({ t: this.elapsed || 0, text: clean, env: !!env });
        if (this.eventLog.length > 250) this.eventLog.shift();
      }
    }
    const element = document.getElementById('event-message');
    const evtText = document.getElementById('evt-text');
    if (evtText) evtText.textContent = text; else element.textContent = text;
    element.style.display = 'block';
    element.classList.remove('show', 'evt-collapsed'); void element.offsetWidth; element.classList.add('show');
    // 튜토리얼 활성 시 슬라임 가리지 않도록 하단 배치
    const tutActive = document.getElementById('tutorial-overlay')?.classList.contains('active');
    element.classList.remove('boss-mode', 'evt-collapsed');
    element.classList.toggle('tutorial-mode', !!tutActive);
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => { element.style.display = 'none'; }, 2800);
  }

  // 도전과제 등 토스트 알림
  showToast(text, kind = 'ach') {
    // kind: 'mut'=돌연변이(왼쪽 아래) / 'ach'=도전과제(오른쪽 아래) / 'warn'=경고(오른쪽 아래 빨강)
    const wrapId = kind === 'mut' ? 'toast-mut' : 'toast-ach';
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind === 'warn' ? 'warn' : kind);
    el.textContent = text;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), kind === 'warn' ? 2800 : 3700);
  }

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

  // ── 날씨 변화 ──
  changeWeather() {
    const prev = this.weather;
    // 날씨 가중 선택 (맑음 계열이 더 자주)
    const roll = Math.random();
    let next;
    if (roll < 0.35) next = WEATHERS.sunny;
    else if (roll < 0.55) next = WEATHERS.clear;
    else if (roll < 0.75) next = WEATHERS.rain;
    else if (roll < 0.9) next = WEATHERS.fog;
    else next = WEATHERS.storm;
    if (next === prev) return;
    this.weather = next;
    document.getElementById('weather-ico').textContent = next.ico;

    if (next.id === 'storm') {
      Audio.sfxThunder();
      this.cameras.main.flash(300, 255, 255, 255);
      // 폭풍은 HUD 날씨 아이콘·화면 틴트·번개 연출로 전달 — 중앙 메시지 생략
    }
  }

  // ── 낮밤 사이클 ──
  updateDayNight() {
    const t = (this.elapsed % DAY_LENGTH) / DAY_LENGTH; // 0~1
    // 0~0.6 낮, 0.6~1.0 밤 (부드러운 전환)
    let nightAlpha;
    if (t < 0.5) nightAlpha = 0;
    else if (t < 0.65) nightAlpha = (t - 0.5) / 0.15 * 0.5;
    else if (t < 0.9) nightAlpha = 0.5;
    else nightAlpha = (1 - t) / 0.1 * 0.5;
    this.nightOverlay.setFillStyle(0x1a2a4a, nightAlpha);

    const isNight = nightAlpha > 0.25;
    if (isNight !== (this.dayPhase === 'night')) {
      this.dayPhase = isNight ? 'night' : 'day';
      const _clockEl = document.getElementById('clock-text'); if (_clockEl) _clockEl.textContent = isNight ? '밤' : '낮';
    }

    // 날씨 tint 오버레이
    const wt = this.weather.tint;
    if (wt) this.weatherTint.setFillStyle(wt, 0.18);
    else this.weatherTint.setFillStyle(0x000000, 0);
  }

  // ── HUD DOM 플로팅 텍스트 (식량 소비 등) ──
  // anchorId: 기준 DOM 요소 id, side: 'right'(기본) | 'left'
  spawnHudFloat(anchorId, text, color = '#d97030', side = 'right') {
    const el = document.getElementById(anchorId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const div = document.createElement('div');
    div.className = 'hud-float';
    div.textContent = text;
    div.style.color = color;
    if (side === 'left') {
      div.style.right = (window.innerWidth - rect.left + 4) + 'px';
    } else {
      div.style.left = (rect.right + 4) + 'px';
    }
    div.style.top = (rect.top - 2) + 'px';
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1400);
  }

  // ── 전투 타격 이펙트 (플레이어 전투 전용) ──
  spawnHitEffect(x, y) {
    // 불꽃 파티클 스파크
    this.burst(x, y, 0xff6b35, 4, 22);
    // 미세 카메라 흔들림 (타격감)
    this.cameras.main.shake(90, 0.0035);
  }

  // ── 데미지/획득 플로팅 텍스트 ──
  spawnFloatText(x, y, text, color = '#ffffff', size = 18) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Jua, sans-serif', fontSize: `${size}px`, color,
      stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.floatTexts.push({ obj: t, vy: -40, life: 800, age: 0 });
  }
  updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const f = this.floatTexts[i];
      f.age += dt;
      f.obj.y += f.vy * (dt / 1000);
      f.obj.alpha = Math.max(0, 1 - f.age / f.life);
      if (f.age >= f.life) { f.obj.destroy(); this.floatTexts.splice(i, 1); }
    }
  }

  // ── 파티클 폭발 (이펙트) ──
  burst(x, y, color, count = 8, spread = 60) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const p = this.add.circle(x, y, 3 + Math.random() * 3, color).setDepth(19);
      this.tweens.add({
        targets: p, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r,
        alpha: 0, scale: 0.2, duration: 400 + Math.random() * 300, ease: 'Quad.out',
        onComplete: () => p.destroy(),
      });
    }
  }

  updateHud() {
    const group = this.player;
    const need = group.need();
    const surplus = group.surplus();
    const canBreed = group.canBreed();
    const terrain = this.terrainAt(group.x, group.y);
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

    // 상단 칩: 무한 모드는 경과시간, 일반 모드는 남은시간 표시
    const remainMs = Math.max(0, METEOR_TIME + ((LAB_BUFFS&&LAB_BUFFS.meteorBonus)||0) - this.elapsed);
    let timerStr;
    if (GAME_MODE === 'infinite') {
      const em = Math.floor(this.elapsed / 60000), es = Math.floor((this.elapsed % 60000) / 1000);
      timerStr = `♾️${em}:${String(es).padStart(2,'0')}`;
    } else {
      const rm = Math.floor(remainMs / 60000), rs = Math.floor((remainMs % 60000) / 1000);
      timerStr = `${rm}:${String(rs).padStart(2,'0')}`;
    }
    setText('c-count', group.count);
    setText('c-food', Math.floor(group.food));
    setText('c-gen', timerStr);

    // 현황 패널 (간소화)
    setText('s-count', group.count);
    setText('s-breed', canBreed ? T('breed_ok') : T('breed_no'));
    document.getElementById('s-breed').className = canBreed ? 'good' : 'bad';
    setText('s-hp', group.average('hp').toFixed(0));
    setText('s-attack', group.average('attack').toFixed(0));
    setText('s-defense', group.average('defense').toFixed(0));
    setText('s-speed', group.average('speed').toFixed(0));
    setText('s-gather', group.average('gather').toFixed(0));
    setText('s-charm', group.average('charm').toFixed(0));

    // 하단 바 — 진화 게이지
    const evoNeed = evoExpNeedFor(this.evoLevel);
    setText('b-evolevel', `Lv.${this.evoLevel}`);
    setText('b-evoexp', `${Math.floor(Math.min(this.evoExp, evoNeed))} / ${evoNeed}`);
    const evoFill = document.getElementById('evo-fill');
    if (evoFill) {
      const evoPct = clamp(this.evoExp / evoNeed * 100, 0, 100);
      evoFill.style.width = evoPct + '%';
      evoFill.classList.toggle('evo-near-full', evoPct >= 85);
    }
    // 하단 바 — 식량 (한 줄, 두 색 구간: 주황=다음 소비될 생존 식량 / 초록=번식 여력)
    const _bc = (this.player === group && LAB_BUFFS) ? Math.max(1, Math.round(10 * LAB_BUFFS.breedCostMult)) : 10;
    const breedThreshold = _bc * 10;              // 번식에 필요한 잉여 식량
    const total = Math.max(1, need + breedThreshold); // 번식 가능 식량 수준(바 가득참 기준)
    const consumePart = Math.min(group.food, need);
    const breedPart = clamp(group.food - need, 0, breedThreshold);
    const consumePct = consumePart / total * 100;
    const breedPct = breedPart / total * 100;
    const needMarkPct = need / total * 100;
    const starving = group.food < need;
    setText('b-food', Math.floor(group.food));
    setText('b-need', need.toFixed(0));
    setText('b-breed', breedThreshold.toFixed(0));
    setText('terrain-name', terrain.name);
    setText('terrain-ico', terrain.ico || '🌿');
    // 남은 시간 임박 시 칩 강조
    const cgen = document.getElementById('c-gen');
    if (cgen) cgen.style.color = remainMs < 30000 ? '#ff7d6e' : '';
    const consumeFill = document.getElementById('food-consume');
    const breedFill = document.getElementById('food-breed');
    const needMark = document.getElementById('food-need-mark');
    if (consumeFill) { consumeFill.style.width = consumePct + '%'; consumeFill.classList.toggle('starving', starving); }
    if (breedFill) { breedFill.style.width = breedPct + '%'; breedFill.classList.toggle('ready', breedPart >= breedThreshold); }
    if (needMark) needMark.style.left = needMarkPct + '%';
    const actionBtn = document.getElementById('breed-btn');
    actionBtn.disabled = !canBreed;
    // 번식 불가 이유 tooltip
    if (!canBreed) {
      const bc = LAB_BUFFS ? Math.max(1, Math.round(10 * LAB_BUFFS.breedCostMult)) : 10;
      const minFood = bc * 10;
      if (group.state !== 'normal')      actionBtn.title = '전투 중 번식 불가 — 멀리 이동해 전투에서 이탈하세요';
      else if (group.count < 5)          actionBtn.title = `개체 5마리 필요 (현재 ${group.count})`;
      else if (group.surplus() < minFood) actionBtn.title = `식량 부족 (${Math.floor(group.food)}/${minFood})`;
      else if (group.count >= group._maxPop()) actionBtn.title = `한도 초과 (최대 ${group._maxPop()})`;
      else actionBtn.title = '';
    } else {
      actionBtn.title = '';
    }
    // 무한 모드 웨이브 표시
    if (GAME_MODE === 'infinite' && this._infiniteWave > 1) {
      const waveEl = document.getElementById('diff-badge-name');
      if (waveEl) waveEl.textContent = `♾️ ${this._infiniteWave}웨이브`;
    }
    // 돌연변이 폭풍 활성 표시
    if (this._specialEventMutStormUntil && this.elapsed < this._specialEventMutStormUntil) {
      const rem = Math.ceil((this._specialEventMutStormUntil - this.elapsed) / 1000);
      const timerEl = document.getElementById('c-gen');
      if (timerEl && !timerEl.dataset.stormInterval) {
        timerEl.dataset.stormBg = timerEl.style.background || '';
        timerEl.style.background = 'rgba(160,80,255,.2)';
      }
      timerEl && (timerEl.dataset.stormInterval = '1');
    } else {
      const timerEl = document.getElementById('c-gen');
      if (timerEl && timerEl.dataset.stormInterval) {
        timerEl.style.background = timerEl.dataset.stormBg || '';
        delete timerEl.dataset.stormInterval;
      }
    }

    // (PC 사이드 패널 제거됨 — 화면 전체 사용)

    // 전쟁 현황 배너 (실시간 전투: 타이머 없음 — 병력·콤보 표시)
    const activeBattle = this.battles.find(b => b.active && (b.groupA.isPlayer || b.groupB.isPlayer));
    if (activeBattle) {
      const _pb = activeBattle.groupA.isPlayer ? activeBattle.groupA : activeBattle.groupB;
      const _eb = activeBattle.groupA.isPlayer ? activeBattle.groupB : activeBattle.groupA;
      const _myN = _pb.individuals.filter(i=>!i.dead).length;
      const _enN = _eb.individuals.filter(i=>!i.dead).length;
      const comboTxt = this.combat.combo >= 2 ? `  ·  🔥${this.combat.combo}콤보` : '';
      document.getElementById('battle-banner').textContent = `⚔️ 내 편 ${_myN}  vs  적 ${_enN}${comboTxt}`;
      document.getElementById('battle-banner').style.display = 'block';
    }
    // 전투 스킬바 표시·쿨다운 갱신
    this.updateSkillBar();

    // ── 유전자 대립유전자 빈도 (vis1 이상 해금 시 표시)
    const visLv = (LAB_BUFFS && LAB_BUFFS.geneVisLevel) || 0;
    const genesSection = document.getElementById('s-genes-section');
    if (genesSection) genesSection.style.display = visLv >= 1 ? '' : 'none';
    if (visLv >= 1) {
      const geneFreq = group.geneFrequency();
      const GENE_META = {
        color:  { ico:'🔴', label:'R (몸색)',  desc:'R:공격+5·HP+8 / B:방어+4·식량↓', allele:'R/B', col:'#ef5555' },
        speed:  { ico:'⚡', label:'S (속도)',  desc:'속도+25  식량소모+0.3',           allele:'S/s', col:'#22c55e' },
        poison: { ico:'☠️', label:'P (독성)',  desc:'공격+10·방어+3  늪 적응',         allele:'P/p', col:'#a855f7' },
        armor:  { ico:'🛡️', label:'A (갑옷)', desc:'방어+10·HP+15·속도-8',            allele:'A/a', col:'#60a5fa' },
        charm:  { ico:'💗', label:'C (매력)', desc:'매력+12·번식+0.3  포섭↑',         allele:'C/c', col:'#f0abfc' },
      };
      document.getElementById('s-genes').innerHTML = Object.entries(GENE_META).map(([gene, m]) => {
        const pct = geneFreq[gene] || 0;
        const delta = pct - 50;
        const absDelta = Math.abs(delta);
        const deltaColor = delta > 5 ? m.col : delta < -5 ? '#94a3b8' : 'var(--ink-soft)';
        const deltaStr = delta > 0 ? `+${delta.toFixed(0)}%` : `${delta.toFixed(0)}%`;
        return `<div style="margin:4px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:2px">
            <span style="font-weight:800;color:var(--ink)">${m.ico} ${m.label}</span>
            <span style="display:flex;gap:4px;align-items:center">
              <span style="color:${deltaColor};font-weight:900;font-size:11.5px">${pct.toFixed(0)}%</span>
              <span style="color:${deltaColor};font-size:10px">(${deltaStr})</span>
            </span>
          </div>
          <div style="position:relative;height:8px;background:rgba(110,99,132,.15);border-radius:999px;overflow:hidden">
            <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(110,99,132,.3)"></div>
            <div style="position:absolute;height:100%;border-radius:999px;background:${m.col};
              ${delta>=0 ? `left:50%;width:${Math.min(50,delta)}%` : `left:${50+delta}%;width:${Math.min(50,absDelta)}%;background:#94a3b8`}">
            </div>
          </div>
          <div style="font-size:10px;color:var(--ink-soft);margin-top:1px">${m.desc} · ${m.allele}</div>
        </div>`;
      }).join('');
    }

    // 유전자형 분포 (RR/RB/BB) — vis2 이상
    const genotypesEl = document.getElementById('s-genotypes');
    const genotypesSection = document.getElementById('s-genotypes-section');
    if (genotypesSection) genotypesSection.style.display = visLv >= 2 ? '' : 'none';
    if (visLv >= 2 && genotypesEl) {
      genotypesEl.innerHTML = Object.entries(group.genotypeFrequency('color'))
        .sort((a, b) => b[1] - a[1])
        .map(([gt, pct]) => {
          const dotCol = gt==='RR' ? '#ef5555' : gt==='BB' ? '#60a5fa' : '#a855f7';
          const name = gt==='RR' ? '붉은색' : gt==='BB' ? '푸른색' : '보라색(이형접합)';
          return `<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:1px 0">
            <span style="display:flex;align-items:center;gap:4px">
              <span style="width:8px;height:8px;border-radius:50%;background:${dotCol};display:inline-block"></span>
              <span class="label">${gt} ${name}</span>
            </span>
            <strong>${pct.toFixed(0)}%</strong>
          </div>`;
        }).join('');
    }

    // 돌연변이 (상위 4개) — 섹션이 존재할 때만 갱신
    const mutationsEl = document.getElementById('s-mutations');
    if (mutationsEl) {
      const frequency = group.mutationFrequency();
      const topMutations = Object.entries(frequency).sort((a, b) => b[1] - a[1]).slice(0, 4);
      mutationsEl.innerHTML = topMutations.map(([id, percent]) => {
        const mutation = mutationById(id);
        const className = mutation ? (mutation.type === 'bad' ? 'bad' : mutation.type === 'dual' ? 'dual' : 'good') : 'good';
        return `<div class="${className}">${mutation ? mutation.name : id} ${percent.toFixed(0)}%</div>`;
      }).join('') || '<div class="label">아직 없음</div>';
    }
    // Feature 5: 강화 개체(statBonus) 표시
    const bonusIndsEl = document.getElementById('s-bonus-inds');
    if (bonusIndsEl) {
      const enhanced = group.individuals.filter(i => !i.dead && i.statBonus && (i.statBonus.hpMult > 1 || i.statBonus.attack > 0));
      if (enhanced.length > 0) {
        bonusIndsEl.innerHTML = `<h2 style="margin-top:8px;margin-bottom:4px">⚡ 강화 개체</h2>` + enhanced.slice(0, 5).map(ind => {
          const hm = ind.statBonus.hpMult || 1;
          const atk = ind.statBonus.attack || 0;
          const spd = ind.statBonus.speed || 0;
          const def = ind.statBonus.defense || 0;
          const tags = [];
          if (hm > 1) tags.push(`HP ×${hm.toFixed(1)}`);
          if (atk > 0) tags.push(`공 +${Math.round(atk)}`);
          if (spd > 0) tags.push(`속 +${Math.round(spd)}`);
          if (def > 0) tags.push(`방 +${Math.round(def)}`);
          return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--glass);border:1px solid var(--glass-bdr);border-radius:10px;margin-bottom:4px;font-family:'Jua',sans-serif">
            <span style="font-size:13px">⚡</span>
            <span style="font-size:11px;color:var(--sky-dk);flex:1">${tags.join(' · ')}</span>
          </div>`;
        }).join('');
      } else {
        bonusIndsEl.innerHTML = '';
      }
    }
    this.updateProgressBar();
  }

  updateProgressBar() {
    const total = METEOR_TIME + ((LAB_BUFFS && LAB_BUFFS.meteorBonus) || 0);
    const pct = Math.min(1, this.elapsed / total);

    const fill = document.getElementById('game-progress-fill');
    if (fill) {
      fill.style.width = (pct * 100).toFixed(2) + '%';
      fill.classList.toggle('boss-warn', this.bossPhase === 'warning' || this.bossPhase === 'chase');
    }

    const em = Math.floor(this.elapsed / 60000);
    const es = Math.floor((this.elapsed % 60000) / 1000);
    const tm = Math.floor(total / 60000);
    const ts = Math.floor((total % 60000) / 1000);
    const timeEl = document.getElementById('game-progress-time');
    if (timeEl) timeEl.textContent = `${em}:${String(es).padStart(2,'0')} / ${tm}:${String(ts).padStart(2,'0')}`;

    // 웨이브 진행도 표시
    const waveEl = document.getElementById('boss-wave-counter');
    if (waveEl && this._waveList) {
      const total = this._waveList.length;
      const done  = this._waveIdx;
      const cur   = this.activeBoss;
      if (cur) {
        waveEl.textContent = `${cur.ico} ${done + 1}/${total}`;
        waveEl.style.color = '#ff7d6e';
      } else {
        waveEl.textContent = `⚔️ ${done}/${total}`;
        waveEl.style.color = done >= total ? '#22c55e' : '';
      }
    }

    // 다음 보스 예고 — 경고 단계와 동일한 상단 배너(boss-banner) 하나로 통일 표시
    // (idle: 출현까지 남은 시간 = 예고 시작까지 + 경고 60초 → 경고 단계 카운트다운과 끊김 없이 이어짐)
    if (this._waveList && this.bossPhase === 'idle' && !this.activeBoss) {
      const banner = document.getElementById('boss-banner');
      const allDone = this._waveIdx >= this._waveList.length;
      const nextBoss = allDone ? null : bossById(this._waveList[this._waveIdx]);
      if (nextBoss) {
        const secsLeft = Math.max(0, Math.ceil((this._nextBossAt - this.elapsed) / 1000)) + Math.round(BOSS_WARN_TIME / 1000);
        const m = Math.floor(secsLeft / 60), s = secsLeft % 60;
        const timeStr = m > 0 ? `${m}분 ${s}초` : `${s}초`;
        const alive = this.player.individuals.filter(i => !i.dead);
        let safeN = 0;
        try { safeN = alive.filter(i => nextBoss.safe(i, this.player)).length; } catch (e) {}
        const n = alive.length || 1;
        const ready = Math.round(safeN / n * 100);
        const readyCol = ready >= 80 ? '#4ade80' : ready >= 50 ? '#fbbf24' : '#f87171';
        document.getElementById('boss-banner-text').innerHTML =
          `${nextBoss.ico} <b>${nextBoss.name}</b> ${timeStr} 후 출현!<br>요구: <b>${nextBoss.reqText}</b><br>🛡 안전 <b style="color:${readyCol}">${safeN}/${alive.length} (${ready}%)</b> — 조건 미충족 개체는 도태!`;
        banner.classList.add('show');
      } else {
        banner.classList.remove('show');
      }
    }
  }

  startMeteorWarning() {
    this.showMessage('⚠️ 하늘이 붉어집니다...\n거대한 빛이 다가옵니다!', true);
    Audio.sfxMeteor();
    // 화면 가장자리 붉은 경고
    const cam = this.cameras.main;
    this.warnTween = this.tweens.addCounter({
      from: 0, to: 1, duration: 800, yoyo: true, repeat: -1,
      onUpdate: (t) => { cam.setBackgroundColor(`rgba(${Math.floor(40 + t.getValue()*120)},20,20,1)`); }
    });
  }

  triggerMeteor() {
    this.meteorActive = true;
    const cam = this.cameras.main;
    if (this.warnTween) this.warnTween.stop();
    document.getElementById('battle-banner').style.display = 'none';
    document.getElementById('battle-vignette').classList.remove('active');

    // 1) 지진 — 강한 흔들림
    cam.shake(2600, 0.035);
    Audio.sfxQuake();
    this.showMessage('🌋 대지진이 시작됩니다!', true);

    // 2) 1.4초 후 운석 낙하 (화면 중앙으로 점점 커지는 흰 원)
    this.time.delayedCall(1400, () => {
      const flash = this.add.circle(this.player.x, this.player.y - 600, 20, 0xffffff)
        .setDepth(999).setScrollFactor(0);
      flash.x = cam.width / 2; flash.y = -100;
      this.tweens.add({
        targets: flash, y: cam.height / 2, radius: 80, duration: 900, ease: 'Quad.in',
        onComplete: () => {
          // 3) 충돌 섬광 — 화면 전체 흰색
          cam.flash(1600, 255, 255, 255);
          cam.shake(1800, 0.05);
          Audio.sfxImpact();
          this.burst(this.player.x, this.player.y, 0xffffff, 40, 200);
          flash.destroy();
          this.meteorDeathCount = this.player.count;
          this.savedMeteorDiversity = this.player.calcDiversity();
          this.savedMeteorMutFreq = this.player.mutationFrequency();
          this.savedMeteorGeneFreq = this.player.geneFrequency();
          this.recordAlleleSnapshot(); // 멸종 직전 최종 빈도 기록
          // 모든 개체 멸종
          for (const g of this.groups) g.individuals = [];
          this.syncSprites();
          // 4) 멸종 엔딩 화면
          this.time.delayedCall(1600, () => this.endGame(true));
        }
      });
    });
  }

  endGame(endingType = 'normal') {
    if (this.gameOver) return;
    this.gameOver = true;
    // Feature 4: 누적 통계 업데이트 (endGame 진입 직후, endingType 정규화 전에 임시 저장)
    this._endingTypeForStats = endingType;
    this._clickTarget = null;
    this._clickMarker?.clear();
    this._clearAllDangerVisuals();
    document.querySelectorAll('.hud-float').forEach(el => el.remove());
    // 하위 호환: 기존 endGame(true) 호출 지원
    if (endingType === true) endingType = 'meteor';
    if (endingType === false) endingType = 'normal';
    const byMeteor = endingType === 'meteor';
    this.meteorEnding = byMeteor;
    const group = this.player;
    if (!byMeteor) this.recordAlleleSnapshot(); // 종료 시점 최종 빈도 기록
    const minutes = Math.floor(this.elapsed / 60000);
    const seconds = Math.floor((this.elapsed % 60000) / 1000);
    const resultPopulation = byMeteor ? (this.meteorDeathCount || 0) : group.count;
    const meteorDeathBonus = byMeteor ? resultPopulation * 2 : 0;
    const finalDiversity = byMeteor ? (this.savedMeteorDiversity || 0) : group.calcDiversity();
    const diversityBonus = Math.round(finalDiversity * 500);
    const achieveBonus = [...this.achievements].reduce((sum, id) => {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      return sum + (ach ? ach.bonus : 0);
    }, 0);
    const evoBonus = Math.max(0, (this.evoLevel || 1) - 1) * 150; // 진화 레벨당 +150점
    const score = Math.max(0, resultPopulation * 10 + Math.floor(group.food) * 5 + group.wins * 50 + group.recruited * 30 + Math.floor(this.elapsed / 10000) * 5 - group.starved * 10 + diversityBonus + achieveBonus + meteorDeathBonus + evoBonus + (this.bossBonus || 0));
    // Feature 4: 누적 통계 저장
    {
      const s = loadStats();
      s.totalGames = (s.totalGames || 0) + 1;
      s.bestScore = Math.max(s.bestScore || 0, score);
      s.totalBossKills = (s.totalBossKills || 0) + (this.achieveData.bossKills || 0);
      s.totalPlayMs = (s.totalPlayMs || 0) + (this.elapsed || 0);
      const et = this._endingTypeForStats || endingType;
      if (et === 'primordial' || et === 'golden') s.totalWins = (s.totalWins || 0) + 1;
      saveStats(s);
    }
    // 순위표 등록용 데이터 임시 보관
    this._endScoreData = {
      score,
      generations: group.generation,
      mutations:   this.gainedMutationsThisGame.size,
    };
    const frequency = byMeteor ? (this.savedMeteorMutFreq || {}) : group.mutationFrequency();
    const changes = [];
    for (const mutationId of new Set([...Object.keys(this.initialMutationFrequency), ...Object.keys(frequency)])) {
      const initial = this.initialMutationFrequency[mutationId] || 0;
      const final = frequency[mutationId] || 0;
      if (Math.abs(final - initial) >= 3) {
        const mutation = mutationById(mutationId);
        changes.push({ name: mutation ? mutation.name : mutationId, initial, final, delta: final - initial });
      }
    }
    changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const doneAch = ACHIEVEMENTS.filter(a => this.achievements.has(a.id));
    const _dc = getDiffConfig();
    const diffColors = ['#3d8a3a','#e07a20','#c9402f','#4a1a6a'];
    const diffBanner = CURRENT_DIFFICULTY > 0
      ? `<div class="result-card panel" style="background:${diffColors[CURRENT_DIFFICULTY]}22;border-color:${diffColors[CURRENT_DIFFICULTY]};margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:22px">${_dc.ico}</span>
            <span style="font-weight:900;color:#fff">${_dc.name} 난이도${endingType==='primordial'||endingType==='golden' ? ' — 클리어! 🎉' : ''}</span>
          </div>
        </div>` : '';
    const nd = this._newlyUnlockedDiff;
    const unlockBanner = nd
      ? `<div class="result-card panel" style="background:rgba(255,210,50,.12);border-color:#fbbf24;margin-bottom:8px;animation:fadeIn .5s ease">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:28px">🔓</span>
            <div>
              <div style="font-weight:900;color:#fbbf24;font-size:15px">새 난이도 해금!</div>
              <div style="font-size:13px;color:#fff;margin-top:2px">${nd.ico} <strong>${nd.name}</strong> 난이도가 해금되었습니다</div>
            </div>
          </div>
        </div>` : '';
    // 패인 분석 (운석/보스 와이프 공통)
    const _causeLines = [];
    if (endingType === 'meteor') {
      const peakPop = this._peakPopulation || group.count;
      const finalPop = group.count;
      if (finalPop <= 5) _causeLines.push('⚠️ 개체 수가 너무 적었습니다 (최대 ' + peakPop + '마리 → 최종 ' + finalPop + '마리)');
      if (this._waveIdx === 0) _causeLines.push('⚠️ 첫 번째 보스에 도달하지 못했습니다');
      else _causeLines.push('📊 ' + this._waveIdx + '/3 보스 처치 후 멸종');
      if (this.gainedMutationsThisGame.size === 0) _causeLines.push('⚠️ 이번 런에서 돌연변이를 한 번도 얻지 못했습니다');
      else _causeLines.push('🧬 돌연변이 ' + this.gainedMutationsThisGame.size + '종 획득');
    }
    const defeatAnalysis = _causeLines.length
      ? `<div class="result-card" style="border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.06)">
          <h2 style="font-size:13px">🔍 이번 런 분석</h2>
          ${_causeLines.map(l=>`<div class="row"><span>${l}</span></div>`).join('')}
        </div>` : '';

    const meteorBanner = endingType === 'meteor'
      ? `<div class="result-card panel" style="background:rgba(120,20,20,.6);border-color:#ef4444">
          <h2 style="color:#fca5a5">☄️ 운석 충돌 — 전체 멸종</h2>
          <div class="row"><span>거대한 빛과 지진과 함께 운석이 떨어져</span></div>
          <div class="row"><span>섬의 모든 생명이 멸종했습니다.</span></div>
        </div>`
      : endingType === 'primordial'
      ? `<div class="result-card panel" style="background:rgba(20,20,80,.7);border-color:#818cf8">
          <h2 style="color:#c7d2fe">🌈 진화의 정점 — 태초의 포식자 처치</h2>
          <div class="row"><span>수백만 년을 군림하던 태초의 포식자가 쓰러졌습니다.</span></div>
          <div class="row"><span>당신의 슬라임은 이 섬의 새로운 정점에 올랐습니다.</span></div>
        </div>`
      : endingType === 'golden'
      ? `<div class="result-card panel" style="background:rgba(80,60,0,.7);border-color:#fbbf24">
          <h2 style="color:#fde68a">✨ 황금의 전설 — 황금 슬라임 처치</h2>
          <div class="row"><span>전설 속에서만 전해지던 황금 슬라임이 모습을 드러냈습니다.</span></div>
          <div class="row"><span>극한까지 진화한 당신의 슬라임만이 이룰 수 있는 위업입니다.</span></div>
        </div>`
      : '';

    // 돌연변이 보급 현황 (최종 집단 기준)
    const finalInds = group.individuals.filter(i => !i.dead);
    const mutFreqMap = {};
    for (const ind of finalInds) {
      for (const id of (ind.mutations || [])) mutFreqMap[id] = (mutFreqMap[id] || 0) + 1;
    }
    const MUT_TYPE_COL = { good: '#22c55e', dual: '#60a5fa', bad: '#ef5555' };
    const topMuts = Object.entries(mutFreqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, cnt]) => {
        const m = MUTATIONS.find(x => x.id === id);
        if (!m) return null;
        const pct = finalInds.length ? Math.round(cnt / finalInds.length * 100) : 0;
        const col = MUT_TYPE_COL[m.type] || '#94a3b8';
        const isBig = pct >= 50;
        return `<div style="margin:${isBig?'8':'5'}px 0;padding:${isBig?'8px 10px':'4px 8px'};
          border-radius:12px;background:${isBig?'rgba(34,197,94,.1)':'transparent'};
          ${isBig?'border:1.5px solid rgba(34,197,94,.35)':''}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:${isBig?14:12}px;font-weight:900;color:var(--ink)">${m.name}${isBig?' 🏅':''}</span>
            <span style="font-size:${isBig?17:13}px;font-weight:900;color:${col}">${pct}% <span style="font-size:11px">(${cnt}마리)</span></span>
          </div>
          <div style="margin-top:3px;height:7px;background:rgba(110,99,132,.12);border-radius:999px;overflow:hidden">
            <div style="height:100%;border-radius:999px;background:${col};width:${pct}%"></div>
          </div>
        </div>`;
      }).filter(Boolean).join('');
    const geneChangeHtml = topMuts || '<div style="color:var(--ink-soft);font-size:12px">이번 런에서 돌연변이가 발현되지 않았습니다.</div>';

    // 최다 이벤트 지형 계산
    const eventEntries = Object.entries(this.terrainEventCount || {});
    let hotTerrainHtml = '<div class="row"><span class="label">이벤트 없음</span></div>';
    if (eventEntries.length) {
      eventEntries.sort((a, b) => b[1] - a[1]);
      const [topId, topCount] = eventEntries[0];
      const topTerrain = TERRAIN[topId];
      const topName = topTerrain ? `${topTerrain.ico} ${topTerrain.name}` : topId;
      const rows = eventEntries.slice(0, 4).map(([id, cnt]) => {
        const t = TERRAIN[id];
        const label = t ? `${t.ico} ${t.name}` : id;
        const bar = '█'.repeat(Math.round(cnt / topCount * 8)).padEnd(8, '░');
        return `<div class="row"><span>${label}</span><strong>${cnt}회 <span style="font-family:monospace;font-size:10px;color:var(--ink-soft)">${bar}</span></strong></div>`;
      });
      hotTerrainHtml = rows.join('');
    }

    // 돌연변이 결과
    const finalMutFreq = byMeteor ? (this.savedMeteorMutFreq || {}) : group.mutationFrequency();
    const gainedList = [...this.gainedMutationsThisGame].map(id => mutationById(id)).filter(Boolean);
    const finalList  = Object.entries(finalMutFreq)
      .sort((a,b) => b[1]-a[1])
      .map(([id, pct]) => ({ mut: mutationById(id), pct }))
      .filter(x => x.mut);

    const mutTypeColor = t => t==='good' ? 'var(--leaf-dk)' : t==='bad' ? 'var(--coral)' : 'var(--lilac-dk)';
    const mutBadge = t => t==='good' ? '✅' : t==='bad' ? '❌' : '🔵';

    // 도전과제 보너스 행 (달성한 것만)
    const achRows = doneAch.length
      ? doneAch.map(a => `<div class="row"><span>🏆 ${a.name}</span><strong class="good">+${a.bonus}</strong></div>`).join('')
      : '';

    document.getElementById('result-content').innerHTML = `
      ${unlockBanner}${diffBanner}${meteorBanner}${defeatAnalysis}
      ${(loadStats().totalGames <= 1) ? `<div class="result-card" style="border-color:rgba(99,102,241,.5);background:rgba(99,102,241,.08);text-align:center">
        <div style="font-size:22px;margin-bottom:6px">🌳</div>
        <div style="font-weight:900;font-size:14px;margin-bottom:4px">계통수에서 집단을 강화해보세요!</div>
        <div style="font-size:12px;color:var(--ink-soft);margin-bottom:10px">돌연변이 선택지 확대, 보스 저항, 유전 분석 등 다양한 업그레이드가 있습니다.</div>
        <button class="big-btn lilac" style="font-size:13px;padding:8px 20px" onclick="document.getElementById('result').style.display='none';openLab()">🌳 계통수 열기</button>
      </div>` : ''}

      <div class="result-card"><h2>📊 결과</h2>
        <div class="row"><span>생존 시간</span><strong>${minutes}분 ${seconds}초</strong></div>
        <div class="row"><span>${byMeteor ? '운석 사망 개체' : '최종 개체 수'}</span><strong>${resultPopulation}마리</strong></div>
        <div class="row"><span>세대</span><strong>${group.generation}세대</strong></div>
        <div class="row"><span>🧬 진화 레벨</span><strong>Lv.${this.evoLevel || 1} (+${Math.max(0, (this.evoLevel || 1) - 1) * 150}점)</strong></div>
        <div class="row"><span>보스 처치</span><strong>${this.achieveData.bossKills || 0}마리</strong></div>
        <div class="row"><span>전쟁 승리 / 포섭</span><strong>${group.wins}회 / +${group.recruited}마리</strong></div>
      </div>

      <div class="result-card"><h2>🧬 돌연변이</h2>
        <div style="font-size:11px;font-weight:800;color:var(--ink-soft);margin-bottom:6px">이번 런 획득 (${gainedList.length}종)</div>
        ${gainedList.length
          ? `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px">
              ${gainedList.map(m => `<span style="font-size:12px;padding:3px 9px;border-radius:999px;
                background:${m.type==='good' ? 'rgba(61,138,58,.12)' : m.type==='bad' ? 'rgba(249,101,88,.12)' : 'rgba(196,158,224,.15)'};
                color:${mutTypeColor(m.type)};font-weight:800;border:1.5px solid ${mutTypeColor(m.type)}40">
                ${mutBadge(m.type)} ${m.name}</span>`).join('')}
             </div>`
          : '<div style="color:var(--ink-soft);font-size:12px;margin-bottom:12px">획득 없음</div>'}
        <div style="font-size:11px;font-weight:800;color:var(--ink-soft);margin-bottom:6px">최종 보급률 (상위 4종)</div>
        ${geneChangeHtml || '<div style="color:var(--ink-soft);font-size:12px">없음</div>'}
        ${(LAB_BUFFS && LAB_BUFFS.geneVisLevel >= 3) ? `
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--ink-faint);display:flex;flex-wrap:wrap;gap:6px">
          ${[['color','🔴 몸색'],['speed','⚡ 속도'],['poison','☠️ 독성'],['armor','🛡️ 갑옷'],['charm','💗 매력']].map(([g,label])=>
            `<button onclick="showAlleleGraph('${g}')" style="font-size:12px;padding:4px 10px;border-radius:999px;border:1.5px solid var(--leaf-dk);background:rgba(61,138,58,.12);color:var(--leaf-dk);font-weight:800;cursor:pointer">${label}</button>`
          ).join('')}
        </div>` : ''}
      </div>

      ${doneAch.length ? `<div class="result-card"><h2>🏆 도전과제 달성</h2>${achRows}</div>` : ''}

      <div class="score">${score.toLocaleString()}점</div>
      <div style="text-align:center;margin-top:12px">
        <button id="result-register-btn" class="big-btn sky" type="button"
          style="font-size:14px;padding:10px 24px${_db ? '' : ';display:none'}"
          onclick="window._arenaScene?._endScoreData && openScoreSubmit(window._arenaScene._endScoreData)">
          🏆 기록 등록
        </button>
      </div>`;

    const titleMap = { meteor:'☄️ 멸종 엔딩', primordial:'🌈 진화의 정점', golden:'✨ 황금의 전설' };
    document.getElementById('result').querySelector('h1').textContent = titleMap[endingType] || '🏁 게임 종료';

    const isWin = endingType === 'primordial' || endingType === 'golden';
    if (isWin) {
      this._showVictorySplash(endingType, () => {
        document.getElementById('result').style.display = 'block';
      });
    } else {
      document.getElementById('result').style.display = 'block';
    }
  }

  _showVictorySplash(endingType, onDone) {
    // 파티클 (Phaser Graphics로 별 흩뿌리기)
    const colors = endingType === 'golden'
      ? [0xfbbf24, 0xfde68a, 0xffffff, 0xff9900]
      : [0x818cf8, 0xc7d2fe, 0x22c55e, 0xffffff];
    const particles = [];
    for (let i = 0; i < 60; i++) {
      const g = this.add.graphics().setDepth(100);
      const col = colors[Math.floor(Math.random() * colors.length)];
      g.fillStyle(col, 1);
      g.fillCircle(0, 0, 3 + Math.random() * 5);
      const cx = this.cameras.main.worldView.x + Math.random() * this.cameras.main.width;
      const cy = this.cameras.main.worldView.y + this.cameras.main.height * 0.3 + Math.random() * this.cameras.main.height * 0.4;
      g.setPosition(cx, cy);
      const vx = (Math.random() - 0.5) * 6;
      const vy = -(3 + Math.random() * 5);
      particles.push({ g, vx, vy, life: 1.0, decay: 0.008 + Math.random() * 0.012 });
    }

    // 풀스크린 오버레이
    const ov = document.createElement('div');
    ov.id = 'victory-splash';
    ov.style.cssText = `position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:${endingType==='golden' ? 'rgba(30,20,0,.92)' : 'rgba(10,5,30,.92)'};animation:fadeIn .4s ease`;
    const ico  = endingType === 'golden' ? '✨' : '🌈';
    const msg  = endingType === 'golden' ? '황금의 전설' : '진화의 정점';
    const sub  = endingType === 'golden' ? '극한까지 진화한 집단만이 이룰 수 있는 위업!' : '태초의 포식자를 쓰러뜨렸습니다!';
    const col  = endingType === 'golden' ? '#fbbf24' : '#818cf8';
    ov.innerHTML = `
      <div style="font-size:72px;animation:bounceIn .6s ease">${ico}</div>
      <div style="font-family:'Jua',sans-serif;font-size:32px;color:${col};margin:12px 0 6px;text-shadow:0 0 20px ${col}88">${msg}</div>
      <div style="font-size:14px;color:rgba(255,255,255,.75);margin-bottom:32px;text-align:center;padding:0 24px">${sub}</div>
      <div style="font-size:13px;color:rgba(255,255,255,.4)">터치하면 결과 화면으로</div>`;
    ov.addEventListener('click', () => {
      ov.style.animation = 'fadeOut .3s ease forwards';
      setTimeout(() => { ov.remove(); onDone(); }, 300);
    });
    document.body.appendChild(ov);

    // 파티클 틱
    let frame;
    const tick = () => {
      for (const p of particles) {
        if (!p.g.active) continue;
        p.vy += 0.12;
        p.g.x += p.vx;
        p.g.y += p.vy;
        p.life -= p.decay;
        p.g.setAlpha(Math.max(0, p.life));
        if (p.life <= 0) p.g.destroy();
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    // 4초 후 자동 진행
    setTimeout(() => {
      cancelAnimationFrame(frame);
      particles.forEach(p => { if (p.g.active) p.g.destroy(); });
      if (document.getElementById('victory-splash')) {
        ov.remove(); onDone();
      }
    }, 4000);
  }
}

