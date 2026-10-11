import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE = "glp_session";

export async function POST() {
  const jar = await cookies();
  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
}
