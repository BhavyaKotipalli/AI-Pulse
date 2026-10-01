import type { Confidence, Role } from "@/domain/taxonomy";

export interface SeedCareerImpact {
  role: Role;
  trend?: string;
  headline: string;
  exposure: number;
  automated: string[];
  augmented: string[];
  newSkills: string[];
  decliningSkills: string[];
  newRoles: string[];
  tools: string[];
  studentAdvice: string;
  confidence: Confidence;
  sourceItems: string[];
}

export const seedCareerImpacts: SeedCareerImpact[] = [
  {
    role: "software-engineer",
    trend: "agent-managed-software-development",
    headline: "From writing code to specifying, supervising and verifying agent work",
    exposure: 82,
    automated: ["Boilerplate and CRUD implementation", "Mechanical refactors and migrations", "First-draft unit tests"],
    augmented: ["Debugging", "Code review", "System design", "Documentation"],
    newSkills: ["Task decomposition for agents", "Eval-driven development", "Agent tooling (MCP, hooks)"],
    decliningSkills: ["Memorizing framework APIs", "Hand-writing boilerplate"],
    newRoles: ["Agent platform engineer", "AI developer-experience engineer"],
    tools: ["Claude Code", "Codex CLI", "Gemini CLI", "Cursor"],
    studentAdvice: "Get very good at reading unfamiliar code, writing tests and explaining design trade-offs — then learn to delegate implementation to agents.",
    confidence: "medium",
    sourceItems: ["terminal-coding-agents", "jobs-entry-level", "paper-swe-agent"],
  },
  {
    role: "ai-engineer",
    trend: "evaluation-as-engineering",
    headline: "Evals, tool design and agent reliability are the core of the job",
    exposure: 70,
    automated: ["Prompt variant generation", "Synthetic test-case creation"],
    augmented: ["Evaluation design", "Retrieval tuning", "Agent orchestration"],
    newSkills: ["AI Evaluation", "MCP server development", "Agent security", "Cost/latency optimization"],
    decliningSkills: ["Manual prompt tweaking without evals", "Framework-specific glue code"],
    newRoles: ["AI evaluation engineer", "Agent reliability engineer"],
    tools: ["LangGraph", "MCP SDKs", "Tracing/eval platforms", "vLLM"],
    studentAdvice: "Ship one end-to-end agent with an eval suite and tracing — that portfolio piece beats ten demos.",
    confidence: "medium",
    sourceItems: ["enterprise-agents", "paper-llm-judge", "mcp-adoption"],
  },
  {
    role: "ml-engineer",
    trend: "inference-is-the-new-frontier",
    headline: "Value shifts toward post-training, inference efficiency and serving",
    exposure: 58,
    automated: ["Hyperparameter sweeps", "Baseline training scripts"],
    augmented: ["Fine-tuning", "RL post-training", "Model compression"],
    newSkills: ["GRPO/RL fine-tuning", "Quantization", "Inference serving (vLLM)", "Distillation"],
    decliningSkills: ["Training small task-specific models from scratch"],
    newRoles: ["Inference engineer", "Post-training engineer"],
    tools: ["vLLM", "Unsloth", "TRL", "Ollama"],
    studentAdvice: "Reproduce one post-training paper at small scale and one serving benchmark — both are interview gold.",
    confidence: "medium",
    sourceItems: ["paper-deepseek-r1", "repo-vllm", "nvidia-inference"],
  },
  {
    role: "data-scientist",
    headline: "Analysis gets faster; framing questions and validating results matter more",
    exposure: 62,
    automated: ["Exploratory analysis code", "Chart generation", "Routine SQL"],
    augmented: ["Experiment design", "Causal analysis", "Stakeholder communication"],
    newSkills: ["Evaluating LLM outputs statistically", "Synthetic data validation"],
    decliningSkills: ["Hand-coding standard analyses"],
    newRoles: ["AI evaluation scientist"],
    tools: ["Notebook agents", "LLM-assisted SQL"],
    studentAdvice: "Statistics and experiment design are durable; pair them with LLM evaluation methods.",
    confidence: "low",
    sourceItems: ["paper-llm-judge", "enterprise-agents"],
  },
  {
    role: "product-manager",
    headline: "PMs prototype directly and must design for probabilistic behaviour",
    exposure: 55,
    automated: ["Spec drafting", "Competitive summaries"],
    augmented: ["Prototyping", "User research synthesis"],
    newSkills: ["AI product sense (uncertainty UX)", "Defining evals as acceptance criteria"],
    decliningSkills: ["Long static PRDs without prototypes"],
    newRoles: ["AI product engineer"],
    tools: ["Coding agents for prototypes", "Eval dashboards"],
    studentAdvice: "Learn to build working prototypes with AI tools and to define success with eval sets.",
    confidence: "low",
    sourceItems: ["terminal-coding-agents", "enterprise-agents"],
  },
  {
    role: "security-engineer",
    trend: "agent-security",
    headline: "Agents create a new attack surface that needs dedicated expertise",
    exposure: 66,
    automated: ["Log triage", "Known-vulnerability scanning"],
    augmented: ["Threat modeling", "Red-teaming", "Incident response"],
    newSkills: ["Prompt-injection defense", "Agent permission design", "LLM red-teaming"],
    decliningSkills: [],
    newRoles: ["AI security engineer", "AI red-teamer"],
    tools: ["OWASP LLM Top 10", "Red-teaming frameworks"],
    studentAdvice: "Combine classic appsec with hands-on agent red-teaming — the talent pool is tiny.",
    confidence: "medium",
    sourceItems: ["prompt-injection", "mcp-adoption"],
  },
  {
    role: "devops-engineer",
    headline: "Operating agents and inference adds new platform responsibilities",
    exposure: 50,
    automated: ["Config generation", "Routine runbooks"],
    augmented: ["Incident response", "Capacity planning"],
    newSkills: ["GPU/inference operations", "LLMOps observability", "Sandboxing agent execution"],
    decliningSkills: ["Manual infrastructure scripting"],
    newRoles: ["LLMOps engineer"],
    tools: ["vLLM", "Kubernetes GPU operators", "Agent runtimes"],
    studentAdvice: "Learn to serve and observe models — GPU-aware infrastructure is scarce expertise.",
    confidence: "low",
    sourceItems: ["aws-agentcore", "repo-vllm"],
  },
  {
    role: "researcher",
    headline: "Open weights and cheap RL broaden who can do frontier-relevant research",
    exposure: 45,
    automated: ["Literature triage", "Experiment boilerplate"],
    augmented: ["Hypothesis generation", "Analysis"],
    newSkills: ["RL post-training", "Agent benchmarks", "Interpretability tooling"],
    decliningSkills: [],
    newRoles: [],
    tools: ["Hugging Face", "Unsloth", "arXiv agents"],
    studentAdvice: "Pick a niche where open models let you run real experiments: reasoning RL, evals, or interpretability.",
    confidence: "low",
    sourceItems: ["paper-deepseek-r1", "paper-alignment-faking"],
  },
];

/** Synthetic 60-day evidence profiles per skill entity (DEMO). last30 vs prev30 drives status. */
export const seedSkillProfiles: Record<string, { prev30: number; last30: number }> = {
  "agent-engineering": { prev30: 120, last30: 230 },
  "mcp-skill": { prev30: 60, last30: 150 },
  "ai-evaluation-skill": { prev30: 70, last30: 128 },
  "ai-security": { prev30: 40, last30: 70 },
  "llm-engineering": { prev30: 180, last30: 215 },
  "rag-skill": { prev30: 150, last30: 160 },
  "inference-skill": { prev30: 70, last30: 92 },
  "llmops": { prev30: 60, last30: 74 },
  "ai-infrastructure": { prev30: 90, last30: 104 },
  "multimodal-skill": { prev30: 55, last30: 66 },
  "synthetic-data": { prev30: 40, last30: 43 },
  "ai-product-engineering": { prev30: 50, last30: 68 },
  "mlops": { prev30: 85, last30: 78 },
  "manual-prompt-tuning": { prev30: 60, last30: 34 },
};
