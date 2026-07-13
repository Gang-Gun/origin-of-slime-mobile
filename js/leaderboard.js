'use strict';
// ══════════════════════════════════════════════════════
// ▶ Firebase 설정 — Firebase Console에서 발급받은 값으로 교체
// ══════════════════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyAtKAaC-Tx1vTGi7f-iNEUZBOwzLjjZflk",
  authDomain:        "origin-of-slime.firebaseapp.com",
  projectId:         "origin-of-slime",
  storageBucket:     "origin-of-slime.firebasestorage.app",
  messagingSenderId: "762926262190",
  appId:             "1:762926262190:web:7f6c8d42f172a7b06c4a3f",
};

let _db = null; // Firestore 인스턴스 (초기화 성공 시 할당)
let _lbUnsub = null; // onSnapshot 구독 해제 함수

function initFirebase() {
  try {
    if (FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') return; // 미설정 → 순위표 숨김
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
  } catch (e) {
    console.warn('[Leaderboard] Firebase init failed:', e);
  }
}

// ── Firebase SDK 동적 로드 (오프라인이면 순위표만 조용히 비활성화) ──
function _loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('script load failed: ' + src));
    document.head.appendChild(s);
  });
}
let _fbSdkPromise = null;
function _ensureFirebaseSdk() {
  if (typeof firebase !== 'undefined') return Promise.resolve();
  if (!_fbSdkPromise) {
    _fbSdkPromise = _loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
      .then(() => _loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'))
      .catch(e => { _fbSdkPromise = null; throw e; });
  }
  return _fbSdkPromise;
}

// ── 순위표: 실시간 로드 ──────────────────────────────
async function initLeaderboard() {
  try {
    await _ensureFirebaseSdk();
  } catch (e) {
    console.warn('[Leaderboard] Firebase SDK 로드 실패 (오프라인?) — 순위표 비활성화:', e.message);
    return; // 오프라인: 패널 숨김 유지, 게임은 정상 동작
  }
  initFirebase();
  if (!_db) return; // Firebase 미설정 시 패널 숨김 유지
  // SDK 로드를 기다리는 사이 게임이 시작됐으면 (튜토리얼 직후 자동 재시작 등)
  // 게임 화면 위에 순위표·기록 버튼을 띄우지 않는다 — 타이틀 화면에서만 표시
  if (game || document.getElementById('title-screen').style.display === 'none') return;
  document.getElementById('leaderboard-panel').style.display = 'flex';
  document.getElementById('stats-corner-btn').style.display = 'block';
  _startLeaderboardListener();
}

function _startLeaderboardListener() {
  if (!_db) return;
  if (_lbUnsub) _lbUnsub(); // 기존 구독 해제
  _lbUnsub = _db.collection('leaderboard')
    .orderBy('score', 'desc')
    .limit(10)
    .onSnapshot(snap => {
      const list = document.getElementById('leaderboard-list');
      if (!list) return;
      if (snap.empty) {
        list.innerHTML = '<li class="lb-empty">아직 기록이 없어요!</li>';
        return;
      }
      const medals = ['🥇','🥈','🥉'];
      const rows = snap.docs.map((doc, i) => {
        const d = doc.data();
        const rank = medals[i] || `${i + 1}.`;
        return { rank, name: d.name || '이름 없음', score: d.score, gen: d.generations, mut: d.mutations, date: d.date };
      });
      list.innerHTML = rows.map(r => `<li>
          <div class="lb-top">
            <span class="lb-rank">${r.rank}</span>
            <span class="lb-name">${escHtml(r.name)}</span>
            <span class="lb-score">${Number(r.score).toLocaleString()}점</span>
          </div>
          <div class="lb-sub">세대 ${escHtml(String(r.gen ?? '?'))} · 돌연변이 ${escHtml(String(r.mut ?? '?'))}종 · ${escHtml(String(r.date ?? ''))}</div>
        </li>`).join('');
      // PC 사이드바 미러 업데이트
      const mirror = document.getElementById('pc-lb-mirror');
      if (mirror) {
        mirror.innerHTML = rows.slice(0, 5).map(r =>
          `<div style="display:flex;justify-content:space-between;gap:4px;padding:2px 0;border-bottom:1px solid var(--ink-faint)">
            <span>${r.rank} ${escHtml(r.name)}</span>
            <span style="color:var(--coral);font-weight:900">${Number(r.score).toLocaleString()}</span>
          </div>`
        ).join('') || '<div style="color:var(--ink-soft);font-size:11px">아직 기록 없음</div>';
      }
    }, err => {
      console.warn('[Leaderboard] 구독 오류:', err);
    });
}

function stopLeaderboard() {
  if (_lbUnsub) { _lbUnsub(); _lbUnsub = null; }
  document.getElementById('leaderboard-panel').style.display = 'none';
  document.getElementById('stats-corner-btn').style.display = 'none';
}

function toggleLeaderboard() {
  const panel = document.getElementById('leaderboard-panel');
  panel.classList.toggle('collapsed');
}

// ── 점수 등록 ────────────────────────────────────────
let _pendingScore = null; // openScoreSubmit() 호출 시 임시 저장
let _scoreSubmitted = false; // 게임당 1회만 등록 (리로드 시 초기화)

function openScoreSubmit({ score, generations, mutations }) {
  if (_scoreSubmitted) return; // 이미 등록한 게임
  _pendingScore = { score, generations, mutations };
  document.getElementById('lb-score-preview').textContent = score.toLocaleString() + '점';
  document.getElementById('lb-sub-preview').textContent =
    `세대 ${generations} · 돌연변이 ${mutations}종`;
  document.getElementById('lb-name-input').value = '';
  document.getElementById('lb-submit-btn').disabled = false;
  document.getElementById('lb-feedback').textContent = '';
  document.getElementById('score-submit-modal').classList.add('open');
  setTimeout(() => document.getElementById('lb-name-input').focus(), 100);
}

function closeScoreSubmit() {
  document.getElementById('score-submit-modal').classList.remove('open');
  _pendingScore = null;
}

async function submitScoreFromModal() {
  if (document.getElementById('lb-submit-btn').disabled) return;
  if (!_pendingScore || !_db) { closeScoreSubmit(); return; }
  const name = document.getElementById('lb-name-input').value.trim();
  if (!name) {
    document.getElementById('lb-feedback').textContent = '이름을 입력해주세요!';
    return;
  }
  document.getElementById('lb-submit-btn').disabled = true;
  try {
    const now = new Date();
    const date = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}`;
    await _db.collection('leaderboard').add({
      name,
      score:       _pendingScore.score,
      generations: _pendingScore.generations,
      mutations:   _pendingScore.mutations,
      date,
      timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
    });
    _scoreSubmitted = true; // 게임당 1회 제한
    const regBtn = document.getElementById('result-register-btn');
    if (regBtn) { regBtn.disabled = true; regBtn.textContent = '✅ 등록 완료'; regBtn.style.opacity = '0.5'; }
    document.getElementById('lb-feedback').textContent = '✅ 등록 완료!';
    setTimeout(() => closeScoreSubmit(), 1200);
  } catch (e) {
    console.warn('[Leaderboard] 등록 실패:', e);
    document.getElementById('lb-feedback').textContent = '등록에 실패했습니다.';
    document.getElementById('lb-submit-btn').disabled = false;
  }
}

// Enter 키로 등록
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('score-submit-modal').classList.contains('open')) {
    submitScoreFromModal();
  }
});

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

