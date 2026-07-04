import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buffer);

    if (!data.text.trim()) {
      return NextResponse.json(
        { error: "No readable text in PDF" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: data.text });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse PDF" },
      { status: 500 }
    );
  }
}