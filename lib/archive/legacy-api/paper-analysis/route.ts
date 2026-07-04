import { NextRequest, NextResponse } from "next/server";

import { PaperAnalysisRequest, PaperAnalysisResponse } from "@/lib/api-types";
import { hasOpenAIConfig } from "@/lib/env";
import { buildMockAnalysisResponse } from "@/lib/mock-api";
import { extractPaperWithOpenAI } from "@/lib/openai/paper-extraction-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as PaperAnalysisRequest;

  if (!body.uploadBatchId) {
    return NextResponse.json({ error: "uploadBatchId is required." }, { status: 400 });
  }

  if (hasOpenAIConfig() && body.rawPaperText) {
    try {
      const response = await extractPaperWithOpenAI({
        analysisId: `analysis_${Math.random().toString(36).slice(2, 10)}`,
        rawPaperText: body.rawPaperText,
        rawAnswerKeyText: body.rawAnswerKeyText,
        supportingText: body.supportingText
      });

      return NextResponse.json(response);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Paper extraction failed."
        },
        { status: 500 }
      );
    }
  }

  const response: PaperAnalysisResponse = buildMockAnalysisResponse(body);
  return NextResponse.json(response);
}
