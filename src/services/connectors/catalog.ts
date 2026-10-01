import { arxivConnector, githubConnector, hfPapersConnector, hnConnector } from "./apis";
import { rssConnector } from "./rss";
import type { ConnectorId, SourceConnector, SourceDefinition } from "./types";

export const CONNECTORS: Record<ConnectorId, SourceConnector> = {
  rss: rssConnector,
  arxiv: arxivConnector,
  hn: hnConnector,
  github: githubConnector,
  hf_papers: hfPapersConnector,
};

/** Broad tech publications: keep AI-related stories only. */
const AI_ONLY = /\b(ai|artificial intelligence|llms?|gpt|openai|anthropic|claude|gemini|deepmind|chatbot|machine learning|neural|nvidia|agents?|robot\w*|copilot|model)\b/i;

/**
 * Live sources. Feeds verified reachable on 2026-10-01. Official lab blogs get the
 * highest credibility prior; aggregated community sources the lowest.
 */
export const SOURCE_CATALOG: SourceDefinition[] = [
  { slug: "openai-rss", name: "OpenAI", kind: "blog", connector: "rss", url: "https://openai.com/news/rss.xml", homepage: "https://openai.com/news/", credibility: 0.95 },
  { slug: "deepmind-rss", name: "Google DeepMind", kind: "blog", connector: "rss", url: "https://deepmind.google/blog/rss.xml", homepage: "https://deepmind.google/blog/", credibility: 0.95 },
  { slug: "google-ai-rss", name: "Google AI Blog", kind: "blog", connector: "rss", url: "https://blog.google/technology/ai/rss/", homepage: "https://blog.google/technology/ai/", credibility: 0.92 },
  { slug: "hf-blog-rss", name: "Hugging Face Blog", kind: "blog", connector: "rss", url: "https://huggingface.co/blog/feed.xml", homepage: "https://huggingface.co/blog", credibility: 0.9 },
  { slug: "nvidia-rss", name: "NVIDIA Blog", kind: "blog", connector: "rss", url: "https://blogs.nvidia.com/feed/", homepage: "https://blogs.nvidia.com/", credibility: 0.85, filter: AI_ONLY },
  { slug: "aws-ml-rss", name: "AWS Machine Learning Blog", kind: "blog", connector: "rss", url: "https://aws.amazon.com/blogs/machine-learning/feed/", homepage: "https://aws.amazon.com/blogs/machine-learning/", credibility: 0.85 },
  { slug: "apple-ml-rss", name: "Apple Machine Learning Research", kind: "blog", connector: "rss", url: "https://machinelearning.apple.com/rss.xml", homepage: "https://machinelearning.apple.com/", credibility: 0.92 },
  { slug: "github-blog-ai-rss", name: "The GitHub Blog — AI & ML", kind: "rss", connector: "rss", url: "https://github.blog/ai-and-ml/feed/", homepage: "https://github.blog/ai-and-ml/", credibility: 0.86 },
  { slug: "mit-tr-ai-rss", name: "MIT Technology Review", kind: "rss", connector: "rss", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", homepage: "https://www.technologyreview.com/topic/artificial-intelligence/", credibility: 0.88 },
  { slug: "techcrunch-ai-rss", name: "TechCrunch AI", kind: "rss", connector: "rss", url: "https://techcrunch.com/category/artificial-intelligence/feed/", homepage: "https://techcrunch.com/category/artificial-intelligence/", credibility: 0.78 },
  { slug: "verge-ai-rss", name: "The Verge — AI", kind: "rss", connector: "rss", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", homepage: "https://www.theverge.com/ai-artificial-intelligence", credibility: 0.75 },
  { slug: "ars-ai-rss", name: "Ars Technica — AI", kind: "rss", connector: "rss", url: "https://arstechnica.com/ai/feed/", homepage: "https://arstechnica.com/ai/", credibility: 0.82 },
  { slug: "hf-daily-papers", name: "Hugging Face Daily Papers", kind: "hf_papers", connector: "hf_papers", url: "https://huggingface.co/api/daily_papers", homepage: "https://huggingface.co/papers", credibility: 0.82 },
  { slug: "arxiv-ai", name: "arXiv", kind: "arxiv", connector: "arxiv", url: "https://export.arxiv.org/api/query", homepage: "https://arxiv.org", credibility: 0.75 },
  { slug: "hacker-news-ai", name: "Hacker News", kind: "hn", connector: "hn", url: "https://hn.algolia.com/api/v1/search", homepage: "https://news.ycombinator.com", credibility: 0.6 },
  { slug: "github-trending-ai", name: "GitHub", kind: "github", connector: "github", url: "https://api.github.com/search/repositories", homepage: "https://github.com", credibility: 0.7 },
];
