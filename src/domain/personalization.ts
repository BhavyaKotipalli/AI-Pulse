import { INTEREST_LABELS, type Category, type Interest } from "./taxonomy";

/** What each interest matches on: categories plus tag/entity terms. */
export const INTEREST_SIGNALS: Record<Interest, { categories: Category[]; terms: string[] }> = {
  "ai-agents": { categories: ["agents"], terms: ["agents", "ai-agents", "coding agents", "coding-agents", "mcp", "browser agents", "browser-agents", "agent-engineering"] },
  llms: { categories: ["models"], terms: ["reasoning", "open weights", "llama", "gpt", "claude", "gemini", "reasoning-models", "llm-engineering"] },
  "computer-vision": { categories: [], terms: ["vision", "video", "multimodal", "vla"] },
  multimodal: { categories: [], terms: ["multimodal", "video", "long context", "vla-models", "multimodal-skill"] },
  robotics: { categories: ["robotics"], terms: ["robotics", "vla", "humanoids", "pi0"] },
  research: { categories: ["research"], terms: ["benchmark", "reinforcement learning", "scaling laws"] },
  startups: { categories: ["funding"], terms: ["funding", "startup"] },
  career: { categories: ["careers"], terms: ["jobs", "hiring", "junior engineers"] },
  "software-engineering": { categories: ["developer-tools"], terms: ["coding agents", "developer productivity", "ide", "terminal", "coding-agents"] },
  mlops: { categories: ["infrastructure"], terms: ["inference", "serving", "llmops", "mlops", "vllm", "fine-tuning"] },
  "ai-safety": { categories: ["safety", "policy"], terms: ["ai safety", "alignment", "regulation", "security"] },
  cybersecurity: { categories: ["safety"], terms: ["security", "prompt injection", "prompt-injection", "ai-security"] },
};

export interface PersonalizableItem {
  id: string;
  score: number;
  category: Category | null;
  tags: string[];
  entitySlugs: string[];
}

export interface PersonalizedResult {
  id: string;
  personalScore: number;
  reasons: string[];
}

/**
 * Transparent re-ranking: personalScore = score × (1 + 0.12 per matched interest, max 3)
 * × (1 + 0.05 per matched recently-engaged topic, max 3). Returns human-readable reasons.
 */
export function personalize(
  items: PersonalizableItem[],
  interests: Interest[],
  engagedTopics: string[] = [],
): PersonalizedResult[] {
  const engaged = new Set(engagedTopics.map((t) => t.toLowerCase()));
  return items
    .map((item) => {
      const terms = new Set([...item.tags, ...item.entitySlugs].map((t) => t.toLowerCase()));
      const matched = interests.filter((interest) => {
        const sig = INTEREST_SIGNALS[interest];
        return (item.category && sig.categories.includes(item.category)) || sig.terms.some((t) => terms.has(t));
      });
      const engagedHits = [...terms].filter((t) => engaged.has(t));
      const interestBoost = 1 + 0.12 * Math.min(3, matched.length);
      const behaviorBoost = 1 + 0.05 * Math.min(3, engagedHits.length);
      const reasons = matched.map((m) => `You follow ${INTEREST_LABELS[m]}`);
      if (engagedHits.length > 0) reasons.push(`Related to topics you saved (${engagedHits.slice(0, 2).join(", ")})`);
      return { id: item.id, personalScore: Math.round(item.score * interestBoost * behaviorBoost), reasons };
    })
    .sort((a, b) => b.personalScore - a.personalScore);
}
