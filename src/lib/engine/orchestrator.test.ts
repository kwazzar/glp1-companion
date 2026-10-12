import { describe, expect, it, vi } from "vitest";
import {
  CRISIS_REPLY,
  DEFAULT_STATE,
  FALLBACK_REPLY,
  type ModelOutput,
  type SessionState,
} from "./types";
import type { GeminiCall } from "./orchestrator";
import {
  handleMessage,
  parseMessage,
  parseModelOutput,
} from "./orchestrator";

const valid: ModelOutput = {
  reply: "That stillness must feel strange.",
  stage: "explore",
  user_signal: "friday was my exhale",
};

type FakeCall = GeminiCall & {
  jsonCalls: number;
  textCalls: number;
  jsonSystems: string[];
  textSystems: string[];
};

function fakeCall(opts?: {
  jsonResults?: unknown[];
  textResult?: string | Error;
}): FakeCall {
  const queue = [...(opts?.jsonResults ?? [])];
  return {
    jsonCalls: 0,
    textCalls: 0,
    jsonSystems: [],
    textSystems: [],
    async json(system) {
      this.jsonSystems.push(system);
      this.jsonCalls += 1;
      const next = queue[Math.min(this.jsonCalls - 1, queue.length - 1)];
      if (next instanceof Error) throw next;
      return next;
    },
    async text(system) {
      this.textSystems.push(system);
      this.textCalls += 1;
      const t = opts?.textResult;
      if (t instanceof Error) throw t;
      return t ?? "plain reply";
    },
  };
}

const deps = (call: GeminiCall) => ({ call, secret: "s" });

const out = (over: Partial<ModelOutput>): ModelOutput => ({
  reply: "r",
  stage: "explore",
  user_signal: "sig",
  ...over,
});

describe("parseModelOutput", () => {
  it("accepts a valid output", () => {
    expect(parseModelOutput(out({}))).toEqual(out({}));
  });
  it("rejects non-objects, empty replies, unknown stages", () => {
    expect(parseModelOutput(null)).toBeNull();
    expect(parseModelOutput("hi")).toBeNull();
    expect(parseModelOutput(out({ reply: "" }))).toBeNull();
    expect(parseModelOutput(out({ stage: "party" as ModelOutput["stage"] }))).toBeNull();
    expect(parseModelOutput(out({ user_signal: 42 as unknown as string }))).toBeNull();
  });
});

describe("parseMessage", () => {
  it("accepts and trims a valid message", () => {
    expect(parseMessage({ message: "  hi  " })).toEqual({ ok: true, message: "hi" });
  });
  it("rejects oversized, whitespace-only and non-object bodies", () => {
    expect(parseMessage({ message: "x".repeat(2001) })).toEqual({ ok: false });
    expect(parseMessage({ message: "   " })).toEqual({ ok: false });
    expect(parseMessage("hi")).toEqual({ ok: false });
    expect(parseMessage({})).toEqual({ ok: false });
  });
});

describe("handleMessage", () => {
  it("intercepts crisis without calling the model", async () => {
    const call = fakeCall();
    const r = await handleMessage(deps(call), "I want to hurt myself", DEFAULT_STATE);
    expect(r.reply).toBe(CRISIS_REPLY);
    expect(call.jsonCalls).toBe(0);
    expect(r.state).toEqual(DEFAULT_STATE);
  });
  it("sets depressionConcern when flagged", async () => {
    const call = fakeCall({ jsonResults: [valid] });
    const r = await handleMessage(deps(call), "I feel numb every day, nothing helps", DEFAULT_STATE);
    expect(r.state.depressionConcern).toBe(true);
  });
  it("happy path: one json call, reply passed through, state advanced", async () => {
    const call = fakeCall({ jsonResults: [valid] });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(r.reply).toBe(valid.reply);
    expect(call.jsonCalls).toBe(1);
    expect(r.state.turn).toBe(1);
    expect(r.state.stage).toBe("reflect"); // min 1 turn per stage keeps reflect on turn 1
    expect(r.state.memory).toEqual(["friday was my exhale"]);
  });
  it("retries once on invalid JSON, then accepts the valid retry", async () => {
    const call = fakeCall({ jsonResults: [{ reply: 42 }, valid] });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(call.jsonCalls).toBe(2);
    expect(r.reply).toBe(valid.reply);
  });
  it("falls back to plain text when json never validates", async () => {
    const call = fakeCall({ jsonResults: [{ reply: 42 }], textResult: "A plain, warm reply." });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(call.textCalls).toBe(1);
    expect(r.reply).toBe("A plain, warm reply.");
  });
  it("returns FALLBACK_REPLY when the text call also throws", async () => {
    const call = fakeCall({ jsonResults: [{ reply: 42 }], textResult: new Error("down") });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(r.reply).toBe(FALLBACK_REPLY);
  });
  it("forces close at the end of the session budget", async () => {
    const state: SessionState = { ...DEFAULT_STATE, stage: "cocreate", turn: 11, stageTurns: 1 };
    const call = fakeCall({ jsonResults: [out({ stage: "cocreate" })] });
    const r = await handleMessage(deps(call), "ok, small step", state);
    expect(r.state.turn).toBe(12);
    expect(r.state.stage).toBe("close");
    expect(r.state.forced).toBe("session-end");
  });
  it("does not leak model-call rejections: json throws, text answers", async () => {
    const call = fakeCall({ jsonResults: [new Error("GROQ_API_KEY is not set")], textResult: "A plain, warm reply." });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(call.jsonCalls).toBe(2);
    expect(call.textCalls).toBe(1);
    expect(r.reply).toBe("A plain, warm reply.");
  });
  it("forces close when she confirms her plan in explore or later", async () => {
    const state: SessionState = { ...DEFAULT_STATE, stage: "explore", turn: 3, stageTurns: 1 };
    const call = fakeCall({ jsonResults: [out({ stage: "explore" })] });
    const r = await handleMessage(deps(call), "Yes — chai walk this Friday, 7pm. I already feel a bit better just deciding it.", state);
    expect(r.state.stage).toBe("close");
    expect(r.state.forced).toContain("confirmed");
  });
  it("does not force close on confirmation in reflect", async () => {
    const call = fakeCall({ jsonResults: [valid] });
    const r = await handleMessage(deps(call), "Yes, that's it — I feel better already", DEFAULT_STATE);
    expect(r.state.stage).toBe("reflect");
    expect(r.state.forced).toBeUndefined();
  });
  it("does not leak model-call rejections: json and text both throw", async () => {
    const call = fakeCall({ jsonResults: [new Error("network down")], textResult: new Error("still down") });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(r.reply).toBe(FALLBACK_REPLY);
  });
  it("puts the confirmed-close instruction into the prompt of the confirming call", async () => {
    const state: SessionState = { ...DEFAULT_STATE, stage: "explore", turn: 3, stageTurns: 1 };
    const call = fakeCall({ jsonResults: [out({ stage: "explore" })] });
    await handleMessage(deps(call), "Yes — chai walk this Friday. I feel better already.", state);
    expect(call.jsonSystems[0]).toContain("forced_transition: confirmed");
    expect(call.jsonSystems[0]).toContain("this reply is the CLOSE");
  });
  it("does not force close on a negated confirmation", async () => {
    const state: SessionState = { ...DEFAULT_STATE, stage: "explore", turn: 3, stageTurns: 1 };
    const call = fakeCall({ jsonResults: [out({ stage: "explore" })] });
    const r = await handleMessage(deps(call), "Honestly, I don't feel better — that's it, I give up on plans.", state);
    expect(r.state.stage).toBe("explore");
    expect(r.state.forced).toBeUndefined();
  });
  it("returns FALLBACK_REPLY when the text fallback is empty", async () => {
    const call = fakeCall({ jsonResults: [{ reply: 42 }], textResult: "" });
    const r = await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
    expect(r.reply).toBe(FALLBACK_REPLY);
    expect(r.reply.trim().length).toBeGreaterThan(0);
  });
  it("logs model failures server-side", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const call = fakeCall({ jsonResults: [new Error("network down")], textResult: new Error("still down") });
      await handleMessage(deps(call), "Fridays feel empty now", DEFAULT_STATE);
      expect(err).toHaveBeenCalled();
    } finally {
      err.mockRestore();
    }
  });
});
