import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { BookmarkButton } from "@/components/intel/bookmark-button";
import { DemoBadge } from "@/components/intel/labels";
import { SectionHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/server/auth/viewer";
import { getStartup } from "@/server/repositories/intel";
import { bookmarkState } from "@/server/repositories/user-data";

export async function generateMetadata({ params }: PageProps<"/startups/[slug]">): Promise<Metadata> {
  const data = await getStartup((await params).slug);
  return { title: data?.name ?? "Startup" };
}

function Field({ label, verified, children }: { label: string; verified: boolean; children: ReactNode }) {
  return (
    <div className="border-b border-line py-4 last:border-0">
      <div className="mb-1 flex items-center gap-2">
        <p className="text-sm font-medium text-fg">{label}</p>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-fact" title="Verified against a cited source">
            <ShieldCheck className="size-3" /> verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle" title="Not yet verified against a cited source">
            <ShieldAlert className="size-3" /> not verified
          </span>
        )}
      </div>
      <div className="text-[15px] leading-relaxed text-fg-muted">{children}</div>
    </div>
  );
}

const list = (arr: string[], empty = "Unknown") => (arr.length ? arr.join(", ") : <span className="text-fg-subtle">{empty}</span>);

export default async function StartupPage({ params }: PageProps<"/startups/[slug]">) {
  const { slug } = await params;
  const data = await getStartup(slug);
  if (!data) notFound();
  const p = data.profile;
  const v = (f: string) => p.verifiedFields.includes(f);
  const viewer = await getViewer();
  const saved = viewer ? await bookmarkState(viewer.id, "startup", [slug]) : new Map();

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-surface-3 text-2xl font-semibold text-fg">
          {data.name[0]}
        </span>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <Link href="/startups" className="text-[13px] text-fg-subtle hover:text-fg">
              Startup radar
            </Link>
            {data.isDemo && <DemoBadge />}
          </div>
          <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-fg">{data.name}</h1>
          <p className="mt-1 text-lg text-fg-muted">{p.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.url && (
            <a href={data.url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-fg-muted hover:border-line-strong hover:text-fg">
              Website <ArrowUpRight className="size-3.5" />
            </a>
          )}
          <BookmarkButton targetType="startup" targetId={slug} saved={saved.get(slug)} defaultCollection="startups" />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="px-6 py-2">
          <Field label="Problem" verified={v("problem")}>{p.problem}</Field>
          <Field label="Product" verified={v("product")}>{p.product}</Field>
          <Field label="AI technology" verified={v("aiTech")}>{p.aiTech}</Field>
          <Field label="Market" verified={v("market")}>{p.market}</Field>
          <Field label="What makes it interesting" verified={false}>
            <span className="mr-2 text-[11px] uppercase tracking-wide text-analysis">Analysis</span>
            {p.interesting}
          </Field>
          <Field label="Possible weaknesses" verified={false}>
            <span className="mr-2 text-[11px] uppercase tracking-wide text-analysis">Analysis</span>
            {p.weaknesses}
          </Field>
        </Card>
        <div className="space-y-4">
          <Card className="px-6 py-2">
            <Field label="Funding stage" verified={v("fundingStage")}>{p.fundingStage ?? <span className="text-fg-subtle">Unknown</span>}</Field>
            <Field label="Investors" verified={v("investors")}>{list(p.investors)}</Field>
            <Field label="Founders" verified={v("founders")}>{list(p.founders)}</Field>
            <Field label="Competitors" verified={v("competitors")}>{list(p.competitors)}</Field>
          </Card>
          <Card className="p-5">
            <p className="mb-2 text-sm font-medium text-fg">Startup ideas inspired by {data.name}</p>
            <ul className="space-y-2">
              {p.ideas.map((idea) => (
                <li key={idea} className="text-sm leading-relaxed text-fg-muted">
                  → {idea}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <section>
        <SectionHeader eyebrow="Sources" title="Coverage" />
        {data.sources.length === 0 ? (
          <p className="text-sm text-fg-subtle">No ingested coverage yet. Profile fields without a source are marked “not verified”.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.sources.map((s) => (
              <StoryCard key={s.id} item={s} variant="compact" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
