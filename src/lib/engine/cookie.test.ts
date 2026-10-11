import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, type SessionState } from "./types";
import { decodeState, encodeState } from "./cookie";

const SECRET = "test-secret";
const full: SessionState = {
  ...DEFAULT_STATE,
  stage: "explore",
  turn: 3,
  stageTurns: 2,
  depressionConcern: true,
  memory: ["a".repeat(80), "b".repeat(80), "c".repeat(80), "d".repeat(80), "e".repeat(80)],
  asked: ["f".repeat(120), "g".repeat(120)],
};

describe("cookie codec", () => {
  it("round-trips state", () => {
    expect(decodeState(encodeState(full, SECRET), SECRET)).toEqual(full);
  });
  it("returns DEFAULT_STATE for missing cookie", () => {
    expect(decodeState(undefined, SECRET)).toEqual(DEFAULT_STATE);
  });
  it("rejects a tampered payload", () => {
    const raw = encodeState(full, SECRET);
    const [payload, sig] = raw.split(".");
    const flipped = payload.startsWith("eyJ2Ijox") ? "eyJ2Ijoy" + payload.slice(8) : payload.slice(1);
    expect(decodeState(`${flipped}.${sig}`, SECRET)).toEqual(DEFAULT_STATE);
  });
  it("rejects a tampered signature", () => {
    const raw = encodeState(full, SECRET);
    const [payload] = raw.split(".");
    expect(decodeState(`${payload}.AAAA`, SECRET)).toEqual(DEFAULT_STATE);
  });
  it("rejects a wrong secret", () => {
    expect(decodeState(encodeState(full, SECRET), "other-secret")).toEqual(DEFAULT_STATE);
  });
  it("rejects garbage input", () => {
    expect(decodeState("not-a-cookie", SECRET)).toEqual(DEFAULT_STATE);
  });
  it("keeps a full session cookie under 1024 bytes", () => {
    expect(encodeState(full, SECRET).length).toBeLessThan(1024);
  });
});
