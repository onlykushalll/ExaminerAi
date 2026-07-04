import { NextRequest, NextResponse } from "next/server";

import { FileUploadRequest, FileUploadResponse } from "@/lib/api-types";
import { buildMockUploadResponse } from "@/lib/mock-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as FileUploadRequest;

  if (!body.files || body.files.length === 0) {
    return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
  }

  const response: FileUploadResponse = buildMockUploadResponse(body);
  return NextResponse.json(response);
}
