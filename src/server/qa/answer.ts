import "server-only";
import type { ChatMessage, GroundingSource } from "@/services/ai/types";
import { temporalWindowHours } from "@/domain/query-intent";
import { getEmbedder } from "@/services/ai/registry";
import { getItem, listItems, type ItemSummary } from "@/server/repositories/items";
import { hybridSearchItems, type RetrievedItem } from "@/server/repositories/search";

const MAX_SOURCES = 6;

export const QA_SYSTEM_PROMPT = `You are AI Pulse, a personal AI and technology intelligence analyst.
Answer ONLY from the numbered sources provided in <sources>. Do not use outside knowledge for facts.
Cite every factual sentence with its source number in square brackets, e.g. [1] or [2][3].
If the sources do not answer the question, say so plainly and suggest what to search for instead.
Clearly separate facts (cited) from your analysis; prefix forward-looking statements with "Speculation:".
Be concise: lead with the answer, then 2–5 supporting points. Use markdown bullets when listing.`;

/**
 * Builds the retrieval query. Short follow-ups ("why does that matter?") are expanded
 * with the previous user turn so retrieval keeps conversational context.
 */
export function retrievalQuery(question: string, history: ChatMessage[]): string {
  const words = question.trim().split(/\s+/).length;
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  return words < 9 && lastUser ? `${lastUser.content} ${question}` : question;
}

function toSource(item: ItemSummary & { snippet?: string | null }, index: number): GroundingSource {
  const text = [item.tldr, item.whyItMatters, item.snippet].filter(Boolean).join(" ");
  return {
    index,
    itemId: item.id,
    title: item.title,
    url: item.url,
    source: item.sourceName,
    publishedAt: item.publishedAt,
    text: text.slice(0, 1200),
  };
}

export async function retrieveSources(question: string, history: ChatMessage[], aboutItemId?: string): Promise<GroundingSource[]> {
  const floor = getEmbedder().relevanceFloor;
  const query = retrievalQuery(question, history);
  const window = temporalWindowHours(query);
  const [hits, recent, pinned] = await Promise.all([
    hybridSearchItems(query, { limit: MAX_SOURCES + 2 }),
    // "What happened today?" is answered from the top-ranked recent items, not lexical matches.
    window ? listItems({ sinceHours: window, limit: MAX_SOURCES, minScore: 50 }) : Promise.resolve([]),
    aboutItemId ? getItem(aboutItemId) : Promise.resolve(null),
  ]);
  const relevant: RetrievedItem[] = hits.filter((h) => h.textMatch || h.similarity >= floor);
  const ordered: Array<ItemSummary & { snippet?: string | null }> = [];
  for (const candidate of [pinned, ...recent, ...relevant]) {
    if (candidate && !ordered.some((o) => o.id === candidate.id)) ordered.push(candidate);
  }
  return ordered.slice(0, MAX_SOURCES).map((item, i) => toSource(item, i + 1));
}

const escapeAttr = (s: string) => s.replace(/"/g, "'");

export function buildGroundedPrompt(question: string, sources: GroundingSource[]): string {
  const block = sources
    .map(
      (s) =>
        `<source index="${s.index}" title="${escapeAttr(s.title)}">${s.text} (Source: ${s.source ?? "unknown"}, ${s.publishedAt.toISOString().slice(0, 10)})</source>`,
    )
    .join("\n");
  return `<sources>\n${block}\n</sources>\n\nQuestion: ${question}`;
}
