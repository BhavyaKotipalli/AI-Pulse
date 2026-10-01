import { describe, expect, it } from "vitest";
import { validateCitationMarkers, validateClaims } from "./citations";
import { personalize } from "./personalization";
import { temporalWindowHours } from "./query-intent";
import { computeScore, corroborationBonus, recencyScore, SCORE_DIMENSIONS, SCORE_WEIGHTS, scoreBand } from "./scoring";
import { escapeLike, reciprocalRankFusion } from "./search";
import { classifySkillMomentum } from "./skills";

const now = new Date("2026-10-01T12:00:00Z");
const strongSub = { impact: 90, novelty: 80, technical: 85, industry: 90, career: 90, clickbait: 0 };

describe("intelligence score", () => {
  it("uses weights that sum to 1", () => {
    const total = SCORE_DIMENSIONS.reduce((s, d) => s + SCORE_WEIGHTS[d], 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("ranks a substantive story above a viral clickbait story", () => {
    const substantive = computeScore({ sub: strongSub, sourceCredibility: 0.9, corroboratingSources: 3, momentum: 60, publishedAt: now, now });
    const clickbait = computeScore({
      sub: { impact: 20, novelty: 10, technical: 5, industry: 15, career: 30, clickbait: 0.95 },
      sourceCredibility: 0.25,
      corroboratingSources: 1,
      momentum: 100, // extremely popular
      publishedAt: now,
      now,
    });
    expect(substantive.score).toBeGreaterThan(80);
    expect(clickbait.score).toBeLessThan(30);
  });

  it("penalizes clickbait multiplicatively", () => {
    const base = { sourceCredibility: 0.8, corroboratingSources: 1, momentum: 50, publishedAt: now, now };
    const clean = computeScore({ ...base, sub: { ...strongSub, clickbait: 0 } });
    const bait = computeScore({ ...base, sub: { ...strongSub, clickbait: 1 } });
    expect(bait.clickbaitPenalty).toBe(0.65);
    expect(bait.score).toBeLessThan(clean.score * 0.7);
  });

  it("halves recency every 36 hours", () => {
    expect(recencyScore(now, now)).toBe(100);
    expect(recencyScore(new Date(now.getTime() - 36 * 3_600_000), now)).toBeCloseTo(50, 5);
    expect(recencyScore(new Date(now.getTime() + 3_600_000), now)).toBe(100); // future dates clamp
  });

  it("caps the corroboration bonus at +6%", () => {
    expect(corroborationBonus(1)).toBe(1);
    expect(corroborationBonus(2)).toBeCloseTo(1.02);
    expect(corroborationBonus(10)).toBeCloseTo(1.06);
  });

  it("is bounded to 0–100 and explainable", () => {
    const b = computeScore({ sub: { ...strongSub, impact: 100, novelty: 100, technical: 100, industry: 100, career: 100 }, sourceCredibility: 1, corroboratingSources: 9, momentum: 100, publishedAt: now, now });
    expect(b.score).toBeLessThanOrEqual(100);
    expect(Object.keys(b.dimensions)).toEqual([...SCORE_DIMENSIONS]);
    expect(scoreBand(b.score)).toBe("critical");
  });
});

describe("skill momentum", () => {
  it("classifies growth bands from evidence counts", () => {
    expect(classifySkillMomentum(230, 120).status).toBe("exploding");
    expect(classifySkillMomentum(128, 100).status).toBe("growing");
    expect(classifySkillMomentum(100, 100).status).toBe("stable");
    expect(classifySkillMomentum(34, 60).status).toBe("declining");
  });

  it("refuses to assert a trend without enough evidence", () => {
    expect(classifySkillMomentum(3, 0)).toEqual({ status: "insufficient", growth: null });
  });
});

describe("citation validation", () => {
  it("drops markers that point outside the retrieved sources", () => {
    const r = validateCitationMarkers("A [1]. B [7]. C [2][3].", 2);
    expect(r.cited).toEqual([1, 2]);
    expect(r.removed).toBe(2);
    expect(r.text).toBe("A [1]. B . C [2].");
  });

  it("downgrades unsupported facts to low-confidence analysis", () => {
    const [claim] = validateClaims([{ text: "x", label: "fact", sourceItemIds: ["ghost"], confidence: "high" }], new Set(["real"]));
    expect(claim).toMatchObject({ label: "analysis", confidence: "low", sourceItemIds: [] });
  });

  it("keeps supported facts intact", () => {
    const [claim] = validateClaims([{ text: "x", label: "fact", sourceItemIds: ["real", "ghost"], confidence: "high" }], new Set(["real"]));
    expect(claim).toMatchObject({ label: "fact", confidence: "high", sourceItemIds: ["real"] });
  });
});

describe("hybrid search fusion", () => {
  it("rewards documents found by both retrievers", () => {
    const fused = reciprocalRankFusion([
      ["a", "b", "c"],
      ["c", "d"],
    ]);
    expect(fused[0]!.id).toBe("c");
    expect(fused.map((f) => f.id)).toContain("d");
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("personalization", () => {
  const items = [
    { id: "agents", score: 70, category: "agents" as const, tags: ["mcp"], entitySlugs: ["ai-agents"] },
    { id: "robots", score: 75, category: "robotics" as const, tags: ["robotics"], entitySlugs: [] },
  ];

  it("boosts followed interests and explains why", () => {
    const [first] = personalize(items, ["ai-agents"]);
    expect(first!.id).toBe("agents");
    expect(first!.reasons).toContain("You follow AI Agents");
  });

  it("falls back to pure score ordering without interests", () => {
    expect(personalize(items, [])[0]!.id).toBe("robots");
  });
});

describe("query intent", () => {
  it("detects temporal questions", () => {
    expect(temporalWindowHours("What happened in AI today?")).toBe(24);
    expect(temporalWindowHours("What are the biggest trends this week?")).toBe(168);
    expect(temporalWindowHours("Explain the SWE-agent paper")).toBeNull();
  });
});
