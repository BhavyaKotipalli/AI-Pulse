import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import { fetchText } from "./http";
import type { RawItem, SourceConnector, SourceDefinition } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
});

/** XML text nodes arrive as strings, numbers or `{ "#text": ... }` objects. */
export function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === "object" && "#text" in value) return text((value as Record<string, unknown>)["#text"]);
  return "";
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const RssItem = z.object({
  title: z.unknown(),
  link: z.unknown(),
  guid: z.unknown().optional(),
  pubDate: z.unknown().optional(),
  "dc:date": z.unknown().optional(),
  description: z.unknown().optional(),
  "dc:creator": z.unknown().optional(),
  author: z.unknown().optional(),
  category: z.unknown().optional(),
});

const AtomEntry = z.object({
  title: z.unknown(),
  link: z.unknown(),
  id: z.unknown().optional(),
  published: z.unknown().optional(),
  updated: z.unknown().optional(),
  summary: z.unknown().optional(),
  content: z.unknown().optional(),
  author: z.unknown().optional(),
  category: z.unknown().optional(),
});

function atomLink(link: unknown): string {
  const links = asArray(link as Record<string, unknown> | Record<string, unknown>[]);
  const alt = links.find((l) => typeof l === "object" && l && (l["@_rel"] === undefined || l["@_rel"] === "alternate"));
  const chosen = alt ?? links[0];
  if (typeof chosen === "string") return chosen;
  return chosen && typeof chosen === "object" ? String(chosen["@_href"] ?? "") : "";
}

function parseDate(...candidates: unknown[]): Date | null {
  for (const c of candidates) {
    const s = text(c);
    if (!s) continue;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function categories(value: unknown): string[] {
  return asArray(value as unknown[])
    .map((c) => (typeof c === "object" && c && "@_term" in c ? String((c as Record<string, unknown>)["@_term"]) : text(c)))
    .filter(Boolean)
    .slice(0, 8);
}

/** Parses RSS 2.0 or Atom XML into raw items. Invalid entries are skipped, not fatal. */
export function parseFeed(xml: string, source: SourceDefinition): RawItem[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const kind = source.itemKind ?? "article";
  const out: RawItem[] = [];

  const rss = (doc.rss as { channel?: { item?: unknown } } | undefined)?.channel?.item;
  for (const raw of asArray(rss)) {
    const parsed = RssItem.safeParse(raw);
    if (!parsed.success) continue;
    const it = parsed.data;
    const url = text(it.link);
    const publishedAt = parseDate(it.pubDate, it["dc:date"]);
    const title = text(it.title);
    if (!url || !title || !publishedAt) continue;
    out.push({
      externalId: text(it.guid) || url,
      kind,
      title,
      url,
      author: text(it["dc:creator"]) || text(it.author) || null,
      publishedAt,
      summary: text(it.description),
      tags: categories(it.category),
    });
  }

  const atom = (doc.feed as { entry?: unknown } | undefined)?.entry;
  for (const raw of asArray(atom)) {
    const parsed = AtomEntry.safeParse(raw);
    if (!parsed.success) continue;
    const it = parsed.data;
    const url = atomLink(it.link);
    const publishedAt = parseDate(it.published, it.updated);
    const title = text(it.title);
    if (!url || !title || !publishedAt) continue;
    const author = asArray(it.author as unknown[])
      .map((a) => (a && typeof a === "object" ? text((a as Record<string, unknown>).name) : text(a)))
      .filter(Boolean);
    out.push({
      externalId: text(it.id) || url,
      kind,
      title,
      url,
      author: author.slice(0, 3).join(", ") || null,
      publishedAt,
      summary: text(it.summary) || text(it.content),
      tags: categories(it.category),
    });
  }
  return out;
}

export const rssConnector: SourceConnector = {
  id: "rss",
  async fetch(source, ctx) {
    const xml = await fetchText(source.url, { signal: ctx.signal, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    return parseFeed(xml, source).filter((i) => i.publishedAt >= ctx.since);
  },
};
