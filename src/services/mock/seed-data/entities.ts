import type { EntityType, RelationType } from "@/domain/taxonomy";

export interface SeedEntity {
  key: string;
  type: EntityType;
  name: string;
  description: string;
  url?: string;
  aliases?: string[];
}

const e = (type: EntityType, key: string, name: string, description: string, url?: string, aliases?: string[]): SeedEntity => ({
  key,
  type,
  name,
  description,
  url,
  aliases,
});

export const seedEntities: SeedEntity[] = [
  // Companies
  e("company", "anthropic", "Anthropic", "AI safety company developing the Claude model family.", "https://www.anthropic.com"),
  e("company", "openai", "OpenAI", "AI research and deployment company behind GPT models and ChatGPT.", "https://openai.com"),
  e("company", "google-deepmind", "Google DeepMind", "Google's AI research lab; develops the Gemini models.", "https://deepmind.google", ["DeepMind", "Google"]),
  e("company", "meta", "Meta AI", "Meta's AI organization; publishes the open-weight Llama models.", "https://ai.meta.com", ["Meta"]),
  e("company", "microsoft", "Microsoft", "Cloud and software company; Azure AI, GitHub, Copilot.", "https://www.microsoft.com"),
  e("company", "nvidia", "NVIDIA", "Accelerated computing company; dominant AI training/inference hardware.", "https://www.nvidia.com"),
  e("company", "xai", "xAI", "AI company developing the Grok models.", "https://x.ai"),
  e("company", "mistral", "Mistral AI", "European AI company shipping open-weight and commercial models.", "https://mistral.ai"),
  e("company", "hugging-face", "Hugging Face", "Open-source AI platform: model hub, datasets, libraries.", "https://huggingface.co"),
  e("company", "apple", "Apple", "Consumer hardware company shipping on-device foundation models.", "https://www.apple.com"),
  e("company", "amazon", "Amazon / AWS", "Cloud provider with Bedrock and agent infrastructure services.", "https://aws.amazon.com", ["AWS"]),
  e("company", "deepseek", "DeepSeek", "Chinese AI lab known for efficient open-weight reasoning models.", "https://www.deepseek.com"),
  e("company", "github-co", "GitHub", "Code hosting platform (Microsoft); Copilot coding agent.", "https://github.com"),

  // Models
  e("model", "claude", "Claude", "Anthropic's family of large language models.", "https://www.anthropic.com/claude"),
  e("model", "gpt", "GPT", "OpenAI's family of large language models."),
  e("model", "gemini", "Gemini", "Google DeepMind's multimodal model family."),
  e("model", "llama", "Llama", "Meta's open-weight model family."),
  e("model", "deepseek-r1", "DeepSeek-R1", "Open-weight reasoning model trained with large-scale RL."),
  e("model", "phi", "Phi", "Microsoft's small language model family."),
  e("model", "pi0", "π0 (pi-zero)", "Physical Intelligence's vision-language-action robot policy."),

  // Technologies
  e("technology", "ai-agents", "AI Agents", "LLM systems that plan and take actions with tools over multiple steps."),
  e("technology", "coding-agents", "Coding Agents", "Agents that read, write, run and test code autonomously."),
  e("technology", "mcp", "Model Context Protocol", "Open protocol connecting AI applications to tools and data sources.", "https://modelcontextprotocol.io", ["MCP"]),
  e("technology", "rag", "Retrieval-Augmented Generation", "Grounding model outputs in retrieved documents.", undefined, ["RAG"]),
  e("technology", "reasoning-models", "Reasoning Models", "Models trained to spend inference-time compute on chains of thought."),
  e("technology", "multimodal", "Multimodal AI", "Models that process text, images, audio and video jointly."),
  e("technology", "vla-models", "Vision-Language-Action Models", "Robot foundation models mapping perception and language to actions.", undefined, ["VLA"]),
  e("technology", "inference-optimization", "Inference Optimization", "Techniques that cut latency and cost of serving models."),
  e("technology", "small-models", "Small Language Models", "Compact models that run on laptops and phones.", undefined, ["SLM"]),
  e("technology", "ai-evaluation", "AI Evaluation", "Benchmarks, evals and LLM-as-judge methods for measuring model systems."),
  e("technology", "prompt-injection", "Prompt Injection", "Attacks that smuggle instructions into model inputs via untrusted content."),
  e("technology", "test-time-compute", "Test-Time Compute", "Scaling reasoning quality by spending more compute at inference."),
  e("technology", "browser-agents", "Browser Agents", "Agents that operate websites through a browser."),

  // Tools
  e("tool", "claude-code", "Claude Code", "Anthropic's agentic coding tool for the terminal and IDEs.", "https://github.com/anthropics/claude-code"),
  e("tool", "codex", "OpenAI Codex", "OpenAI's coding agent (CLI and cloud).", "https://github.com/openai/codex"),
  e("tool", "gemini-cli", "Gemini CLI", "Google's open-source terminal coding agent.", "https://github.com/google-gemini/gemini-cli"),
  e("tool", "cursor", "Cursor", "AI-native code editor by Anysphere.", "https://cursor.com"),
  e("tool", "vllm", "vLLM", "High-throughput LLM inference engine (PagedAttention).", "https://github.com/vllm-project/vllm"),
  e("tool", "ollama", "Ollama", "Run open models locally with a simple CLI/API.", "https://github.com/ollama/ollama"),
  e("tool", "langgraph", "LangGraph", "Framework for stateful, graph-based agent workflows.", "https://github.com/langchain-ai/langgraph"),
  e("tool", "openhands", "OpenHands", "Open platform for AI software-development agents.", "https://github.com/All-Hands-AI/OpenHands"),
  e("tool", "swe-agent", "SWE-agent", "Research agent for resolving GitHub issues.", "https://github.com/SWE-agent/SWE-agent"),

  // Skills
  e("skill", "agent-engineering", "Agent Engineering", "Designing tool-using, multi-step LLM systems with planning, memory and guardrails."),
  e("skill", "llm-engineering", "LLM Engineering", "Building reliable applications on top of language models."),
  e("skill", "rag-skill", "RAG", "Retrieval pipelines, chunking, hybrid search, reranking."),
  e("skill", "ai-evaluation-skill", "AI Evaluation", "Designing evals, golden sets, LLM-as-judge, regression tracking."),
  e("skill", "mlops", "MLOps", "Training/deployment pipelines for ML models."),
  e("skill", "llmops", "LLMOps", "Operating LLM apps: tracing, cost, prompt/version management."),
  e("skill", "ai-infrastructure", "AI Infrastructure", "GPU clusters, serving stacks, scheduling."),
  e("skill", "multimodal-skill", "Multimodal AI", "Building with vision, audio and video models."),
  e("skill", "ai-security", "AI Security", "Threat-modeling agents; prompt-injection defenses; red-teaming."),
  e("skill", "mcp-skill", "Model Context Protocol", "Building MCP servers/clients to connect agents to tools."),
  e("skill", "synthetic-data", "Synthetic Data", "Generating and filtering training/eval data with models."),
  e("skill", "inference-skill", "Inference Optimization", "Quantization, batching, speculative decoding, KV-cache management."),
  e("skill", "ai-product-engineering", "AI Product Engineering", "Shipping AI features end-to-end with UX for uncertainty."),
  e("skill", "manual-prompt-tuning", "Manual Prompt Tweaking", "Hand-iterating prompts without evals — being replaced by eval-driven development."),

  // Startups
  e("startup", "anysphere", "Anysphere (Cursor)", "Maker of the Cursor AI code editor.", "https://cursor.com"),
  e("startup", "cognition", "Cognition", "Maker of Devin, an autonomous software-engineering agent.", "https://cognition.ai"),
  e("startup", "perplexity", "Perplexity", "AI answer engine with cited, search-grounded responses.", "https://www.perplexity.ai"),
  e("startup", "elevenlabs", "ElevenLabs", "Voice AI: text-to-speech, voice cloning, conversational agents.", "https://elevenlabs.io"),
  e("startup", "harvey", "Harvey", "Generative AI platform for legal and professional services.", "https://www.harvey.ai"),
  e("startup", "physical-intelligence", "Physical Intelligence", "Building general-purpose robot foundation models (π0).", "https://www.physicalintelligence.company"),
  e("startup", "glean", "Glean", "Enterprise search and work AI assistant.", "https://www.glean.com"),
  e("startup", "browser-use-co", "Browser Use", "Open-source library and cloud for browser-operating agents.", "https://browser-use.com"),
];

export interface SeedRelation {
  from: string;
  to: string;
  relation: RelationType;
  weight?: number;
}

const r = (from: string, relation: RelationType, to: string, weight = 1): SeedRelation => ({ from, to, relation, weight });

export const seedRelations: SeedRelation[] = [
  r("anthropic", "develops", "claude"),
  r("anthropic", "develops", "claude-code"),
  r("anthropic", "develops", "mcp"),
  r("openai", "develops", "gpt"),
  r("openai", "develops", "codex"),
  r("google-deepmind", "develops", "gemini"),
  r("google-deepmind", "develops", "gemini-cli"),
  r("meta", "develops", "llama"),
  r("microsoft", "develops", "phi"),
  r("deepseek", "develops", "deepseek-r1"),
  r("physical-intelligence", "develops", "pi0"),
  r("claude", "uses", "coding-agents", 0.9),
  r("claude-code", "part_of", "coding-agents"),
  r("codex", "part_of", "coding-agents"),
  r("gemini-cli", "part_of", "coding-agents"),
  r("openhands", "part_of", "coding-agents"),
  r("swe-agent", "part_of", "coding-agents"),
  r("cognition", "competes_with", "anysphere", 0.6),
  r("coding-agents", "part_of", "ai-agents"),
  r("browser-agents", "part_of", "ai-agents"),
  r("mcp", "enables", "ai-agents"),
  r("ai-agents", "requires", "agent-engineering"),
  r("coding-agents", "requires", "ai-evaluation-skill", 0.8),
  r("ai-agents", "requires", "ai-security", 0.8),
  r("prompt-injection", "affects", "ai-agents"),
  r("mcp", "requires", "mcp-skill"),
  r("rag", "requires", "rag-skill"),
  r("reasoning-models", "uses", "test-time-compute"),
  r("deepseek-r1", "part_of", "reasoning-models"),
  r("vllm", "part_of", "inference-optimization"),
  r("inference-optimization", "requires", "inference-skill"),
  r("nvidia", "enables", "inference-optimization", 0.7),
  r("pi0", "part_of", "vla-models"),
  r("small-models", "uses", "inference-optimization", 0.6),
  r("phi", "part_of", "small-models"),
  r("apple", "uses", "small-models", 0.8),
  r("ai-evaluation", "requires", "ai-evaluation-skill"),
];
