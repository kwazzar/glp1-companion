import { describe, expect, it } from "vitest";
import { extractJson, makeOpenAICall } from "./openai";

describe("makeOpenAICall", () => {
  it("throws a descriptive error at call time when the key is empty", async () => {
    const call = makeOpenAICall("");
    await expect(call.json("system", "hi")).rejects.toThrow("OPENAI_API_KEY is not set");
  });
});

describe("extractJson", () => {
  it("parses a clean JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("extracts JSON from a markdown code fence", () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("extracts JSON embedded in prose", () => {
    expect(extractJson('Sure! {"reply":"hi","stage":"reflect","user_signal":""} hope it helps')).toEqual({
      reply: "hi",
      stage: "reflect",
      user_signal: "",
    });
  });
  it("returns null when there is no JSON at all", () => {
    expect(extractJson("Here is the JSON:")).toBeNull();
    expect(extractJson("")).toBeNull();
  });
  it("returns null for malformed JSON inside fences", () => {
    expect(extractJson('```json\n{"a":\n```')).toBeNull();
  });
});
