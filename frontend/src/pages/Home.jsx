import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TOPICS } from '../data/questions';
import { loadSessionHistory, clearSessionHistory } from '../engine/adaptive';
import { Brain, Calculator, FlaskConical, Code, Globe, Bot, Activity, Zap, BarChart3, ChevronRight, Sparkles, Leaf, Flame, FileUp, BookOpen } from 'lucide-react';
import PDFUploader from '../components/quiz/PDFUploader';
import QuizCustomizer from '../components/quiz/QuizCustomizer';
import SmartRevision from '../components/quiz/SmartRevision';

const topicIcons = {
  mathematics: <Calculator size={24} />,
  science: <FlaskConical size={24} />,
  programming: <Code size={24} />,
  general: <Globe size={24} />
};

const DIFFICULTY_OPTIONS = [
  { id: 'adaptive', label: 'Adaptive', desc: 'AI decides',     icon: <Sparkles size={16} /> },
  { id: 'easy',     label: 'Easy',     desc: 'Warm-up',        icon: <Leaf size={16} /> },
  { id: 'medium',   label: 'Medium',   desc: 'Balanced',       icon: <Zap size={16} /> },
  { id: 'hard',     label: 'Hard',     desc: 'Push your limits', icon: <Flame size={16} /> },
];

const DIFFICULTY_KEY = 'als-start-difficulty';

const Home = () => {
  const navigate = useNavigate();
  const pdfSectionRef = useRef(null);
  const [history] = useState(loadSessionHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [difficulty, setDifficulty] = useState(() => {
    if (typeof window === 'undefined') return 'adaptive';
    return localStorage.getItem(DIFFICULTY_KEY) || 'adaptive';
  });

  useEffect(() => {
    try { localStorage.setItem(DIFFICULTY_KEY, difficulty); } catch {}
  }, [difficulty]);

  const buildQuizUrl = (topicSlug) => `/quiz/${topicSlug}?difficulty=${difficulty}`;

  const [pdfData, setPdfData] = useState(null);

  const handlePdfQuizGenerated = (quizConfig) => {
    navigate('/pdf-quiz', { state: quizConfig });
  };

  const handleStart = (topicId) => {
    navigate(buildQuizUrl(topicId));
  };

  const handleCustomStart = (e) => {
    e.preventDefault();
    const topic = customTopic.trim();
    if (!topic) return;
    navigate(buildQuizUrl(encodeURIComponent(topic)));
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all session history?')) {
      clearSessionHistory();
      window.location.reload();
    }
  };

  const bestScore = history.length > 0
    ? Math.max(...history.map(h => h.accuracy || 0))
    : null;

  return (
    <div className="home-page">
      <div className="home-bg-effects">
        <div className="bg-orb bg-orb-1"></div>
        <div className="bg-orb bg-orb-2"></div>
        <div className="bg-orb bg-orb-3"></div>
      </div>

      <motion.header
        className="home-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >

        <h1>Adapt</h1>
        <p className="header-subtitle">
          Learn Smarter, Grow Faster.
        </p>
        {history.length > 0 && (
          <div className="header-stats">
            <span className="stat-pill">{history.length} {history.length === 1 ? 'session' : 'sessions'}</span>
            {bestScore !== null && <span className="stat-pill">Best: {bestScore}%</span>}
          </div>
        )}
      </motion.header>

      {/* Smart Revision CTA */}
      <motion.section
        className="sr-cta-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.5 }}
      >
        <div
          className="sr-cta-card"
          onClick={() => pdfSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          role="button"
          tabIndex={0}
        >
          <div className="sr-cta-icon">
            <BookOpen size={28} />
          </div>
          <div className="sr-cta-body">
            <h3>Smart Revision</h3>
            <p>Upload your PDF notes and get AI-generated revision summaries, key concepts, and topic breakdowns — all in one click.</p>
          </div>
          <div className="sr-cta-arrow">
            <ChevronRight size={20} />
          </div>
        </div>
      </motion.section>

      {/* Difficulty Selector */}
      <motion.section
        className="difficulty-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        aria-labelledby="difficulty-heading"
      >
        <div className="difficulty-heading-row">
          <h2 id="difficulty-heading" className="difficulty-title">Choose your starting difficulty</h2>
          <p className="difficulty-sub">The engine will keep adapting as you go.</p>
        </div>
        <div className="difficulty-segmented" role="radiogroup" aria-label="Starting difficulty">
          {DIFFICULTY_OPTIONS.map(opt => {
            const active = difficulty === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`difficulty-chip ${active ? 'is-active' : ''} chip-${opt.id}`}
                onClick={() => setDifficulty(opt.id)}
              >
                {active && (
                  <motion.span
                    layoutId="difficulty-pill"
                    className="difficulty-chip-bg"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="difficulty-chip-content">
                  <span className="difficulty-chip-icon">{opt.icon}</span>
                  <span className="difficulty-chip-label">{opt.label}</span>
                  <span className="difficulty-chip-desc">{opt.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Custom Topic Input */}
      <motion.section
        className="custom-topic-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h2 className="section-title"><Bot size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }}/> Ask AI — Any Topic</h2>
        <form className="custom-topic-form" onSubmit={handleCustomStart}>
          <div className="custom-input-wrapper">
            <input
              type="text"
              className="custom-topic-input"
              placeholder="e.g. Python loops, Machine Learning, World War II, Quantum Physics..."
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              autoFocus
            />
            <button type="submit" className="custom-topic-btn" disabled={!customTopic.trim()}>
              Generate Quiz →
            </button>
          </div>
          <p className="custom-topic-hint">
            Instantly generate personalized quiz questions on any topic you choose, with smart adaptive learning tailored to your level.
          </p>
        </form>
      </motion.section>

      {/* PDF Upload Section */}
      <motion.section
        className="pdf-upload-section"
        ref={pdfSectionRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
      >
        <h2 className="section-title">
          <FileUp size={24} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'text-bottom' }} />
          Upload PDF — Study Material Quiz
        </h2>
        <p className="pdf-section-hint">
          Upload your notes, textbook, or study material and get an adaptive quiz generated from its content.
        </p>
        <PDFUploader
          onUploadSuccess={(data) => setPdfData(data)}
          onReset={() => setPdfData(null)}
        />
        {pdfData && (
          <SmartRevision pdfData={pdfData} />
        )}
        {pdfData && (
          <QuizCustomizer
            pdfData={pdfData}
            onGenerate={handlePdfQuizGenerated}
          />
        )}
      </motion.section>

      {/* Preset Topics */}
      <section className="topics-section">
        <h2 className="section-title">Or Choose a Preset Subject</h2>
        <div className="topics-grid">
          {TOPICS.map((topic, i) => (
            <motion.button
              key={topic.id}
              className="topic-card"
              onClick={() => handleStart(topic.id)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.98 }}
              style={{ '--topic-color': topic.color }}
            >
              <div className="topic-icon">{topicIcons[topic.id] || <Bot size={24} />}</div>
              <h3>{topic.label}</h3>
              <p>{topic.desc}</p>
              <div className="topic-arrow"><ChevronRight size={20} /></div>
            </motion.button>
          ))}
        </div>
      </section>

      <section className="how-section">
        <h2 className="section-title">How It Works</h2>
        <div className="how-grid">
          {[
            { icon: <Bot size={32}/>, title: 'AI Generates Questions', desc: 'Our AI crafts unique questions on any topic you choose.' },
            { icon: <Activity size={32}/>, title: 'Smart Ability Scoring', desc: 'Your skill level is tracked and refined after every answer.' },
            { icon: <Zap size={32}/>, title: 'Dynamic Adaptation', desc: 'Difficulty shifts automatically based on your performance in real-time.' },
            { icon: <BarChart3 size={32}/>, title: 'Analytics Dashboard', desc: 'See detailed charts, knowledge tracing, and learning insights.' },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="how-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <span className="how-icon">{item.icon}</span>
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="history-section">
          <div className="history-header">
            <h2 className="section-title">Recent Sessions</h2>
            <div className="history-actions">
              <button className="btn-ghost" onClick={() => setShowHistory(!showHistory)}>
                {showHistory ? 'Hide' : 'Show'} History
              </button>
              <button className="btn-ghost btn-danger" onClick={handleClearHistory}>Clear All</button>
            </div>
          </div>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                className="history-list"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {history.slice(0, 10).map((s, i) => {
                  const topicData = TOPICS.find(t => t.id === s.topic);
                  return (
                    <motion.div
                      key={s.id}
                      className="history-item"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <span className="hi-icon">{topicData ? React.cloneElement(topicIcons[topicData.id], { size: 18 }) : <Bot size={18} />}</span>
                      <div className="hi-info">
                        <span className="hi-topic">{topicData?.label || s.topic}</span>
                        <span className="hi-date">{new Date(s.completedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="hi-stats">
                        <span className="hi-accuracy">{s.accuracy}%</span>
                        <span className="hi-questions">{s.totalQuestions} Qs</span>
                        <span className={`hi-diff diff-${s.finalDifficulty}`}>{s.finalDifficulty}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <footer className="home-footer">
        <p>Adapt · AI-Powered Adaptive Learning Companion · Smart revision for the whole semester</p>
      </footer>
    </div>
  );
};

export default Home;
