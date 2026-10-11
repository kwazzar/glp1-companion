import { describe, expect, it } from "vitest";
import { assessSafety } from "./safety";

describe("assessSafety", () => {
  it("flags crisis: self-harm / suicide phrasings", () => {
    for (const text of ["I want to hurt myself", "sometimes I think about ending my life",
      "kill myself", "no point in anything anymore, I feel hopeless"]) {
      expect(assessSafety(text).crisis).toBe(true);
    }
  });
  it("flags depression signal without crisis", () => {
    const v = assessSafety("I feel empty every day, nothing helps, I can't sleep");
    expect(v.crisis).toBe(false);
    expect(v.depression).toBe(true);
  });
  it("passes benign scenario text", () => {
    expect(assessSafety("Fridays used to be my treat, now I feel empty")).toEqual({ crisis: false, depression: false });
  });
});
