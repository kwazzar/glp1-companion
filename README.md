# GLP-1 Companion — AI Engine Demo

A small working demo of an **AI Engine** that conducts an empathetic,
personalized English dialogue with a GLP-1 therapy user (fictional persona:
36F, three months on Zepbound, her Friday ritual has faded and Fridays feel
empty). The engine helps her arrive — in her own words — at one concrete
adaptation, without templated advice and without touching medication or dose.

**Live demo:** https://glp1-companion-three.vercel.app

## What the engine does

Four layers, all deterministic except the model call:

1. **Safety pre-filter** (before the model): crisis phrasings are intercepted
   engine-side with a fixed response — the model is never called; a
   depression signal (persistent low mood beyond Fridays) sets a flag that
   makes the engine gently suggest talking to her doctor.
2. **Stage machine**: `reflect → explore → reframe → cocreate → close`.
   The model only *proposes* a stage; the engine validates transitions
   (forward-only, max one step, turn budgets 8/12), force-advances on stall,
   and force-closes when the user confirms her plan.
3. **Memory**: each reply extracts a `user_signal` — the meaning of what she
   said, in her words — and re-injects it into every prompt (max 5 entries).
4. **Prompt assembly**: system prompt + persona card + memory +
   `<turn_context>` (stage, turn budget, flags, forced reasons).

Session state travels in an HMAC-signed httpOnly cookie — no database,
serverless-friendly. The engine core (`src/lib/engine/`) is pure TypeScript:
no Next.js, no SDK imports, 58 unit tests (vitest).

The **Debug: on/off** panel in the header makes the machinery visible:
active stage pills, turn budget, accumulated memory, last question asked.

## Stack

- Next.js 16.4 (App Router), React 19, Tailwind 4, TypeScript
- `openai` SDK pointed at Groq — model `openai/gpt-oss-120b`, JSON output
- vitest for engine unit tests

## Run locally

```bash
npm install
cp .env.example .env.local    # fill GROQ_API_KEY and SESSION_SECRET
npm run dev                   # http://localhost:3000
```

Keys: free `GROQ_API_KEY` at [console.groq.com](https://console.groq.com);
`SESSION_SECRET` — any long random string (`openssl rand -hex 32`).

## Verification

```bash
npm run lint        # eslint: 0 errors
npx tsc --noEmit    # typecheck: exit 0
npm test            # engine unit tests: 0 failures
npm run build       # production build: exit 0
```

Manual acceptance: reach cocreate within ≤8 turns, no advice lists, no
medication/dose suggestions, one question per reply, crisis input intercepted
engine-side. A ready recording script with copy-paste user messages:
[SCRIPT.md](SCRIPT.md).

## Docs

- [DESCRIPTION.md](DESCRIPTION.md) — one-pager (RU): what was configured and
  why it beats a baseline chatbot.
- [EXAMPLES.md](EXAMPLES.md) — evaluation criteria mapped to real dialogue
  quotes.
- [SCRIPT.md](SCRIPT.md) — 3–5 min screen-recording script.
- Design spec: `docs/superpowers/specs/2026-10-11-ai-engine-design.md`;
  implementation plan: `docs/superpowers/plans/2026-10-11-ai-engine.md`.

## Project structure

```
app/api/chat/route.ts    POST /api/chat — the only place secrets are read
app/api/chat/reset/      POST /api/chat/reset — clears the session cookie
src/components/chat.tsx  chat UI (dark theme, debug panel) — no engine logic
src/lib/groq.ts          LLM adapter (swap providers in one file)
src/lib/engine/          pure domain core: safety, stages, cookie codec,
                         prompt assembly, orchestrator — 58 vitest tests
```
