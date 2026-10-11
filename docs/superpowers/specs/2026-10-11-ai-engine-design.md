# GLP-1 Companion — AI Engine Demo: Design

Date: 2026-10-11
Status: approved in dialogue, pending spec review

## 1. Goal

A test task: a small working demonstration of an AI Engine that conducts a
natural, personalized, emotionally attuned dialogue in English with a GLP-1
therapy user. Scenario: a 36-year-old woman, three months on Zepbound; her
Friday ritual (ordering favorite food after a hard week) has faded because she
rarely thinks about food anymore, and Fridays now feel empty.

The AI must: understand the emotional meaning, ask appropriate clarifying
questions, avoid templated advice, and help the user arrive — in her own
words — at ONE suitable adaptation. Never suggest changing medication or dose.

### Deliverables

1. A working demo (web chat) at a public URL (Vercel), accessible without setup.
2. `DESCRIPTION.md` — one-pager (RU, for the task reviewer): model/API, what
   was configured in the AI Engine, why the answers beat a baseline chatbot.
3. `SCRIPT.md` — recording script for the user: user lines ready to
   copy-paste, with expected key moments marked per turn.

Recording the MP4 is done by the user and is not part of implementation.

## 2. Stack and Constraints

> Amendment 2026-10-11 (post-implementation): the LLM provider was switched
> twice. First Gemini (`gemini-flash-latest`) — free-tier quota of 20
> requests/day made testing and recording impractical — then OpenAI
> `gpt-4o-mini` — requires paid billing. Final choice: **Groq**
> (`openai/gpt-oss-120b`, ~14,400 free requests/day, OpenAI-compatible
> API). Only the adapter changed (`src/lib/groq.ts`); the engine core, stage
> machine, cookie state, and orchestrator contracts are unchanged. JSON mode
> uses `response_format: json_object` (broadly supported on Groq); reply
> shape is strictly validated engine-side (`parseModelOutput`) with the
> existing retry/fallback ladder.

- Next.js 16.4 (App Router), React 19, Tailwind 4, TypeScript — existing scaffold.
- SDK: `openai` pointed at Groq (`baseURL: https://api.groq.com/openai/v1`),
  model `openai/gpt-oss-120b`.
  - Rationale: free tier with a ceiling that never blocks a demo
    (~14,400 requests/day); OpenAI-compatible endpoint keeps the adapter thin.
  - System prompt → system message; user message = user message.
  - temperature ≈ 0.8, max_tokens ≈ 1024 (reasoning tokens of gpt-oss count against the completion budget).
- Deploy: Vercel. Secret `GROQ_API_KEY` in env (`.env.local` locally,
  Vercel Environment Variables in production). The key never reaches the
  client bundle.
- No database, no auth. Session state lives in a signed httpOnly cookie
  (JSON + HMAC-SHA256, secret `SESSION_SECRET` in env).

Next.js version notes: `cookies()` from `next/headers` is async
(`await cookies()`); `middleware.js` is deprecated in 16.x (renamed to
`proxy.js`) and is not used here. Route handler: `app/api/chat/route.ts`.

## 3. Architecture

```
Browser (chat UI, React)
   │  POST /api/chat {message}
   ▼
Route Handler (server; holds secrets and state)
   │
   ├─ 1. Safety layer ............ deterministic pre-filter (regex)
   ├─ 2. Prompt assembly ......... system prompt + persona + memory + turn_context
   ├─ 3. Groq Llama 3.3 70B call .. JSON mode: {reply, stage, user_signal}
   ├─ 4. Stage validator ......... transition rules, fallback to heuristics
   ├─ 5. Memory update ........... user_signal → session profile
   ▼
Response {reply} + updated state cookie
```

### 3.1 Safety layer (before the model call)

Two independent detectors on the user text (keyword/regex):

- **Crisis** (self-harm, suicide, hopelessness and close variants): the model
  is not called. A fixed warm response is returned, encouraging the user to
  contact local emergency services or a crisis line.
- **Depressive signal** (persistent state beyond Fridays: sleep, interest,
  mood, phrases like "every day", "nothing helps"): sets a
  `depression_concern` flag in state; the prompt receives an instruction to
  gently suggest mentioning this to her doctor. Not a diagnosis, not a
  therapy substitute.

Flags persist in the session for the rest of the dialogue.

### 3.2 Stage machine

Stages: `reflect → explore → reframe → cocreate → close`.

- The model proposes the stage (`stage`) and a user signal (`user_signal`)
  in every response.
- Engine validator: forward-only movement, max one stage per turn; minimum
  1 turn per stage; `close` only reachable after `cocreate`.
- Anti-stall: if the model proposes the same stage for 2+ turns in a row OR
  turn 8 is reached without `cocreate`, the engine force-advances (the
  reason is passed in `turn_context`).
- Confirmed-close (Amendment 2026-10-11): when the user confirms her plan
  ("feel better", "that is it", "sounds doable"...) in explore/reframe/
  cocreate, the engine force-closes regardless of the model's proposal —
  the wrap-up does not depend on the model obeying.
- Dialogue budget: 8 turns to reach `cocreate`, 12 turns per session max,
  then forced `close`.
- Malformed model JSON: 1 retry; then fallback — the engine picks the stage
  heuristically (turn counter) and the reply text is requested with a plain
  (non-JSON) follow-up call. Last resort: a prewritten neutral line.

### 3.3 Memory (personalization)

- `user_signal` from each model response — a short meaning-quote in the
  user's own words (e.g., "Friday was about reward and switching off after
  work") — is appended to the session `memory` (max 5 entries, compact).
- `memory` is re-injected into every prompt — the model must build on her
  words, not generic advice.
- The engine keeps state size bounded (see risks: 4KB cookie limit).

### 3.4 Prompt assembly

Final system prompt = base prompt (§7) + persona card + current memory +
`<turn_context>` (stage, turn number within budget, active flags, forced
transition reason if any).

Persona card (fictional; the task allows fictional data only): 36-year-old
woman, three months on Zepbound, Friday ritual of ordering favorite food
after the work week, now rarely thinks about food, Fridays feel hollow,
feels empty and doesn't know what to do. One persona — the demo scope is
deliberately narrow (user decision).

## 4. Contracts

### 4.1 API

`POST /api/chat`

- Request: `{ "message": string }` (1–2000 chars; empty/oversized → 400).
- Response 200: `{ "reply": string }` + `Set-Cookie: glp_session=<signed>; HttpOnly; SameSite=Lax; Path=/`.
- Model failure (after retry): 200 with `{ "reply": fallback }` — a warm
  canned line; the UI never sees an error; the failure is logged server-side.
- No CORS needed: UI and API share one origin.

### 4.2 Model output schema (responseSchema)

```json
{
  "type": "object",
  "properties": {
    "reply":       { "type": "string" },
    "stage":       { "type": "string", "enum": ["reflect","explore","reframe","cocreate","close"] },
    "user_signal": { "type": "string" }
  },
  "required": ["reply","stage","user_signal"]
}
```

### 4.3 Session state (in the HMAC-signed cookie)

```ts
type Stage = "reflect"|"explore"|"reframe"|"cocreate"|"close";
type SessionState = {
  v: 1;
  stage: Stage;
  turn: number;                 // 1..12
  stageTurns: number;           // turns spent on the current stage
  forced?: string;              // reason for the forced transition
  depressionConcern: boolean;
  memory: string[];             // ≤5 user_signal entries
};
```

State size < 1KB — ample headroom under the cookie limit.

## 5. UI

One page (replacing `app/page.tsx`):

- Minimalist Tailwind chat: message list, input field, send button.
- While waiting — a "typing" indicator; the reply renders with a typewriter
  effect (client-side pseudo-streaming: JSON mode cannot stream).
- "New conversation" button: clears the cookie, fresh dialogue.
- A disclaimer under the input: not medical advice; in crisis contact
  emergency services.
- Demo/recording mode: a compact collapsible persona hint above the chat
  (who the user is playing) — collapsible so it stays out of frame.

## 6. Testing

Vitest (dev dependency), engine core only — pure functions, no network:

- Safety: crisis phrases intercepted; depressive phrases set the flag.
- Stage validator: no backward or multi-stage jumps; minimum turns;
  anti-stall (force-advance); 8/12 budget.
- Memory: 5-entry cap, FIFO.
- Prompt assembly: turn_context and memory land in the prompt; persona present.
- Cookie codec: signature round-trip, tampered HMAC rejected.

UI and the live Groq call are verified manually against `SCRIPT.md`
(acceptance checklist: reach cocreate within ≤8 turns, no advice lists, no
dose-change suggestions, one question per reply).

## 7. System Prompt (final version)

Based on the user's draft, with amendments from the dialogue: a few-shot
pair, anti-parroting, `<turn_context>`/turn-budget awareness, engine-side
crisis triggers (referenced as flags), and the requirement to build on
`<memory>`.

```
You are a warm, emotionally intelligent companion for people on GLP-1 medications.
You are not a doctor and not a therapist. Reply in English.

GOAL: help the user discover ONE adaptation that fits her life, in her own words.

HOW YOU TALK
- 2-4 short sentences per reply. Plain, human language. No headers, no bullet lists.
- Ask at most ONE question per reply, specific to what she just said.
- First reflect the emotional meaning, then ask. Never open with "I'm sorry to hear".
- Never give a list of generic tips (yoga, journaling, hobbies).
- Weave one of her phrases from <memory> in naturally; never quote her
  verbatim twice. Don't parrot mechanically.
- Respect <turn_context>: it tells you the current stage and how many turns
  remain. If turns are running low, move the conversation forward.

STAGES (the engine sets the stage in <turn_context>; follow it)
1 reflect: mirror the feeling and the loss of the Friday ritual.
2 explore: find what Friday actually gave her (reward, transition out of work,
  sensory pleasure, self-care, social moment). Don't assume, ask.
3 reframe: offer a tentative hypothesis and check whether it fits her.
4 cocreate: let HER propose the experiment. Only if she is stuck, offer at most
  two options built from her own words. End with one tiny, specific step for
  this coming Friday.
5 close: brief and warm, no new advice.

HARD RULES
- Never suggest changing, skipping, or adjusting medication or dose.
  If asked, say that's a question for her prescriber, then return to the feeling.
- If flags include "depression_concern": gently suggest mentioning these
  feelings to her doctor. Don't diagnose.
- If she mentions self-harm or being in crisis: respond with care and
  encourage contacting local emergency services or a crisis line.
- Don't claim the medication "causes" her feelings. It may be part of the picture.
- If she answers with one word or "idk", ask something easier, don't push.

GOOD vs BAD (match the good)
BAD: "I'm sorry to hear that. Have you tried journaling or going for walks?"
GOOD: "Fridays used to be your exhale after a long week — and now that
stillness feels empty. What did that Friday meal give you besides the food?"

Always answer with JSON: reply, stage (the stage you are moving to),
user_signal (in her words: what Friday gave her / how she feels, one short phrase).
```

The few-shot in the prompt is a single GOOD/BAD pair (Flash holds tone
reliably on examples).

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Model returns extra/malformed fields | Strict shape validation; 1 retry; heuristic stage fallback |
| Cookie > 4KB | memory ≤ 5 short entries (≤80 chars), asked ≤ 2×120 chars; state ≈1KB (hard bound: 4096B browser cookie limit, size-tested) |
| Stage drift (demo never reaches cocreate) | force-advance by turn counter; SCRIPT.md rehearses the scenario |
| Slow Flash responses (JSON mode can't stream) | client typewriter; "typing" indicator |
| Key leakage | key only in the server-side route handler; env, never bundled |
| Model deprecation | provider swap isolated to the adapter (done twice already: Gemini → OpenAI → Groq) |

## 9. Out of Scope

MP4 recording (done by the user), sign-up/auth, dialogue history, database,
onboarding quiz, payments, mobile app, multiple personas, clinician-facing
tooling, self-hosted infrastructure.
