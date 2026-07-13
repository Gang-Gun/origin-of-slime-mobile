'use strict';
// ════════════════════════════════════════════
//  SaveStore — 통합 저장 시스템
// ════════════════════════════════════════════
// 흩어져 있던 gpa_* localStorage 키를 버전 있는 2개 섹션으로 통합한다.
//   options  — 기기별 설정 (언어·볼륨·이동방식 등). Steam Cloud 제외 대상.
//   progress — 진행 데이터 (도전과제·계통수·통계 등). Steam Cloud 동기화 대상.
// 플랫폼 어댑터:
//   Electron(window.desktop.*): userData의 options.json / progress.json 파일
//   웹: localStorage 'gpa_options' / 'gpa_progress' 두 키
// 레거시 gpa_* 개별 키는 최초 실행 시 1회 마이그레이션 후 제거된다.
// 인터페이스는 localStorage와 동일한 문자열 key-value(get/set/remove)라
// 호출부는 키 이름을 그대로 쓰면 된다.

const Save = (() => {
  const VERSION = 1;

  // 기기별 설정으로 분류되는 키 — 나머지 gpa_* 키(동적 키 포함)는 전부 progress
  const OPTION_KEYS = new Set([
    'gpa_lang', 'gpa_bgm_off', 'gpa_bgm_vol', 'gpa_sfx_vol',
    'gpa_move_mode', 'gpa_mutpick_off', 'gpa_breedpick_off',
    'gpa_terrain_notify', 'gpa_speed_val', 'gpa_keymap', 'gpa_ui_scale',
  ]);
  const STORE_KEY = { options: 'gpa_options', progress: 'gpa_progress' };
  const SECTIONS = ['options', 'progress'];

  function sectionOf(key) { return OPTION_KEYS.has(key) ? 'options' : 'progress'; }

  // ── 플랫폼 어댑터 ──────────────────────────────────
  function desktopApi() {
    return (typeof window !== 'undefined' && window.desktop) ? window.desktop : null;
  }
  function rawLoad(section) {
    try {
      const d = desktopApi();
      if (d && d.loadDataSync) return d.loadDataSync(section);
      return localStorage.getItem(STORE_KEY[section]);
    } catch (e) { console.warn('[Save] load 실패:', section, e); return null; }
  }
  function rawPersist(section, json) {
    try {
      const d = desktopApi();
      if (d && d.saveData) { d.saveData(section, json); return; }
      localStorage.setItem(STORE_KEY[section], json);
    } catch (e) { console.warn('[Save] persist 실패:', section, e); }
  }
  function rawDelete(section) {
    try {
      const d = desktopApi();
      if (d && d.deleteData) { d.deleteData(section); return; }
      localStorage.removeItem(STORE_KEY[section]);
    } catch { /* 무시 */ }
  }

  // ── 버전 마이그레이션 ──────────────────────────────
  // 스키마가 바뀌면 VERSION을 올리고 MIGRATIONS[새버전] = (data) => 새data 를 추가한다.
  const MIGRATIONS = {};

  function parseSection(json) {
    if (typeof json !== 'string' || !json) return null;
    try {
      const sec = JSON.parse(json);
      if (!sec || typeof sec !== 'object' || typeof sec.v !== 'number'
          || !sec.data || typeof sec.data !== 'object') return null;
      while (sec.v < VERSION) {
        const up = MIGRATIONS[sec.v + 1];
        if (!up) break;
        sec.data = up(sec.data);
        sec.v += 1;
      }
      return sec;
    } catch { return null; }
  }

  // ── 레거시(흩어진 gpa_* 키) → 섹션 1회 마이그레이션 ──
  function migrateLegacy(state) {
    let found = false;
    try {
      const legacy = Object.keys(localStorage)
        .filter(k => k.startsWith('gpa_') && k !== STORE_KEY.options && k !== STORE_KEY.progress);
      for (const k of legacy) {
        const v = localStorage.getItem(k);
        if (v === null) continue;
        state[sectionOf(k)].data[k] = v;
        found = true;
      }
      if (found) {
        rawPersist('options', JSON.stringify(state.options));
        rawPersist('progress', JSON.stringify(state.progress));
        legacy.forEach(k => localStorage.removeItem(k));
        console.log(`[Save] 레거시 저장 ${legacy.length}개 키 마이그레이션 완료`);
      }
    } catch (e) { console.warn('[Save] 레거시 마이그레이션 실패:', e); }
    return found;
  }

  // ── 초기화 (스크립트 로드 시 동기 실행 — 이후 스크립트가 바로 읽는다) ──
  const state = {};
  for (const s of SECTIONS) state[s] = parseSection(rawLoad(s)) || { v: VERSION, data: {} };
  if (Object.keys(state.options.data).length === 0 && Object.keys(state.progress.data).length === 0) {
    migrateLegacy(state);
  }

  // ── 쓰기: 웹은 즉시, 데스크톱(파일 IPC)은 디바운스 + flush ──
  const dirty = new Set();
  let flushTimer = 0;
  function persist(section) { rawPersist(section, JSON.stringify(state[section])); }
  function markDirty(section) {
    if (!desktopApi()) { persist(section); return; }
    dirty.add(section);
    if (flushTimer) return;
    flushTimer = setTimeout(() => { flushTimer = 0; flush(); }, 200);
  }
  function flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = 0; }
    for (const s of dirty) persist(s);
    dirty.clear();
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('beforeunload', flush);
  }

  // ── 공개 API (localStorage 호환 문자열 시맨틱) ──────
  return {
    get(key) {
      const v = state[sectionOf(key)].data[key];
      return v === undefined ? null : v;
    },
    set(key, value) {
      const section = sectionOf(key);
      state[section].data[key] = String(value);
      markDirty(section);
    },
    remove(key) {
      const section = sectionOf(key);
      if (key in state[section].data) {
        delete state[section].data[key];
        markDirty(section);
      }
    },
    resetAll() {
      for (const s of SECTIONS) { state[s] = { v: VERSION, data: {} }; rawDelete(s); }
      try {
        Object.keys(localStorage).filter(k => k.startsWith('gpa_'))
          .forEach(k => localStorage.removeItem(k));
      } catch { /* 무시 */ }
      dirty.clear();
    },
    flush,
  };
})();
