export interface SeedStartup {
  entity: string;
  tagline: string;
  problem: string;
  product: string;
  aiTech: string;
  fundingStage: string | null;
  investors: string[];
  founders: string[];
  market: string;
  competitors: string[];
  interesting: string;
  weaknesses: string;
  ideas: string[];
  /** Fields considered verified against cited sources. Others render as "Not verified". */
  verifiedFields: string[];
  sourceItems: string[];
  momentum: number;
}

/**
 * Funding amounts are intentionally omitted: they change frequently and must come
 * from cited, dated sources once ingestion is live. Stages are described qualitatively.
 */
export const seedStartups: SeedStartup[] = [
  {
    entity: "anysphere",
    tagline: "The AI-native code editor",
    problem: "Developers lose time on boilerplate, navigation and multi-file edits in traditional IDEs.",
    product: "Cursor — a VS Code-based editor with codebase-aware chat, multi-file edits and background agents.",
    aiTech: "Frontier LLMs plus custom models for code completion and retrieval over the codebase.",
    fundingStage: "Late-stage (multiple large rounds reported)",
    investors: ["Thrive Capital", "Andreessen Horowitz"],
    founders: ["Michael Truell", "Sualeh Asif", "Arvid Lunnemark", "Aman Sanger"],
    market: "Developer tools — tens of millions of professional developers.",
    competitors: ["GitHub Copilot", "Windsurf", "Claude Code", "Zed"],
    interesting: "Showed that rebuilding the editor around AI can beat plugins bolted onto existing IDEs.",
    weaknesses: "Depends on third-party frontier models; competing with model labs' own coding agents.",
    ideas: ["Agent-native code review tool", "Codebase onboarding assistant for new hires"],
    verifiedFields: ["product", "founders"],
    sourceItems: ["tool-cursor"],
    momentum: 92,
  },
  {
    entity: "cognition",
    tagline: "Autonomous software engineer",
    problem: "Engineering backlogs grow faster than teams can ship.",
    product: "Devin — an autonomous agent that plans and executes software tasks in its own sandboxed environment.",
    aiTech: "Agent harness over frontier LLMs with long-horizon planning, browser, shell and editor tools.",
    fundingStage: "Growth stage",
    investors: ["Founders Fund"],
    founders: ["Scott Wu", "Steven Hao", "Walden Yan"],
    market: "Enterprise software engineering capacity.",
    competitors: ["OpenHands", "GitHub Copilot coding agent", "OpenAI Codex", "Claude Code"],
    interesting: "Bet early on fully delegated, asynchronous agent work rather than in-editor assistance.",
    weaknesses: "Reliability on large, unfamiliar codebases; pricing pressure from model providers' agents.",
    ideas: ["Migration-specialist agent (framework upgrades)", "Agent that fixes flaky tests"],
    verifiedFields: ["product"],
    sourceItems: ["terminal-coding-agents"],
    momentum: 78,
  },
  {
    entity: "perplexity",
    tagline: "Answer engine with citations",
    problem: "Search returns links, not answers; chatbots answer without sources.",
    product: "Search-grounded AI answers with inline citations, plus a browser and enterprise offering.",
    aiTech: "Retrieval over a live web index combined with multiple LLMs; heavy use of RAG and reranking.",
    fundingStage: "Late-stage",
    investors: ["IVP", "NVIDIA", "Jeff Bezos"],
    founders: ["Aravind Srinivas", "Denis Yarats", "Johnny Ho", "Andy Konwinski"],
    market: "Consumer and enterprise search.",
    competitors: ["Google AI Overviews", "ChatGPT search", "You.com"],
    interesting: "Proved users value cited answers; a reference product for RAG UX.",
    weaknesses: "Publisher relationships and content licensing; competition from search incumbents.",
    ideas: ["Vertical cited-answer engine for a regulated domain", "Citation-quality evaluation service"],
    verifiedFields: ["product", "founders"],
    sourceItems: [],
    momentum: 74,
  },
  {
    entity: "elevenlabs",
    tagline: "Voice AI platform",
    problem: "Producing natural, multilingual speech and voice agents is expensive and slow.",
    product: "Text-to-speech, voice cloning, dubbing and a conversational voice-agent platform.",
    aiTech: "Proprietary speech synthesis and speech-to-text models with low-latency streaming.",
    fundingStage: "Late-stage",
    investors: ["Andreessen Horowitz", "Sequoia Capital"],
    founders: ["Mati Staniszewski", "Piotr Dąbkowski"],
    market: "Media, gaming, customer support, accessibility.",
    competitors: ["OpenAI voice", "Google", "Cartesia", "Deepgram"],
    interesting: "One of the few model companies winning a modality against frontier labs on quality.",
    weaknesses: "Voice cloning misuse risk; frontier labs bundling voice into general models.",
    ideas: ["Voice-first daily briefing for professionals", "Voice agent QA and testing tool"],
    verifiedFields: ["product", "founders"],
    sourceItems: [],
    momentum: 70,
  },
  {
    entity: "harvey",
    tagline: "Generative AI for legal work",
    problem: "Legal research, drafting and review are high-cost, text-heavy work.",
    product: "AI platform for law firms and legal teams: research, drafting, document review and workflows.",
    aiTech: "Frontier LLMs customized with legal data, retrieval and workflow agents.",
    fundingStage: "Growth stage",
    investors: ["Sequoia Capital", "OpenAI Startup Fund"],
    founders: ["Winston Weinberg", "Gabriel Pereyra"],
    market: "Legal and professional services.",
    competitors: ["Thomson Reuters CoCounsel", "Legora", "LexisNexis"],
    interesting: "Template for vertical AI: domain workflows + trust features on top of general models.",
    weaknesses: "Hallucination tolerance in legal contexts is near zero; incumbents own proprietary data.",
    ideas: ["Vertical AI for compliance documentation", "Citation-verified contract analysis"],
    verifiedFields: ["product"],
    sourceItems: [],
    momentum: 66,
  },
  {
    entity: "physical-intelligence",
    tagline: "General-purpose robot foundation models",
    problem: "Robots need task-specific programming; general manipulation remains unsolved.",
    product: "π0 family of vision-language-action policies for multiple robot embodiments.",
    aiTech: "VLM backbone with flow-matching action expert trained on cross-embodiment robot data.",
    fundingStage: "Early growth",
    investors: ["Thrive Capital", "Lux Capital"],
    founders: ["Karol Hausman", "Sergey Levine", "Chelsea Finn", "Brian Ichter", "Lachy Groom"],
    market: "Robotics across manufacturing, logistics and home.",
    competitors: ["Google DeepMind robotics", "Figure", "Skild AI", "NVIDIA GR00T"],
    interesting: "Research-first team publishing open models that define the VLA approach.",
    weaknesses: "Data collection cost; long path to revenue.",
    ideas: ["Teleoperation data-collection tooling", "Simulation-to-real evaluation service"],
    verifiedFields: ["product", "aiTech"],
    sourceItems: ["paper-pi0", "robotics-funding"],
    momentum: 64,
  },
  {
    entity: "glean",
    tagline: "Work AI over your company's knowledge",
    problem: "Knowledge is fragmented across dozens of SaaS tools.",
    product: "Enterprise search and AI assistant with permission-aware retrieval and agents.",
    aiTech: "Connectors + permission-aware hybrid search + LLM generation and agents.",
    fundingStage: "Late-stage",
    investors: ["Kleiner Perkins", "Sequoia Capital"],
    founders: ["Arvind Jain"],
    market: "Enterprise knowledge management.",
    competitors: ["Microsoft Copilot", "Google Agentspace", "Notion AI"],
    interesting: "Shows that enterprise RAG's moat is connectors and permissions, not the model.",
    weaknesses: "Platform vendors bundling similar features.",
    ideas: ["Permission-aware RAG starter kit", "Knowledge freshness monitor"],
    verifiedFields: ["product"],
    sourceItems: [],
    momentum: 58,
  },
  {
    entity: "browser-use-co",
    tagline: "Make websites accessible to AI agents",
    problem: "Most of the web has no API for agents.",
    product: "Open-source browser-agent library plus hosted cloud browsers.",
    aiTech: "DOM extraction + vision + LLM planning over Playwright.",
    fundingStage: "Seed",
    investors: [],
    founders: [],
    market: "Automation, RPA replacement, agent infrastructure.",
    competitors: ["OpenAI Operator", "Anthropic computer use", "Browserbase"],
    interesting: "Open-source distribution made it a default building block for browser agents.",
    weaknesses: "Prompt injection exposure; frontier labs shipping native browser agents.",
    ideas: ["Prompt-injection firewall for browser agents", "Regression testing for web automations"],
    verifiedFields: ["product"],
    sourceItems: ["repo-browser-use"],
    momentum: 72,
  },
];
