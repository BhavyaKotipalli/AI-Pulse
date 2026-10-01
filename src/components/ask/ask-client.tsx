"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Square, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AskEvent } from "@/app/api/ask/route";
import { Kbd } from "@/components/ui/kbd";
import { cn, relativeTime } from "@/lib/utils";
import type { MessageCitation } from "@/server/db/schema";
import { AnswerText } from "./answer-text";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources: MessageCitation[];
  cited?: number[];
  pending?: boolean;
  error?: string;
  isMock?: boolean;
}

const SUGGESTIONS = [
  "What happened in AI today?",
  "What are the biggest trends this week?",
  "What should an AI engineer learn right now?",
  "How is AI affecting software engineering?",
  "What experiments can I build this weekend?",
  "What AI startups are becoming interesting?",
];

export function AskClient({
  initialTurns = [],
  initialConversationId,
  initialQuestion,
  aboutItemId,
  aboutTitle,
}: {
  initialTurns?: ChatTurn[];
  initialConversationId?: string;
  initialQuestion?: string;
  aboutItemId?: string;
  aboutTitle?: string;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const conversationId = useRef<string | undefined>(initialConversationId);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoAsked = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (q.length < 2 || busy) return;
      setBusy(true);
      setInput("");
      const history = turns.filter((t) => !t.error && !t.pending).map((t) => ({ role: t.role, content: t.content }));
      setTurns((prev) => [...prev, { role: "user", content: q, sources: [] }, { role: "assistant", content: "", sources: [], pending: true }]);
      const controller = new AbortController();
      abortRef.current = controller;

      const patchLast = (fn: (t: ChatTurn) => ChatTurn) =>
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = fn(next[next.length - 1]!);
          return next;
        });

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, conversationId: conversationId.current, aboutItemId, history: history.slice(-6) }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as AskEvent;
            if (event.type === "sources") patchLast((t) => ({ ...t, sources: event.sources }));
            else if (event.type === "delta") patchLast((t) => ({ ...t, content: t.content + event.text }));
            else if (event.type === "done") {
              patchLast((t) => ({ ...t, pending: false, cited: event.cited, isMock: event.isMock }));
              if (event.conversationId && event.conversationId !== conversationId.current) {
                conversationId.current = event.conversationId;
                router.replace(`/ask?c=${event.conversationId}`, { scroll: false });
              }
            } else if (event.type === "error") throw new Error(event.message);
          }
        }
        patchLast((t) => ({ ...t, pending: false }));
      } catch (err) {
        const aborted = (err as Error).name === "AbortError";
        patchLast((t) => ({ ...t, pending: false, error: aborted ? "Stopped." : (err as Error).message }));
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [aboutItemId, busy, router, turns],
  );

  useEffect(() => {
    if (initialQuestion && !autoAsked.current && initialTurns.length === 0) {
      autoAsked.current = true;
      void ask(initialQuestion);
    }
  }, [ask, initialQuestion, initialTurns.length]);

  const empty = turns.length === 0;

  return (
    <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
      {aboutTitle && (
        <div className="mb-4 rounded-xl border border-accent/20 bg-accent-soft px-4 py-2.5 text-[13px] text-fg-muted">
          Asking about <span className="text-fg">{aboutTitle}</span> — this source is pinned as [1].
        </div>
      )}

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-surface-2">
            <Sparkles className="size-5 text-accent" />
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-fg">Ask your intelligence base</h2>
          <p className="mt-1.5 max-w-md text-sm text-fg-muted">
            Answers are grounded in collected stories, papers and repositories — every fact is cited, and unknowns are stated as unknown.
          </p>
          <div className="mt-6 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => ask(s)}
                className="rounded-xl border border-line bg-surface-1 px-4 py-3 text-left text-[13.5px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-8 pb-6" aria-live="polite">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-3 px-4 py-2.5 text-[15px] text-fg">{t.content}</p>
              </div>
            ) : (
              <div key={i} className="space-y-4">
                {t.sources.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {t.sources.map((s) => {
                      const cited = !t.cited || t.cited.includes(s.index);
                      return (
                        <Link
                          key={s.index}
                          href={`/intel/${s.itemId}`}
                          className={cn(
                            "w-56 shrink-0 rounded-xl border border-line bg-surface-1 p-3 transition-colors hover:border-line-strong",
                            !cited && "opacity-45",
                          )}
                          title={cited ? s.title : "Retrieved but not cited"}
                        >
                          <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                            <span className="font-mono text-accent">[{s.index}]</span>
                            <span className="truncate">{s.source}</span>
                            <span className="ml-auto shrink-0">{relativeTime(new Date(s.publishedAt))}</span>
                          </p>
                          <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-fg-muted">{s.title}</p>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {t.content ? (
                  <AnswerText text={t.content} sources={t.sources} />
                ) : t.pending ? (
                  <p className="flex items-center gap-2 text-sm text-fg-subtle">
                    <Loader2 className="size-4 animate-spin" /> Retrieving intelligence…
                  </p>
                ) : null}
                {t.error && <p className="text-sm text-down">{t.error}</p>}
                {!t.pending && !t.error && t.sources.length === 0 && t.content && (
                  <p className="text-xs text-warn">No matching sources were found — nothing above is presented as fact.</p>
                )}
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="sticky bottom-4 mt-4"
      >
        <div className="glass flex items-end gap-2 rounded-2xl border border-line-strong p-2 shadow-2xl shadow-black/40 focus-within:border-accent/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder={empty ? "Ask anything about AI and technology…" : "Ask a follow-up…"}
            aria-label="Your question"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-fg-subtle"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Stop generating"
              className="inline-flex size-10 items-center justify-center rounded-xl bg-surface-3 text-fg hover:bg-surface-2"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={input.trim().length < 2}
              aria-label="Ask"
              className="inline-flex size-10 items-center justify-center rounded-xl bg-fg text-bg transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-fg-subtle">
          <Kbd>Enter</Kbd> to send · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> new line · answers cite their sources
        </p>
      </form>
    </div>
  );
}
