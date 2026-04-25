import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import pdfParse from 'pdf-parse';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const marksMap = { easy: 2, medium: 5, hard: 10 };

// ── Multer config for PDF uploads (memory storage, 10MB limit) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// ── Text cleaning utility ──
function cleanExtractedText(raw) {
  let text = raw;
  // Fix broken hyphenation at line breaks
  text = text.replace(/(\w)-\n(\w)/g, '$1$2');
  // Normalize whitespace (collapse multiple spaces/newlines but keep paragraphs)
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');
  // Remove common header/footer patterns (page numbers, repeated short lines)
  text = text.replace(/\n\s*\d+\s*\n/g, '\n');
  return text.trim();
}

// ── Extract topics via keyword frequency ──
function extractTopics(text) {
  const stopWords = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','shall','can',
    'and','or','but','if','then','else','when','at','by','for','with','about',
    'from','to','in','on','of','that','this','it','its','not','no','so','as',
    'into','than','which','what','who','how','where','why','each','all','both',
    'more','most','other','some','such','only','also','very','just','because',
    'between','after','before','during','through','above','below','up','down',
    'out','off','over','under','again','further','once','here','there','these',
    'those','they','them','their','he','she','we','you','i','me','my','our',
    'your','his','her','page','chapter','figure','table','section','example',
  ]);
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freq = {};
  for (const w of words) {
    if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  // Build bigrams for better topic names
  const tokens = text.toLowerCase().split(/\s+/);
  const bigramFreq = {};
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i].replace(/[^a-z]/g, '');
    const b = tokens[i + 1].replace(/[^a-z]/g, '');
    if (a.length >= 3 && b.length >= 3 && !stopWords.has(a) && !stopWords.has(b)) {
      const bg = `${a} ${b}`;
      bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
    }
  }
  // Merge: prefer bigrams if frequent enough
  const topBigrams = Object.entries(bigramFreq)
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '));

  const topWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  // Deduplicate: remove single words that appear in a bigram
  const bigramWords = new Set(topBigrams.flatMap(b => b.toLowerCase().split(' ')));
  const filtered = topWords.filter(w => !bigramWords.has(w.toLowerCase()));
  const topics = [...topBigrams, ...filtered].slice(0, 8);
  return topics.length > 0 ? topics : ['General'];
}

// ── Chunk text for large documents ──
function chunkText(text, maxWords = 5000) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  let currentWordCount = 0;
  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;
    if (currentWordCount + paraWords > maxWords && current.length > 0) {
      chunks.push(current.trim());
      current = para;
      currentWordCount = paraWords;
    } else {
      current += '\n\n' + para;
      currentWordCount += paraWords;
    }
  }
  if (current.trim().length > 0) chunks.push(current.trim());
  return chunks;
}

/**
 * POST /api/generate
 * Body: { topic: string, difficulty: "easy"|"medium"|"hard" }
 * Returns a Groq-generated question in the app's format.
 */
app.post('/api/generate', async (req, res) => {
  const { topic, difficulty, requestedDifficulty } = req.body;

  if (!topic || !difficulty) {
    return res.status(400).json({ error: 'topic and difficulty are required' });
  }

  // Use the user's requested difficulty if they explicitly chose one (not 'adaptive')
  const targetDifficulty = (requestedDifficulty && ['easy', 'medium', 'hard'].includes(requestedDifficulty)) 
    ? requestedDifficulty 
    : difficulty;

  const prompt = `You are an expert tutor. Generate a unique multiple-choice question about "${topic}". The requested difficulty is ${targetDifficulty}.

You must respond in valid JSON format using exactly this schema:
{
  "question_text": "The question here",
  "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "correct_option_index": 0,
  "difficulty": "${targetDifficulty}",
  "marks": ${marksMap[targetDifficulty] || 5},
  "explanation": "Brief explanation of why the answer is correct."
}

Rules:
- The question must be about "${topic}" specifically
- The question must be ${targetDifficulty} difficulty level
- All 4 options must be plausible but only one correct
- The explanation should be educational and concise
- Generate a DIFFERENT question each time — be creative and varied`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.9
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Groq API error: ${response.status} ${errorText}`);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;
    const parsed = JSON.parse(text);

    const question = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      topic: topic,
      difficulty: parsed.difficulty || difficulty,
      question: parsed.question_text,
      options: parsed.options,
      correctIndex: parsed.correct_option_index,
      explanation: parsed.explanation,
      marks: parsed.marks || marksMap[difficulty],
      source: 'ai',
      model: 'llama-3.1-8b-instant',
    };

    console.log(`✅ Generated question via Groq for "${topic}" [${difficulty}]`);
    return res.json(question);
  } catch (err) {
    console.error('Groq generation failed:', err.message);
    return res.status(500).json({ error: 'Failed to generate question', detail: err.message, fallback: true });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    groqConfigured: !!process.env.GROQ_API_KEY || !!GROQ_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/upload-pdf ──
app.post('/api/upload-pdf', (req, res, next) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please select a PDF file.' });
  }

  try {
    const data = await pdfParse(req.file.buffer);

    const rawText = data.text || '';
    const cleanedText = cleanExtractedText(rawText);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    const pageCount = data.numpages || 1;

    if (wordCount < 50) {
      return res.status(422).json({
        error: 'This PDF contains very little text. It may be scanned or image-based. Please use a text-based PDF.',
      });
    }

    const topics = extractTopics(cleanedText);

    console.log(`✅ PDF uploaded: "${req.file.originalname}" — ${pageCount} pages, ${wordCount} words, ${topics.length} topics`);

    return res.json({
      success: true,
      text: cleanedText,
      pageCount,
      wordCount,
      extractedTopics: topics,
      filename: req.file.originalname,
    });
  } catch (parseErr) {
    const msg = parseErr.message || '';
    if (msg.includes('password') || msg.includes('encrypted') || msg.includes('Password')) {
      return res.status(422).json({ error: 'This PDF is password-protected. Please remove the password and try again.' });
    }
    console.error('PDF parse error:', msg);
    return res.status(422).json({ error: 'This PDF appears to be corrupted or unreadable. Please try another file.' });
  }
});

// ── POST /api/generate-from-pdf ──
app.post('/api/generate-from-pdf', async (req, res) => {
  const { text, numQuestions = 10, difficulty = { easy: 30, medium: 50, hard: 20 }, focusTopics = [], questionTypes = ['MCQ'] } = req.body;

  if (!text || text.length < 100) {
    return res.status(400).json({ error: 'PDF text is required and must be at least 100 characters.' });
  }

  const startTime = Date.now();

  // Calculate how many questions of each difficulty
  const total = Math.min(numQuestions, 50);
  const easyCount = Math.round(total * (difficulty.easy || 30) / 100);
  const hardCount = Math.round(total * (difficulty.hard || 20) / 100);
  const mediumCount = total - easyCount - hardCount;
  const diffDistribution = [
    ...Array(easyCount).fill('easy'),
    ...Array(mediumCount).fill('medium'),
    ...Array(hardCount).fill('hard'),
  ];

  // Chunk the text
  const chunks = chunkText(text, 5000);
  const questionsPerChunk = Math.max(1, Math.ceil(total / chunks.length));

  const allQuestions = [];
  const topicFilter = focusTopics.length > 0 ? `Focus on these topics: ${focusTopics.join(', ')}.` : '';
  const typeInstructions = questionTypes.includes('TrueFalse')
    ? 'Some questions should be True/False format (with exactly 2 options: ["True", "False"]).'
    : 'All questions must be multiple choice with exactly 4 options.';

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    const qCount = Math.min(questionsPerChunk, total - allQuestions.length);
    if (qCount <= 0) break;

    // Determine difficulties for this chunk
    const chunkDiffs = diffDistribution.splice(0, qCount);
    const diffBreakdown = {};
    for (const d of chunkDiffs) diffBreakdown[d] = (diffBreakdown[d] || 0) + 1;

    const prompt = `You are an expert tutor and test maker. Based on the following study material, generate exactly ${qCount} quiz questions.

STUDY MATERIAL:
"""
${chunk.slice(0, 8000)}
"""

REQUIREMENTS:
- Generate exactly ${qCount} questions based ONLY on the material above
- Difficulty distribution: ${Object.entries(diffBreakdown).map(([d, c]) => `${c} ${d}`).join(', ')}
- ${typeInstructions}
- ${topicFilter}
- Each question must test understanding, not just recall
- All options must be plausible but only one correct
- Include a brief explanation for the correct answer
- Include a short excerpt from the source material that the question is based on

You must respond in valid JSON format:
{
  "questions": [
    {
      "question_text": "The question",
      "options": ["A", "B", "C", "D"],
      "correct_option_index": 0,
      "difficulty": "easy|medium|hard",
      "topic": "specific topic name",
      "explanation": "Why this answer is correct",
      "source_chunk": "relevant excerpt from the study material (max 100 words)"
    }
  ]
}`;

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        console.error(`Groq API error on chunk ${ci}: ${response.status}`);
        continue; // skip this chunk, try others
      }

      const data = await response.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      const qs = parsed.questions || [parsed]; // handle single-question response

      for (const q of qs) {
        allQuestions.push({
          id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          topic: q.topic || 'General',
          difficulty: q.difficulty || 'medium',
          question: q.question_text,
          options: q.options,
          correctIndex: q.correct_option_index,
          explanation: q.explanation,
          sourceChunk: q.source_chunk || '',
          marks: marksMap[q.difficulty] || 5,
          source: 'pdf',
        });
      }

      console.log(`  ✅ Chunk ${ci + 1}/${chunks.length}: generated ${qs.length} questions`);
    } catch (err) {
      console.error(`Chunk ${ci} generation failed:`, err.message);
      continue;
    }
  }

  if (allQuestions.length === 0) {
    return res.status(500).json({ error: 'Failed to generate any questions. Please try again.' });
  }

  // Shuffle to mix difficulties
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ PDF quiz generated: ${allQuestions.length} questions in ${generationTime}s`);

  return res.json({
    questions: allQuestions.slice(0, total),
    generationTime: +generationTime,
  });
});

app.listen(PORT, () => {
  console.log(`\n🧠 ALS Backend running on http://localhost:${PORT}`);
  console.log(`🤖 Groq API: ✅ Configured`);
  console.log('');
});
