import { NextRequest, NextResponse } from "next/server";

import { TestCreationRequest, TestCreationResponse } from "@/lib/api-types";
import { buildMockTestCreationResponse } from "@/lib/mock-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as TestCreationRequest;

  if (!body.analysisId) {
    return NextResponse.json({ error: "analysisId is required." }, { status: 400 });
  }

  const response: TestCreationResponse = buildMockTestCreationResponse(body);
  return NextResponse.json(response);
}
