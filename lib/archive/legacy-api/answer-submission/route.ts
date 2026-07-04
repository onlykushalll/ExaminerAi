import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

import { AnswerSubmissionRequest, AnswerSubmissionResponse } from "@/lib/api-types";
import { buildMockSubmissionResponse } from "@/lib/mock-api";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AnswerSubmissionRequest;

  if (!body.testId) {
    return NextResponse.json({ error: "testId is required." }, { status: 400 });
  }

  if (!body.answers || body.answers.length === 0) {
    return NextResponse.json({ error: "answers must contain at least one submitted answer." }, { status: 400 });
  }

  const response: AnswerSubmissionResponse = buildMockSubmissionResponse(body);
  return NextResponse.json(response);
}
