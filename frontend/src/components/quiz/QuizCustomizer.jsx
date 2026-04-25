import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sliders, Play, Clock, Hash, Tag } from 'lucide-react';

const TIME_OPTIONS = [
  { value: 0, label: 'No Limit' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 90, label: '90s' },
];

const QUESTION_TYPES = [
  { id: 'MCQ', label: 'Multiple Choice' },
  { id: 'TrueFalse', label: 'True / False' },
];

const QuizCustomizer = ({ pdfData, onGenerate }) => {
  const suggestedCount = Math.min(50, Math.max(5, Math.round(pdfData.wordCount / 300)));

  const [numQuestions, setNumQuestions] = useState(suggestedCount);
  const [diffMix, setDiffMix] = useState({ easy: 30, medium: 50, hard: 20 });
  const [questionTypes, setQuestionTypes] = useState(['MCQ']);
  const [timePerQ, setTimePerQ] = useState(30);
  const [selectedTopics, setSelectedTopics] = useState(new Set(pdfData.extractedTopics));
  const [quizTitle, setQuizTitle] = useState(pdfData.filename?.replace('.pdf', '') || 'PDF Quiz');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const estimatedTime = useMemo(() => {
    const secs = Math.round(numQuestions * 1.5 + 5);
    return secs < 60 ? `~${secs}s` : `~${Math.ceil(secs / 60)} min`;
  }, [numQuestions]);

  const canGenerate = questionTypes.length > 0 && selectedTopics.size > 0;

  // Linked difficulty sliders — adjusting one redistributes to the others
  const handleDiffChange = (key, newVal) => {
    const clamped = Math.max(0, Math.min(100, newVal));
    const others = Object.keys(diffMix).filter(k => k !== key);
    const remaining = 100 - clamped;
    const otherSum = others.reduce((s, k) => s + diffMix[k], 0);

    const newMix = { ...diffMix, [key]: clamped };
    if (otherSum === 0) {
      // Split remaining equally
      others.forEach(k => { newMix[k] = Math.round(remaining / others.length); });
    } else {
      others.forEach(k => {
        newMix[k] = Math.round((diffMix[k] / otherSum) * remaining);
      });
    }
    // Fix rounding
    const total = Object.values(newMix).reduce((s, v) => s + v, 0);
    if (total !== 100) newMix[others[0]] += (100 - total);
    setDiffMix(newMix);
  };

  const toggleType = (id) => {
    setQuestionTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleTopic = (topic) => {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic);
      else next.add(topic);
      return next;
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);

    try {
      const apiBase = import.meta.env.DEV ? 'http://localhost:4000' : '/_/backend';
      const res = await fetch(`${apiBase}/api/generate-from-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pdfData.text,
          numQuestions,
          difficulty: diffMix,
          focusTopics: [...selectedTopics],
          questionTypes,
        }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server timed out generating questions. Try fewer questions or a shorter PDF.');
      }
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      onGenerate?.({
        questions: data.questions,
        generationTime: data.generationTime,
        title: quizTitle,
        timePerQuestion: timePerQ,
        pdfInfo: {
          filename: pdfData.filename,
          pageCount: pdfData.pageCount,
          wordCount: pdfData.wordCount,
          topics: [...selectedTopics],
        },
      });
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      className="quiz-customizer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="qc-header">
        <Sliders size={20} />
        <h3>Configure Your Quiz</h3>
      </div>

      {/* Quiz Title */}
      <div className="qc-field">
        <label className="qc-label">Quiz Title</label>
        <input
          type="text"
          className="qc-input"
          value={quizTitle}
          onChange={e => setQuizTitle(e.target.value)}
          placeholder="Enter quiz title"
        />
      </div>

      {/* Number of Questions */}
      <div className="qc-field">
        <label className="qc-label">
          <Hash size={14} /> Number of Questions: <strong>{numQuestions}</strong>
        </label>
        <input
          type="range"
          className="qc-slider"
          min={5}
          max={50}
          value={numQuestions}
          onChange={e => setNumQuestions(+e.target.value)}
        />
        <div className="qc-slider-labels">
          <span>5</span>
          <span>25</span>
          <span>50</span>
        </div>
      </div>

      {/* Difficulty Mix */}
      <div className="qc-field">
        <label className="qc-label">Difficulty Mix</label>
        <div className="qc-diff-bar">
          <div className="qc-diff-fill qc-diff-easy" style={{ width: `${diffMix.easy}%` }}>
            {diffMix.easy > 10 && `${diffMix.easy}%`}
          </div>
          <div className="qc-diff-fill qc-diff-medium" style={{ width: `${diffMix.medium}%` }}>
            {diffMix.medium > 10 && `${diffMix.medium}%`}
          </div>
          <div className="qc-diff-fill qc-diff-hard" style={{ width: `${diffMix.hard}%` }}>
            {diffMix.hard > 10 && `${diffMix.hard}%`}
          </div>
        </div>
        {['easy', 'medium', 'hard'].map(d => (
          <div key={d} className="qc-diff-row">
            <span className={`qc-diff-label qc-diff-${d}`}>
              {d.charAt(0).toUpperCase() + d.slice(1)}: {diffMix[d]}%
            </span>
            <input
              type="range"
              className={`qc-slider qc-slider-${d}`}
              min={0}
              max={100}
              value={diffMix[d]}
              onChange={e => handleDiffChange(d, +e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Question Types */}
      <div className="qc-field">
        <label className="qc-label">Question Types</label>
        <div className="qc-chips">
          {QUESTION_TYPES.map(t => (
            <button
              key={t.id}
              className={`qc-chip ${questionTypes.includes(t.id) ? 'qc-chip-active' : ''}`}
              onClick={() => toggleType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time Per Question */}
      <div className="qc-field">
        <label className="qc-label"><Clock size={14} /> Time Per Question</label>
        <div className="qc-segmented">
          {TIME_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`qc-seg-btn ${timePerQ === opt.value ? 'qc-seg-active' : ''}`}
              onClick={() => setTimePerQ(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic Filter */}
      <div className="qc-field">
        <label className="qc-label"><Tag size={14} /> Focus Topics</label>
        <div className="qc-chips">
          {pdfData.extractedTopics.map(t => (
            <button
              key={t}
              className={`qc-chip ${selectedTopics.has(t) ? 'qc-chip-active' : ''}`}
              onClick={() => toggleTopic(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      {genError && (
        <div className="qc-error">{genError}</div>
      )}

      <motion.button
        className="btn-primary qc-generate-btn"
        disabled={!canGenerate || generating}
        onClick={handleGenerate}
        whileHover={canGenerate && !generating ? { scale: 1.02 } : {}}
        whileTap={canGenerate && !generating ? { scale: 0.98 } : {}}
      >
        {generating ? (
          <>
            <motion.span
              className="qc-gen-spinner"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >⟳</motion.span>
            Generating Questions...
          </>
        ) : (
          <>
            <Play size={16} />
            Generate Quiz ({numQuestions} questions · {estimatedTime})
          </>
        )}
      </motion.button>
    </motion.div>
  );
};

export default QuizCustomizer;
