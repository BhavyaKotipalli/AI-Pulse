import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/intel/section-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { globalSearch, type SearchHit } from "@/server/repositories/search";

export const metadata: Metadata = { title: "Search" };

const GROUP_LABEL: Record<SearchHit["type"], string> = {
  item: "Stories, papers, repositories & tools",
  trend: "Trends",
  experiment: "Experiments",
  startup: "Startups",
  entity: "Companies, models, technologies & skills",
};

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 200) : "";
  const hits = query ? await globalSearch(query, 12) : [];
  const groups = new Map<SearchHit["type"], SearchHit[]>();
  for (const h of hits) groups.set(h.type, [...(groups.get(h.type) ?? []), h]);

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Global search" title={query ? `Results for “${query}”` : "Search everything"} description="Hybrid semantic + full-text search across all collected intelligence." />
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Companies, papers, technologies, skills…"
          aria-label="Search query"
          className="h-11 flex-1 rounded-lg border border-line bg-surface-1 px-4 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent/40"
        />
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>
      {query && hits.length === 0 && <EmptyState title="No results" description="Try a broader term, or ask AI for a synthesized answer." />}
      {query && (
        <Link href={`/ask?q=${encodeURIComponent(query)}`} className="inline-block text-sm text-accent hover:underline">
          Ask AI about “{query}” →
        </Link>
      )}
      {[...groups.entries()].map(([type, list]) => (
        <section key={type}>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">{GROUP_LABEL[type]}</p>
          <Card className="divide-y divide-line">
            {list.map((h) => (
              <Link key={`${h.type}:${h.id}`} href={h.href as Route} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] text-fg">{h.title}</p>
                  {h.subtitle && <p className="line-clamp-1 text-sm text-fg-muted">{h.subtitle}</p>}
                </div>
                {h.meta && <span className="shrink-0 font-mono text-xs capitalize text-fg-subtle">{h.meta}</span>}
              </Link>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}
