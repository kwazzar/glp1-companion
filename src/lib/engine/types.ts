export type Stage = "reflect" | "explore" | "reframe" | "cocreate" | "close";

export type SessionState = {
  v: 1;
  stage: Stage;
  turn: number;
  stageTurns: number;
  forced?: string;
  depressionConcern: boolean;
  memory: string[];
  asked: string[];
};

export type ModelOutput = {
  reply: string;
  stage: Stage;
  user_signal: string;
};

export type SafetyVerdict = {
  crisis: boolean;
  depression: boolean;
};

export const DEFAULT_STATE: SessionState = {
  v: 1,
  stage: "reflect",
  turn: 0,
  stageTurns: 0,
  depressionConcern: false,
  memory: [],
  asked: [],
};

export const CRISIS_REPLY =
  "I'm really glad you told me. What you're describing sounds bigger than food or Fridays — please contact your local emergency services or a crisis line right now. You deserve real support, and I'd rather make sure you get it.";

export const FALLBACK_REPLY =
  "I'm here with you — my thoughts slipped for a moment. Can you tell me a bit more about how this Friday felt?";
