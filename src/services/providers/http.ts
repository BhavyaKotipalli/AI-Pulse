import { ProviderError, RateLimitError } from "@/services/ai/types";

/** POSTs JSON to an AI provider and maps HTTP failures onto typed errors. Never logs or echoes API keys. */
export async function postJson(
  url: string,
  body: unknown,
  opts: { headers: Record<string, string>; timeoutMs?: number; signal?: AbortSignal; provider: string },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  opts.signal?.addEventListener("abort", () => controller.abort(), { once: true });
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...opts.headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (opts.signal?.aborted) throw err;
    throw new ProviderError(`${opts.provider}: network error or timeout (${err instanceof Error ? err.name : "unknown"})`);
  }
  clearTimeout(timer);
  if (res.ok) return res;

  const detail = (await res.text().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
  if (res.status === 429 || res.status === 503) {
    const retry = Number(res.headers.get("retry-after"));
    throw new RateLimitError(`${opts.provider}: rate limited or overloaded (HTTP ${res.status})`, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(`${opts.provider}: API key rejected (HTTP ${res.status}). Check the key and that the API is enabled.`, res.status);
  }
  throw new ProviderError(`${opts.provider}: HTTP ${res.status} ${detail}`, res.status);
}

/** Parses a text/event-stream body into `data:` payload strings. */
export async function* sseData(res: Response): AsyncIterable<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data && data !== "[DONE]") yield data;
      }
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const data = tail.slice(5).trim();
    if (data && data !== "[DONE]") yield data;
  }
}

export const approxTokens = (text: string) => Math.ceil(text.length / 4);
