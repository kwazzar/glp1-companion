"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

const PERSONA_HINT =
  "You are demoing: a 36-year-old woman, three months on Zepbound. Fridays used to be " +
  "your ritual — favorite takeout and unwinding after a hard week. Now you rarely think " +
  "about food, Fridays feel hollow, and you can't explain the emptiness.";

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
      const data = (await res.json()) as { reply?: string };
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
    }
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 pb-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-base">
            🌙
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
            <p className="text-2xl">🌙</p>
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
