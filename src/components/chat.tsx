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
    await fetch("/api/chat/reset", { method: "POST" });
    setMessages([]);
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">GLP-1 Companion</h1>
        <button
          onClick={reset}
          className="rounded-md border border-neutral-300 px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
        >
          New conversation
        </button>
      </div>

      <button
        onClick={() => setHintOpen((o) => !o)}
        className="mb-3 self-start text-xs text-neutral-500 underline"
      >
        {hintOpen ? "Hide demo role" : "Show demo role"}
      </button>
      {hintOpen && (
        <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{PERSONA_HINT}</p>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && !awaiting && (
          <p className="mt-10 text-center text-sm text-neutral-500">
            How did this Friday feel compared to the ones before?
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <Bubble text={m.text} animate={m.role === "assistant" && i === messages.length - 1 && !awaiting} />
          </div>
        ))}
        {awaiting && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-200 px-4 py-2 text-neutral-600">…</div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message…"
          className="flex-1 rounded-xl border border-neutral-300 px-4 py-2 outline-none focus:border-neutral-500"
        />
        <button
          onClick={send}
          disabled={awaiting || !input.trim()}
          className="rounded-xl bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
        >
          Send
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-neutral-400">
        Not medical advice. In crisis, contact local emergency services.
      </p>
    </main>
  );
}

function Bubble({ text, animate }: { text: string; animate: boolean }) {
  const shown = useTypewriter(text, animate);
  return (
    <div className="max-w-[80%] rounded-2xl bg-neutral-200 px-4 py-2 whitespace-pre-wrap">
      {shown}
    </div>
  );
}
