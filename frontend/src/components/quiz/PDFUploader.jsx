import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, File, X, AlertCircle, CheckCircle, Loader } from 'lucide-react';

const STATUS_MESSAGES = [
  'Extracting text from PDF...',
  'Analyzing document structure...',
  'Identifying key topics...',
  'Almost ready...',
];

const PDFUploader = ({ onUploadSuccess, onReset }) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const intervalRef = useRef(null);

  const validateFile = (f) => {
    if (!f) return 'No file selected.';
    if (f.type !== 'application/pdf' && !f.name.endsWith('.pdf')) {
      return 'Please upload a PDF file.';
    }
    if (f.size > 10 * 1024 * 1024) {
      return 'File is too large. Maximum size is 10MB.';
    }
    return null;
  };

  const handleFile = useCallback((f) => {
    setError(null);
    setResult(null);
    const err = validateFile(f);
    if (err) {
      setError(err);
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }, [handleFile]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleBrowse = () => fileRef.current?.click();

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setStatusIdx(0);

    // Cycle through status messages
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % STATUS_MESSAGES.length;
      setStatusIdx(idx);
    }, 1500);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      const apiBase = import.meta.env.DEV ? 'http://localhost:4000' : '/_/backend';
      const res = await fetch(`${apiBase}/api/upload-pdf`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch {
        throw new Error('Server returned an unexpected response. Please try a smaller PDF.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      onUploadSuccess?.(data);
    } catch (err) {
      setError(err.message || 'Failed to upload PDF. Is the backend running?');
    } finally {
      clearInterval(intervalRef.current);
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setUploading(false);
    clearInterval(intervalRef.current);
    if (fileRef.current) fileRef.current.value = '';
    onReset?.();
  };

  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : 0;
  const showSizeWarning = file && file.size > 5 * 1024 * 1024;

  return (
    <div className="pdf-uploader">
      <AnimatePresence mode="wait">
        {result ? (
          // ── Success State ──
          <motion.div
            key="success"
            className="pdf-success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle size={32} className="pdf-success-icon" />
            <h3>PDF Analyzed Successfully</h3>
            <div className="pdf-chips">
              <span className="pdf-chip">{result.filename}</span>
              <span className="pdf-chip">{result.pageCount} pages</span>
              <span className="pdf-chip">{result.wordCount.toLocaleString()} words</span>
            </div>
            <div className="pdf-topics-preview">
              <span className="pdf-topics-label">Detected Topics:</span>
              <div className="pdf-topic-chips">
                {result.extractedTopics.map((t, i) => (
                  <span key={i} className="pdf-topic-chip">{t}</span>
                ))}
              </div>
            </div>
            <button className="btn-ghost pdf-reset-btn" onClick={handleReset}>
              Upload a different file
            </button>
          </motion.div>
        ) : uploading ? (
          // ── Uploading State ──
          <motion.div
            key="uploading"
            className="pdf-uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="pdf-spinner"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            >
              <Loader size={28} />
            </motion.div>
            <p className="pdf-status-msg">{STATUS_MESSAGES[statusIdx]}</p>
            <div className="pdf-progress-bar">
              <motion.div
                className="pdf-progress-fill"
                initial={{ width: '5%' }}
                animate={{ width: '85%' }}
                transition={{ duration: 8, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ) : (
          // ── Dropzone State ──
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className={`pdf-dropzone ${dragOver ? 'pdf-dropzone-active' : ''} ${file ? 'pdf-dropzone-has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={!file ? handleBrowse : undefined}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleInputChange}
                style={{ display: 'none' }}
              />

              {file ? (
                <div className="pdf-file-info">
                  <File size={24} className="pdf-file-icon" />
                  <div className="pdf-file-details">
                    <span className="pdf-filename">{file.name}</span>
                    <span className="pdf-filesize">{fileSizeMB} MB</span>
                  </div>
                  <button className="pdf-remove-btn" onClick={(e) => { e.stopPropagation(); handleReset(); }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <FileUp size={32} className="pdf-upload-icon" />
                  <p className="pdf-drop-text">
                    <strong>Drop your PDF here</strong> or click to browse
                  </p>
                  <p className="pdf-drop-hint">Max 10MB · Text-based PDFs only</p>
                </>
              )}
            </div>

            {showSizeWarning && (
              <div className="pdf-warning">
                <AlertCircle size={14} /> Large file ({fileSizeMB} MB) — processing may take longer
              </div>
            )}

            {file && (
              <motion.button
                className="btn-primary pdf-upload-btn"
                onClick={handleUpload}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Upload & Analyze PDF
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="pdf-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
            <button className="pdf-error-retry" onClick={() => { setError(null); }}>Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PDFUploader;
