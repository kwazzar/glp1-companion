import type { ModelOutput, SessionState, Stage } from "./types";

export const STAGES: Stage[] = ["reflect", "explore", "reframe", "cocreate", "close"];
export const MAX_TURNS = 12;
export const COCREATE_DEADLINE = 8;
export const MEMORY_LIMIT = 5;

function stageIndex(stage: Stage): number {
  return STAGES.indexOf(stage);
}

function nextStage(stage: Stage): Stage {
  return STAGES[Math.min(stageIndex(stage) + 1, STAGES.length - 1)];
}

export function validateTransition(
  current: Stage,
  proposed: Stage,
  stageTurns: number,
  turn: number,
): { stage: Stage; forced?: string } {
  if (
    turn >= COCREATE_DEADLINE &&
    current !== "cocreate" &&
    current !== "close"
  ) {
    return { stage: nextStage(current), forced: "budget" };
  }
  if (proposed === current && stageTurns > 2 && current !== "close") {
    return { stage: nextStage(current), forced: "stalled" };
  }
  if (stageTurns < 1) {
    return { stage: current };
  }
  if (proposed === "close" && current !== "cocreate") {
    return { stage: current };
  }
  if (stageIndex(proposed) < stageIndex(current)) {
    return { stage: current };
  }
  if (stageIndex(proposed) - stageIndex(current) > 1) {
    return { stage: nextStage(current), forced: "clamped" };
  }
  return { stage: proposed };
}

export function appendMemory(
  state: SessionState,
  signal: string,
): SessionState {
  const trimmed = signal.trim();
  if (!trimmed) return state;
  return {
    ...state,
    memory: [...state.memory, trimmed].slice(-MEMORY_LIMIT),
  };
}

export function applyModelOutput(
  state: SessionState,
  out: ModelOutput,
): SessionState {
  const turn = state.turn + 1;
  const move = validateTransition(state.stage, out.stage, state.stageTurns, turn);
  return {
    ...state,
    turn,
    stage: move.stage,
    stageTurns: move.stage === state.stage ? state.stageTurns + 1 : 0,
    forced: move.forced,
    memory: appendMemory(state, out.user_signal).memory,
  };
}
