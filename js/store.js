/* 背词 · 数据层：状态、调度、导入导出
 * 数据只存在本机 localStorage；没有账号、没有后端。
 */

export const KEY = 'beici_v1';
export const BOX_DAYS = [1, 2, 4, 7, 15, 30];
export const CAP = { light: { n: 15, r: 100, m: 15 }, std: { n: 30, r: 180, m: 25 }, hard: { n: 45, r: 270, m: 40 } };
export const XP = { 1: 3, 2: 6, 3: 10 };

export function todayISO() {
  const t = new Date(Date.now() + 8 * 3600e3);
  return t.toISOString().slice(0, 10);
}
export function addDays(iso, d) {
  const t = new Date(iso + 'T00:00:00+08:00');
  t.setDate(t.getDate() + d);
  return new Date(t.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00+08:00') - new Date(a + 'T00:00:00+08:00')) / 864e5);
}

export function defaultState() {
  return {
    version: 1,
    settings: { intensity: 'std', exam: '2027-12-19' },
    cards: {},          // word -> {box, due, seen}
    mastered: {},       // word -> true（到第 6 箱且自评认识）
    stats: { xp: 0, streak: 0, lastDay: '', gateDone: '' },
    lastExport: ''
  };
}

export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && raw.cards) return Object.assign(defaultState(), raw);
  } catch (e) { /* 损坏就用默认值 */ }
  return defaultState();
}
export function save(S) {
  localStorage.setItem(KEY, JSON.stringify(S));
}
export function reset() {
  localStorage.removeItem(KEY);
}

export function learnedCount(S) { return Object.keys(S.cards).length; }
export function masteredCount(S) { return Object.keys(S.mastered || {}).length; }

export function dueWords(S, today) {
  return Object.keys(S.cards)
    .filter((w) => S.cards[w].due && S.cards[w].due <= today)
    .sort((a, b) => (S.cards[a].due < S.cards[b].due ? -1 : 1));
}

/** 新词顺序：调用方传入已按频次排好的词表 */
export function newWords(S, words, n) {
  const out = [];
  for (const it of words) {
    if (out.length >= n) break;
    if (!S.cards[it.w]) out.push(it.w);
  }
  return out;
}

/**
 * 建立今日队列：第一关固定 5 张（优先新词，没新词用复习）
 * 之后 = 剩余复习 -> 剩余新词
 */
export function buildQueue(S, words, today) {
  const cap = CAP[S.settings.intensity] || CAP.std;
  const reviews = dueWords(S, today).slice(0, cap.r);
  const news = newWords(S, words, cap.n);
  const gate = (news.length ? news.slice(0, 5) : reviews.slice(0, 5)).map((w) => ({ w, mode: 'new' }));
  const gateSet = new Set(gate.map((g) => g.w));
  const restRev = reviews.filter((w) => !gateSet.has(w)).map((w) => ({ w, mode: 'review' }));
  const restNew = news.filter((w) => !gateSet.has(w)).map((w) => ({ w, mode: 'new' }));
  return {
    queue: gate.concat(restRev, restNew),
    stat: { newCount: news.length, reviewCount: reviews.length, cap }
  };
}

/** 自评：1 忘了 / 2 模糊 / 3 认识 */
export function applyGrade(S, word, g, today) {
  const c = S.cards[word] || { box: 1, due: today, seen: 0 };
  c.seen = (c.seen || 0) + 1;
  let box = c.box || 1;
  if (g === 3) box = Math.min(6, box + 1);
  else if (g === 2) box = box;          // 留箱，明天再现
  else box = 1;                          // 回第 1 箱

  c.box = box;
  c.due = addDays(today, g === 2 ? 1 : BOX_DAYS[box - 1]);
  S.cards[word] = c;

  if (g === 3 && box === 6) S.mastered[word] = true;

  S.stats.xp = (S.stats.xp || 0) + (XP[g] || 0);
  save(S);
  return c;
}

export function markGateDone(S, today) {
  if (S.stats.gateDone === today) return S.stats.streak;
  const y = addDays(today, -1);
  S.stats.streak = S.stats.lastDay === y ? (S.stats.streak || 0) + 1 : 1;
  S.stats.lastDay = today;
  S.stats.gateDone = today;
  save(S);
  return S.stats.streak;
}

export function backupAgeDays(S) {
  if (!S.lastExport) return 999;
  return daysBetween(S.lastExport, todayISO());
}
