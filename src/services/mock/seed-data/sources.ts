import type { SourceKind } from "@/domain/taxonomy";

export interface SeedSource {
  slug: string;
  name: string;
  kind: SourceKind;
  url: string;
  homepage: string;
  credibility: number;
}

/** Real publications/feeds. In demo mode their items point to the publication's index page. */
export const seedSources: SeedSource[] = [
  { slug: "anthropic-news", name: "Anthropic", kind: "blog", url: "https://www.anthropic.com/news", homepage: "https://www.anthropic.com", credibility: 0.95 },
  { slug: "openai-news", name: "OpenAI", kind: "blog", url: "https://openai.com/news/", homepage: "https://openai.com", credibility: 0.95 },
  { slug: "deepmind-blog", name: "Google DeepMind", kind: "blog", url: "https://deepmind.google/discover/blog/", homepage: "https://deepmind.google", credibility: 0.95 },
  { slug: "meta-ai-blog", name: "Meta AI", kind: "blog", url: "https://ai.meta.com/blog/", homepage: "https://ai.meta.com", credibility: 0.92 },
  { slug: "microsoft-ai-blog", name: "Microsoft AI", kind: "blog", url: "https://blogs.microsoft.com/ai/", homepage: "https://www.microsoft.com/ai", credibility: 0.9 },
  { slug: "nvidia-blog", name: "NVIDIA Blog", kind: "blog", url: "https://blogs.nvidia.com/", homepage: "https://www.nvidia.com", credibility: 0.88 },
  { slug: "mistral-news", name: "Mistral AI", kind: "blog", url: "https://mistral.ai/news", homepage: "https://mistral.ai", credibility: 0.9 },
  { slug: "hf-blog", name: "Hugging Face Blog", kind: "blog", url: "https://huggingface.co/blog", homepage: "https://huggingface.co", credibility: 0.9 },
  { slug: "apple-ml", name: "Apple Machine Learning Research", kind: "blog", url: "https://machinelearning.apple.com/", homepage: "https://machinelearning.apple.com", credibility: 0.92 },
  { slug: "aws-ml-blog", name: "AWS Machine Learning Blog", kind: "blog", url: "https://aws.amazon.com/blogs/machine-learning/", homepage: "https://aws.amazon.com", credibility: 0.88 },
  { slug: "github-blog", name: "The GitHub Blog", kind: "rss", url: "https://github.blog/", homepage: "https://github.blog", credibility: 0.88 },
  { slug: "mit-tech-review", name: "MIT Technology Review", kind: "rss", url: "https://www.technologyreview.com/topic/artificial-intelligence/", homepage: "https://www.technologyreview.com", credibility: 0.88 },
  { slug: "techcrunch-ai", name: "TechCrunch AI", kind: "rss", url: "https://techcrunch.com/category/artificial-intelligence/", homepage: "https://techcrunch.com", credibility: 0.78 },
  { slug: "the-verge-ai", name: "The Verge — AI", kind: "rss", url: "https://www.theverge.com/ai-artificial-intelligence", homepage: "https://www.theverge.com", credibility: 0.75 },
  { slug: "ars-technica", name: "Ars Technica", kind: "rss", url: "https://arstechnica.com/ai/", homepage: "https://arstechnica.com", credibility: 0.82 },
  { slug: "arxiv", name: "arXiv", kind: "arxiv", url: "https://arxiv.org", homepage: "https://arxiv.org", credibility: 0.8 },
  { slug: "hacker-news", name: "Hacker News", kind: "hn", url: "https://news.ycombinator.com", homepage: "https://news.ycombinator.com", credibility: 0.6 },
  { slug: "github", name: "GitHub", kind: "github", url: "https://github.com/trending", homepage: "https://github.com", credibility: 0.7 },
  { slug: "viral-social", name: "Viral social post", kind: "rss", url: "https://news.ycombinator.com/newest", homepage: "https://news.ycombinator.com", credibility: 0.25 },
];
