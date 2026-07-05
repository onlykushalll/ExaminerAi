import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
    
    console.log(`[ollama-proxy] Forwarding request to local Ollama at ${ollamaUrl}/api/generate...`);
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        { error: `Ollama error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("[ollama-proxy] Proxy failed:", err);
    return NextResponse.json(
      { error: `Failed to connect to local Ollama. Ensure Ollama is running on your machine.`, details: err.message },
      { status: 500 }
    );
  }
}
