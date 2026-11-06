import {
  CAP, XP, todayISO, daysBetween, load, save, reset,
  learnedCount, masteredCount, dueWords, newWords, buildQueue,
  applyGrade, markGateDone, backupAgeDays
} from './store.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let WORDS = [];            // 已按真题频次降序
let BYW = new Map();
let S = load();
let queue = [], cur = null, done = 0, flipped = false, started = false;

function toast(msg, ms = 1400) {
  const root = $('toast-root');
  const n = el('div', 'toast', msg);
  root.appendChild(n);
  setTimeout(() => n.remove(), ms);
}

async function boot() {
  try {
    const res = await fetch('./data/words.json', { cache: 'force-cache' });
    const data = await res.json();
    WORDS = data.words || data;
    BYW = new Map(WORDS.map((w) => [w.w, w]));
    $('boot').hidden = true;
    renderHome();
  } catch (e) {
    $('boot').textContent = '词库载入失败：' + e.message + '（请用本地预览或部署后打开）';
  }
}

function wdata(w) { return BYW.get(w) || { w, d: '（缺释义）' }; }

/* ---------------- 视图 ---------------- */
function show(view) {
  for (const k of ['home', 'card', 'set']) $('view-' + k).hidden = k !== view;
  $('tabbar').hidden = view === 'card';
}

function renderHome() {
  const today = todayISO();
  const exam = S.settings.exam || '2027-12-19';
  const dd = daysBetween(today, exam);
  $('hd-sub').textContent = today;
  $('hd-title').textContent = dd > 0 ? `距考试 ${dd} 天` : (dd === 0 ? '今天考试' : `考试已过 ${-dd} 天`);

  const cap = CAP[S.settings.intensity] || CAP.std;
  const nNew = Math.min(newWords(S, WORDS, cap.n).length, cap.n);
  const nRev = Math.min(dueWords(S, today).length, cap.r);
  $('home-new').textContent = nNew;
  $('home-rev').textContent = nRev;
  $('home-learned').textContent = learnedCount(S);
  $('home-mastered').textContent = masteredCount(S);
  $('home-xp').textContent = S.stats.xp || 0;
  $('home-streak').textContent = '🔥 ' + (S.stats.streak || 0);
  $('home-cap').textContent = `强度：${{ light: '轻', std: '标准', hard: '猛' }[S.settings.intensity]} · ${cap.n} 新词 / ${cap.r} 复习 / ${cap.m} 分钟`;

  const age = backupAgeDays(S);
  const banner = $('backup-banner');
  if (learnedCount(S) > 0 && age >= 7) {
    banner.hidden = false;
    banner.textContent = '';
    banner.appendChild(el('span', null,
      age > 300 ? '还没有备份过进度，建议现在导出一次' : `已经 ${age} 天没备份了，导出一次更安全`));
    const b = el('button', null, '导出');
    b.addEventListener('click', exportJSON);
    banner.appendChild(b);
  } else banner.hidden = true;
}

function startSession() {
  const today = todayISO();
  const r = buildQueue(S, WORDS, today);
  queue = r.queue; done = 0; started = true; flipped = false;
  if (!queue.length) { toast('今天没有到期卡片，休息一下'); return; }
  show('card');
  nextCard();
}

function nextCard() {
  if (done >= queue.length) return finish();
  cur = queue[done];
  flipped = false;
  const d = wdata(cur.w);
  const mode = cur.mode === 'new' ? '新词' : '复习';
  $('card-mode').textContent = `${mode} · 第 ${done + 1} / ${queue.length} 张`;
  $('card-word').textContent = d.w;
  $('card-freq').textContent = d.f ? `真题出现 ${d.f} 次` : '';
  $('card-def').textContent = d.d || '—';

  const ex = $('card-ex');
  if (d.e) {
    ex.hidden = false;
    ex.textContent = '';
    ex.appendChild(el('span', 'ex-tag', d.y ? d.y + ' 真题' : '真题'));
    ex.appendChild(el('span', 'ex-text', d.e));
  } else ex.hidden = true;

  $('card-back').hidden = true;
  $('btn-flip').hidden = false;
  $('grades').hidden = true;
  $('gate').hidden = true;
  $('prog').style.width = Math.round((100 * done) / Math.max(1, queue.length)) + '%';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function flip() {
  if (!cur) return;
  flipped = true;
  $('card-back').hidden = false;
  $('btn-flip').hidden = true;
  $('grades').hidden = false;
}

function grade(g) {
  if (!flipped || !cur) return;
  const today = todayISO();
  applyGrade(S, cur.w, g, today);
  if (g === 1) queue.push({ w: cur.w, mode: 'review' });   // 忘了：今天晚些再现
  done++;
  toast('+' + (XP[g] || 0) + ' XP');
  $('prog').style.width = Math.round((100 * done) / Math.max(1, queue.length)) + '%';

  if (done === 5) return showGate();
  setTimeout(nextCard, 90);
}

function showGate() {
  const today = todayISO();
  const streak = markGateDone(S, today);
  $('gate-streak').textContent = `🔥 ${streak} 天`;
  $('gate').hidden = false;
  $('card-body').hidden = true;
  $('btn-flip').hidden = true;
  $('grades').hidden = true;
}

function continueAfterGate() {
  $('gate').hidden = true;
  $('card-body').hidden = false;
  nextCard();
}

function finish() {
  started = false;
  show('home');
  renderHome();
  toast('今日完成，做得够好了');
}

/* ---------------- 设置 ---------------- */
function renderSet() {
  $('set-intensity').value = S.settings.intensity;
  $('set-exam').value = S.settings.exam || '';
  const cap = CAP[S.settings.intensity] || CAP.std;
  $('set-cap').textContent = `${cap.n} 新词 / 复习上限 ${cap.r} / ${cap.m} 分钟`;
  $('set-learned').textContent = learnedCount(S);
  $('set-mastered').textContent = masteredCount(S);
  $('set-total').textContent = WORDS.length;
  $('set-streak').textContent = S.stats.streak || 0;
  $('set-xp').textContent = S.stats.xp || 0;
  $('set-export-age').textContent = S.lastExport ? S.lastExport : '从未';
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = `背词进度-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  S.lastExport = todayISO();
  save(S);
  renderHome();
  toast('已导出，存到「文件」App 里');
}

function importJSON(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const obj = JSON.parse(fr.result);
      if (!obj || !obj.cards) throw new Error('不是背词备份文件');
      S = Object.assign({ settings: {}, stats: {} }, obj);
      save(S);
      renderSet(); renderHome();
      toast('已恢复进度：' + Object.keys(obj.cards).length + ' 词');
    } catch (e) { toast('恢复失败：' + e.message, 2600); }
  };
  fr.readAsText(file);
}

/* ---------------- 交互 ---------------- */
function wire() {
  $('btn-start').addEventListener('click', startSession);
  $('btn-flip').addEventListener('click', flip);
  $('btn-go').addEventListener('click', continueAfterGate);
  $('btn-stop').addEventListener('click', () => { show('home'); renderHome(); toast('今天到这，已打卡'); });
  $('btn-tts').addEventListener('click', () => {
    if (!cur) return;
    try {
      const u = new SpeechSynthesisUtterance(cur.w);
      u.lang = 'en-US'; u.rate = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { toast('这台设备不支持发音'); }
  });
  $('btn-hint').addEventListener('click', () => {
    if (!cur) return;
    const d = wdata(cur.w);
    toast(`提示：${d.w.slice(0, 2)}… 共 ${d.w.length} 个字母`);
  });
  $('grades').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-g]');
    if (b) grade(+b.dataset.g);
  });
  $('tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (!b) return;
    const v = b.dataset.view;
    if (v === 'set') { show('set'); renderSet(); } else { show('home'); renderHome(); }
  });
  $('set-intensity').addEventListener('change', (e) => {
    S.settings.intensity = e.target.value; save(S); renderSet(); renderHome();
  });
  $('set-exam').addEventListener('change', (e) => {
    S.settings.exam = e.target.value; save(S); renderHome();
  });
  $('btn-export').addEventListener('click', exportJSON);
  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importJSON(f);
    e.target.value = '';
  });
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('清空全部进度？建议先导出备份。')) return;
    reset();
    S = load();
    renderSet(); renderHome();
    toast('已清空');
  });
}

/* ---------------- 启动 ---------------- */
wire();
boot();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
