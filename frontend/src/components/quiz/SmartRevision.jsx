import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Sparkles, ChevronDown, ChevronUp, Loader, RotateCcw, Lightbulb, List, FileText } from 'lucide-react';

const SmartRevision = ({ pdfData }) => {
  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  const generateRevision = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiBase = import.meta.env.DEV ? `http://${window.location.hostname}:4000` : '/_/backend';
      const res = await fetch(`${apiBase}/api/smart-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: pdfData.text,
          topics: pdfData.extractedTopics,
          filename: pdfData.filename,
        }),
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server returned an unexpected response.');
      }
      if (!res.ok) throw new Error(data.error || 'Revision generation failed');

      setRevision(data.revision);
      setExpandedSection(0);
    } catch (err) {
      setError(err.message || 'Failed to generate revision notes.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (idx) => {
    setExpandedSection(expandedSection === idx ? null : idx);
  };

  if (!revision && !loading && !error) {
    return (
      <motion.div
        className="smart-revision-trigger"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="sr-trigger-content">
          <div className="sr-trigger-icon">
            <BookOpen size={24} />
          </div>
          <div className="sr-trigger-text">
            <h3>Smart Revision Notes</h3>
            <p>AI generates a concise study summary with key concepts, definitions, and important points from your PDF.</p>
          </div>
          <button className="btn-primary sr-generate-btn" onClick={generateRevision}>
            <Sparkles size={16} />
            Generate Notes
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="smart-revision"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="sr-header">
        <div className="sr-header-left">
          <BookOpen size={20} />
          <h3>Smart Revision</h3>
          <span className="sr-badge">{pdfData.filename}</span>
        </div>
        {revision && (
          <button className="btn-ghost sr-regen-btn" onClick={generateRevision} disabled={loading}>
            <RotateCcw size={14} /> Regenerate
          </button>
        )}
      </div>

      {/* Loading State */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            className="sr-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            >
              <Loader size={24} />
            </motion.div>
            <p>Analyzing your study material...</p>
            <span className="sr-loading-sub">This may take 10–20 seconds</span>
          </motion.div>
        )}

        {/* Error State */}
        {error && !loading && (
          <motion.div
            key="error"
            className="sr-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <p>{error}</p>
            <button className="btn-ghost" onClick={generateRevision}>Try Again</button>
          </motion.div>
        )}

        {/* Revision Content */}
        {revision && !loading && (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Tab Bar */}
            <div className="sr-tabs">
              <button
                className={`sr-tab ${activeTab === 'summary' ? 'sr-tab-active' : ''}`}
                onClick={() => setActiveTab('summary')}
              >
                <FileText size={14} /> Summary
              </button>
              <button
                className={`sr-tab ${activeTab === 'concepts' ? 'sr-tab-active' : ''}`}
                onClick={() => setActiveTab('concepts')}
              >
                <Lightbulb size={14} /> Key Concepts
              </button>
              <button
                className={`sr-tab ${activeTab === 'topics' ? 'sr-tab-active' : ''}`}
                onClick={() => setActiveTab('topics')}
              >
                <List size={14} /> By Topic
              </button>
            </div>

            {/* Summary Tab */}
            {activeTab === 'summary' && (
              <div className="sr-summary-tab">
                <div className="sr-overview-card">
                  <h4>Overview</h4>
                  <p>{revision.overview}</p>
                </div>

                {revision.keyTakeaways && revision.keyTakeaways.length > 0 && (
                  <div className="sr-takeaways">
                    <h4>Key Takeaways</h4>
                    <ul className="sr-takeaway-list">
                      {revision.keyTakeaways.map((item, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <span className="sr-bullet">{i + 1}</span>
                          <span>{item}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Key Concepts Tab */}
            {activeTab === 'concepts' && (
              <div className="sr-concepts-tab">
                {revision.concepts && revision.concepts.map((concept, i) => (
                  <motion.div
                    key={i}
                    className="sr-concept-card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <div className="sr-concept-term">{concept.term}</div>
                    <div className="sr-concept-def">{concept.definition}</div>
                    {concept.example && (
                      <div className="sr-concept-example">
                        <Lightbulb size={12} />
                        <span>{concept.example}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Topics Tab */}
            {activeTab === 'topics' && (
              <div className="sr-topics-tab">
                {revision.topicSummaries && revision.topicSummaries.map((topic, idx) => (
                  <div key={idx} className="sr-topic-section">
                    <button
                      className={`sr-topic-header ${expandedSection === idx ? 'sr-topic-expanded' : ''}`}
                      onClick={() => toggleSection(idx)}
                    >
                      <span className="sr-topic-name">{topic.name}</span>
                      {expandedSection === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <AnimatePresence>
                      {expandedSection === idx && (
                        <motion.div
                          className="sr-topic-body"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <p className="sr-topic-summary">{topic.summary}</p>
                          {topic.points && topic.points.length > 0 && (
                            <ul className="sr-topic-points">
                              {topic.points.map((pt, pi) => (
                                <li key={pi}>{pt}</li>
                              ))}
                            </ul>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SmartRevision;
