/**
 * Adaptive Difficulty Engine v2
 *
 * Upgrade from simple EMA to IRT-inspired scoring:
 *   - Student ability (theta) updated via simplified 2PL IRT
 *   - Per-topic knowledge tracing with mastery scores
 *   - Engagement safeguards: frustration & boredom prevention
 *   - Gemini API integration with static fallback
 *
 * Latency budget per question cycle:
 *   Gemini call ~400ms | Engine update ~5ms | React render ~50ms → <500ms total
 */

// ── IRT Parameters ──
const LEARNING_RATE = 0.4;       // how fast theta moves per answer
const DIFFICULTY_B = { easy: -1.0, medium: 0.0, hard: 1.5 };  // item difficulty params
const DISCRIMINATION = 1.2;      // item discrimination (a-parameter)

// Difficulty band thresholds (theta → band)
const BAND_THRESHOLDS = { easy: -0.5, medium: 0.6 };
// theta < -0.5 → easy, -0.5..0.6 → medium, >0.6 → hard

// Engagement safeguards
const MAX_CONSECUTIVE_SAME_DIFF = 4;  // max questions at same difficulty in a row
const STREAK_JUMP_THRESHOLD = 3;      // consecutive correct/wrong to force band shift
const COOLDOWN_AFTER_JUMP = 2;        // questions before another forced jump

export const DIFFICULTY_LEVELS = {
  easy:   { label: 'Easy',   color: '#10b981', value: 0.2, emoji: '🌱' },
  medium: { label: 'Medium', color: '#f59e0b', value: 0.5, emoji: '⚡' },
  hard:   { label: 'Hard',   color: '#ef4444', value: 0.8, emoji: '🔥' },
};

// ── IRT logistic function ──
function irtProbability(theta, difficulty) {
  const b = DIFFICULTY_B[difficulty] ?? 0;
  return 1 / (1 + Math.exp(-DISCRIMINATION * (theta - b)));
}

// ── Map theta to difficulty band ──
function thetaToBand(theta) {
  if (theta < BAND_THRESHOLDS.easy) return 'easy';
  if (theta > BAND_THRESHOLDS.medium) return 'hard';
  return 'medium';
}

/**
 * Create a fresh adaptive session state.
 * @param {string} topic
 * @param {object} [opts]
 * @param {'easy'|'medium'|'hard'|'adaptive'} [opts.startDifficulty='adaptive']
 *        User-chosen starting difficulty. 'adaptive' = engine decides (medium, theta=0).
 */
export function createSession(topic, opts = {}) {
  const startDifficulty = opts.startDifficulty || 'adaptive';
  // Seed theta so the engine respects the user's chosen starting band.
  const seedTheta = {
    easy:   -0.9,
    medium:  0.0,
    hard:    1.0,
    adaptive: 0.0,
  }[startDifficulty] ?? 0;
  const seedDifficulty = startDifficulty === 'adaptive' ? 'medium' : startDifficulty;
  return {
    topic,
    startDifficulty,           // user preference (informational)
    theta: seedTheta,
    difficulty: seedDifficulty,
    currentStreak: 0,
    consecutiveSameDiff: 0,
    cooldownRemaining: 0,
    questionsAnswered: 0,
    correctCount: 0,
    totalTimeSpent: 0,
    totalMarks: 0,
    earnedMarks: 0,
    history: [],
    startedAt: Date.now(),
  };
}

/**
 * Time bonus factor: faster correct → higher weight (0.5–1.0)
 */
function timeFactor(timeMs) {
  const s = timeMs / 1000;
  if (s <= 3) return 1.0;
  if (s >= 30) return 0.5;
  return 1.0 - (s - 3) / (30 - 3) * 0.5;
}

/**
 * Core IRT-inspired update. Returns new session after processing an answer.
 */
export function processAnswer(session, questionId, isCorrect, timeSpentMs, questionDifficulty, marks = 5) {
  const tf = timeFactor(timeSpentMs);
  const expectedP = irtProbability(session.theta, questionDifficulty);

  // IRT theta update: delta = lr * (observed - expected) * timeFactor
  const observed = isCorrect ? 1 : 0;
  let deltaTheta = LEARNING_RATE * (observed - expectedP) * (isCorrect ? tf : 1);
  let newTheta = session.theta + deltaTheta;

  // Streak tracking
  let streak = session.currentStreak;
  streak = isCorrect ? (streak >= 0 ? streak + 1 : 1) : (streak <= 0 ? streak - 1 : -1);

  // ── Engagement safeguards ──
  let consecutiveSame = session.consecutiveSameDiff;
  let cooldown = Math.max(0, session.cooldownRemaining - 1);
  let rawBand = thetaToBand(newTheta);

  // Safeguard 1: Streak jump (frustration/boredom spiral prevention)
  if (cooldown === 0) {
    if (streak >= STREAK_JUMP_THRESHOLD && rawBand !== 'hard') {
      // Student is too comfortable → push up
      newTheta = Math.min(2, newTheta + 0.3);
      rawBand = thetaToBand(newTheta);
      cooldown = COOLDOWN_AFTER_JUMP;
    } else if (streak <= -STREAK_JUMP_THRESHOLD && rawBand !== 'easy') {
      // Student is struggling → ease off
      newTheta = Math.max(-2, newTheta - 0.3);
      rawBand = thetaToBand(newTheta);
      cooldown = COOLDOWN_AFTER_JUMP;
    }
  }

  // Safeguard 2: Don't stay at same difficulty too long
  if (rawBand === session.difficulty) {
    consecutiveSame++;
    if (consecutiveSame >= MAX_CONSECUTIVE_SAME_DIFF && cooldown === 0) {
      // Force a small nudge toward medium (variety)
      if (rawBand === 'easy') newTheta += 0.15;
      else if (rawBand === 'hard') newTheta -= 0.15;
      rawBand = thetaToBand(newTheta);
      consecutiveSame = 0;
    }
  } else {
    consecutiveSame = 0;
  }

  // Clamp theta to [-2, 2]
  newTheta = Math.max(-2, Math.min(2, newTheta));
  const newDifficulty = thetaToBand(newTheta);

  const earnedForThis = isCorrect ? marks : 0;

  const entry = {
    questionId,
    correct: isCorrect,
    timeSpent: timeSpentMs,
    difficulty: questionDifficulty,
    theta: newTheta,
    expectedP: +expectedP.toFixed(3),
    newDifficulty,
    marks,
    earnedMarks: earnedForThis,
    timestamp: Date.now(),
  };

  return {
    ...session,
    theta: newTheta,
    difficulty: newDifficulty,
    currentStreak: streak,
    consecutiveSameDiff: consecutiveSame,
    cooldownRemaining: cooldown,
    questionsAnswered: session.questionsAnswered + 1,
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    totalTimeSpent: session.totalTimeSpent + timeSpentMs,
    totalMarks: session.totalMarks + marks,
    earnedMarks: session.earnedMarks + earnedForThis,
    history: [...session.history, entry],
  };
}

/**
 * Pick next question from static bank (fallback when AI unavailable).
 */
export function pickNextQuestion(session, questionBank) {
  const answered = new Set(session.history.map(h => h.questionId));
  const topicQ = questionBank.filter(q => q.topic === session.topic);
  let cands = topicQ.filter(q => q.difficulty === session.difficulty && !answered.has(q.id));
  if (!cands.length) {
    const order = session.difficulty === 'easy'
      ? ['medium','hard'] : session.difficulty === 'hard'
      ? ['medium','easy'] : ['easy','hard'];
    for (const f of order) {
      cands = topicQ.filter(q => q.difficulty === f && !answered.has(q.id));
      if (cands.length) break;
    }
  }
  if (!cands.length) cands = topicQ.filter(q => q.difficulty === session.difficulty);
  if (!cands.length) cands = topicQ;
  return cands[Math.floor(Math.random() * cands.length)] || null;
}

/**
 * Fetch a question from the backend. Forwards the user's requested difficulty
 * (from the selector) AND the adaptive engine's current difficulty so the server
 * can decide which to honor.
 */
export async function fetchGeminiQuestion(topic, difficulty, requestedDifficulty) {
  try {
    const apiBase = import.meta.env.DEV ? `http://${window.location.hostname}:4000` : '/_/backend';
    const res = await fetch(`${apiBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty,                                 // adaptive engine's current band
        requestedDifficulty: requestedDifficulty,   // user-selected (easy|medium|hard|adaptive)
      }),
    });
    if (!res.ok) return null;
    const q = await res.json();
    if (q.error || q.fallback) return null;
    return q;
  } catch {
    return null;
  }
}

/**
 * Engagement score: how close to optimal "flow" zone.
 */
export function getEngagementScore(session) {
  if (!session.questionsAnswered) return 0.5;
  const acc = session.correctCount / session.questionsAnswered;
  const accScore = 1 - Math.abs(acc - 0.7) * 2.5;
  // Theta near 0 = balanced challenge
  const challengeScore = 1 - Math.abs(session.theta) / 2;
  return Math.max(0, Math.min(1, accScore * 0.6 + challengeScore * 0.4));
}

/**
 * Session stats for analytics dashboard.
 */
export function getSessionStats(session) {
  const accuracy = session.questionsAnswered > 0
    ? +(session.correctCount / session.questionsAnswered * 100).toFixed(1) : 0;
  const avgTime = session.questionsAnswered > 0
    ? +(session.totalTimeSpent / session.questionsAnswered / 1000).toFixed(1) : 0;
  let diffChanges = 0;
  session.history.forEach((e, i) => {
    if (i > 0 && e.newDifficulty !== session.history[i-1].newDifficulty) diffChanges++;
  });
  let maxStreak = 0, cur = 0;
  for (const e of session.history) {
    if (e.correct) { cur++; maxStreak = Math.max(maxStreak, cur); } else cur = 0;
  }

  // Per-topic mastery from knowledge tracing
  const mastery = getTopicMastery(session.topic);

  return {
    accuracy,
    avgResponseTime: avgTime,
    totalQuestions: session.questionsAnswered,
    correctCount: session.correctCount,
    difficultyChanges: diffChanges,
    longestStreak: maxStreak,
    currentStreak: session.currentStreak,
    engagement: getEngagementScore(session),
    finalDifficulty: session.difficulty,
    finalTheta: +session.theta.toFixed(3),
    totalMarks: session.totalMarks,
    earnedMarks: session.earnedMarks,
    marksPct: session.totalMarks > 0 ? +(session.earnedMarks / session.totalMarks * 100).toFixed(1) : 0,
    duration: +((Date.now() - session.startedAt) / 60000).toFixed(1),
    topicMastery: mastery,
  };
}

// ── Knowledge Tracing (per-topic mastery in localStorage) ──

const KT_KEY = 'als_knowledge';

function loadKnowledge() {
  try { return JSON.parse(localStorage.getItem(KT_KEY) || '{}'); } catch { return {}; }
}

function saveKnowledge(data) {
  try { localStorage.setItem(KT_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

/**
 * Update per-topic mastery after a session completes.
 * mastery = EMA of session accuracy, weighted by questions answered.
 */
export function updateTopicMastery(session) {
  const kt = loadKnowledge();
  const acc = session.questionsAnswered > 0
    ? session.correctCount / session.questionsAnswered : 0;
  const prev = kt[session.topic] || { mastery: 0.5, sessions: 0, totalQ: 0, totalCorrect: 0 };
  const alpha = Math.min(0.5, 0.3 + 0.05 * prev.sessions); // alpha grows with data
  const newMastery = alpha * acc + (1 - alpha) * prev.mastery;

  kt[session.topic] = {
    mastery: +newMastery.toFixed(4),
    sessions: prev.sessions + 1,
    totalQ: prev.totalQ + session.questionsAnswered,
    totalCorrect: prev.totalCorrect + session.correctCount,
    lastTheta: +session.theta.toFixed(3),
    lastSession: new Date().toISOString(),
  };
  saveKnowledge(kt);
  return kt[session.topic];
}

/**
 * Get mastery for a specific topic.
 */
export function getTopicMastery(topic) {
  const kt = loadKnowledge();
  return kt[topic] || { mastery: 0.5, sessions: 0, totalQ: 0, totalCorrect: 0 };
}

/**
 * Get all topic mastery data.
 */
export function getAllMastery() {
  return loadKnowledge();
}

// ── Session History ──

export function saveSessionToHistory(session) {
  const stats = getSessionStats(session);
  updateTopicMastery(session);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    topic: session.topic,
    completedAt: new Date().toISOString(),
    ...stats,
    thetaHistory: session.history.map(h => h.theta),
    difficultyHistory: session.history.map(h => h.newDifficulty),
  };
  try {
    const hist = JSON.parse(localStorage.getItem('als_history') || '[]');
    hist.unshift(entry);
    localStorage.setItem('als_history', JSON.stringify(hist.slice(0, 50)));
  } catch { /* ignore */ }
  return entry;
}

export function loadSessionHistory() {
  try { return JSON.parse(localStorage.getItem('als_history') || '[]'); } catch { return []; }
}

export function clearSessionHistory() {
  localStorage.removeItem('als_history');
  localStorage.removeItem(KT_KEY);
}
