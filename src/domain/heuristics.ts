import type { SubScores } from "./scoring";
import type { Category, ItemKind } from "./taxonomy";

/**
 * Rule-based enrichment used when no LLM is configured (or before the LLM stage runs).
 * Deliberately conservative: sub-scores cluster around the middle unless there is
 * concrete evidence, and every score produced here is labeled "heuristic" in the UI.
 */

const CATEGORY_RULES: Array<[Category, RegExp]> = [
  ["policy", /\b(regulat\w*|law|act|policy|senate|congress|eu|ftc|lawsuit|court|copyright|govern\w*)\b/i],
  ["safety", /\b(safety|alignment|jailbreak|prompt injection|red[- ]team\w*|interpretab\w*|misuse|security|vulnerab\w*)\b/i],
  ["funding", /\b(rais(es|ed)|funding|series [a-f]|seed round|valuation|acquir\w*|acquisition|ipo|invest\w*)\b/i],
  ["robotics", /\b(robot\w*|humanoid|embodied|manipulation|vla)\b/i],
  ["hardware", /\b(gpus?|chips?|tpu|semiconductor|blackwell|h100|h200|b200|data ?cent(er|re)s?|accelerator)\b/i],
  ["agents", /\b(agents?|agentic|mcp|model context protocol|tool use|browser use|computer use|autonomous)\b/i],
  ["developer-tools", /\b(sdk|api|cli|ide|copilot|coding|developer|code review|github|framework|library)\b/i],
  ["infrastructure", /\b(inference|serving|latency|throughput|quantiz\w*|kubernetes|cloud|deploy\w*|vllm|kv cache)\b/i],
  ["careers", /\b(jobs?|hiring|layoffs?|workforce|careers?|skills?|employ\w*|engineers? (are|will))\b/i],
  ["enterprise", /\b(enterprise|customers?|business(es)?|adoption|productivity|workplace)\b/i],
  ["models", /\b(model|llm|gpt[-\w.]*|claude|gemini|llama|mistral|qwen|deepseek|release[sd]?|launch\w*|weights|multimodal|reasoning)\b/i],
];

const LAUNCH_TITLE = /^(introducing|announcing|meet|launching|unveiling)\b|\b(now available|generally available|is live|launches|rolls out)\b/i;

/** Feed items announcing a product/model/API become "launch" items (shown on the Tools page). */
export function inferKind(title: string, fallback: ItemKind): ItemKind {
  return fallback === "article" && LAUNCH_TITLE.test(title) ? "launch" : fallback;
}

export function categorize(text: string, kind: ItemKind): Category {
  if (kind === "paper") return "research";
  if (kind === "repo") return "open-source";
  for (const [cat, re] of CATEGORY_RULES) if (re.test(text)) return cat;
  return "models";
}

const CLICKBAIT_PATTERNS: RegExp[] = [
  /\b(you won'?t believe|shocking|mind[- ]blowing|insane|game[- ]?changer|destroy(s|ed)?|killer|secret|everyone is)\b/i,
  /\b(will replace|replaces?) (all|every)\b/i,
  /!{1,}/,
  /\b[A-Z]{4,}\b.*\b[A-Z]{4,}\b/, // multiple shouted words
  /^\d+\s+(ways|reasons|things|tools)\b/i,
  /\?$/,
];

/** 0 = sober headline, 1 = clickbait. */
export function clickbaitScore(title: string): number {
  const acronyms = /\b(AI|LLM|GPU|API|SDK|CLI|MCP|RAG|GPT|AWS|IDE|EU|US|UK|CEO|NVIDIA|OPENAI|ARXIV)\b/g;
  const normalized = title.replace(acronyms, "x");
  const hits = CLICKBAIT_PATTERNS.filter((p) => p.test(normalized)).length;
  return Math.min(1, hits * 0.3);
}

const IMPACT_TERMS = /\b(launch\w*|releas\w*|introduc\w*|announc\w*|open[- ]sourc\w*|acquir\w*|raises|billion|breakthrough|state[- ]of[- ]the[- ]art|sota|record|first)\b/i;
const NOVELTY_TERMS = /\b(new|novel|first|introduc\w*|unveil\w*|preview|beta|debut\w*)\b/i;
const TECHNICAL_TERMS =
  /\b(benchmark\w*|architecture|transformer|training|fine-?tun\w*|reinforcement|inference|quantiz\w*|attention|embedding\w*|retrieval|parameters?|tokens?|latency|evaluation|dataset|diffusion|mixture[- ]of[- ]experts|moe)\b/gi;
const CAREER_TERMS = /\b(developers?|engineers?|jobs?|skills?|hiring|coding|workforce|students?|learn\w*|career\w*|productivity)\b/gi;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const count = (re: RegExp, text: string) => (text.match(re) ?? []).length;

export interface HeuristicInput {
  kind: ItemKind;
  title: string;
  snippet: string | null;
  /** Number of known entities (companies, models, technologies) mentioned. */
  entityCount: number;
  /** Number of skill entities mentioned. */
  skillCount: number;
  /** Source credibility prior 0–1; first-party announcements from major labs carry more impact. */
  sourceCredibility?: number;
}

export function heuristicSubScores(input: HeuristicInput): SubScores {
  const text = `${input.title} ${input.snippet ?? ""}`;
  const kindBase: Record<ItemKind, number> = { article: 45, launch: 55, tool: 50, paper: 48, repo: 40 };
  const authority = Math.max(0, ((input.sourceCredibility ?? 0.7) - 0.7) * 50);
  const base = kindBase[input.kind];
  const technical = count(TECHNICAL_TERMS, text);
  const career = count(CAREER_TERMS, text);
  return {
    impact: clamp(base + authority + (IMPACT_TERMS.test(text) ? 15 : 0) + Math.min(15, input.entityCount * 4)),
    novelty: clamp(45 + (NOVELTY_TERMS.test(input.title) ? 18 : 0) + (input.kind === "paper" ? 10 : 0)),
    technical: clamp((input.kind === "paper" ? 62 : input.kind === "repo" ? 50 : 35) + Math.min(25, technical * 6)),
    industry: clamp(35 + Math.min(40, input.entityCount * 8)),
    career: clamp(35 + Math.min(30, career * 6) + Math.min(20, input.skillCount * 7)),
    clickbait: clickbaitScore(input.title),
  };
}
