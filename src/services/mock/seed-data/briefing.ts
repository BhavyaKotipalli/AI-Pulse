import type { Briefing } from "@/domain/analysis";

/** Daily briefing expressed with item keys; the seed script resolves keys → ids. */
export const seedBriefing: Briefing = {
  greeting: "Good morning",
  headline: {
    itemId: "terminal-coding-agents",
    summary:
      "Terminal-native coding agents from Anthropic, OpenAI and Google are becoming the default workflow for early-adopter teams — engineers delegate whole tasks and review the results.",
    whyItMatters:
      "This is the clearest signal yet of the shift from AI-assisted coding to agent-managed development. The scarce skills move to task specification, verification and review.",
  },
  topStoryIds: ["mcp-adoption", "open-reasoning", "enterprise-agents", "prompt-injection", "nvidia-inference"],
  researchItemId: "paper-deepseek-r1",
  toolItemId: "tool-claude-code",
  repoItemId: "repo-mcp-servers",
  jobs: [
    {
      text: "Expectations for junior engineers are shifting toward reviewing AI-generated code, testing and system understanding; evidence on net hiring effects is still mixed.",
      label: "fact",
      sourceItemIds: ["jobs-entry-level"],
    },
    {
      text: "Evaluation and agent-security skills are where demand is outpacing supply.",
      label: "analysis",
      sourceItemIds: ["enterprise-agents", "prompt-injection"],
    },
  ],
  startupSlug: "cognition",
  experimentSlug: "mcp-server-for-your-api",
  skill: {
    name: "Model Context Protocol",
    reason: "Adoption across competing labs, IDEs and clouds makes MCP the most portable agent skill you can learn this week.",
  },
  emergingTrendSlug: "evaluation-as-engineering",
  payAttention: [
    {
      text: "MCP security: as tool ecosystems grow, scoping credentials and treating tool output as untrusted data becomes essential.",
      label: "analysis",
      sourceItemIds: ["mcp-adoption", "prompt-injection"],
    },
    {
      text: "Inference cost, not training cost, is now the dominant variable in AI product economics.",
      label: "analysis",
      sourceItemIds: ["nvidia-inference", "paper-pagedattention"],
    },
    {
      text: "Ignore the viral 'all programmers replaced next year' claim — it cites no evidence.",
      label: "analysis",
      sourceItemIds: ["clickbait-replace-programmers"],
    },
  ],
  readingMinutes: 5,
};
