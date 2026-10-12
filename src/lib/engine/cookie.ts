import { createHmac, timingSafeEqual } from "node:crypto";
import { DEFAULT_STATE, type SessionState } from "./types";

const SCHEMA_VERSION = 1;

function toBase64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeState(state: SessionState, secret: string): string {
  const payload = toBase64Url(JSON.stringify(state));
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeState(
  raw: string | undefined,
  secret: string,
): SessionState {
  if (!raw) return DEFAULT_STATE;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return DEFAULT_STATE;
  const expected = Buffer.from(sign(payload, secret), "base64url");
  let received: Buffer;
  try {
    received = Buffer.from(sig, "base64url");
  } catch {
    return DEFAULT_STATE;
  }
  if (received.length !== expected.length) return DEFAULT_STATE;
  if (!timingSafeEqual(received, expected)) return DEFAULT_STATE;
  let state: unknown;
  try {
    state = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return DEFAULT_STATE;
  }
  if (
    typeof state !== "object" ||
    state === null ||
    (state as SessionState).v !== SCHEMA_VERSION
  ) {
    return DEFAULT_STATE;
  }
  const s = state as SessionState;
  if (!Array.isArray(s.memory) || !Array.isArray(s.asked)) {
    return DEFAULT_STATE;
  }
  return s;
}
