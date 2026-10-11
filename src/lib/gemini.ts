import { GoogleGenAI, Type } from "@google/genai";
import type { GeminiCall } from "./engine/orchestrator";

const MODEL = "gemini-flash-latest";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    stage: {
      type: Type.STRING,
      enum: ["reflect", "explore", "reframe", "cocreate", "close"],
    },
    user_signal: { type: Type.STRING },
  },
  required: ["reply", "stage", "user_signal"],
} as const;

export function makeGeminiCall(apiKey: string): GeminiCall {
  async function generate(
    system: string,
    message: string,
    json: boolean,
  ): Promise<string> {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: message,
      config: {
        systemInstruction: system,
        temperature: 0.8,
        maxOutputTokens: 300,
        ...(json
          ? { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
          : {}),
      },
    });
    return response.text ?? "";
  }

  return {
    async json(system, message) {
      return JSON.parse(await generate(system, message, true));
    },
    async text(system, message) {
      return generate(system, message, false);
    },
  };
}
