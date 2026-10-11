"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

const STAGES = ["reflect", "explore", "reframe", "cocreate", "close"];

type DebugInfo = {
  stage: string;
  turn: number;
  stageTurns: number;
  forced: string | null;
  depressionConcern: boolean;
  memory: string[];
  asked: string[];
};

const PERSONA_HINT =
  "A 36-year-old woman, three months on Zepbound. Fridays used to be your ritual — " +
  "favorite takeout and unwinding after a hard week. Now you rarely think about food, " +
  "Fridays feel hollow, and you can't explain the emptiness.";

function useTypewriter(target: string, active: boolean): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    if (!active) return;
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setShown(target.slice(0, i));
      if (i >= target.length) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [target, active]);

  return active ? shown : target;
}

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [awaiting, setAwaiting] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(true);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, awaiting]);

  async function send() {
    const message = input.trim();
    if (!message || awaiting) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: message }]);
    setAwaiting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json()) as { reply?: string; debug?: DebugInfo };
      setDebug(data.debug ?? null);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.reply ?? "Something went wrong — please try again." },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Connection hiccup — please try again." },
      ]);
    } finally {
      setAwaiting(false);
    }
  }

  async function reset() {
    try {
      await fetch("/api/chat/reset", { method: "POST" });
    } finally {
      setMessages([]);
      setDebug(null);
    }
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 pb-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-base">
            🌿
          </span>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight text-neutral-100">
              GLP-1 Companion
            </h1>
            <p className="text-xs leading-tight text-neutral-500">
              A quiet space to think it through
            </p>
          </div>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
        >
          New conversation
        </button>
      </header>

      {debugOpen && (
        <div className="mb-3 rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
              Engine
            </span>
            <button
              onClick={() => setDebugOpen(false)}
              className="text-[10px] text-neutral-600 transition-colors hover:text-neutral-400"
            >
              hide
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {STAGES.map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={
                    s === debug?.stage
                      ? "rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300 ring-1 ring-indigo-500/40"
                      : "rounded-md px-2 py-0.5 text-[10px] text-neutral-600"
                  }
                >
                  {s}
                </span>
                {i < STAGES.length - 1 && <span className="text-[9px] text-neutral-700">→</span>}
              </div>
            ))}
            {debug && (
              <span className="ml-auto text-[10px] text-neutral-500">
                turn {debug.turn}/12
                {debug.forced && (
                  <span className="ml-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                    {debug.forced}
                  </span>
                )}
                {debug.depressionConcern && (
                  <span className="ml-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-300">
                    depression_concern
                  </span>
                )}
              </span>
            )}
          </div>
          {debug && debug.memory.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
              <span className="text-neutral-600">her words:</span>{" "}
              {debug.memory.map((m, i) => (
                <span key={i} className="mr-1.5 rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-400">
                  {m}
                </span>
              ))}
            </p>
          )}
          {debug && debug.asked.length > 0 && (
            <p className="mt-1.5 truncate text-[11px] text-neutral-600">
              <span className="text-neutral-700">asked:</span> {debug.asked[debug.asked.length - 1]}
            </p>
          )}
        </div>
      )}
      {!debugOpen && (
        <button
          onClick={() => setDebugOpen(true)}
          className="mb-3 self-start text-[10px] text-neutral-600 transition-colors hover:text-neutral-400"
        >
          show engine
        </button>
      )}

      <button
        onClick={() => setHintOpen((o) => !o)}
        className="mb-3 self-start text-xs text-neutral-600 underline decoration-neutral-700 underline-offset-2 transition-colors hover:text-neutral-400"
      >
        {hintOpen ? "Hide demo role" : "Show demo role"}
      </button>
      {hintOpen && (
        <p className="mb-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-[13px] leading-relaxed text-amber-200/80">
          {PERSONA_HINT}
        </p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && !awaiting && (
          <div className="mt-16 text-center">
            <p className="text-2xl">🌿</p>
            <p className="mt-3 text-sm text-neutral-500">
              How did this Friday feel compared to the ones before?
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <Bubble
              text={m.text}
              animate={m.role === "assistant" && i === messages.length - 1 && !awaiting}
            />
          </div>
        ))}
        {awaiting && (
          <div className="flex justify-start">
            <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-neutral-800/80 px-4 py-3">
              <Dot delay="0ms" />
              <Dot delay="150ms" />
              <Dot delay="300ms" />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors focus:border-indigo-500/60"
        />
        <button
          onClick={send}
          disabled={awaiting || !input.trim()}
          className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-2.5 text-center text-[11px] text-neutral-600">
        Not medical advice. In crisis, contact local emergency services.
      </p>
    </main>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500"
      style={{ animationDelay: delay }}
    />
  );
}

function Bubble({ text, animate }: { text: string; animate: boolean }) {
  const shown = useTypewriter(text, animate);
  return (
    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-neutral-800/80 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-neutral-100">
      {shown}
    </div>
  );
}
