import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractTextFromFile, validateFile } from '@/lib/extractor/text-extractor';
import type { ExtractedQuestion, ExtractionResult } from '@/lib/extractor/types';
import { parseQuestionsWithGroq, isGroqEnabled } from '@/lib/extractor/groq-client';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { HomeDashboard, SelectedFiles } from '@/components/home-dashboard';
import { DinoGame } from '@/components/dino-game';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Stage =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'parsing'
  | 'finishing'
  | 'done'
  | 'error';

interface AppState {
  stage: Stage;
  files: SelectedFiles;
  extractedText: string;
  answerKeyText: string;
  pageImages: string[] | null;
  result: ExtractionResult | null;
  error: string | null;
  progress: string;
  progressPercent: number;
  processingTimeMs: number;
}

const INITIAL_STATE: AppState = {
  stage: 'idle',
  files: {
    questionPaper: null,
    answerKey: null,
  },
  extractedText: '',
  answerKeyText: '',
  pageImages: null,
  result: null,
  error: null,
  progress: '',
  progressPercent: 0,
  processingTimeMs: 0,
};

// ─────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'subjective' | 'assertion_reason'>('all');

  // ─────────────────────────────────────────────
  // CORE PIPELINE
  // ─────────────────────────────────────────────

  const processFiles = useCallback(async () => {
    const { questionPaper, answerKey } = state.files;
    if (!questionPaper) return;

    // Validate
    const validation = validateFile(questionPaper);
    if (!validation.valid) {
      setState(prev => ({ ...prev, stage: 'error', error: validation.error ?? 'Invalid Question Paper.' }));
      return;
    }

    if (answerKey) {
      const akValidation = validateFile(answerKey);
      if (!akValidation.valid) {
        setState(prev => ({ ...prev, stage: 'error', error: akValidation.error ?? 'Invalid Answer Key.' }));
        return;
      }
    }

    setState(prev => ({
      ...prev,
      stage: 'extracting',
      progressPercent: 5,
      progress: 'Extracting text from Question Paper...',
    }));

    try {
      // ── Step 1: Extract Question Paper text ─────────────────────
      const qpExtraction = await extractTextFromFile(questionPaper, {
        onProgress: (pct, msg) => {
          const scaledPct = 5 + Math.round((pct / 100) * 45);
          setState(prev => ({ ...prev, progressPercent: scaledPct, progress: `[Question Paper] ${msg}` }));
        }
      });

      const hasQpImages = qpExtraction.pageImages && qpExtraction.pageImages.length > 0;
      if ((!qpExtraction.text || qpExtraction.text.trim().length < 20) && !hasQpImages) {
        throw new Error('No readable text or page images found in the Question Paper file.');
      }

      let akText = '';
      if (answerKey) {
        setState(prev => ({
          ...prev,
          progressPercent: 55,
          progress: 'Extracting text from Answer Key...',
        }));

        const akExtraction = await extractTextFromFile(answerKey, {
          onProgress: (pct, msg) => {
            const scaledPct = 55 + Math.round((pct / 100) * 25);
            setState(prev => ({ ...prev, progressPercent: scaledPct, progress: `[Answer Key] ${msg}` }));
          }
        });
        akText = akExtraction.text;
      }

      setState(prev => ({
        ...prev,
        stage: 'parsing',
        extractedText: qpExtraction.text,
        answerKeyText: akText,
        progressPercent: 85,
        progress: 'Structuring questions with 3-pass engine...',
      }));

      if (!isGroqEnabled()) {
        setState(prev => ({
          ...prev,
          stage: 'error',
          error: 'No API key configured. Go to Settings to add your Groq API key.',
        }));
        return;
      }

      // ── Step 2: Parse questions (direct Groq client) ────────────
      const startTime = Date.now();
      const data = await parseQuestionsWithGroq(
        qpExtraction.text,
        akText
      );
      const processingTime = Date.now() - startTime;

      setState(prev => ({ ...prev, progressPercent: 95 }));

      const warnings = [...qpExtraction.warnings];
      if (data.warnings) warnings.push(...data.warnings);

      setState(prev => ({
        ...prev,
        stage: 'finishing',
        result: { ...data, warnings },
        pageImages: qpExtraction.pageImages ?? null,
        processingTimeMs: processingTime,
        progress: 'test ready, lol!',
        progressPercent: 100,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setState(prev => ({
        ...prev,
        stage: 'error',
        error: msg,
      }));
    }
  }, [state.files]);

  const handleLoadingFinished = useCallback(() => {
    setState(prev => ({
      ...prev,
      stage: 'done',
      progress: '',
    }));
  }, []);

  const handleReset = () => {
    setState(INITIAL_STATE);
    setSelectedQuestion(null);
    setFilterType('all');
  };

  const startPractice = () => {
    if (!state.result || !state.files.questionPaper) return;

    const paperData = {
      fileName: state.files.questionPaper.name,
      extractionMethod: 'hybrid',
      documentType: 'text',
      lowConfidence: state.result.questions.some(q => q.confidence < 0.4),
      title: state.files.questionPaper.name.replace(/\.[^/.]+$/, ""),
      titleSource: 'inferred',
      subject: 'Exam Paper',
      subjectSource: 'inferred',
      className: 'Class XI',
      classNameSource: 'inferred',
      totalMarks: String(state.result.questions.reduce((sum, q) => sum + (q.marks ?? 0), 0)),
      totalMarksSource: 'inferred',
      duration: '60 minutes',
      durationSource: 'inferred',
      rawText: state.extractedText,
      normalizedText: state.extractedText,
      pageImages: state.pageImages ?? [],
      lines: [],
      sections: [],
      sectionNames: state.result.sections ?? [],
      questions: state.result.questions.map(q => ({
        id: q.id,
        number: q.id,
        text: q.question,
        questionText: q.question,
        type: q.type || 'subjective',
        marks: q.marks ?? null,
        marksSource: 'detected',
        section: q.section || 'Section A',
        subparts: [],
        options: q.options || [],
        confidence: q.confidence > 0.7 ? 'high' : q.confidence > 0.4 ? 'medium' : 'low',
        expectedAnswer: q.expectedAnswer,
      })),
      answers: [],
      warnings: state.result.warnings || [],
    };

    const durationMatch = state.extractedText.match(/(\d+)\s*(hours?|minutes?|mins?|hrs?)/i);
    if (durationMatch) {
      paperData.duration = durationMatch[0];
      paperData.durationSource = 'detected';
    }

    localStorage.setItem('examiner-ai-current-paper', JSON.stringify(paperData));
    navigate('/test');
  };

  // ─────────────────────────────────────────────
  // FILTERED QUESTIONS
  // ─────────────────────────────────────────────

  const filteredQuestions = state.result?.questions.filter(q =>
    filterType === 'all' ? true : q.type === filterType
  ) ?? [];

  const typeCounts = state.result?.questions.reduce(
    (acc, q) => {
      acc[q.type] = (acc[q.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  ) ?? {};

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────

  return (
    <AppShell currentPath="/">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Playfair+Display:wght@700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        :root {
          --bg:       #faf9f6;
          --surface:  #ffffff;
          --border:   rgba(15, 23, 42, 0.06);
          --border2:  rgba(15, 23, 42, 0.1);
          --text:     #0f172a;
          --muted:    #64748b;
          --amber:    #d97706;
          --amber2:   #b45309;
          --green:    #0d9488;
          --blue:     #2563eb;
          --red:      #ea580c;
          --purple:   #7c3aed;
          --mono:     'IBM Plex Mono', monospace;
          --serif:    'Playfair Display', serif;
          --sans:     'DM Sans', sans-serif;
        }

        ::selection { background: #fef3c7; color: #78350f; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }

        .fade-in { animation: fadeIn 0.4s ease both; }
        .fade-in-delay-1 { animation-delay: 0.08s; }
        .fade-in-delay-2 { animation-delay: 0.16s; }
        .fade-in-delay-3 { animation-delay: 0.24s; }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .fade-in-delay-1, .fade-in-delay-2, .fade-in-delay-3 {
            animation: none;
          }
        }
      ` }} />

      <div style={{ width: '100%' }}>
        <PageHeader
          eyebrow="Step 1 — Document Extraction"
          title="Extract Questions from PDF Papers"
          description="Upload any exam paper PDF to parse and structure questions, MCQs, subparts, and marks. Start a mock practice test once extracted."
          action={
            state.stage === 'done' ? (
              <button
                onClick={handleReset}
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 12,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  border: '1px solid var(--border2)',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  borderRadius: 24,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = 'var(--bg)';
                  e.currentTarget.style.borderColor = 'var(--text)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'var(--surface)';
                  e.currentTarget.style.borderColor = 'var(--border2)';
                }}
              >
                ← Parse New File
              </button>
            ) : undefined
          }
        />

        <main style={{ paddingBottom: 48 }}>

          {/* IDLE: Upload screen */}
          {state.stage === 'idle' && (
            <div className="fade-in">
              <HomeDashboard
                files={state.files}
                onFileChange={(slotId, file) => {
                  setState(prev => ({
                    ...prev,
                    files: { ...prev.files, [slotId]: file }
                  }));
                }}
                onRemoveFile={(slotId) => {
                  setState(prev => ({
                    ...prev,
                    files: { ...prev.files, [slotId]: null }
                  }));
                }}
                onCreateTest={processFiles}
                isSubmitting={false}
                errorMessage={state.error}
              />
            </div>
          )}

          {/* LOADING STATES */}
          {(state.stage === 'extracting' || state.stage === 'parsing' || state.stage === 'finishing') && (
            <div className="fade-in" style={{ paddingTop: 40, textAlign: 'center' }}>
              {state.stage !== 'finishing' ? (
                <div style={{
                  width: 56, height: 56, border: '3px solid var(--border2)',
                  borderTopColor: 'var(--amber)', borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite', margin: '0 auto 24px',
                }} />
              ) : (
                <div style={{
                  fontSize: 40, margin: '0 auto 24px', animation: 'pulse 1.5s infinite',
                }}>
                  ☄️
                </div>
              )}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)', letterSpacing: 1 }}>
                {state.stage === 'extracting' ? 'EXTRACTING TEXT' :
                 state.stage === 'parsing' ? 'PARSING QUESTIONS' :
                 'PREPARING TEST'}
              </div>
              <div style={{ marginTop: 12, fontSize: 14, color: 'var(--muted)', maxWidth: 450, margin: '12px auto 0', lineHeight: 1.6 }}>
                {state.stage === 'finishing' ? 'test ready, lol!' : state.progress}
              </div>

              {/* Progress bar */}
              <div style={{ maxWidth: 400, margin: '20px auto 0', background: 'var(--border2)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${state.progressPercent}%`, height: '100%', background: 'var(--amber)', transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                {state.progressPercent}%
              </div>

              {/* Chrome Dino game section */}
              <div style={{ marginTop: 12 }}>
                <DinoGame
                  isFinishing={state.stage === 'finishing'}
                  onAnimationComplete={handleLoadingFinished}
                />
              </div>

              {state.files.questionPaper && (
                <div style={{ marginTop: 20, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {state.files.questionPaper.name} · {(state.files.questionPaper.size / 1024).toFixed(0)}KB
                </div>
              )}
            </div>
          )}

          {/* ERROR STATE */}
          {state.stage === 'error' && (
            <div className="fade-in" style={{ paddingTop: 40, maxWidth: 600, margin: '0 auto' }}>
              <div style={{
                background: 'rgba(234,88,12,0.04)', border: '1px solid rgba(234,88,12,0.2)',
                padding: 32, borderRadius: 16,
              }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--red)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                  Extraction Failed
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>
                  {state.error}
                </div>
                <button onClick={handleReset} style={{
                  marginTop: 24, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 1,
                  textTransform: 'uppercase', background: 'var(--red)', color: '#fff',
                  border: 'none', padding: '10px 20px', cursor: 'pointer', borderRadius: 20,
                }}>
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* RESULTS */}
          {state.stage === 'done' && state.result && (
            <div className="fade-in" style={{ paddingTop: 10 }}>

              {/* Stats bar — fixed layout to prevent overlap */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                borderBottom: '1px solid var(--border)',
                marginBottom: 24,
                flexWrap: 'wrap',
                paddingBottom: 16,
              }}>
                <StatBlock value={state.result.total} label="Questions" color="var(--amber)" />
                <StatBlock value={typeCounts.mcq ?? 0} label="MCQ" color="var(--blue)" />
                <StatBlock value={typeCounts.subjective ?? 0} label="Subjective" color="var(--green)" />
                <StatBlock value={typeCounts.assertion_reason ?? 0} label="A-R" color="var(--purple)" />
                <StatBlock value={`${state.processingTimeMs}ms`} label="Parse Time" />

                {/* Solutions detected badge */}
                {state.result.hasSolutions ? (
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: 'var(--green)',
                    background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
                    padding: '6px 12px', borderRadius: 20,
                  }}>
                    ✓ Answer Key Detected
                  </div>
                ) : (
                  <div style={{
                    fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: 1.5,
                    textTransform: 'uppercase', color: 'var(--amber)',
                    background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)',
                    padding: '6px 12px', borderRadius: 20,
                  }}>
                    ⚠ No Solutions — Dynamic Generation
                  </div>
                )}

                {/* Action — only Practice Test */}
                <div style={{ marginLeft: 'auto' }}>
                  <ActionButton onClick={startPractice} label="Practice Test" primary />
                </div>
              </div>

              {/* Warnings */}
              {state.result.warnings.length > 0 && (
                <div className="fade-in" style={{
                  background: 'rgba(217,119,6,0.04)', border: '1px solid rgba(217,119,6,0.2)',
                  padding: '14px 20px', marginBottom: 24, borderRadius: 12,
                }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
                    Warnings ({state.result.warnings.length})
                  </div>
                  {state.result.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
                      · {w}
                    </div>
                  ))}
                </div>
              )}

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
                {(['all', 'mcq', 'subjective', 'assertion_reason'] as const).map(type => (
                  <button key={type} onClick={() => setFilterType(type)} style={{
                    fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 1,
                    textTransform: 'uppercase', padding: '10px 20px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: filterType === type ? 'var(--amber)' : 'var(--muted)',
                    borderBottom: `2px solid ${filterType === type ? 'var(--amber)' : 'transparent'}`,
                    marginBottom: -1, transition: 'color 0.2s, border-color 0.2s',
                  }}>
                    {type === 'all' ? `All (${state.result?.total ?? 0})` :
                     type === 'mcq' ? `MCQ (${typeCounts.mcq ?? 0})` :
                     type === 'subjective' ? `Subjective (${typeCounts.subjective ?? 0})` :
                     `A-R (${typeCounts.assertion_reason ?? 0})`}
                  </button>
                ))}
              </div>

              {/* Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredQuestions.map((q, index) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={index}
                    isExpanded={selectedQuestion === q.id}
                    onToggle={() => setSelectedQuestion(selectedQuestion === q.id ? null : q.id)}
                  />
                ))}
              </div>

              {filteredQuestions.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
                  No questions of this type found.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function StatBlock({ value, label, color = 'var(--text)' }: { value: string | number; label: string; color?: string }) {
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 600, color, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 }}>
        {label}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  primary = false,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: 1,
        textTransform: 'uppercase', padding: '12px 20px', cursor: 'pointer',
        background: primary ? 'var(--amber)' : 'var(--surface)',
        color: primary ? '#fff' : 'var(--text)',
        border: primary ? 'none' : '1px solid var(--border2)',
        fontWeight: primary ? 600 : 400,
        transition: 'opacity 0.2s, transform 0.1s',
        borderRadius: 20,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.opacity = '0.9';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {label}
    </button>
  );
}

const TYPE_COLORS: Record<string, string> = {
  mcq: 'var(--blue)',
  subjective: 'var(--green)',
  assertion_reason: 'var(--purple)',
  case_study: 'var(--amber)',
};

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  subjective: 'Subjective',
  assertion_reason: 'A-R',
  case_study: 'Case',
};

function QuestionCard({
  question,
  index,
  isExpanded,
  onToggle,
}: {
  question: ExtractedQuestion;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const color = TYPE_COLORS[question.type] ?? 'var(--muted)';
  const confidence = question.confidence ?? 0.7;
  const confColor = confidence > 0.7 ? 'var(--green)' : confidence > 0.4 ? 'var(--amber)' : 'var(--red)';

  return (
    <div
      style={{
        background: isExpanded ? 'var(--bg)' : 'var(--surface)',
        border: `1px solid ${isExpanded ? 'var(--border2)' : 'var(--border)'}`,
        transition: 'border-color 0.25s, background 0.25s',
        borderRadius: 16,
      }}
    >
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 16,
          padding: '16px 20px', cursor: 'pointer',
        }}
      >
        {/* Question number */}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)',
          minWidth: 32, paddingTop: 2, flexShrink: 0,
        }}>
          Q{question.id}
        </div>

        {/* Type badge */}
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: 1.5,
          textTransform: 'uppercase', color, border: `1px solid ${color}`,
          padding: '2px 8px', flexShrink: 0, marginTop: 3,
          opacity: 0.9,
          borderRadius: 4,
        }}>
          {TYPE_LABELS[question.type] ?? question.type}
        </div>

        {/* Question text preview */}
        <div style={{
          flex: 1, fontSize: 14, color: 'var(--text)',
          lineHeight: 1.5, fontFamily: 'var(--sans)',
          minWidth: 0,
        }}>
          {question.question.slice(0, isExpanded ? undefined : 140)}
          {!isExpanded && question.question.length > 140 && '...'}
        </div>

        {/* Right meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {question.marks !== undefined && (
            <div style={{
              fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--amber)',
              background: 'rgba(217,119,6,0.06)', padding: '2px 8px',
              borderRadius: 4,
            }}>
              {question.marks}M
            </div>
          )}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 10, color: confColor,
          }}>
            {Math.round(confidence * 100)}%
          </div>
          <div style={{
            color: 'var(--muted)', fontSize: 12, transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>▾</div>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{
          padding: '0 20px 20px 68px',
        }}>
          {/* Full question */}
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.8,
            color: 'var(--text)', whiteSpace: 'pre-wrap',
            borderLeft: `2px solid ${color}`, paddingLeft: 16, marginBottom: 16,
          }}>
            {question.question}
          </div>

          {/* Options */}
          {question.options && question.options.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
                letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
              }}>
                Options
              </div>
              {question.options.map((opt, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  fontSize: 13, lineHeight: 1.5,
                }}>
                  <span style={{
                    fontFamily: 'var(--mono)', fontSize: 11,
                    color: color, minWidth: 20, marginTop: 1,
                  }}>
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <span style={{ color: 'var(--text)' }}>{opt}</span>
                </div>
              ))}
            </div>
          )}



          {/* Metadata */}
          <div style={{
            display: 'flex', gap: 20, flexWrap: 'wrap',
            fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)',
          }}>
            <span>type: {question.type}</span>
            {question.marks !== undefined && <span>marks: {question.marks}</span>}
            <span>confidence: {Math.round(confidence * 100)}%</span>
            {question.section && <span>section: {question.section}</span>}
            {question.metadata?.splitMethod && <span>split: {question.metadata.splitMethod}</span>}
            {question.metadata?.optionFormat && <span>options: {question.metadata.optionFormat}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
