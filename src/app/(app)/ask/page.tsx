import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AskClient, type ChatTurn } from "@/components/ask/ask-client";
import { cn, relativeTime } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { getConversation, listConversations } from "@/server/repositories/conversations";
import { getItem } from "@/server/repositories/items";

export const metadata: Metadata = { title: "Ask AI" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const sp = await searchParams;
  const conversationParam = str(sp.c);
  const question = str(sp.q)?.slice(0, 1000);
  const aboutId = str(sp.about);
  const viewer = await getViewer();

  const [history, conversation, about] = await Promise.all([
    viewer ? listConversations(viewer.id) : Promise.resolve([]),
    viewer && conversationParam ? getConversation(conversationParam, viewer.id) : Promise.resolve(null),
    aboutId ? getItem(aboutId) : Promise.resolve(null),
  ]);

  const turns: ChatTurn[] =
    conversation?.messages.map((m) => ({ role: m.role, content: m.content, sources: m.citations, cited: m.citations.map((c) => c.index) })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <Link
          href="/ask"
          className="mb-4 flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
        >
          <Plus className="size-4" /> New question
        </Link>
        <p className="mb-2 px-1 font-mono text-[10.5px] uppercase tracking-wider text-fg-subtle">Recent</p>
        {history.length === 0 ? (
          <p className="px-1 text-xs text-fg-subtle">Your conversations appear here.</p>
        ) : (
          <ul className="space-y-0.5">
            {history.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/ask?c=${h.id}`}
                  className={cn(
                    "block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                    h.id === conversation?.id ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <span className="line-clamp-1">{h.title}</span>
                  <span className="text-[11px] text-fg-subtle">{relativeTime(h.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        <AskClient
          key={conversation?.id ?? `${aboutId ?? ""}:${question ?? ""}`}
          initialTurns={turns}
          initialConversationId={conversation?.id}
          initialQuestion={conversation ? undefined : question}
          aboutItemId={about?.id}
          aboutTitle={about?.title}
        />
      </div>
    </div>
  );
}
