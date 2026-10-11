<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# GLP-1 Companion — AI Engine Demo

Test-task demo: an AI Engine that conducts an empathetic, personalized
English dialogue with a GLP-1 therapy user. Design spec (read before
changing engine behavior): `docs/superpowers/specs/2026-10-11-ai-engine-design.md`.

- Stack: Next.js 16.4 (App Router), React 19, Tailwind 4, TypeScript, `@google/genai`, model `gemini-flash-latest`.
- Chat dialogue is English; commit messages and `DESCRIPTION.md` are English/RU respectively; discuss with the user in RU/UA.
- Secrets (`GEMINI_API_KEY`, `SESSION_SECRET`) live in `.env.local` (gitignored). Never commit real keys; `.env.example` holds placeholders only. Keys are used server-side only (`app/api/chat/route.ts`).

## Architecture convention (lightweight layered / hexagonal)

- **Domain core** — pure, framework-free TypeScript: stage machine, safety rules, memory policy, prompt assembly. No Next.js, no SDK imports. Unit-testable directly (vitest).
- **Adapters** — Gemini client, signed-cookie session codec, route handler, crisis detector I/O.
- **Presentation** — chat UI components.
- Full tactical DDD (aggregates, repositories, bounded contexts) is deliberately out of scope for a demo; keep the domain/adapter boundary clean instead.

## Verification

Run before claiming anything works (evidence, not assumptions):

```bash
npm run lint        # eslint: 0 errors
npx tsc --noEmit    # typecheck: exit 0
npm run build       # production build: exit 0 — linter does NOT check compilation
npx vitest run      # engine unit tests: 0 failures (once added)
```

Manual acceptance for the AI behavior (see spec §6): reach the cocreate
stage within ≤8 turns, no advice lists, no medication/dose suggestions,
exactly one question per reply, crisis input intercepted engine-side.
