import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, type SessionState } from "./types";
import { buildSystemInstruction } from "./prompt";

const state: SessionState = {
  ...DEFAULT_STATE,
  stage: "explore",
  turn: 3,
  stageTurns: 1,
  depressionConcern: true,
  memory: ["friday was my reward", "the week drains me"],
  asked: ["what did that Friday meal give you besides the food?"],
};

describe("buildSystemInstruction", () => {
  it("includes the base prompt with stage rules and few-shot", () => {
    const s = buildSystemInstruction(state);
    expect(s).toContain("STAGES");
    expect(s).toContain("GOOD vs BAD");
    expect(s).toContain("Never suggest changing, skipping, or adjusting medication or dose");
  });
  it("includes the persona card", () => {
    const s = buildSystemInstruction(state);
    expect(s).toContain("Zepbound");
    expect(s).toContain("36");
  });
  it("includes each memory entry", () => {
    const s = buildSystemInstruction(state);
    expect(s).toContain("friday was my reward");
    expect(s).toContain("the week drains me");
  });
  it("includes turn context with stage, budget and deadline", () => {
    const s = buildSystemInstruction(state);
    expect(s).toContain("stage: explore");
    expect(s).toContain("turn 3/12");
    expect(s).toContain("8");
  });
  it("exposes the depression flag", () => {
    expect(buildSystemInstruction(state)).toContain("depression_concern");
  });
  it("omits the memory block when memory is empty", () => {
    expect(buildSystemInstruction(DEFAULT_STATE)).not.toContain("</memory>");
  });
  it("lists already-asked questions with a no-repeat instruction", () => {
    const s = buildSystemInstruction(state);
    expect(s).toContain("do not repeat or rephrase");
    expect(s).toContain("what did that Friday meal give you besides the food?");
  });
  it("omits the asked block when nothing was asked yet", () => {
    expect(buildSystemInstruction(DEFAULT_STATE)).not.toContain("already asked");
  });
  it("includes the forced reason when set", () => {
    const s = buildSystemInstruction({ ...DEFAULT_STATE, forced: "budget" });
    expect(s).toContain("budget");
  });
});
