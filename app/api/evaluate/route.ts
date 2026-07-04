import { NextRequest, NextResponse } from "next/server";
import { isGroqEnabled, evaluateAnswerWithGroq } from "@/lib/extractor/groq-client";

export const runtime = "nodejs";

interface EvaluateRequest {
  question: string;
  studentAnswer: string;
  referenceAnswer?: string;
  maxMarks?: number;
  questionType?: "mcq" | "subjective";
  answer?: string;
  reference?: string;
  max_marks?: number;
  mode?: string;
}

interface EvaluateResponse {
  marksAwarded: number;
  maxMarks: number;
  feedback: string;
  missingPoints: string[];
  strengths: string[];
  refinedAnswer?: string;
}

function evaluateAnswer(req: EvaluateRequest): EvaluateResponse {
  const maxMarks = req.maxMarks || 5;
  const refAnswer = req.referenceAnswer || "";
  const studentAns = req.studentAnswer.trim();

  // MCQ evaluation
  if (req.questionType === "mcq") {
    const isCorrect = studentAns.toLowerCase() === refAnswer.toLowerCase();
    return {
      marksAwarded: isCorrect ? maxMarks : 0,
      maxMarks,
      feedback: isCorrect ? "Correct answer." : "Incorrect answer.",
      missingPoints: [],
      strengths: isCorrect ? ["Correct option selected"] : []
    };
  }

  // Subjective evaluation
  if (!studentAns) {
    return {
      marksAwarded: 0,
      maxMarks,
      feedback: "No answer provided.",
      missingPoints: ["Complete answer required"],
      strengths: []
    };
  }

  if (!refAnswer) {
    // No reference answer - provide basic feedback
    const wordCount = studentAns.split(/\s+/).length;
    let baseMarks = 0;

    if (wordCount >= 50) baseMarks = 3;
    else if (wordCount >= 30) baseMarks = 2;
    else if (wordCount >= 10) baseMarks = 1;

    return {
      marksAwarded: baseMarks,
      maxMarks,
      feedback: `Answer has ${wordCount} words. Ensure all key points are covered.`,
      missingPoints: ["Comparison with reference answer not available"],
      strengths: wordCount > 0 ? ["Answer attempt made"] : []
    };
  }

  // Evaluate against reference answer
  return evaluateAgainstReference(studentAns, refAnswer, maxMarks);
}

function evaluateAgainstReference(
  studentAnswer: string,
  referenceAnswer: string,
  maxMarks: number
): EvaluateResponse {
  const refLower = referenceAnswer.toLowerCase();
  const stuLower = studentAnswer.toLowerCase();

  // Extract key phrases from reference (split by common delimiters)
  const refPhrases = extractKeyPhrases(refLower);
  const stuPhrases = extractKeyPhrases(stuLower);

  if (refPhrases.length === 0) {
    return {
      marksAwarded: Math.floor(maxMarks / 2),
      maxMarks,
      feedback: "Reference answer format unclear. Manual review recommended.",
      missingPoints: [],
      strengths: []
    };
  }

  // Calculate coverage
  const matchedCount = refPhrases.filter((phrase) =>
    stuPhrases.some((stud) => stud.includes(phrase) || phrase.includes(stud))
  ).length;

  const coverage = matchedCount / refPhrases.length;
  let marksAwarded = 0;

  if (coverage >= 0.9) marksAwarded = maxMarks; // Full marks
  else if (coverage >= 0.75) marksAwarded = Math.ceil(maxMarks * 0.85);
  else if (coverage >= 0.5) marksAwarded = Math.ceil(maxMarks * 0.6);
  else if (coverage >= 0.25) marksAwarded = Math.ceil(maxMarks * 0.3);
  else marksAwarded = 0;

  const missingPhrases = refPhrases.filter(
    (phrase) =>
      !stuPhrases.some((stud) => stud.includes(phrase) || phrase.includes(stud))
  );

  const strengths: string[] = [];
  if (coverage >= 0.75) strengths.push("Good coverage of key points");
  if (studentAnswer.length > 100) strengths.push("Detailed explanation");
  if (/demonstrate|explain|analyze|discuss/i.test(studentAnswer))
    strengths.push("Analytical approach shown");

  const feedbackParts: string[] = [];
  feedbackParts.push(
    `${Math.round(coverage * 100)}% of key points covered.`
  );
  if (missingPhrases.length > 0) {
    feedbackParts.push(
      `Missing concepts: ${missingPhrases.slice(0, 2).join(", ")}`
    );
  }
  if (coverage < 0.5) {
    feedbackParts.push("Review reference answer for additional context.");
  }

  return {
    marksAwarded,
    maxMarks,
    feedback: feedbackParts.join(" "),
    missingPoints: missingPhrases.slice(0, 3),
    strengths
  };
}

function extractKeyPhrases(text: string): string[] {
  // Split by: periods, semicolons, "and", "or", commas (with caps after)
  const phrases = text
    .split(/[.;]|,(?=\s+[A-Z])|(?<=[a-z])\s+and\s+(?=[a-z])|(?<=[a-z])\s+or\s+(?=[a-z])/)
    .map((phrase) =>
      phrase
        .replace(/^[\s•·–-]+/, "")
        .replace(/[\s•·–-]+$/, "")
        .trim()
    )
    .filter((phrase) => phrase.length > 3 && phrase.split(/\s+/).length <= 15);

  return [...new Set(phrases)]; // Dedupe
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const question = body.question;
    const studentAnswer = body.studentAnswer || body.answer;
    const referenceAnswer = body.referenceAnswer || body.reference;
    const maxMarks = body.maxMarks || body.max_marks || 5;
    const questionType = body.questionType || (body.mode === 'mcq' ? 'mcq' : 'subjective');

    if (!question || !studentAnswer) {
      return NextResponse.json(
        { error: "Missing required fields: question and studentAnswer" },
        { status: 400 }
      );
    }

    if (isGroqEnabled()) {
      const result = await evaluateAnswerWithGroq(
        question,
        studentAnswer,
        referenceAnswer,
        maxMarks,
        questionType
      );
      return NextResponse.json(result);
    }

    const result = evaluateAnswer({
      question,
      studentAnswer,
      referenceAnswer,
      maxMarks,
      questionType
    });

    return NextResponse.json({
      ...result,
      refinedAnswer: referenceAnswer || ""
    });
  } catch (err) {
    console.error("Evaluation error:", err);
    return NextResponse.json(
      { error: "Evaluation failed. Please try again." },
      { status: 500 }
    );
  }
}