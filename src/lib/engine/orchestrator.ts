import { assessSafety } from "./safety";
import {
  CRISIS_REPLY,
  FALLBACK_REPLY,
  type ModelOutput,
  type SessionState,
  type Stage,
} from "./types";
import {
  applyModelOutput,
  MAX_TURNS,
  STAGES,
  validateTransition,
} from "./stages";
import { buildSystemInstruction } from "./prompt";

export type GeminiCall = {
  json(system: string, message: string): Promise<unknown>;
  text(system: string, message: string): Promise<string>;
};

const MAX_MESSAGE_LENGTH = 2000;
const CONFIRM_RE =
  /feel(s)? a bit better|feel(s)? better|that'?s it|sounds? (doable|like a plan)|let'?s do it|i'?ll (do|try) (it|that)/i;
const CONFIRM_NEGATION_RE = /\b(don'?t|do not|not|never|can'?t)\s+(feel|want|think)/i;
const CONFIRM_STAGES: Stage[] = ["explore", "reframe", "cocreate"];

export function parseModelOutput(raw: unknown): ModelOutput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.reply !== "string" || o.reply.trim().length === 0) return null;
  if (typeof o.stage !== "string" || !STAGES.includes(o.stage as never)) return null;
  if (typeof o.user_signal !== "string") return null;
  return { reply: o.reply, stage: o.stage as ModelOutput["stage"], user_signal: o.user_signal };
}

export function parseMessage(
  body: unknown,
): { ok: true; message: string } | { ok: false } {
  if (typeof body !== "object" || body === null) return { ok: false };
  const message = (body as Record<string, unknown>).message;
  if (typeof message !== "string") return { ok: false };
  const trimmed = message.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_MESSAGE_LENGTH) return { ok: false };
  return { ok: true, message: trimmed };
}

async function callJsonWithRetry(
  call: GeminiCall,
  system: string,
  message: string,
): Promise<ModelOutput | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let parsed: ModelOutput | null = null;
    try {
      parsed = parseModelOutput(await call.json(system, message));
    } catch (err) {
      console.error("[engine] model call failed:", err);
    }
    if (parsed) return parsed;
  }
  return null;
}

export async function handleMessage(
  deps: { call: GeminiCall; secret: string },
  message: string,
  state: SessionState,
): Promise<{ reply: string; state: SessionState }> {
  const safety = assessSafety(message);
  if (safety.crisis) {
    return { reply: CRISIS_REPLY, state };
  }
  const nextStateBase: SessionState = safety.depression
    ? { ...state, depressionConcern: true }
    : state;
  const confirmed =
    CONFIRM_RE.test(message) &&
    !CONFIRM_NEGATION_RE.test(message) &&
    CONFIRM_STAGES.includes(nextStateBase.stage)
      ? "confirmed — she just confirmed her plan: this reply is the CLOSE, brief and warm, no new questions"
      : undefined;
  const system = buildSystemInstruction(
    confirmed ? { ...nextStateBase, forced: confirmed } : nextStateBase,
  );
  const parsed = await callJsonWithRetry(deps.call, system, message);
  if (parsed) {
    return finish(nextStateBase, parsed.reply, parsed, confirmed);
  }
  const heuristics = validateTransition(
    nextStateBase.stage,
    nextStateBase.stage,
    nextStateBase.stageTurns,
    nextStateBase.turn + 1,
  );
  try {
    const text = (await deps.call.text(system, message)).trim();
    const reply = text.length > 0 ? text : FALLBACK_REPLY;
    return finish(nextStateBase, reply, { reply, stage: heuristics.stage, user_signal: "" }, confirmed);
  } catch (err) {
    console.error("[engine] model text fallback failed:", err);
    return finish(nextStateBase, FALLBACK_REPLY, {
      reply: FALLBACK_REPLY,
      stage: heuristics.stage,
      user_signal: "",
    }, confirmed);
  }
}

function finish(
  base: SessionState,
  reply: string,
  out: ModelOutput,
  force?: string,
): { reply: string; state: SessionState } {
  let next = applyModelOutput(base, out, force);
  next = {
    ...next,
    asked: [...next.asked, reply.slice(0, 120)].slice(-2),
  };
  if (next.turn >= MAX_TURNS) {
    next = { ...next, stage: "close", forced: "session-end" };
  }
  return { reply, state: next };
}
