import type { Claim } from "@/domain/analysis";
import type { Role, TrendStatus } from "@/domain/taxonomy";

export interface SeedTrend {
  slug: string;
  title: string;
  thesis: string;
  summary: string;
  status: TrendStatus;
  momentum: number;
  whyHappening: string;
  implications: Claim[];
  affectedRoles: Role[];
  skills: string[];
  /** Causal chain rendered as the trend's flow graph. */
  chain: string[];
  firstSeenDaysAgo: number;
  /** Item keys used as evidence. */
  items: string[];
  entities: string[];
  /** Shape of the synthetic 90-day mention series. */
  curve: { start: number; end: number; noise: number };
}

export const seedTrends: SeedTrend[] = [
  {
    slug: "agent-managed-software-development",
    title: "Agent-managed software development",
    thesis: "Software engineering is moving from AI-assisted coding toward agent-managed software development.",
    summary:
      "Terminal coding agents from Anthropic, OpenAI and Google, open platforms like OpenHands, and rapidly rising SWE-bench results point to a shift: engineers increasingly delegate whole tasks to agents and act as specifiers and reviewers.",
    status: "accelerating",
    momentum: 0.82,
    whyHappening:
      "Models became reliable enough at multi-step tool use; agent harnesses (sandboxed execution, repository context, tests as feedback) matured; and benchmarks gave labs a clear target.",
    implications: [
      { text: "All three frontier labs ship terminal coding agents.", label: "fact", sourceItemIds: ["terminal-coding-agents", "repo-gemini-cli", "repo-codex"], confidence: "high" },
      { text: "Code review, testing and task specification become the scarce engineering skills.", label: "analysis", sourceItemIds: ["terminal-coding-agents", "jobs-entry-level"], confidence: "medium" },
      { text: "CI pipelines evolve into agent verification systems with stricter test gates.", label: "speculation", sourceItemIds: [], confidence: "low" },
    ],
    affectedRoles: ["software-engineer", "ai-engineer", "devops-engineer", "product-manager"],
    skills: ["Agent Engineering", "AI Evaluation", "Task specification", "Code review at scale"],
    chain: ["AI Agents", "Coding Agents", "Software Engineering", "Developer Productivity", "Changing Engineering Roles"],
    firstSeenDaysAgo: 160,
    items: ["terminal-coding-agents", "tool-claude-code", "repo-gemini-cli", "repo-codex", "repo-openhands", "paper-swe-agent", "paper-swe-bench", "jobs-entry-level", "tool-cursor", "microsoft-agents"],
    entities: ["coding-agents", "claude-code", "codex", "gemini-cli", "cursor", "openhands", "anthropic", "openai", "google-deepmind", "cognition"],
    curve: { start: 14, end: 62, noise: 4 },
  },
  {
    slug: "mcp-becomes-the-standard",
    title: "MCP becomes the standard agent interface",
    thesis: "The Model Context Protocol is becoming the universal connector between AI agents and tools.",
    summary:
      "Adoption of MCP by competing labs, IDEs, Windows and cloud agent platforms is turning tool integration from bespoke adapters into a protocol ecosystem.",
    status: "accelerating",
    momentum: 0.76,
    whyHappening: "Every agent needs tools; N×M custom integrations don't scale; an open spec with reference servers lowered the cost of adoption.",
    implications: [
      { text: "MCP is supported across multiple competing AI platforms.", label: "fact", sourceItemIds: ["mcp-adoption", "microsoft-agents", "openai-agents-sdk"], confidence: "high" },
      { text: "APIs will increasingly ship an MCP surface alongside REST.", label: "speculation", sourceItemIds: ["mcp-adoption"], confidence: "medium" },
    ],
    affectedRoles: ["ai-engineer", "software-engineer", "security-engineer"],
    skills: ["Model Context Protocol", "Agent tool design", "AI Security"],
    chain: ["Agent tool use", "N×M integration problem", "Model Context Protocol", "Tool ecosystem", "New security surface"],
    firstSeenDaysAgo: 300,
    items: ["mcp-adoption", "repo-mcp-servers", "microsoft-agents", "openai-agents-sdk", "tool-claude-code"],
    entities: ["mcp", "anthropic", "openai", "microsoft", "google-deepmind"],
    curve: { start: 10, end: 48, noise: 3 },
  },
  {
    slug: "open-reasoning-models",
    title: "Reasoning goes open and cheap",
    thesis: "RL-trained reasoning is commoditizing through open weights and distillation.",
    summary: "DeepSeek-R1's open recipe, test-time compute research and single-GPU RL tooling make reasoning models broadly accessible.",
    status: "mainstream",
    momentum: 0.45,
    whyHappening: "Verifiable-reward RL proved simple and effective; distillation transfers it to small models; open tooling (Unsloth, TRL) lowered training cost.",
    implications: [
      { text: "DeepSeek-R1 released open weights and distilled reasoning models.", label: "fact", sourceItemIds: ["paper-deepseek-r1"], confidence: "high" },
      { text: "Model routing between reasoning and fast models becomes a standard architecture.", label: "analysis", sourceItemIds: ["open-reasoning", "paper-test-time-compute"], confidence: "medium" },
    ],
    affectedRoles: ["ai-engineer", "ml-engineer", "researcher"],
    skills: ["Inference Optimization", "Reinforcement learning basics", "Model routing"],
    chain: ["Test-time compute", "Reasoning models", "Open weights + distillation", "Cheap reasoning", "New product economics"],
    firstSeenDaysAgo: 250,
    items: ["open-reasoning", "paper-deepseek-r1", "paper-test-time-compute", "repo-unsloth", "nvidia-inference"],
    entities: ["reasoning-models", "deepseek-r1", "deepseek", "test-time-compute"],
    curve: { start: 40, end: 36, noise: 5 },
  },
  {
    slug: "evaluation-as-engineering",
    title: "Evaluation becomes an engineering discipline",
    thesis: "Shipping AI systems now requires eval suites, tracing and regression testing — evaluation is a core engineering skill.",
    summary: "Enterprises cite evaluation as a top blocker; LLM-as-judge methods and agent benchmarks are standard tools; observability platforms are proliferating.",
    status: "emerging",
    momentum: 0.64,
    whyHappening: "Non-deterministic systems can't be validated with unit tests alone; agents multiply failure modes; buyers demand evidence.",
    implications: [
      { text: "Enterprises report evaluation as a major blocker to agent deployment.", label: "fact", sourceItemIds: ["enterprise-agents"], confidence: "medium" },
      { text: "LLM judges carry known biases that eval designs must control.", label: "fact", sourceItemIds: ["paper-llm-judge"], confidence: "high" },
      { text: "'AI evaluation engineer' emerges as a distinct job title.", label: "speculation", sourceItemIds: ["enterprise-agents"], confidence: "low" },
    ],
    affectedRoles: ["ai-engineer", "ml-engineer", "data-scientist", "product-manager"],
    skills: ["AI Evaluation", "LLMOps", "Statistics for evals"],
    chain: ["Agents in production", "Reliability questions", "Eval suites & tracing", "Evaluation engineering", "New roles"],
    firstSeenDaysAgo: 120,
    items: ["enterprise-agents", "paper-llm-judge", "paper-swe-bench", "aws-agentcore"],
    entities: ["ai-evaluation", "ai-evaluation-skill", "llmops"],
    curve: { start: 8, end: 30, noise: 3 },
  },
  {
    slug: "agent-security",
    title: "Agent security becomes its own field",
    thesis: "Tool-using agents create a new attack surface — prompt injection and over-privileged tools — driving a dedicated AI security discipline.",
    summary: "Demonstrated injection attacks on browser and coding agents, MCP's growing tool surface and enterprise governance requirements are converging.",
    status: "emerging",
    momentum: 0.58,
    whyHappening: "Agents read untrusted content and hold real credentials; model-level defenses are incomplete.",
    implications: [
      { text: "Indirect prompt injection against agents has been repeatedly demonstrated.", label: "fact", sourceItemIds: ["prompt-injection"], confidence: "high" },
      { text: "Agent permission systems and confirmation flows become standard product requirements.", label: "analysis", sourceItemIds: ["prompt-injection", "enterprise-agents"], confidence: "medium" },
    ],
    affectedRoles: ["security-engineer", "ai-engineer", "devops-engineer"],
    skills: ["AI Security", "Threat modeling", "Red-teaming"],
    chain: ["Tool-using agents", "Untrusted inputs", "Prompt injection", "Privilege separation", "AI security roles"],
    firstSeenDaysAgo: 140,
    items: ["prompt-injection", "repo-browser-use", "enterprise-agents", "mcp-adoption"],
    entities: ["prompt-injection", "ai-security", "browser-agents"],
    curve: { start: 6, end: 24, noise: 3 },
  },
  {
    slug: "inference-is-the-new-frontier",
    title: "Inference efficiency is the new scaling frontier",
    thesis: "With reasoning models generating far more tokens, serving efficiency now determines AI economics.",
    summary: "Hardware roadmaps, serving engines and small on-device models all target cost per token rather than training scale.",
    status: "accelerating",
    momentum: 0.6,
    whyHappening: "Long chains of thought multiply output tokens; agent loops multiply calls; margins depend on serving cost.",
    implications: [
      { text: "PagedAttention-style memory management substantially raised serving throughput.", label: "fact", sourceItemIds: ["paper-pagedattention"], confidence: "high" },
      { text: "Inference engineers become as strategic as training engineers.", label: "analysis", sourceItemIds: ["nvidia-inference", "repo-vllm"], confidence: "medium" },
    ],
    affectedRoles: ["ml-engineer", "devops-engineer", "ai-engineer"],
    skills: ["Inference Optimization", "AI Infrastructure", "Quantization"],
    chain: ["Reasoning models", "More tokens per query", "Inference cost", "Serving optimization", "Infra roles"],
    firstSeenDaysAgo: 200,
    items: ["nvidia-inference", "repo-vllm", "paper-pagedattention", "small-models", "apple-on-device", "repo-ollama"],
    entities: ["inference-optimization", "nvidia", "vllm", "small-models"],
    curve: { start: 18, end: 40, noise: 4 },
  },
  {
    slug: "robotics-foundation-models",
    title: "Foundation models reach the physical world",
    thesis: "Robotics is adopting the foundation-model playbook with vision-language-action policies.",
    summary: "VLA research like π0 and sustained investment in generalist robot companies suggest robotics is entering its 'GPT-2 moment'.",
    status: "emerging",
    momentum: 0.42,
    whyHappening: "Pretrained VLMs supply world knowledge; cross-embodiment datasets grew; teleoperation data collection scaled.",
    implications: [
      { text: "π0 combines a VLM backbone with a flow-matching action expert for dexterous manipulation.", label: "fact", sourceItemIds: ["paper-pi0"], confidence: "high" },
      { text: "Generalist robot policies will reach narrow commercial deployments before general-purpose household use.", label: "speculation", sourceItemIds: ["robotics-funding"], confidence: "low" },
    ],
    affectedRoles: ["ml-engineer", "researcher"],
    skills: ["Robot learning", "Multimodal AI", "Simulation"],
    chain: ["Vision-language models", "VLA policies", "Generalist robots", "Physical AI products"],
    firstSeenDaysAgo: 180,
    items: ["paper-pi0", "robotics-funding"],
    entities: ["vla-models", "pi0", "physical-intelligence"],
    curve: { start: 6, end: 16, noise: 2 },
  },
];
