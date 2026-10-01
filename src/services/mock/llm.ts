import type { ZodType } from "zod";
import type { GenerateRequest, GenerateResult, GroundingSource, LLMProvider } from "@/services/ai/types";

/**
 * Demo-mode LLM. It never invents content: for grounded tasks it composes an
 * extractive answer from the supplied sources, with `[n]` citations. For structured
 * tasks it refuses, so callers fall back to precomputed (seeded) analysis.
 */

const SOURCES_TAG = /<source index="(\d+)" title="([^"]*)">([\s\S]*?)<\/source>/g;

export function parseGroundingBlock(prompt: string): Array<Pick<GroundingSource, "index" | "title" | "text">> {
  const out: Array<Pick<GroundingSource, "index" | "title" | "text">> = [];
  for (const m of prompt.matchAll(SOURCES_TAG)) {
    out.push({ index: Number(m[1]), title: m[2] ?? "", text: (m[3] ?? "").trim() });
  }
  return out;
}

function firstSentence(text: string): string {
  const match = text.match(/^(.{20,280}?[.!?])(\s|$)/);
  return (match?.[1] ?? text.slice(0, 220)).trim();
}

export function composeExtractiveAnswer(prompt: string): string {
  const sources = parseGroundingBlock(prompt);
  if (sources.length === 0) {
    return "I couldn't find anything about that in the collected intelligence yet. Try rephrasing, or ask about a topic covered in today's feed.";
  }
  const lead = sources[0]!;
  const lines = [
    `Here's what the collected intelligence shows. The most relevant development is **${lead.title}** — ${firstSentence(lead.text)} [${lead.index}]`,
    "",
  ];
  const rest = sources.slice(1, 5);
  if (rest.length > 0) {
    lines.push("**Related signals**");
    for (const s of rest) lines.push(`- **${s.title}** — ${firstSentence(s.text)} [${s.index}]`);
    lines.push("");
  }
  lines.push(
    "_Demo mode: this answer was assembled extractively from the retrieved sources — no language model is configured. Set `AI_PROVIDER` to enable synthesized answers._",
  );
  return lines.join("\n");
}

const approxTokens = (s: string) => Math.ceil(s.length / 4);

export class MockLLMProvider implements LLMProvider {
  readonly id = "mock";
  readonly isMock = true;

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const prompt = req.messages.map((m) => m.content).join("\n\n");
    const text = composeExtractiveAnswer(prompt);
    return { text, model: "mock-extractive", inputTokens: approxTokens(prompt), outputTokens: approxTokens(text) };
  }

  async generateObject<T>(req: GenerateRequest, _schema: ZodType<T>): Promise<T> {
    throw new Error(
      `Mock provider cannot generate structured output for task "${req.task}". Configure AI_PROVIDER to run enrichment.`,
    );
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const { text } = await this.generate(req);
    // Emit word-sized chunks so the UI exercises the same streaming path as real providers.
    for (const chunk of text.match(/\S+\s*|\s+/g) ?? []) {
      yield chunk;
      await new Promise((r) => setTimeout(r, 8));
    }
  }
}
