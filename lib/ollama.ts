
const OLLAMA_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL ?? "qwen3:1.7b";

interface OllamaResponse {
  response?: string;
  thinking?: string;
  done?: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export async function generateWithOllama(
  prompt: string,
  system?: string
): Promise<string> {
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system,
      think: false,
      format: "json",
      stream: false,
      options: {
        temperature: 0.2,
        num_predict: 800,
      },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as OllamaResponse;

  if (!data.response || typeof data.response !== "string") {
    throw new Error(
      `Ollama returned an empty response. ` +
      `done=${data.done}, ` +
      `reason=${data.done_reason}, ` +
      `thinkingLength=${data.thinking?.length ?? 0}, ` +
      `promptTokens=${data.prompt_eval_count}, ` +
      `outputTokens=${data.eval_count}, ` +
      `duration=${data.total_duration}`
    );
  }

  return data.response.trim();
}
