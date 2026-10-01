import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS } from "@/domain/constants";
import { cosineSimilarity, hashEmbed, tokenize } from "./embeddings";
import { composeExtractiveAnswer, MockLLMProvider, parseGroundingBlock } from "./llm";

describe("hash embeddings", () => {
  it("produces normalized vectors of the configured width", () => {
    const v = hashEmbed("Model Context Protocol adoption grows");
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
  });

  it("is deterministic", () => {
    expect(hashEmbed("coding agents")).toEqual(hashEmbed("coding agents"));
  });

  it("scores related text above unrelated text", () => {
    const doc = hashEmbed("Terminal coding agents edit files, run tests and open pull requests");
    const related = cosineSimilarity(hashEmbed("coding agent that runs tests"), doc);
    const unrelated = cosineSimilarity(hashEmbed("sourdough pizza hydration"), doc);
    expect(related).toBeGreaterThan(0.18);
    expect(related).toBeGreaterThan(unrelated);
  });

  it("stems plurals and drops stopwords", () => {
    expect(tokenize("The agents and the agent")).toEqual(["agent", "agent"]);
  });

  it("never returns a zero vector", () => {
    expect(Math.hypot(...hashEmbed("the of and"))).toBeCloseTo(1, 6);
  });
});

describe("mock LLM", () => {
  const prompt = `<sources>
<source index="1" title="MCP adoption">MCP is now widely supported. More text here.</source>
<source index="2" title="Coding agents">Agents edit code across many files.</source>
</sources>

Question: what changed?`;

  it("parses grounding blocks", () => {
    expect(parseGroundingBlock(prompt).map((s) => s.index)).toEqual([1, 2]);
  });

  it("only cites provided sources", () => {
    const answer = composeExtractiveAnswer(prompt);
    const cited = [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    expect(cited.length).toBeGreaterThan(0);
    expect(cited.every((n) => n === 1 || n === 2)).toBe(true);
  });

  it("says it doesn't know when nothing was retrieved", () => {
    expect(composeExtractiveAnswer("Question: pizza?")).toMatch(/couldn't find/i);
  });

  it("refuses structured generation instead of inventing analysis", async () => {
    const llm = new MockLLMProvider();
    await expect(llm.generateObject({ tier: "fast", task: "classify", messages: [] }, {} as never)).rejects.toThrow(/cannot generate/);
  });

  it("streams the same text it generates", async () => {
    const llm = new MockLLMProvider();
    const req = { tier: "strong" as const, task: "ask", messages: [{ role: "user" as const, content: prompt }] };
    let streamed = "";
    for await (const chunk of llm.stream(req)) streamed += chunk;
    expect(streamed).toBe((await llm.generate(req)).text);
  });
});
