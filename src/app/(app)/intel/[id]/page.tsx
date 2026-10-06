import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import type { ReactNode } from "react";
import { BookmarkButton } from "@/components/intel/bookmark-button";
import { ExperimentCard } from "@/components/intel/cards";
import { ClaimLabel, ConfidenceBadge } from "@/components/intel/labels";
import { ScoreBadge } from "@/components/intel/score-badge";
import { SectionHeader } from "@/components/intel/section-header";
import { SourceLine, StoryCard } from "@/components/intel/story-card";
import { Card } from "@/components/ui/card";
import type { ItemAnalysis } from "@/domain/analysis";
import { AUDIENCE_LABELS, AUDIENCES, ROLE_LABELS, type Role } from "@/domain/taxonomy";
import { DEEP_ANALYSIS_THRESHOLD, MAJOR_STORY_THRESHOLD } from "@/domain/scoring";
import { hostname } from "@/lib/utils";
import { getViewer } from "@/server/auth/viewer";
import { experimentsForItem } from "@/server/repositories/intel";
import { getItem, getItemsByIds, relatedItems } from "@/server/repositories/items";
import { bookmarkState, recordEvent } from "@/server/repositories/user-data";

export async function generateMetadata({ params }: PageProps<"/intel/[id]">): Promise<Metadata> {
  const item = await getItem((await params).id);
  return { title: item?.title ?? "Intelligence" };
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

function PaperSections({ a }: { a: Extract<ItemAnalysis, { kind: "paper" }> }) {
  const rows: Array<[string, string]> = [
    ["What problem does this solve?", a.problem],
    ["What is technically new?", a.novelty],
    ["How does it differ from previous work?", a.priorWorkDelta],
    ["Why does it matter?", a.whyItMatters],
    ["Can I reproduce it?", a.reproducibility],
    ["Can I build a project from it?", a.projectPotential],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map(([q, ans]) => (
        <Card key={q} className="p-5">
          <p className="mb-1.5 text-sm font-medium text-fg">{q}</p>
          <p className="text-sm leading-relaxed text-fg-muted">{ans}</p>
        </Card>
      ))}
    </div>
  );
}

const ASK_PROMPTS = ["Explain this like I'm a beginner", "What should I learn before understanding this?", "Can I build a project based on this?"];

export default async function IntelPage({ params }: PageProps<"/intel/[id]">) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();
  const viewer = await getViewer();

  const [related, relatedPapers, relatedTools, experiments, saved] = await Promise.all([
    relatedItems(id, { kinds: ["article", "launch"], limit: 3 }),
    relatedItems(id, { kinds: ["paper"], limit: 3 }),
    relatedItems(id, { kinds: ["tool", "repo"], limit: 3 }),
    experimentsForItem(id),
    viewer ? bookmarkState(viewer.id, "item", [id]) : Promise.resolve(new Map()),
  ]);
  if (viewer) {
    // Implicit signal for personalization; failure must not break the page.
    recordEvent(viewer.id, "view", { type: "item", id }, item.tags).catch(() => undefined);
  }
  const a = item.analysis;
  const claimSources = a ? await getItemsByIds([...new Set(a.claims.flatMap((c) => c.sourceItemIds))]) : [];
  const claimSourceMap = new Map(claimSources.map((s) => [s.id, s]));
  const singleSource = item.score >= MAJOR_STORY_THRESHOLD && item.sourceCount < 2;

  return (
    <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_320px]">
      <article className="min-w-0 space-y-8">
        <header>
          <SourceLine item={item} />
          <h1 className="mt-3 text-balance text-[28px] font-semibold leading-tight tracking-[-0.025em] text-fg">{item.title}</h1>
          {item.author && <p className="mt-2 text-sm text-fg-subtle">{item.author}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <ScoreBadge score={item.score} breakdown={item.scoreBreakdown} />
            <ConfidenceBadge confidence={item.confidence} />
            {singleSource && (
              <span className="rounded-md border border-warn/25 bg-warn/10 px-1.5 py-0.5 text-[11px] text-warn">Single source — not yet corroborated</span>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] text-fg-muted hover:border-line-strong hover:text-fg"
            >
              Original · {hostname(item.url)} <ArrowUpRight className="size-3.5" />
            </a>
            <BookmarkButton targetType="item" targetId={item.id} saved={saved.get(item.id)} topics={item.tags} />
          </div>
        </header>

        {item.tldr && (
          <Card className="border-accent/20 bg-[linear-gradient(135deg,rgb(139_147_255/0.07),transparent_60%)] p-6">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">TL;DR</p>
            <p className="text-[17px] leading-relaxed text-fg">{item.tldr}</p>
          </Card>
        )}

        {item.snippet && (
          <Block title="From the source">
            <blockquote className="border-l-2 border-line-strong pl-4 text-[15px] leading-relaxed text-fg-muted">{item.snippet}</blockquote>
            <p className="mt-2 text-xs text-fg-subtle">Permitted excerpt. Read the full piece at the original link.</p>
          </Block>
        )}

        {item.whyItMatters && (
          <Block title="Why this matters">
            <p className="text-[15px] leading-relaxed text-fg-muted">
              <span className="mr-2 align-middle">
                <ClaimLabel label="analysis" />
              </span>
              {item.whyItMatters}
            </p>
          </Block>
        )}

        {!a && (
          <Card className="border-dashed p-5 text-sm text-fg-muted">
            Deep analysis is generated for items scoring {DEEP_ANALYSIS_THRESHOLD}+ when an AI provider is configured. This item scored {item.score}
            {item.score >= DEEP_ANALYSIS_THRESHOLD ? " — analysis is queued." : "."} You can still ask questions about it below.
          </Card>
        )}

        {a && !item.isDemo && (
          <p className="rounded-lg border border-line bg-surface-1 px-4 py-2.5 text-xs leading-relaxed text-fg-subtle">
            The analysis below is AI-generated from the source excerpt and general background knowledge — not from the full article. Statements
            labeled FACT are supported by the excerpt; verify details against the original.
          </p>
        )}

        {a?.kind === "paper" && (
          <Block title="Research breakdown">
            <PaperSections a={a} />
          </Block>
        )}

        {a?.kind === "article" && (
          <Block title="Technical explanation">
            <p className="text-[15px] leading-relaxed text-fg-muted">{a.technical}</p>
          </Block>
        )}

        {a?.kind === "repo" && (
          <Block title="Why developers are discussing it">
            <p className="text-[15px] leading-relaxed text-fg-muted">{a.whyDiscussed}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Card className="p-5">
                <p className="mb-2 text-sm font-medium text-fg">Use cases</p>
                <ul className="space-y-1 text-sm text-fg-muted">{a.useCases.map((u) => <li key={u}>· {u}</li>)}</ul>
              </Card>
              <Card className="p-5">
                <p className="mb-2 text-sm font-medium text-fg">Projects you could build</p>
                <ul className="space-y-1 text-sm text-fg-muted">{a.projectIdeas.map((u) => <li key={u}>→ {u}</li>)}</ul>
              </Card>
            </div>
          </Block>
        )}

        {a && (
          <Block title="Beginner explanation">
            <p className="text-[15px] leading-relaxed text-fg-muted">{a.beginner}</p>
          </Block>
        )}

        {a && (
          <Block title="Why should I care?">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {AUDIENCES.filter((k) => a.audiences[k]).map((k) => (
                <div key={k} className="rounded-xl border border-line bg-surface-1 p-4">
                  <p className="mb-1 text-xs font-medium text-accent-strong">{AUDIENCE_LABELS[k]}</p>
                  <p className="text-sm leading-relaxed text-fg-muted">{a.audiences[k]}</p>
                </div>
              ))}
            </div>
          </Block>
        )}

        {a && (
          <Block title="What should I do?">
            <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs text-fg-subtle">Recommended action</p>
                <p className="mt-1 text-sm text-fg">{a.action.action}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Experiment</p>
                <p className="mt-1 text-sm text-fg">{a.action.experiment}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Time</p>
                <p className="mt-1 font-mono text-sm text-fg">{a.action.timeEstimate}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Career relevance</p>
                <p className="mt-1 text-sm capitalize text-fg">{a.action.careerRelevance}</p>
              </div>
            </Card>
          </Block>
        )}

        {a?.kind === "article" && a.career && (
          <Block title="Career impact">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p className="text-fg-muted">
                <span className="text-fg">Roles affected: </span>
                {a.career.rolesAffected.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ")}
              </p>
              <p className="text-fg-muted">
                <span className="text-fg">Skills rising: </span>
                {a.career.skillsRising.join(", ")}
              </p>
              <p className="text-fg-muted">
                <span className="text-fg">Automated: </span>
                {a.career.automated.join(", ")}
              </p>
              <p className="text-fg-muted">
                <span className="text-fg">Augmented: </span>
                {a.career.augmented.join(", ")}
              </p>
            </div>
          </Block>
        )}

        {a && a.claims.length > 0 && (
          <Block title="Claims & evidence">
            <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
              {a.claims.map((c, i) => (
                <li key={i} className="flex flex-col gap-2 p-4 sm:flex-row sm:gap-4">
                  <div className="flex w-32 shrink-0 flex-wrap gap-1.5">
                    <ClaimLabel label={c.label} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed text-fg">{c.text}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                      {c.sourceItemIds.length === 0 ? (
                        <span className="text-fg-subtle">Unsourced — forward-looking.</span>
                      ) : (
                        c.sourceItemIds.map((sid) => {
                          const s = claimSourceMap.get(sid);
                          return s ? (
                            <Link key={sid} href={`/intel/${sid}`} className="text-fg-subtle hover:text-fg">
                              ↳ {s.sourceName}: {s.title.slice(0, 60)}
                              {s.title.length > 60 ? "…" : ""}
                            </Link>
                          ) : null;
                        })
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Block>
        )}

        {experiments.length > 0 && (
          <Block title="Experiments you can try">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {experiments.map((e) => (
                <ExperimentCard key={e.id} exp={e} />
              ))}
            </div>
          </Block>
        )}
      </article>

      <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-fg">
            <MessageSquareText className="size-4 text-accent" /> Ask about this
          </p>
          <ul className="space-y-1.5">
            {ASK_PROMPTS.map((p) => (
              <li key={p}>
                <Link
                  href={`/ask?about=${item.id}&q=${encodeURIComponent(p)}`}
                  className="block rounded-lg border border-line px-3 py-2 text-[13px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
                >
                  {p}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {item.trends.length > 0 && (
          <div>
            <SectionHeader title="Related trends" />
            <ul className="space-y-1.5">
              {item.trends.map((t) => (
                <li key={t.slug}>
                  <Link href={`/trends/${t.slug}`} className="text-sm text-fg-muted hover:text-fg">
                    ↗ {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {item.entities.length > 0 && (
          <div>
            <SectionHeader title="Entities" />
            <div className="flex flex-wrap gap-1.5">
              {item.entities.map((e) => (
                <Link
                  key={e.id}
                  href={e.type === "startup" ? `/startups/${e.slug}` : `/search?q=${encodeURIComponent(e.name)}`}
                  className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
                >
                  {e.name}
                </Link>
              ))}
            </div>
          </div>
        )}
        {[
          { title: "Related stories", list: related },
          { title: "Related papers", list: relatedPapers },
          { title: "Related tools & repos", list: relatedTools },
        ].map(
          ({ title, list }) =>
            list.length > 0 && (
              <div key={title}>
                <SectionHeader title={title} />
                <div className="space-y-2">
                  {list.map((r) => (
                    <StoryCard key={r.id} item={r} variant="compact" />
                  ))}
                </div>
              </div>
            ),
        )}
      </aside>
    </div>
  );
}
