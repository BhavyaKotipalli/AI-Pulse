import { logger } from "@/lib/logger";

export const USER_AGENT = "AI-Pulse/0.2 (personal research aggregator; respects robots.txt and rate limits)";

/** Hosts connectors are allowed to call. Anything else is refused (SSRF guard). */
const ALLOWED_HOSTS = [
  "openai.com",
  "deepmind.google",
  "blog.google",
  "huggingface.co",
  "blogs.nvidia.com",
  "aws.amazon.com",
  "github.blog",
  "www.technologyreview.com",
  "techcrunch.com",
  "www.theverge.com",
  "arstechnica.com",
  "machinelearning.apple.com",
  "export.arxiv.org",
  "hn.algolia.com",
  "api.github.com",
];

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

export function assertAllowed(url: string): URL {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new FetchError(`Refusing non-HTTPS URL: ${url}`);
  if (!ALLOWED_HOSTS.includes(u.hostname)) throw new FetchError(`Host not allow-listed: ${u.hostname}`);
  return u;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * GET with timeout, size cap, and retries (exponential backoff + jitter) on network errors,
 * 429 and 5xx. 4xx other than 429 fail immediately.
 */
export async function fetchText(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number; retries?: number; signal?: AbortSignal } = {},
): Promise<string> {
  assertAllowed(url);
  const retries = opts.retries ?? 2;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15_000);
    opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*", ...opts.headers },
        signal: controller.signal,
        redirect: "follow",
      });
      if (res.status === 429 || res.status >= 500) throw new FetchError(`HTTP ${res.status}`, res.status);
      if (!res.ok) {
        const err = new FetchError(`HTTP ${res.status} for ${url}`, res.status);
        (err as FetchError & { fatal?: boolean }).fatal = true;
        throw err;
      }
      const len = Number(res.headers.get("content-length") ?? 0);
      if (len > MAX_BYTES) throw new FetchError(`Response too large (${len} bytes)`);
      const text = await res.text();
      if (text.length > MAX_BYTES) throw new FetchError("Response too large");
      return text;
    } catch (err) {
      lastError = err;
      if ((err as { fatal?: boolean }).fatal || opts.signal?.aborted || attempt === retries) break;
      const delay = 500 * 2 ** attempt + Math.random() * 300;
      logger.debug({ url, attempt, delay }, "retrying fetch");
      await new Promise((r) => setTimeout(r, delay));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new FetchError(String(lastError));
}

export async function fetchJson(url: string, opts: Parameters<typeof fetchText>[1] = {}): Promise<unknown> {
  const text = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FetchError(`Invalid JSON from ${url}`);
  }
}
