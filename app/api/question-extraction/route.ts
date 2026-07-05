/**
 * ============================================================
 * app/api/question-extraction/route.ts — Extraction API Route
 * Examiner AI — AI-Only Question Extraction Engine v3
 * ============================================================
 *
 * CHANGES FROM v2:
 * - Removed broken `parseQuestions` import (lib/extractor/archive/ doesn't exist)
 * - Added `hasSolutions` + `hasAnswerKey` flags to response
 * - Added proper error handling when Groq is not configured
 * - Added page images support for diagram-based questions
 */

import { NextRequest, NextResponse } from 'next/server';
import type { ExtractionResult } from '@/lib/extractor/types';
import { isGroqEnabled, parseQuestionsWithGroq, ocrPageWithGroqVision } from '@/lib/extractor/groq-client';

interface ExtractionRequest {
  text?: string;
  images?: string[];
  answerKeyText?: string;
  filename?: string;
  options?: {
    maxQuestions?: number;
    language?: string;
  };
}

interface ExtractionResponse extends ExtractionResult {
  processingTimeMs: number;
  filename?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  let body: ExtractionRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body.' },
      { status: 400 }
    );
  }

  let result: ExtractionResult;
  let textToParse = '';

  // If base64 page images are supplied (scanned PDF / image upload)
  if (body.images && body.images.length > 0) {
    console.log(`[question-extraction] Groq Vision OCR started for ${body.images.length} pages...`);
    try {
      const pageTexts = await Promise.all(
        body.images.map(image => ocrPageWithGroqVision(image))
      );
      textToParse = pageTexts.join('\n\f\n');
      console.log(`[question-extraction] Groq Vision OCR completed. Extracted ${textToParse.length} characters.`);
    } catch (err: any) {
      console.error('[question-extraction] Groq Vision OCR failed:', err);
      return NextResponse.json(
        { error: `OCR extraction failed: ${err.message}` },
        { status: 500 }
      );
    }
  } else {
    textToParse = body.text || '';
  }

  if (!textToParse.trim()) {
    return NextResponse.json(
      { error: 'No text or images provided for parsing.' },
      { status: 400 }
    );
  }

  if (isGroqEnabled()) {
    try {
      result = await parseQuestionsWithGroq(textToParse, body.answerKeyText);
    } catch (err: any) {
      console.error('[question-extraction] Groq parsing failed:', err);
      return NextResponse.json(
        { error: `Groq parsing failed: ${err.message}` },
        { status: 500 }
      );
    }
  } else {
    // No Groq key + no local parser = honest error, not a crash
    console.error('[question-extraction] Groq is not configured and local fallback parser was removed.');
    return NextResponse.json(
      {
        error: 'AI parsing is not configured. Set GROQ_API_KEY in your .env file to enable question extraction.',
      },
      { status: 503 }
    );
  }

  if (body.options?.maxQuestions && result.questions.length > body.options.maxQuestions) {
    const truncated = result.questions.slice(0, body.options.maxQuestions);
    result.warnings.push(
      `Results truncated to ${body.options.maxQuestions} questions (${result.questions.length} total found).`
    );
    result = { ...result, questions: truncated, total: truncated.length };
  }

  const processingTimeMs = Date.now() - startTime;

  const response: ExtractionResponse = {
    ...result,
    processingTimeMs,
    filename: body.filename,
  };

  console.log(
    `[question-extraction] "${body.filename ?? 'unknown'}" -> ` +
    `${result.total} questions in ${processingTimeMs}ms ` +
    `(hasSolutions: ${result.hasSolutions ?? false}, hasAnswerKey: ${result.hasAnswerKey ?? false})`
  );

  return NextResponse.json(response, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'POST, OPTIONS' },
  });
}
