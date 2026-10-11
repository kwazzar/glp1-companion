import { assessSafety } from "./safety";
import {
  CRISIS_REPLY,
  FALLBACK_REPLY,
  type ModelOutput,
  type SessionState,
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
    const parsed = parseModelOutput(await call.json(system, message));
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
  const system = buildSystemInstruction(nextStateBase);
  const parsed = await callJsonWithRetry(deps.call, system, message);
  if (parsed) {
    const next = applyModelOutput(nextStateBase, parsed);
    return {
      reply: parsed.reply,
      state:
        next.turn >= MAX_TURNS
          ? { ...next, stage: "close", forced: "session-end" }
          : next,
    };
  }
  const heuristics = validateTransition(
    nextStateBase.stage,
    nextStateBase.stage,
    nextStateBase.stageTurns,
    nextStateBase.turn + 1,
  );
  try {
    const reply = await deps.call.text(system, message);
    const next = applyModelOutput(nextStateBase, {
      reply,
      stage: heuristics.stage,
      user_signal: "",
    });
    return {
      reply,
      state:
        next.turn >= MAX_TURNS
          ? { ...next, stage: "close", forced: "session-end" }
          : next,
    };
  } catch {
    const next = applyModelOutput(nextStateBase, {
      reply: FALLBACK_REPLY,
      stage: heuristics.stage,
      user_signal: "",
    });
    return {
      reply: FALLBACK_REPLY,
      state:
        next.turn >= MAX_TURNS
          ? { ...next, stage: "close", forced: "session-end" }
          : next,
    };
  }
}
