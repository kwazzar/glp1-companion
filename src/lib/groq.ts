import OpenAI from "openai";
import type { GeminiCall } from "./engine/orchestrator";

const MODEL = "openai/gpt-oss-120b";
const BASE_URL = "https://api.groq.com/openai/v1";

export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function makeGroqCall(apiKey: string): GeminiCall {
  async function generate(
    system: string,
    message: string,
    json: boolean,
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }
    const client = new OpenAI({ apiKey, baseURL: BASE_URL });
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      temperature: 0.8,
      max_tokens: 1024,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    return response.choices[0]?.message?.content ?? "";
  }

  return {
    async json(system, message) {
      return extractJson(await generate(system, message, true));
    },
    async text(system, message) {
      return generate(
        system +
          "\n\nIMPORTANT: The structured reply could not be read. Answer now in plain conversational text only — 2-4 short sentences, no JSON, no code fences, no mention of stages or the engine.",
        message,
        false,
      );
    },
  };
}
