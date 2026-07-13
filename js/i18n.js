'use strict';
// ═══════════════════════════════════════════════════════════
//  i18n — 한국어 / English 번역 시스템
// ═══════════════════════════════════════════════════════════
const TRANSLATIONS = {
  ko: {
    title: '슬라임의 기원', title_en: 'Origin of Slime',
    start: '🌱 게임 시작', dex: '📖 도감', lab: '🌳 계통수', options: '⚙️ 옵션',
    infinite: '♾️ 무한 생존',
    breed: '번식', flee: '도망', pause: '일시정지', resume: '계속',
    opt_title: '⚙️ 옵션', opt_bgm: '🎵 배경음', opt_sfx: '🔊 효과음',
    opt_fullscreen: '⛶ 전체화면', opt_mutpick: '✨ 진화 선택창',
    opt_tutorial: '📖 튜토리얼 초기화', opt_reset: '⚠️ 계정 초기화',
    opt_reset_desc: '계통수 해금·통계·업적 등 모든 진행 데이터를 삭제합니다.',
    opt_reset_btn: '🗑️ 전체 데이터 초기화',
    opt_lang: '🌐 언어', close: '✕ 닫기',
    food: '식량', pop: '개체', gen: '세대',
    breed_ok: '🥚 번식 가능', breed_no: '번식 불가',
    mode_normal: '일반', mode_infinite: '♾️ 무한 생존',
    kb_breed: '번식', kb_pause: '일시정지', kb_dex: '도감',
    kb_lab: '계통수', kb_mute: '음소거', kb_fs: '전체화면',
    next_boss: '다음 보스', cur_mode: '현재 모드',
    waiting: '대기 중…', all_done: '✅ 모든 보스 처치',
    inf_ongoing: '♾️ 계속 진행 중',
    quit: '🚪 게임 종료', ok: '확인', cancel: '취소',
    confirm_quit: '게임을 종료할까요?',
    confirm_home: '메인 메뉴로 돌아갈까요?\n현재 게임이 종료됩니다.',
  },
  en: {
    title: 'Origin of Slime', title_en: '',
    start: '🌱 Start Game', dex: '📖 Compendium', lab: '🌳 Gene Tree', options: '⚙️ Options',
    infinite: '♾️ Infinite Survival',
    breed: 'Breed', flee: 'Flee', pause: 'Pause', resume: 'Resume',
    opt_title: '⚙️ Options', opt_bgm: '🎵 BGM', opt_sfx: '🔊 SFX',
    opt_fullscreen: '⛶ Fullscreen', opt_mutpick: '✨ Evolution Choice',
    opt_tutorial: '📖 Reset Tutorial', opt_reset: '⚠️ Reset Account',
    opt_reset_desc: 'Deletes all progress: gene tree unlocks, stats, achievements.',
    opt_reset_btn: '🗑️ Reset All Data',
    opt_lang: '🌐 Language', close: '✕ Close',
    food: 'Food', pop: 'Pop', gen: 'Gen',
    breed_ok: '🥚 Can Breed', breed_no: 'Cannot Breed',
    mode_normal: 'Normal', mode_infinite: '♾️ Infinite Survival',
    kb_breed: 'Breed', kb_pause: 'Pause', kb_dex: 'Compendium',
    kb_lab: 'Gene Tree', kb_mute: 'Mute', kb_fs: 'Fullscreen',
    next_boss: 'Next Boss', cur_mode: 'Mode',
    waiting: 'Waiting…', all_done: '✅ All Bosses Defeated',
    inf_ongoing: '♾️ Ongoing',
    quit: '🚪 Quit Game', ok: 'OK', cancel: 'Cancel',
    confirm_quit: 'Quit the game?',
    confirm_home: 'Return to the main menu?\nYour current run will end.',
  }
};
let _lang = Save.get('gpa_lang') || 'ko';
function T(key) { return (TRANSLATIONS[_lang] || TRANSLATIONS.ko)[key] || TRANSLATIONS.ko[key] || key; }
function setLang(lang) {
  _lang = lang;
  Save.set('gpa_lang', lang);
  applyI18n();
}
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = T(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = T(el.getAttribute('data-i18n-placeholder'));
  });
  // 타이틀 화면
  const h1 = document.querySelector('#title-screen h1');
  if (h1) {
    h1.childNodes[0].textContent = T('title');
    const en = h1.querySelector('.en');
    if (en) en.textContent = T('title_en');
  }
  document.documentElement.lang = _lang;
}

