import { describe, expect, it } from "vitest";
import { makeGeminiCall } from "./gemini";

describe("makeGeminiCall", () => {
  it("throws a descriptive error at call time when the key is empty", async () => {
    const call = makeGeminiCall("");
    await expect(call.json("system", "hi")).rejects.toThrow("GEMINI_API_KEY is not set");
  });
});
