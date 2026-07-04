"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  CircleHelp,
  ListChecks,
  Save,
  Send
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { QuestionPalette } from "@/components/question-palette";
import { SectionCard } from "@/components/section-card";
import { Tag } from "@/components/tag";
import { TestTimer } from "@/components/test-timer";
import {
  EvaluateAnswerResponse,
  QuestionExtractionResponse,
  QuestionType,
  SingleAnswerEvaluationMode,
  SubmittedAnswerInput
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

type DraftState = {
  answers: Record<string, string>;
  markedForReview: string[];
  currentQuestionId: string | null;
  selectedSectionId: string;
};

type QuestionEvaluationResult = EvaluateAnswerResponse;

type TestExperienceProps = {
  paper: QuestionExtractionResponse;
  onSubmit?: (payload: {
    answeredCount: number;
    totalQuestions: number;
    submittedAnswers: SubmittedAnswerInput[];
  }) => void | Promise<void>;
};

export function TestExperience({ paper, onSubmit }: TestExperienceProps) {
  const router = useRouter();
  const storageKey = useMemo(() => `examiner-ai-test-draft-${slugify(paper.fileName)}`, [paper.fileName]);
  const detectedDurationMinutes = parseDurationToMinutes(paper.duration);
  const sections = useMemo(
    () => [
      {
        id: "section-1",
        title: paper.subject || paper.title || "Question Paper",
        questionCount: paper.questions.length
      }
    ],
    [paper.questions.length, paper.subject, paper.title]
  );
  const questions = useMemo(
    () =>
      paper.questions.map((question, index) => ({
        id: question.id || `question-${index + 1}`,
        number: question.number,
        sectionId: "section-1",
        type: question.type,
        prompt: question.questionText || question.text,
        marks: normalizeQuestionMarks(question.marks),
        expectedAnswer: findExpectedAnswer(question.number, paper),
        answerKeySource: findAnswerSource(question.number, paper),
        answerPlaceholder: buildAnswerPlaceholder(question.type, question.marks)
      })),
    [paper]
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(questions.length > 0 ? questions[0].id : null);
  const [selectedSectionId, setSelectedSectionId] = useState(sections[0].id);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmittingTest, setIsSubmittingTest] = useState(false);
  const [answerEvaluations, setAnswerEvaluations] = useState<Record<string, QuestionEvaluationResult>>({});
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [evaluatingQuestionId, setEvaluatingQuestionId] = useState<string | null>(null);
  const [showEvaluationOptions, setShowEvaluationOptions] = useState(false);
  const [manualReferenceInputs, setManualReferenceInputs] = useState<Record<string, string>>({});
  const [manualAssistMarks, setManualAssistMarks] = useState<Record<string, string>>({});
  const [autosaveStamp, setAutosaveStamp] = useState("Not saved yet");
  const [customDurationMinutes, setCustomDurationMinutes] = useState(60);
  const [timeRemaining, setTimeRemaining] = useState((detectedDurationMinutes ?? 60) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const durationMinutes = detectedDurationMinutes ?? customDurationMinutes;
  const initialSeconds = durationMinutes * 60;
  const hasQuestions = questions.length > 0;

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as DraftState;
      setAnswers(parsed.answers ?? {});
      setMarkedForReview(parsed.markedForReview ?? []);
      setCurrentQuestionId(parsed.currentQuestionId ?? questions[0]?.id ?? null);
      setSelectedSectionId(parsed.selectedSectionId ?? sections[0].id);
      setAutosaveStamp("Recovered local draft");
    } catch {
      setAutosaveStamp("Unable to restore draft");
    }
  }, [questions, sections, storageKey]);

  useEffect(() => {
    if (!hasStarted) {
      setTimeRemaining(initialSeconds);
    }
  }, [hasStarted, initialSeconds]);

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return;

    const interval = window.setInterval(() => {
      setTimeRemaining((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, timeRemaining]);

  const answeredQuestionIds = Object.entries(answers)
    .filter(([, value]) => value.trim().length > 0)
    .map(([questionId]) => questionId);

  useEffect(() => {
    const draft: DraftState = {
      answers,
      markedForReview,
      currentQuestionId,
      selectedSectionId
    };

    window.localStorage.setItem(storageKey, JSON.stringify(draft));
    setAutosaveStamp(`Autosaved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }, [answers, currentQuestionId, markedForReview, selectedSectionId, storageKey]);

  const questionsInSection = useMemo(
    () => questions.filter((question) => question.sectionId === selectedSectionId),
    [questions, selectedSectionId]
  );

  const currentQuestion =
    questions.find((question) => question.id === currentQuestionId) ??
    questionsInSection[0] ??
    questions[0] ??
    null;
  const currentIndex = currentQuestion ? questions.findIndex((question) => question.id === currentQuestion.id) : -1;
  const completionPercent = questions.length > 0 ? Math.round((answeredQuestionIds.length / questions.length) * 100) : 0;
  const canAnswer = hasStarted && timeRemaining > 0 && hasQuestions && currentQuestion !== null;
  const evaluatedQuestionCount = Object.keys(answerEvaluations).length;
  const evaluatedScore = questions.reduce((sum, question) => sum + getDisplayedMarks(question.id, answerEvaluations, manualAssistMarks), 0);
  const evaluatedMaxMarks = questions.reduce((sum, question) => {
    const evaluation = answerEvaluations[question.id];
    return sum + (evaluation ? evaluation.max_marks : 0);
  }, 0);

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.sectionId !== selectedSectionId) {
      const firstQuestionInSection = questionsInSection[0];
      if (firstQuestionInSection) {
        setCurrentQuestionId(firstQuestionInSection.id);
      }
    }
  }, [currentQuestion, questionsInSection, selectedSectionId]);

  function updateAnswer(value: string) {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [currentQuestion.id]: value
    }));
  }

  function startTest() {
    if (!hasQuestions) {
      return;
    }

    setSubmitError(null);
    if (!hasStarted) {
      setHasStarted(true);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  }

  function resetTest() {
    setAnswers({});
    setMarkedForReview([]);
    setCurrentQuestionId(questions[0]?.id ?? null);
    setSelectedSectionId(sections[0].id);
    setShowSubmitModal(false);
    setShowEvaluationOptions(false);
    setSubmitError(null);
    setEvaluationError(null);
    setAnswerEvaluations({});
    setManualReferenceInputs({});
    setManualAssistMarks({});
    setAutosaveStamp("Not saved yet");
    setTimeRemaining(initialSeconds);
    setHasStarted(false);
    setIsRunning(false);
    window.localStorage.removeItem(storageKey);
  }

  const submitTestAttempt = useCallback(async () => {
    if (isSubmittingTest) {
      return;
    }

    setSubmitError(null);
    setIsRunning(false);
    setIsSubmittingTest(true);

    try {
      if (onSubmit) {
        await onSubmit({
          answeredCount: answeredQuestionIds.length,
          totalQuestions: questions.length,
          submittedAnswers: buildSubmittedAnswers(questions, answers, markedForReview, paper)
        });
        return;
      }

      router.push("/processing");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit the test for evaluation.");
    } finally {
      setIsSubmittingTest(false);
    }
  }, [answers, answeredQuestionIds.length, isSubmittingTest, markedForReview, onSubmit, paper, questions, router]);

  useEffect(() => {
    if (isRunning && timeRemaining === 0) {
      setIsRunning(false);
      setShowSubmitModal(false);
      void submitTestAttempt();
    }
  }, [isRunning, submitTestAttempt, timeRemaining]);

  async function handleSubmit() {
    await submitTestAttempt();
  }

  function toggleReviewFlag() {
    if (!currentQuestion) {
      return;
    }

    setMarkedForReview((current) =>
      current.includes(currentQuestion.id)
        ? current.filter((questionId) => questionId !== currentQuestion.id)
        : [...current, currentQuestion.id]
    );
  }

  function moveQuestion(direction: "next" | "previous") {
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const targetQuestion = questions[nextIndex];
    if (!targetQuestion) return;
    setEvaluationError(null);
    setShowEvaluationOptions(false);
    setCurrentQuestionId(targetQuestion.id);
    setSelectedSectionId(targetQuestion.sectionId);
  }

  async function evaluateCurrentAnswer(mode: SingleAnswerEvaluationMode, referenceOverride?: string) {
    if (!currentQuestion) {
      return;
    }

    const studentAnswer = answers[currentQuestion.id]?.trim() || "";

    if (!studentAnswer) {
      setEvaluationError("Enter an answer before evaluation.");
      return;
    }

    setEvaluationError(null);
    setEvaluatingQuestionId(currentQuestion.id);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: currentQuestion.prompt,
          answer: studentAnswer,
          reference: referenceOverride || currentQuestion.expectedAnswer,
          max_marks: currentQuestion.marks,
          mode
        })
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(error?.error || "Evaluation failed.");
      }

      const evaluation = (await response.json()) as QuestionEvaluationResult;
      setAnswerEvaluations((current) => ({
        ...current,
        [currentQuestion.id]: evaluation
      }));
      setShowEvaluationOptions(false);
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "Evaluation failed.");
    } finally {
      setEvaluatingQuestionId(null);
    }
  }

  function updateManualReference(value: string) {
    if (!currentQuestion) {
      return;
    }

    setManualReferenceInputs((current) => ({
      ...current,
      [currentQuestion.id]: value
    }));
    setEvaluationError(null);
  }

  function updateManualAssistMarks(value: string, maxMarks: number) {
    if (!currentQuestion) {
      return;
    }

    if (!/^(\d+(\.\d*)?)?$/.test(value)) {
      return;
    }

    if (value !== "" && Number(value) > maxMarks) {
      return;
    }

    setManualAssistMarks((current) => ({
      ...current,
      [currentQuestion.id]: value
    }));
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <TestTimer
            timeRemaining={timeRemaining}
            isRunning={isRunning}
            hasStarted={hasStarted}
            canStart={hasQuestions}
            hasDetectedDuration={Boolean(detectedDurationMinutes)}
            durationMinutes={durationMinutes}
            customDurationMinutes={customDurationMinutes}
            onCustomDurationChange={setCustomDurationMinutes}
            onStart={startTest}
            onReset={resetTest}
          />

          <SectionCard title="Attempt overview" description="A quick snapshot of progress across the extracted paper.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OverviewStat label="Completed" value={`${answeredQuestionIds.length}/${questions.length}`} />
              <OverviewStat label="Marked" value={`${markedForReview.length}`} tone="accent" />
              <OverviewStat label="Progress" value={`${completionPercent}%`} tone="teal" />
              <OverviewStat
                label="Score"
                value={evaluatedQuestionCount > 0 ? `${evaluatedScore}/${evaluatedMaxMarks}` : "Not evaluated"}
              />
            </div>
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-ink" style={{ width: `${completionPercent}%` }} />
            </div>
          </SectionCard>

          <SectionCard title="Section navigation" description="This extracted paper is presented as one section.">
            <div className="space-y-3">
              {sections.map((section) => {
                const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
                const answeredInSection = sectionQuestions.filter((question) => answeredQuestionIds.includes(question.id)).length;

                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={!canAnswer}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setCurrentQuestionId(sectionQuestions[0]?.id ?? currentQuestion?.id ?? null);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[1.5rem] border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                      selectedSectionId === section.id
                        ? "border-ink bg-ink text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <div>
                      <p className="font-medium">{section.title}</p>
                      <p className={cn("mt-1 text-xs", selectedSectionId === section.id ? "text-white/70" : "text-slate-500")}>
                        {section.questionCount} questions
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        selectedSectionId === section.id ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {answeredInSection}/{sectionQuestions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Question palette" description="Track answered and marked questions at a glance.">
            <QuestionPalette
              currentQuestionId={currentQuestion?.id ?? ""}
              questionIds={questionsInSection.map((question) => question.id)}
              answeredQuestionIds={answeredQuestionIds}
              markedQuestionIds={markedForReview}
              onSelect={(questionId) => {
                if (canAnswer) {
                  setCurrentQuestionId(questionId);
                }
              }}
            />
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Tag tone="teal">{answeredQuestionIds.length} answered</Tag>
              <Tag tone="accent">{markedForReview.length} marked for review</Tag>
              <Tag>{questions.length - answeredQuestionIds.length} remaining</Tag>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <LegendItem label="Current" tone="ink" />
              <LegendItem label="Answered" tone="teal" />
              <LegendItem label="Marked" tone="amber" />
            </div>
          </SectionCard>

          <SectionCard title="Autosave status" description="Answers are stored in local browser state for this paper.">
            <div className="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-teal-700">
                <Save className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{autosaveStamp}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  This attempt is using the real extraction response from your uploaded PDF.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title={currentQuestion ? `Question ${currentQuestion.number}` : "No questions detected"}
          description="Use the extracted PDF response as the source of truth for the test UI."
        >
          {!currentQuestion ? (
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No questions detected. Upload another PDF to create a test.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Tag tone="accent">{currentQuestion.type.toUpperCase()}</Tag>
                  <Tag>{currentQuestion.marks} marks</Tag>
                  <Tag tone="teal">
                    {sections.find((section) => section.id === currentQuestion.sectionId)?.title ?? "Section"}
                  </Tag>
                </div>
                <button
                  type="button"
                  disabled={!canAnswer}
                  onClick={toggleReviewFlag}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
                    markedForReview.includes(currentQuestion.id)
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <BookmarkCheck className="h-4 w-4" />
                  {markedForReview.includes(currentQuestion.id) ? "Marked for review" : "Mark for review"}
                </button>
              </div>

              <p className="mt-6 whitespace-pre-line text-lg font-medium leading-8 text-ink">{currentQuestion.prompt}</p>

              <div className="mt-6 space-y-3">
                <label className="block text-sm font-medium text-slate-700" htmlFor={`answer-${currentQuestion.id}`}>
                  Your answer
                </label>
                <textarea
                  id={`answer-${currentQuestion.id}`}
                  value={answers[currentQuestion.id] ?? ""}
                  disabled={!canAnswer}
                  onChange={(event) => updateAnswer(event.target.value)}
                  rows={currentQuestion.type === "mcq" ? 3 : 10}
                  placeholder={currentQuestion.answerPlaceholder}
                  className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 outline-none placeholder:text-slate-400 focus:border-ink disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canAnswer || evaluatingQuestionId === currentQuestion.id}
                    onClick={() => {
                      if (currentQuestion.expectedAnswer) {
                        void evaluateCurrentAnswer("reference");
                        return;
                      }

                      setShowEvaluationOptions(true);
                      setEvaluationError(null);
                    }}
                    className="rounded-full bg-teal-700 px-5 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {evaluatingQuestionId === currentQuestion.id ? "Evaluating..." : "Evaluate answer"}
                  </button>
                  {answerEvaluations[currentQuestion.id] ? (
                    <button
                      type="button"
                      disabled={!canAnswer || evaluatingQuestionId === currentQuestion.id}
                      onClick={() => {
                        if (currentQuestion.expectedAnswer) {
                          void evaluateCurrentAnswer("reference");
                          return;
                        }

                        setShowEvaluationOptions(true);
                        setEvaluationError(null);
                      }}
                      className="rounded-full bg-slate-100 px-5 py-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Retry evaluation
                    </button>
                  ) : null}
                </div>
              </div>

              {showEvaluationOptions && !currentQuestion.expectedAnswer ? (
                <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-medium text-ink">No reference answer detected for this question.</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Choose how you want to evaluate this answer.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={evaluatingQuestionId === currentQuestion.id}
                      onClick={() => void evaluateCurrentAnswer("ai-generated-answer")}
                      className="rounded-full bg-ink px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Use AI-generated answer
                    </button>
                    <button
                      type="button"
                      disabled={evaluatingQuestionId === currentQuestion.id}
                      onClick={() => void evaluateCurrentAnswer("ai-assist")}
                      className="rounded-full bg-orange-100 px-4 py-3 text-sm text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      AI assist mode
                    </button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700" htmlFor={`reference-${currentQuestion.id}`}>
                      Enter answer key manually
                    </label>
                    <textarea
                      id={`reference-${currentQuestion.id}`}
                      value={manualReferenceInputs[currentQuestion.id] ?? ""}
                      onChange={(event) => updateManualReference(event.target.value)}
                      rows={4}
                      placeholder="Enter the reference answer for this question"
                      className="mt-2 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 outline-none placeholder:text-slate-400 focus:border-ink"
                    />
                    <button
                      type="button"
                      disabled={evaluatingQuestionId === currentQuestion.id}
                      onClick={() => void evaluateCurrentAnswer("manual-input", manualReferenceInputs[currentQuestion.id])}
                      className="mt-3 rounded-full bg-slate-900 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Evaluate with manual key
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-accent">
                    <CircleHelp className="h-4 w-4" />
                  </div>
                  <p>
                    Current answer key source: <span className="font-medium text-ink">{currentQuestion.answerKeySource}</span>
                  </p>
                </div>
              </div>

              {evaluationError ? (
                <p className="mt-4 text-sm text-rose-600">{evaluationError}</p>
              ) : null}

              {answerEvaluations[currentQuestion.id] ? (
                <div className="mt-4 rounded-[1.5rem] border border-teal-200 bg-teal-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink">Evaluation result</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Mode: {formatEvaluationMode(answerEvaluations[currentQuestion.id].mode)} | Board-level evaluation
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink">
                        {getDisplayedMarks(currentQuestion.id, answerEvaluations, manualAssistMarks)}/
                        {answerEvaluations[currentQuestion.id].max_marks}
                      </div>
                      <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700">
                        {getDisplayedPercentage(currentQuestion.id, answerEvaluations, manualAssistMarks)}%
                      </div>
                      <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700">
                        Confidence: {answerEvaluations[currentQuestion.id].confidence}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-700">{answerEvaluations[currentQuestion.id].feedback}</p>
                  {answerEvaluations[currentQuestion.id].reference_answer ? (
                    <div className="mt-4 rounded-[1.25rem] bg-white p-4">
                      <p className="text-sm font-medium text-ink">Reference answer</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                        {answerEvaluations[currentQuestion.id].reference_answer}
                      </p>
                    </div>
                  ) : null}
                  {answerEvaluations[currentQuestion.id].strengths.length ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-ink">Strengths</p>
                      <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-600">
                        {answerEvaluations[currentQuestion.id].strengths.map((point) => (
                          <li key={`${currentQuestion.id}-strength-${point}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {answerEvaluations[currentQuestion.id].missing_points.length ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-ink">Weak areas</p>
                      <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-600">
                        {answerEvaluations[currentQuestion.id].missing_points.map((point) => (
                          <li key={`${currentQuestion.id}-${point}`}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {answerEvaluations[currentQuestion.id].mistakes.length ? (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-ink">Mistakes</p>
                      <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-600">
                        {answerEvaluations[currentQuestion.id].mistakes.map((mistake) => (
                          <li key={`${currentQuestion.id}-mistake-${mistake}`}>{mistake}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    <span className="font-medium text-ink">Improvement:</span> {answerEvaluations[currentQuestion.id].improvement}
                  </p>
                  {answerEvaluations[currentQuestion.id].mode === "ai-assist" ? (
                    <div className="mt-4">
                      <label
                        className="block text-sm font-medium text-slate-700"
                        htmlFor={`assist-mark-${currentQuestion.id}`}
                      >
                        Assign marks manually
                      </label>
                      <input
                        id={`assist-mark-${currentQuestion.id}`}
                        type="text"
                        inputMode="decimal"
                        value={manualAssistMarks[currentQuestion.id] ?? ""}
                        onChange={(event) =>
                          updateManualAssistMarks(event.target.value, answerEvaluations[currentQuestion.id].max_marks)
                        }
                        placeholder={`0 to ${answerEvaluations[currentQuestion.id].max_marks}`}
                        className="mt-2 w-full max-w-xs rounded-full border border-slate-200 bg-white px-4 py-3 outline-none focus:border-ink"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-slate-700">
                    <ListChecks className="h-4 w-4" />
                  </div>
                  <p>
                    {(currentQuestion.marks ?? 0) >= 5
                      ? "Use a complete answer with the key scientific or conceptual points clearly stated."
                      : "Write a concise answer focused on the main expected point."}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={!canAnswer || currentIndex === 0}
                  onClick={() => moveQuestion("previous")}
                  className="rounded-full bg-slate-100 px-5 py-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canAnswer}
                    onClick={() => {
                      setSubmitError(null);
                      setShowSubmitModal(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-5 py-3 text-sm font-medium text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    Submit test
                  </button>
                  <button
                    type="button"
                    disabled={!canAnswer || currentIndex === questions.length - 1}
                    onClick={() => moveQuestion("next")}
                    className="rounded-full bg-ink px-5 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next question
                  </button>
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {showSubmitModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-soft">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-ink">Submit your extracted test?</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You have answered {answeredQuestionIds.length} of {questions.length} questions.{" "}
              {markedForReview.length > 0
                ? `${markedForReview.length} question(s) are still marked for review.`
                : "No questions are currently marked for review."}
            </p>
            <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-700" />
                <span>This attempt is based on the real extracted questions from your uploaded PDF.</span>
              </div>
            </div>
            {submitError ? <p className="mt-4 text-sm text-rose-600">{submitError}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={isSubmittingTest}
                onClick={() => setShowSubmitModal(false)}
                className="rounded-full bg-slate-100 px-5 py-3 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue editing
              </button>
              <button
                type="button"
                disabled={isSubmittingTest}
                onClick={() => void handleSubmit()}
                className="rounded-full bg-ink px-5 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingTest ? "Submitting..." : "Confirm submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function OverviewStat({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "teal" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border p-4",
        tone === "default" && "border-slate-200 bg-white",
        tone === "teal" && "border-teal-200 bg-teal-50",
        tone === "accent" && "border-orange-200 bg-orange-50"
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function LegendItem({
  label,
  tone
}: {
  label: string;
  tone: "ink" | "teal" | "amber";
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <span
        className={cn(
          "h-3 w-3 rounded-full",
          tone === "ink" && "bg-ink",
          tone === "teal" && "bg-teal-500",
          tone === "amber" && "bg-amber-500"
        )}
      />
      {label}
    </div>
  );
}

function buildAnswerPlaceholder(type: QuestionType, marks: number | null) {
  if (type === "mcq") {
    return "Enter the selected option or the correct choice";
  }

  if ((marks ?? 0) >= 5) {
    return "Write a detailed answer";
  }

  return "Write your answer";
}

function parseDurationToMinutes(duration: string) {
  if (!duration) {
    return null;
  }

  const normalized = duration.toLowerCase();
  const hoursMatch = normalized.match(/(\d+)\s*(hours?|hrs?|hr)/);
  const minutesMatch = normalized.match(/(\d+)\s*(minutes?|mins?|min)/);
  const hours = Number(hoursMatch?.[1] ?? 0);
  const minutes = Number(minutesMatch?.[1] ?? 0);
  const totalMinutes = hours * 60 + minutes;

  return totalMinutes > 0 ? totalMinutes : null;
}

function findAnswerSource(questionNumber: string, paper: QuestionExtractionResponse) {
  const hasAnswer = paper.answers.some((answer) => normalizeQuestionNumber(answer.question) === normalizeQuestionNumber(questionNumber));
  return hasAnswer ? "Detected answer key" : "Answer key not available";
}

function findExpectedAnswer(questionNumber: string, paper: QuestionExtractionResponse) {
  const detectedAnswer = paper.answers.find(
    (answer) => normalizeQuestionNumber(answer.question) === normalizeQuestionNumber(questionNumber)
  );

  return detectedAnswer?.answer;
}

function normalizeQuestionNumber(value: string) {
  return value.trim().toLowerCase().replace(/^q(?:uestion)?\s*/i, "");
}

function normalizeQuestionMarks(marks: number | null) {
  return typeof marks === "number" && marks > 0 ? marks : 1;
}

function getDisplayedMarks(
  questionId: string,
  evaluations: Record<string, QuestionEvaluationResult>,
  manualAssistMarks: Record<string, string>
) {
  const evaluation = evaluations[questionId];

  if (!evaluation) {
    return 0;
  }

  if (evaluation.mode === "ai-assist") {
    const manualMarks = manualAssistMarks[questionId];
    return manualMarks ? Math.max(0, Math.min(evaluation.max_marks, Number(manualMarks))) : 0;
  }

  return evaluation.marks_awarded;
}

function getDisplayedPercentage(
  questionId: string,
  evaluations: Record<string, QuestionEvaluationResult>,
  manualAssistMarks: Record<string, string>
) {
  const evaluation = evaluations[questionId];

  if (!evaluation) {
    return 0;
  }

  const marks = getDisplayedMarks(questionId, evaluations, manualAssistMarks);
  return evaluation.max_marks > 0 ? Math.round((marks / evaluation.max_marks) * 100) : 0;
}

function formatEvaluationMode(mode: SingleAnswerEvaluationMode) {
  if (mode === "ai-generated-answer") {
    return "AI-generated answer";
  }

  if (mode === "manual-input") {
    return "Manual answer key";
  }

  if (mode === "ai-assist") {
    return "AI assist";
  }

  return "Reference answer";
}

function buildSubmittedAnswers(
  questions: Array<{
    id: string;
    number: string;
    type: QuestionType;
    prompt: string;
    marks: number;
    expectedAnswer?: string;
  }>,
  answers: Record<string, string>,
  markedForReview: string[],
  paper: QuestionExtractionResponse
): SubmittedAnswerInput[] {
  return questions.map((question) => ({
    questionId: question.id,
    questionNumber: question.number,
    questionType: question.type,
    questionText: question.prompt,
    answer: answers[question.id] ?? "",
    markedForReview: markedForReview.includes(question.id),
    expectedAnswer: question.expectedAnswer ?? findExpectedAnswer(question.number, paper),
    totalMarks: question.marks
  }));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
