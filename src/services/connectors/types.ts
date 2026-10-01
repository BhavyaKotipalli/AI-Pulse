import type { ItemKind, SourceKind } from "@/domain/taxonomy";
import type { ItemMetrics } from "@/domain/analysis";

/** A record as fetched from a source, before normalization. */
export interface RawItem {
  externalId: string;
  kind: ItemKind;
  title: string;
  url: string;
  author?: string | null;
  publishedAt: Date;
  /** Plain text or HTML description; normalization strips HTML and truncates. */
  summary?: string | null;
  tags?: string[];
  metrics?: ItemMetrics;
  /** 0–100 community signal already known at fetch time (HN points, upvotes, stars). */
  momentum?: number;
}

export interface SourceDefinition {
  slug: string;
  name: string;
  kind: SourceKind;
  url: string;
  homepage: string;
  /** Editorial prior, 0–1. Official lab blogs and peer-reviewed venues rank highest. */
  credibility: number;
  /** Which connector handles it. */
  connector: ConnectorId;
  /** Only keep items whose title/summary matches this (for broad feeds). */
  filter?: RegExp;
  /** Default kind for feed items. */
  itemKind?: ItemKind;
}

export type ConnectorId = "rss" | "arxiv" | "hn" | "github" | "hf_papers";

export interface FetchContext {
  since: Date;
  githubToken?: string;
  signal?: AbortSignal;
}

export interface SourceConnector {
  id: ConnectorId;
  fetch(source: SourceDefinition, ctx: FetchContext): Promise<RawItem[]>;
}
