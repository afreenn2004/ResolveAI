
import { connection, NextResponse } from "next/server";
import { generateWithOllama } from "@/lib/ollama";

export async function GET() {
  await connection();

  try {
    const result = await generateWithOllama(
      "Reply with exactly: ResolveAI Next.js AI connection successful.",
      "You are a concise assistant. Follow the requested output exactly."
    );

    return NextResponse.json({
      success: true,
      model: "qwen3:1.7b",
      response: result,
    });
  } catch (error) {
    console.error("AI test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
