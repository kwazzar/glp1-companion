import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decodeState, encodeState } from "@/src/lib/engine/cookie";
import { handleMessage, parseMessage } from "@/src/lib/engine/orchestrator";
import { makeGroqCall } from "@/src/lib/groq";

const COOKIE = "glp_session";

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set — add it to .env.local (or Vercel env)");
  }
  return secret;
}

export async function POST(request: Request) {
  const secret = requireSecret();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  const parsed = parseMessage(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }
  const jar = await cookies();
  const state = decodeState(jar.get(COOKIE)?.value, secret);
  const { reply, state: next } = await handleMessage(
    {
      call: makeGroqCall(process.env.GROQ_API_KEY ?? ""),
      secret,
    },
    parsed.message,
    state,
  );
  jar.set(COOKIE, encodeState(next, secret), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return NextResponse.json({ reply });
}
