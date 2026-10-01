// Canonical enumerations shared by DB schema, validation and UI.

export const ITEM_KINDS = ["article", "paper", "repo", "tool", "launch"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const SOURCE_KINDS = ["rss", "blog", "arxiv", "hn", "github", "hf_papers"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const CATEGORIES = [
  "models",
  "research",
  "agents",
  "developer-tools",
  "infrastructure",
  "funding",
  "policy",
  "safety",
  "enterprise",
  "robotics",
  "hardware",
  "open-source",
  "careers",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  models: "Models",
  research: "Research",
  agents: "Agents",
  "developer-tools": "Developer Tools",
  infrastructure: "Infrastructure",
  funding: "Funding",
  policy: "Policy & Regulation",
  safety: "AI Safety",
  enterprise: "Enterprise",
  robotics: "Robotics",
  hardware: "Hardware",
  "open-source": "Open Source",
  careers: "Careers",
};

export const DIFFICULTIES = ["beginner", "intermediate", "advanced", "research"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SKILL_STATUSES = ["exploding", "growing", "stable", "declining", "insufficient"] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];

export const TREND_STATUSES = ["emerging", "accelerating", "mainstream", "cooling"] as const;
export type TrendStatus = (typeof TREND_STATUSES)[number];

export const CLAIM_LABELS = ["fact", "analysis", "speculation"] as const;
export type ClaimLabel = (typeof CLAIM_LABELS)[number];

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const ENTITY_TYPES = [
  "company",
  "model",
  "person",
  "technology",
  "tool",
  "skill",
  "role",
  "startup",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES = [
  "develops",
  "uses",
  "affects",
  "requires",
  "competes_with",
  "invests_in",
  "part_of",
  "enables",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const COLLECTIONS = [
  "read_later",
  "research",
  "project_ideas",
  "career",
  "startups",
  "tools",
] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const COLLECTION_LABELS: Record<Collection, string> = {
  read_later: "Read Later",
  research: "Research",
  project_ideas: "Project Ideas",
  career: "Career",
  startups: "Interesting Startups",
  tools: "Tools to Try",
};

export const BOOKMARK_TARGETS = ["item", "experiment", "trend", "startup"] as const;
export type BookmarkTarget = (typeof BOOKMARK_TARGETS)[number];

export const INTERESTS = [
  "ai-agents",
  "llms",
  "computer-vision",
  "multimodal",
  "robotics",
  "research",
  "startups",
  "career",
  "software-engineering",
  "mlops",
  "ai-safety",
  "cybersecurity",
] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_LABELS: Record<Interest, string> = {
  "ai-agents": "AI Agents",
  llms: "LLMs",
  "computer-vision": "Computer Vision",
  multimodal: "Multimodal AI",
  robotics: "Robotics",
  research: "Research",
  startups: "Startups",
  career: "Career",
  "software-engineering": "Software Engineering",
  mlops: "MLOps",
  "ai-safety": "AI Safety",
  cybersecurity: "Cybersecurity",
};

export const ROLES = [
  "software-engineer",
  "ai-engineer",
  "ml-engineer",
  "data-scientist",
  "product-manager",
  "designer",
  "devops-engineer",
  "security-engineer",
  "researcher",
  "analyst",
  "consultant",
  "marketing",
  "finance",
  "healthcare",
  "education",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  "software-engineer": "Software Engineers",
  "ai-engineer": "AI Engineers",
  "ml-engineer": "ML Engineers",
  "data-scientist": "Data Scientists",
  "product-manager": "Product Managers",
  designer: "Designers",
  "devops-engineer": "DevOps Engineers",
  "security-engineer": "Cybersecurity Engineers",
  researcher: "Researchers",
  analyst: "Analysts",
  consultant: "Consultants",
  marketing: "Marketing",
  finance: "Finance",
  healthcare: "Healthcare",
  education: "Education",
};

export const AUDIENCES = [
  "students",
  "aiEngineers",
  "softwareEngineers",
  "researchers",
  "founders",
  "companies",
] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  students: "Students",
  aiEngineers: "AI Engineers",
  softwareEngineers: "Software Engineers",
  researchers: "Researchers",
  founders: "Founders",
  companies: "Companies",
};
