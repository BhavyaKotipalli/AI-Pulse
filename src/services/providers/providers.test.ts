import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { forceLayout } from "@/domain/graph-layout";
import { takeSentences, toSpeakable } from "@/lib/voice/provider";
import { extractJson, generateStructured } from "@/services/ai/structured";
import { ProviderError, RateLimitError, type GenerateRequest } from "@/services/ai/types";
import { fitVector, OpenAICompatibleEmbedder, OpenAICompatibleLLM } from "./openai-compatible";

const req: GenerateRequest = { tier: "fast", task: "test", messages: [{ role: "user", content: "hi" }] };
const llm = () => new OpenAICompatibleLLM({ id: "test", baseUrl: "https://example.test/v1/", apiKey: "sk-secret", models: { fast: "small", strong: "big" } });

function mockFetch(handler: (url: string, init: RequestInit) => Response) {
  const spy = vi.fn(async (url: string | URL | Request, init?: RequestInit) => handler(String(url), init ?? {}));
  vi.stubGlobal("fetch", spy);
  return spy;
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI-compatible chat adapter", () => {
  it("sends the tier's model, system prompt and bearer key, and reads usage", async () => {
    const spy = mockFetch(() => json({ model: "small-001", choices: [{ message: { content: "hello" }, finish_reason: "stop" }], usage: { prompt_tokens: 7, completion_tokens: 2 } }));
    const out = await llm().generate({ ...req, system: "be brief", json: true });
    expect(out).toEqual({ text: "hello", model: "small-001", inputTokens: 7, outputTokens: 2 });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("https://example.test/v1/chat/completions");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer sk-secret");
    const body = JSON.parse(String(init!.body));
    expect(body.model).toBe("small");
    expect(body.messages[0]).toEqual({ role: "system", content: "be brief" });
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("maps 429 to RateLimitError with retry-after and never leaks the key", async () => {
    mockFetch(() => json({ error: "slow down" }, 429, { "retry-after": "12" }));
    const err = await llm().generate(req).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSec).toBe(12);
    expect(String(err.message)).not.toContain("sk-secret");
  });

  it("maps auth failures and empty answers to ProviderError", async () => {
    mockFetch(() => json({ error: "bad key" }, 401));
    await expect(llm().generate(req)).rejects.toBeInstanceOf(ProviderError);
    mockFetch(() => json({ choices: [{ message: { content: "" }, finish_reason: "length" }] }));
    await expect(llm().generate(req)).rejects.toThrow(/empty response/);
  });

  it("streams SSE deltas and ignores keep-alives", async () => {
    const sse = [
      ": keep-alive",
      'data: {"choices":[{"delta":{"content":"Hel"}}]}',
      'data: {"choices":[{"delta":{"content":"lo"}}]}',
      "data: not-json",
      'data: {"choices":[{"delta":{}}]}',
      "data: [DONE]",
      "",
    ].join("\n");
    mockFetch(() => new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } }));
    let text = "";
    for await (const chunk of llm().stream(req)) text += chunk;
    expect(text).toBe("Hello");
  });
});

describe("embeddings adapter", () => {
  it("truncates to 768 dimensions and re-normalizes", () => {
    const v = fitVector(Array.from({ length: 3072 }, (_, i) => (i < 768 ? 1 : 5)));
    expect(v).toHaveLength(768);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
    expect(() => fitVector([1, 2, 3])).toThrow(/at least 768/);
  });

  it("batches requests and preserves order by index", async () => {
    const spy = mockFetch((_url, init) => {
      const body = JSON.parse(String(init.body)) as { input: string[] };
      // Return rows reversed to prove ordering uses `index`.
      const data = body.input.map((text, index) => ({ index, embedding: Array.from({ length: 768 }, () => text.length) })).reverse();
      return json({ data });
    });
    const embedder = new OpenAICompatibleEmbedder({ id: "test", baseUrl: "https://example.test/v1", apiKey: "k", model: "emb", relevanceFloor: 0.5, batchSize: 2 });
    const out = await embedder.embed(["a", "bbbb", "cc"]);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(out).toHaveLength(3);
    expect(out.every((v) => v.length === 768)).toBe(true);
    expect(embedder.id).toBe("test:emb:768");
  });
});

describe("structured generation", () => {
  const schema = z.object({ status: z.string(), n: z.number() });

  it("extracts JSON from fenced or chatty output", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":[1,2]} hope that helps')).toEqual({ a: [1, 2] });
    expect(() => extractJson("no json here")).toThrow();
  });

  it("repairs one invalid response by showing the validation error", async () => {
    const outputs = ['{"status":"ok","n":"three"}', '{"status":"ok","n":3}'];
    const calls: GenerateRequest[] = [];
    const generate = async (r: GenerateRequest) => {
      calls.push(r);
      return { text: outputs[calls.length - 1]!, model: "m", inputTokens: 1, outputTokens: 1 };
    };
    await expect(generateStructured(generate, req, schema)).resolves.toEqual({ status: "ok", n: 3 });
    expect(calls).toHaveLength(2);
    expect(calls[1]!.messages.at(-1)!.content).toMatch(/invalid/i);
    expect(calls[0]!.system).toContain('"type":"object"');
  });

  it("fails closed after the repair attempt", async () => {
    const generate = async () => ({ text: "still not json", model: "m", inputTokens: 1, outputTokens: 1 });
    await expect(generateStructured(generate, req, schema)).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("voice text helpers", () => {
  it("removes citations and markdown before speaking", () => {
    expect(toSpeakable("**MCP** is spreading [1][2].\n- `stdio` transport _works_ well")).toBe("MCP is spreading . stdio transport works well");
  });

  it("releases complete sentences and keeps the unfinished tail", () => {
    const { sentences, rest } = takeSentences("First point. Second one! And a third that is not fin");
    expect(sentences).toEqual(["First point.", "Second one!"]);
    expect(rest).toBe("And a third that is not fin");
    expect(takeSentences("version 3.5 is out").sentences).toEqual([]);
  });
});

describe("graph layout", () => {
  const nodes = Array.from({ length: 30 }, (_, i) => ({ id: `n${i}` }));
  const edges = nodes.slice(1).map((n, i) => ({ source: `n${Math.floor(i / 3)}`, target: n.id }));

  it("is deterministic and stays inside the canvas", () => {
    const a = forceLayout(nodes, edges, { width: 800, height: 500 });
    const b = forceLayout(nodes, edges, { width: 800, height: 500 });
    expect([...a.values()]).toEqual([...b.values()]);
    for (const p of a.values()) {
      expect(p.x).toBeGreaterThanOrEqual(24);
      expect(p.x).toBeLessThanOrEqual(776);
      expect(p.y).toBeGreaterThanOrEqual(24);
      expect(p.y).toBeLessThanOrEqual(476);
    }
  });

  it("separates nodes and handles empty input", () => {
    const pos = [...forceLayout(nodes, edges, { width: 800, height: 500 }).values()];
    const minDist = Math.min(...pos.flatMap((p, i) => pos.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
    expect(minDist).toBeGreaterThan(8);
    expect(forceLayout([], [], { width: 100, height: 100 }).size).toBe(0);
  });
});
