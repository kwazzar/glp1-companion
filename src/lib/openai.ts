import OpenAI from "openai";
import type { GeminiCall } from "./engine/orchestrator";

const MODEL = "gpt-4o-mini";

const RESPONSE_SCHEMA = {
  name: "engine_reply",
  strict: true,
  schema: {
    type: "object",
    properties: {
      reply: { type: "string" },
      stage: {
        type: "string",
        enum: ["reflect", "explore", "reframe", "cocreate", "close"],
      },
      user_signal: { type: "string" },
    },
    required: ["reply", "stage", "user_signal"],
    additionalProperties: false,
  },
} as const;

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

export function makeOpenAICall(apiKey: string): GeminiCall {
  async function generate(
    system: string,
    message: string,
    json: boolean,
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      temperature: 0.8,
      max_tokens: 300,
      ...(json
        ? {
            response_format: {
              type: "json_schema",
              json_schema: RESPONSE_SCHEMA,
            },
          }
        : {}),
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
