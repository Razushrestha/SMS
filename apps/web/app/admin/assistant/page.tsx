"use client";

import { FormEvent, useEffect, useState } from "react";
import { control } from "@/components/auth-card";
import { PageChrome } from "@/components/page-chrome";
import { api } from "@/lib/api";

type Chart = { label: string; income: string; expense: string };

type Heard = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

type Listener = {
  lang: string;
  start: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: Heard) => void) | null;
};

type Status = {
  name: string;
  voiceWake: boolean;
  prompts: string[];
  quota: number;
  used: number;
  period: string;
  limitReached: boolean;
};

type Reply = Status & { text: string; charts: Chart[] };

export default function AssistantPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  useEffect(() => {
    api<Status>("/assistant").then(setStatus).catch((err: Error) => setError(err.message));
  }, []);

  async function ask(text: string) {
    setError("");
    try {
      const next = await api<Reply>("/assistant/ask", { method: "POST", body: JSON.stringify({ prompt: text }) });
      setReply(next);
      setStatus((current) => ({ ...next, prompts: next.prompts ?? current?.prompts ?? [], voiceWake: next.voiceWake ?? current?.voiceWake ?? true }));
      setPrompt("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Adam could not answer";
      setError(message);
      if (message === "Monthly assistant limit reached.") setStatus((current) => (current ? { ...current, limitReached: true } : current));
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void ask(String(new FormData(form).get("prompt") ?? ""));
  }

  function wake() {
    const browser = window as Window & { SpeechRecognition?: new () => Listener; webkitSpeechRecognition?: new () => Listener };
    const speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!speech) {
      setError("Voice wake is not available in this browser.");
      return;
    }
    const recognition = new speech();
    recognition.lang = "en-US";
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice wake is not available in this browser.");
    };
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      if (heard) void ask(heard);
    };
    recognition.start();
  }

  const blocked = status?.limitReached ?? false;
  const max = Math.max(1, ...(reply?.charts ?? []).flatMap((chart) => [Number(chart.income), Number(chart.expense)]));

  return (
    <PageChrome icon="fa-light fa-sparkles" crumbs={[{ label: "AI Assistant", href: "/admin/assistant" }, { label: "Adam" }]}>
      <p className="mb-3 max-w-3xl text-sm text-[var(--esk-muted)]">Adam reads only the pages this role can open. A reply is counted against the monthly token limit, and a drafted message is not sent.</p>
      {status ? (
        <p className="mb-3 text-sm">
          {status.used} of {status.quota} tokens used in {status.period}.
        </p>
      ) : null}
      {blocked ? <p className="mb-3 rounded-xl border border-[var(--esk-amber)]/40 bg-[var(--esk-amber)]/15 px-4 py-3 text-sm text-[var(--esk-navy)]">Monthly assistant limit reached.</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        {(status?.prompts ?? []).map((item) => (
          <button key={item} className="esk-btn-ghost disabled:opacity-50" disabled={blocked} onClick={() => void ask(item)} type="button">
            {item}
          </button>
        ))}
        {status?.voiceWake ? (
          <button className="esk-btn-primary disabled:opacity-50" disabled={blocked || listening} onClick={wake} type="button">
            {listening ? "Listening" : "Voice wake"}
          </button>
        ) : null}
      </div>
      <form className="esk-panel max-w-3xl flex flex-wrap gap-2" onSubmit={submit}>
        <input className={`${control} flex-1`} name="prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Adam" disabled={blocked} />
        <button className="esk-btn-primary disabled:opacity-50" disabled={blocked} type="submit">
          Ask
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {reply ? (
        <div className="esk-panel mt-4 max-w-3xl">
          <p className="text-sm">{reply.text}</p>
          {reply.charts.length ? (
            <div className="mt-4 grid gap-3">
              {reply.charts.map((chart) => (
                <div key={chart.label}>
                  <p className="text-xs font-semibold text-[var(--esk-muted)]">{chart.label}</p>
                  <div className="mt-1 h-3 rounded bg-[var(--esk-teal)]" style={{ width: `${Math.max(4, (Number(chart.income) / max) * 100)}%` }} title={`Income ${chart.income}`} />
                  <div className="mt-1 h-3 rounded bg-[var(--esk-muted)]" style={{ width: `${Math.max(4, (Number(chart.expense) / max) * 100)}%` }} title={`Expense ${chart.expense}`} />
                  <p className="mt-1 text-xs text-[var(--esk-muted)]">Income {chart.income} · Expense {chart.expense}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </PageChrome>
  );
}
