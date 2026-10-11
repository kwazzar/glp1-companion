import { describe, expect, it } from "vitest";
import {
  DEFAULT_STATE,
  type ModelOutput,
  type SessionState,
} from "./types";
import { appendMemory, applyModelOutput, validateTransition } from "./stages";

const out = (stage: ModelOutput["stage"], signal = "signal"): ModelOutput => ({
  reply: "ok",
  stage,
  user_signal: signal,
});

const stateWith = (over: Partial<SessionState>): SessionState => ({
  ...DEFAULT_STATE,
  ...over,
});

describe("validateTransition", () => {
  it("moves forward one stage when allowed", () => {
    expect(validateTransition("explore", "reframe", 1, 2)).toEqual({ stage: "reframe" });
  });
  it("clamps multi-stage jump to next stage", () => {
    expect(validateTransition("reflect", "cocreate", 1, 2)).toEqual({
      stage: "explore",
      forced: "clamped",
    });
  });
  it("rejects backward moves", () => {
    expect(validateTransition("explore", "reflect", 1, 2)).toEqual({ stage: "explore" });
  });
  it("keeps current stage when it has not spent a turn yet", () => {
    expect(validateTransition("reflect", "explore", 0, 1)).toEqual({ stage: "reflect" });
  });
  it("rejects close before cocreate", () => {
    expect(validateTransition("reframe", "close", 1, 4)).toEqual({ stage: "reframe" });
  });
  it("allows close after cocreate", () => {
    expect(validateTransition("cocreate", "close", 1, 6)).toEqual({ stage: "close" });
  });
  it("force-advances when stalled on one stage too long", () => {
    expect(validateTransition("explore", "explore", 3, 5)).toEqual({
      stage: "reframe",
      forced: "stalled",
    });
  });
  it("force-advances at the cocreate deadline", () => {
    expect(validateTransition("explore", "explore", 1, 8)).toEqual({
      stage: "reframe",
      forced: "budget",
    });
  });
});

describe("applyModelOutput", () => {
  it("increments turn and resets stageTurns on stage change", () => {
    const s = applyModelOutput(stateWith({ stage: "reflect", turn: 1, stageTurns: 1 }), out("explore"));
    expect(s.turn).toBe(2);
    expect(s.stage).toBe("explore");
    expect(s.stageTurns).toBe(0);
  });
  it("increments stageTurns when staying on the stage", () => {
    const s = applyModelOutput(stateWith({ stage: "explore", turn: 2, stageTurns: 0 }), out("explore"));
    expect(s.stageTurns).toBe(1);
    expect(s.forced).toBeUndefined();
  });
  it("keeps forced marker when transition was forced", () => {
    const s = applyModelOutput(stateWith({ stage: "explore", turn: 8, stageTurns: 1 }), out("explore"));
    expect(s.forced).toBe("budget");
  });
  it("appends the user signal to memory", () => {
    const s = applyModelOutput(DEFAULT_STATE, out("reflect", "friday was my reward"));
    expect(s.memory).toEqual(["friday was my reward"]);
  });
});

describe("appendMemory", () => {
  it("caps at 5 entries, dropping the oldest", () => {
    let s: SessionState = DEFAULT_STATE;
    for (let i = 1; i <= 6; i++) s = appendMemory(s, `signal ${i}`);
    expect(s.memory).toEqual(["signal 2", "signal 3", "signal 4", "signal 5", "signal 6"]);
  });
  it("ignores empty or whitespace signals", () => {
    const s = appendMemory({ ...DEFAULT_STATE, memory: ["keep"] }, "   ");
    expect(s.memory).toEqual(["keep"]);
  });
});
