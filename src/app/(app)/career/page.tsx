import type { Metadata } from "next";
import Link from "next/link";
import { SkillRow } from "@/components/intel/cards";
import { ConfidenceBadge } from "@/components/intel/labels";
import { FilterChips } from "@/components/intel/filter-chips";
import { PageHeader, SectionHeader } from "@/components/intel/section-header";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/taxonomy";
import { cn } from "@/lib/utils";
import { listCareerImpacts, skillRadar } from "@/server/repositories/intel";
import { getItemsByIds } from "@/server/repositories/items";

export const metadata: Metadata = { title: "Career impact" };

function TagList({ title, items, tone }: { title: string; items: string[]; tone: "down" | "up" | "accent" | "neutral" }) {
  if (items.length === 0) return null;
  const toneClass = {
    down: "border-down/20 bg-down/[0.07] text-down",
    up: "border-up/20 bg-up/[0.07] text-up",
    accent: "border-accent/25 bg-accent-soft text-accent-strong",
    neutral: "border-line bg-surface-2 text-fg-muted",
  }[tone];
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-wider text-fg-subtle">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className={cn("rounded-md border px-2 py-0.5 text-xs", toneClass)}>
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function CareerPage({ searchParams }: PageProps<"/career">) {
  const { role } = await searchParams;
  const active = ROLES.includes(role as Role) ? (role as Role) : undefined;
  const [skills, allImpacts] = await Promise.all([skillRadar(), listCareerImpacts()]);
  const impacts = active ? allImpacts.filter((i) => i.role === active) : allImpacts;
  const sources = await getItemsByIds([...new Set(impacts.flatMap((i) => i.sourceItemIds))]);
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Career impact intelligence"
        title="How AI is changing jobs"
        description="Tasks being automated vs augmented, skills rising and fading, and what to learn now — derived from tracked developments, with confidence levels and sources."
      />

      <section>
        <SectionHeader
          eyebrow="Career trend radar"
          title="Skill momentum"
          description="Status is computed from evidence: mentions in the last 30 days vs the prior 30 (≥ +60% exploding, ≥ +15% growing, ±15% stable, below declining)."
        />
        <Card className="grid grid-cols-1 gap-x-10 px-5 py-2 md:grid-cols-2">
          <ul className="divide-y divide-line">
            {skills.slice(0, Math.ceil(skills.length / 2)).map((s) => (
              <SkillRow key={s.id} skill={s} />
            ))}
          </ul>
          <ul className="divide-y divide-line">
            {skills.slice(Math.ceil(skills.length / 2)).map((s) => (
              <SkillRow key={s.id} skill={s} />
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeader eyebrow="Job transformation" title="Role-by-role impact" />
        <FilterChips
          basePath="/career"
          param="role"
          active={active}
          allLabel="All roles"
          options={ROLES.filter((r) => allImpacts.some((i) => i.role === r)).map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {impacts.map((imp) => (
            <Card key={imp.id} className="flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-accent">{ROLE_LABELS[imp.role]}</p>
                  <h3 className="mt-1 text-[16px] font-medium leading-snug text-fg">{imp.headline}</h3>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl text-fg tabular">{imp.exposure}</p>
                  <p className="text-[10.5px] text-fg-subtle">change index</p>
                </div>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-hot" style={{ width: `${imp.exposure}%` }} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TagList title="Tasks being automated" items={imp.automated} tone="down" />
                <TagList title="Tasks being augmented" items={imp.augmented} tone="neutral" />
                <TagList title="Skills increasing" items={imp.newSkills} tone="up" />
                <TagList title="Skills losing importance" items={imp.decliningSkills} tone="down" />
                <TagList title="New roles appearing" items={imp.newRoles} tone="accent" />
                <TagList title="Tools to learn" items={imp.tools} tone="neutral" />
              </div>
              <div className="rounded-xl border border-line bg-surface-2/60 p-4">
                <p className="mb-1 text-xs font-medium text-fg">What students should learn now</p>
                <p className="text-sm leading-relaxed text-fg-muted">{imp.studentAdvice}</p>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <span className="text-[10.5px] uppercase tracking-wide text-analysis">Analysis</span>
                <ConfidenceBadge confidence={imp.confidence} />
                <span>Sources:</span>
                {imp.sourceItemIds.map((id, i) => {
                  const s = sourceMap.get(id);
                  return s ? (
                    <Link key={id} href={`/intel/${id}`} title={s.title} className="font-mono text-accent hover:underline">
                      [{i + 1}]
                    </Link>
                  ) : null;
                })}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
