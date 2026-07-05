'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TestExperience } from '@/components/test-experience';
import { AppShell } from '@/components/app-shell';
import type { QuestionExtractionResponse } from '@/lib/api-types';
import { saveExamResult } from '@/lib/result-storage';

export default function TestPage() {
  const router = useRouter();
  const [paper, setPaper] = useState<QuestionExtractionResponse | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingProgressPercent, setEvaluatingProgressPercent] = useState(0);
  const [evaluatingProgressMessage, setEvaluatingProgressMessage] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem('examiner-ai-current-paper');
    if (!raw) {
      router.push('/');
      return;
    }
    try {
      setPaper(JSON.parse(raw));
    } catch {
      router.push('/');
    }
  }, [router]);

  if (!paper) {
    return (
      <div className="flex h-screen items-center justify-center bg-mist text-ink">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-accent mx-auto" />
          <p className="mt-4 text-sm font-medium">Loading test practice session...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (payload: any) => {
    setIsEvaluating(true);
    setEvaluatingProgressPercent(5);
    setEvaluatingProgressMessage('Preparing answers for Board evaluation...');

    const id = Math.random().toString(36).substring(7);
    const answersList = payload.submittedAnswers || [];
    const evaluations: any[] = [];

    try {
      // Evaluate each question sequentially or in parallel
      for (let i = 0; i < answersList.length; i++) {
        const ans = answersList[i];
        const pct = 5 + Math.round((i / answersList.length) * 85);
        setEvaluatingProgressPercent(pct);
        setEvaluatingProgressMessage(`Evaluating Question ${ans.questionNumber || (i + 1)} of ${answersList.length}...`);

        try {
          const res = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: ans.questionText || '',
              answer: ans.answer || '',
              reference: ans.expectedAnswer || '',
              max_marks: ans.totalMarks || 5,
              mode: ans.questionType === 'mcq' ? 'mcq' : 'subjective'
            })
          });

          if (!res.ok) {
            throw new Error(`Server returned status ${res.status}`);
          }

          const evalItem = await res.json();
          evaluations.push({
            questionId: ans.questionId,
            questionNumber: ans.questionNumber || String(i + 1),
            questionText: ans.questionText || '',
            maxMarks: ans.totalMarks || 5,
            marksAwarded: evalItem.marksAwarded ?? 0,
            feedback: evalItem.feedback || '',
            missingPoints: evalItem.missingPoints || [],
            strengths: evalItem.strengths || [],
            refinedAnswer: evalItem.refinedAnswer || '',
            improvements: evalItem.improvements || [],
            mistakes: evalItem.mistakes || [],
          });
        } catch (err: any) {
          console.error(`Failed to evaluate question ${ans.questionId}:`, err);
          // Graceful fallback evaluation item
          evaluations.push({
            questionId: ans.questionId,
            questionNumber: ans.questionNumber || String(i + 1),
            questionText: ans.questionText || '',
            maxMarks: ans.totalMarks || 5,
            marksAwarded: 0,
            feedback: 'Evaluation failed. Please review manually.',
            missingPoints: [],
            strengths: [],
            refinedAnswer: ans.expectedAnswer || '',
            improvements: [],
            mistakes: [],
          });
        }
      }

      setEvaluatingProgressPercent(95);
      setEvaluatingProgressMessage('Compiling final evaluation scorecard...');

      const evaluationResponse = {
        evaluationId: Math.random().toString(36).substring(7),
        submissionId: id,
        status: 'completed' as const,
        evaluationMode: 'ai-generated-answers' as const,
        sourceLabel: 'Groq Board Evaluator',
        totalScore: evaluations.reduce((sum, item) => sum + item.marksAwarded, 0),
        totalMarks: evaluations.reduce((sum, item) => sum + item.maxMarks, 0),
        evaluations,
        completedAt: new Date().toISOString(),
      };

      const examResult = {
        savedAt: new Date().toISOString(),
        paper,
        evaluation: evaluationResponse,
        submittedAnswers: answersList,
        answeredCount: payload.answeredCount,
        totalQuestions: payload.totalQuestions,
      };

      // Save full results to LocalStorage
      saveExamResult(examResult);

      // Save metadata to library list
      const saved = localStorage.getItem('examiner-ai-saved-papers');
      const list = saved ? JSON.parse(saved) : [];
      
      list.unshift({
        id,
        title: paper.title,
        subject: paper.subject || 'Exam Paper',
        status: 'Evaluated',
        progress: 100,
        score: Math.round((evaluationResponse.totalScore / (evaluationResponse.totalMarks || 1)) * 100),
        updatedAt: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      });
      localStorage.setItem('examiner-ai-saved-papers', JSON.stringify(list));

      setEvaluatingProgressPercent(100);
      router.push('/results');
    } catch (error) {
      console.error('Final submission packaging failed:', error);
      setIsEvaluating(false);
    }
  };

  return (
    <AppShell currentPath="/test">
      {isEvaluating ? (
        <div className="flex min-h-[60vh] items-center justify-center bg-mist text-ink p-8">
          <div className="w-full max-w-md text-center bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-accent mx-auto mb-6" />
            <h2 className="font-serif text-2xl font-bold mb-2">CBSE Board Evaluation</h2>
            <p className="text-sm text-slate-500 mb-6">{evaluatingProgressMessage}</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-2">
              <div 
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${evaluatingProgressPercent}%` }}
              />
            </div>
            <span className="text-xs font-mono font-semibold text-accent">{evaluatingProgressPercent}%</span>
          </div>
        </div>
      ) : (
        <TestExperience paper={paper} onSubmit={handleSubmit} />
      )}
    </AppShell>
  );
}
