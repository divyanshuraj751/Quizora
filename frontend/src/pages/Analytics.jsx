import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TOPICS } from '../data/questions';
import { DIFFICULTY_LEVELS, getSessionStats, getAllMastery } from '../engine/adaptive';
import PerformanceChart from '../components/quiz/PerformanceChart';

const Analytics = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = location.state || {};

  if (!session) {
    return (
      <div className="analytics-page">
        <div className="analytics-empty">
          <h2>No session data</h2>
          <p>Complete a quiz to see your analytics.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Start a Quiz</button>
        </div>
      </div>
    );
  }

  const stats = getSessionStats(session);
  const topic = TOPICS.find(t => t.id === session.topic);
  const level = DIFFICULTY_LEVELS[stats.finalDifficulty];
  const allMastery = getAllMastery();

  // Difficulty distribution
  const corrByDiff = { easy: { c: 0, t: 0 }, medium: { c: 0, t: 0 }, hard: { c: 0, t: 0 } };
  session.history.forEach(h => {
    const d = h.difficulty;
    corrByDiff[d].t++;
    if (h.correct) corrByDiff[d].c++;
  });

  const getGrade = (acc) => {
    if (acc >= 90) return { letter: 'A+', color: '#10b981', msg: 'Outstanding performance!' };
    if (acc >= 80) return { letter: 'A', color: '#10b981', msg: 'Excellent work!' };
    if (acc >= 70) return { letter: 'B', color: '#06b6d4', msg: 'Great job, keep it up!' };
    if (acc >= 60) return { letter: 'C', color: '#f59e0b', msg: 'Good effort, room to improve.' };
    if (acc >= 50) return { letter: 'D', color: '#f97316', msg: 'Keep practicing!' };
    return { letter: 'F', color: '#ef4444', msg: "Don't give up, try again!" };
  };

  const grade = getGrade(stats.accuracy);
  const engPct = Math.round(stats.engagement * 100);

  return (
    <div className="analytics-page">
      <div className="analytics-bg-effects">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
      </div>

      <motion.div
        className="analytics-content"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <header className="analytics-header">
          <h1>Quiz Complete! 🎉</h1>
          <p className="analytics-topic">{topic?.icon} {topic?.label || session.topic}</p>
        </header>

        {/* Grade Card */}
        <motion.div className="grade-card" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
          <div className="grade-circle" style={{ borderColor: grade.color }}>
            <span className="grade-letter" style={{ color: grade.color }}>{grade.letter}</span>
          </div>
          <div className="grade-info">
            <h2>{stats.accuracy}% Accuracy</h2>
            <p style={{ color: grade.color }}>{grade.msg}</p>
            <div className="grade-detail">
              <span>{stats.correctCount}/{stats.totalQuestions} correct</span>
              <span>·</span>
              <span>{stats.earnedMarks}/{stats.totalMarks} marks ({stats.marksPct}%)</span>
              <span>·</span>
              <span>{stats.duration} min</span>
            </div>
          </div>
        </motion.div>

        {/* 5 Key Metrics — Student Dashboard */}
        <div className="analytics-stats-grid">
          {[
            { icon: '🎯', label: 'Final Level', value: `${level?.emoji} ${level?.label}`, color: level?.color, why: 'Shows where the system placed you' },
            { icon: '🧠', label: 'Ability (θ)', value: stats.finalTheta.toFixed(2), color: '#818cf8', why: 'IRT ability score (-2 to +2)' },
            { icon: '⚡', label: 'Avg Response', value: `${stats.avgResponseTime}s`, color: '#06b6d4', why: 'Faster = higher confidence' },
            { icon: '🔥', label: 'Best Streak', value: `${stats.longestStreak}`, color: '#f59e0b', why: 'Consecutive correct answers' },
            { icon: '📈', label: 'Difficulty Shifts', value: `${stats.difficultyChanges}`, color: '#8b5cf6', why: 'How many times difficulty adapted' },
            { icon: '💫', label: 'Engagement', value: `${engPct}%`, color: engPct > 60 ? '#10b981' : '#f59e0b', why: 'Optimal challenge zone (flow)' },
          ].map((s, i) => (
            <motion.div key={i} className="stat-card-analytics" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }}>
              <span className="stat-icon-a">{s.icon}</span>
              <span className="stat-value-a" style={{ color: s.color }}>{s.value}</span>
              <span className="stat-label-a">{s.label}</span>
              <span className="stat-why">{s.why}</span>
            </motion.div>
          ))}
        </div>

        {/* Performance Chart */}
        <motion.div className="analytics-chart-section" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <PerformanceChart history={session.history} title="Your Learning Journey" isIRT={true} />
        </motion.div>

        {/* Knowledge Tracing — Per-Topic Mastery */}
        {Object.keys(allMastery).length > 0 && (
          <motion.div className="analytics-mastery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
            <h3>🧠 Knowledge Tracing — Topic Mastery</h3>
            <p className="mastery-subtitle">Per-topic mastery tracked across all your sessions</p>
            <div className="mastery-grid">
              {TOPICS.map(t => {
                const m = allMastery[t.id];
                if (!m) return null;
                const mPct = Math.round(m.mastery * 100);
                const status = m.mastery > 0.8 ? 'mastered' : m.mastery < 0.4 ? 'revisit' : 'learning';
                return (
                  <div key={t.id} className={`mastery-card mastery-${status}`}>
                    <div className="mastery-header">
                      <span>{t.icon} {t.label}</span>
                      <span className={`mastery-status status-${status}`}>
                        {status === 'mastered' ? '✅ Mastered' : status === 'revisit' ? '🔄 Needs Review' : '📖 Learning'}
                      </span>
                    </div>
                    <div className="mastery-bar-wrap">
                      <div className="mastery-bar">
                        <motion.div
                          className="mastery-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${mPct}%` }}
                          style={{ background: mPct > 80 ? '#10b981' : mPct > 40 ? '#f59e0b' : '#ef4444' }}
                        />
                      </div>
                      <span className="mastery-pct">{mPct}%</span>
                    </div>
                    <div className="mastery-detail">
                      <span>{m.sessions} {m.sessions === 1 ? 'session' : 'sessions'}</span>
                      <span>{m.totalCorrect}/{m.totalQ} correct</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Difficulty Breakdown */}
        <motion.div className="analytics-breakdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <h3>📊 Difficulty Breakdown</h3>
          <div className="breakdown-grid">
            {['easy', 'medium', 'hard'].map(d => {
              const info = DIFFICULTY_LEVELS[d];
              const data = corrByDiff[d];
              const pct = data.t > 0 ? Math.round(data.c / data.t * 100) : 0;
              return (
                <div key={d} className="breakdown-card">
                  <div className="breakdown-header" style={{ color: info.color }}>{info.emoji} {info.label}</div>
                  <div className="breakdown-body">
                    <div className="breakdown-stat">
                      <span className="breakdown-big">{data.c}/{data.t}</span>
                      <span className="breakdown-small">correct</span>
                    </div>
                    <div className="breakdown-bar">
                      <div className="breakdown-fill" style={{ width: `${pct}%`, background: info.color }} />
                    </div>
                    <span className="breakdown-pct">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Algorithm Explanation */}
        <motion.div className="analytics-algo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <h3>🧠 How Adaptation Worked</h3>
          <div className="algo-explanation">
            <div className="algo-item"><strong>Algorithm:</strong> IRT-inspired 2PL model with adaptive θ (ability) scoring</div>
            <div className="algo-item"><strong>Update rule:</strong> Δθ = 0.4 × (observed − P(correct|θ,b)) × timeFactor</div>
            <div className="algo-item"><strong>Factors:</strong> Answer correctness, response time, item difficulty parameter (b), discrimination (a=1.2)</div>
            <div className="algo-item"><strong>Bands:</strong> θ {'<'} -0.5 → Easy · θ -0.5 to 0.6 → Medium · θ {'>'} 0.6 → Hard</div>
            <div className="algo-item"><strong>Safeguards:</strong> Max {4} same-difficulty in a row · Streak jump after 3 consecutive · Cooldown after forced shift</div>
            <div className="algo-item"><strong>Knowledge Tracing:</strong> Per-topic mastery via EMA across sessions · Mastery {'>'} 80% = promoted · {'<'} 40% = revisit</div>
            <div className="algo-item"><strong>Questions:</strong> AI-generated on demand with a curated static bank fallback</div>
            <div className="algo-item"><strong>Result:</strong> The system made {stats.difficultyChanges} difficulty adjustment(s) during your {stats.totalQuestions}-question session.</div>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="analytics-actions">
          <motion.button className="btn-primary" onClick={() => navigate(`/quiz/${session.topic}?difficulty=${session.startDifficulty || 'adaptive'}`)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            🔄 Try Again
          </motion.button>
          <motion.button className="btn-secondary" onClick={() => navigate('/')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
            ← Choose Another Topic
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default Analytics;
