import Link from "next/link";
import { Box, FileText, GitFork, Newspaper, Rocket, Star, Wrench } from "lucide-react";
import type { Collection, ItemKind } from "@/domain/taxonomy";
import { CATEGORY_LABELS } from "@/domain/taxonomy";
import { cn, compactNumber, relativeTime } from "@/lib/utils";
import type { ItemSummary } from "@/server/repositories/items";
import { BookmarkButton } from "./bookmark-button";
import { DemoBadge } from "./labels";
import { ScoreBadge } from "./score-badge";

export const KIND_META: Record<ItemKind, { label: string; Icon: typeof Newspaper }> = {
  article: { label: "News", Icon: Newspaper },
  paper: { label: "Paper", Icon: FileText },
  repo: { label: "Repository", Icon: GitFork },
  tool: { label: "Tool", Icon: Wrench },
  launch: { label: "Launch", Icon: Rocket },
};

export function SourceLine({ item, className }: { item: ItemSummary; className?: string }) {
  const { Icon, label } = KIND_META[item.kind];
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle", className)}>
      <span className="inline-flex items-center gap-1 text-fg-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <span aria-hidden>·</span>
      <span>{item.sourceName ?? "Unknown source"}</span>
      <span aria-hidden>·</span>
      <time dateTime={item.publishedAt.toISOString()}>{relativeTime(item.publishedAt)}</time>
      {item.sourceCount > 1 && (
        <>
          <span aria-hidden>·</span>
          <span title="Independent sources covering this story">{item.sourceCount} sources</span>
        </>
      )}
      {item.isDemo && <DemoBadge />}
    </div>
  );
}

function defaultCollectionFor(kind: ItemKind): Collection {
  if (kind === "paper") return "research";
  if (kind === "tool" || kind === "repo") return "tools";
  return "read_later";
}

export function StoryCard({
  item,
  saved,
  variant = "default",
  rank,
}: {
  item: ItemSummary;
  saved?: Collection[];
  variant?: "default" | "compact" | "feature";
  rank?: number;
}) {
  const category = item.category ? CATEGORY_LABELS[item.category] : null;
  return (
    <article
      className={cn(
        "group relative flex gap-4 rounded-[var(--radius-card)] border border-line bg-surface-1 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2/50",
        variant === "compact" ? "p-4" : "p-5",
        variant === "feature" && "p-6",
      )}
    >
      {rank !== undefined && (
        <span className="mt-0.5 w-5 shrink-0 font-mono text-sm text-fg-subtle tabular" aria-hidden>
          {String(rank).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <SourceLine item={item} />
        <h3
          className={cn(
            "mt-2 text-pretty font-medium tracking-tight text-fg",
            variant === "feature" ? "text-xl leading-snug" : "text-[15px] leading-snug",
          )}
        >
          <Link href={`/intel/${item.id}`} className="outline-none after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:underline">
            {item.title}
          </Link>
        </h3>
        {variant !== "compact" && item.tldr && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-muted">{item.tldr}</p>}
        {variant === "feature" && item.whyItMatters && (
          <p className="mt-3 border-l-2 border-accent/50 pl-3 text-sm leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">Why it matters · </span>
            {item.whyItMatters}
          </p>
        )}
        {variant !== "compact" && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {category && <span className="rounded-md bg-surface-3/70 px-1.5 py-0.5 text-[11px] text-fg-muted">{category}</span>}
            {item.kind === "repo" && item.metrics.stars !== undefined && (
              <span className="inline-flex items-center gap-1 text-[11px] text-fg-muted">
                <Star className="size-3" aria-hidden /> {compactNumber(item.metrics.stars)}
                {item.metrics.starsDelta7d ? <span className="text-up">+{compactNumber(item.metrics.starsDelta7d)}/wk</span> : null}
              </span>
            )}
            {item.kind === "paper" && item.metrics.arxivId && (
              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-fg-subtle">
                <Box className="size-3" aria-hidden />
                arXiv:{item.metrics.arxivId}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="relative z-10 flex shrink-0 flex-col items-end justify-between gap-2">
        <ScoreBadge score={item.score} breakdown={item.scoreBreakdown} size={variant === "compact" ? "sm" : "md"} />
        <BookmarkButton
          targetType="item"
          targetId={item.id}
          saved={saved}
          defaultCollection={defaultCollectionFor(item.kind)}
          topics={item.tags}
          className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        />
      </div>
    </article>
  );
}
