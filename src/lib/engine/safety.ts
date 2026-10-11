import type { SafetyVerdict } from "./types";

const CRISIS_PATTERNS = [
  /hurt myself/,
  /kill myself/,
  /suicid/,
  /end(?:ing)? my life/,
  /self[- ]?harm/,
  /hopeless/,
];

const DEPRESSION_PATTERNS = [
  /every day/,
  /nothing helps/,
  /can'?t sleep/,
  /no interest/,
];

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export function assessSafety(raw: string): SafetyVerdict {
  const text = raw.toLowerCase();
  return {
    crisis: matches(text, CRISIS_PATTERNS),
    depression: matches(text, DEPRESSION_PATTERNS),
  };
}
