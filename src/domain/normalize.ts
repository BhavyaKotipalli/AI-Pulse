/** Query parameters that only track clicks and never change the document. */
const TRACKING_PARAMS = /^(utm_\w+|ref|ref_src|fbclid|gclid|mc_cid|mc_eid|igshid|si|source|cmpid|_hsenc|_hsmi)$/i;

/** Canonical form used for deduplication: https, no www, no fragment, no tracking params, no trailing slash. */
export function canonicalUrl(raw: string): string {
  const u = new URL(raw.trim());
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  return u.toString();
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };

/** Strips tags/scripts and decodes common entities. Output is plain text, never rendered as HTML. */
export function stripHtml(input: string): string {
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A short excerpt suitable for "permitted snippet" storage: we keep at most ~320
 * characters, cut at a sentence or word boundary. Full articles are never stored.
 */
export function makeSnippet(input: string | null | undefined, max = 320): string | null {
  if (!input) return null;
  const text = stripHtml(input);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sentenceEnd = cut.lastIndexOf(". ");
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export function firstSentence(text: string | null | undefined, max = 240): string | null {
  if (!text) return null;
  const m = text.match(/^(.{30,}?[.!?])(\s|$)/);
  const s = (m?.[1] ?? text).trim();
  return s.length > max ? `${s.slice(0, s.lastIndexOf(" ", max))}…` : s;
}

export function cleanTitle(title: string): string {
  return stripHtml(title).replace(/\s+[|–—-]\s+[^|–—-]{2,40}$/, "").trim();
}

const TITLE_STOP = new Set("a an the and or of to in on for with from by at is are as its it this that new how why what".split(" "));

export function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9.\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !TITLE_STOP.has(t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Two titles describe the same story when their token overlap is high. */
export const DUPLICATE_TITLE_THRESHOLD = 0.6;
