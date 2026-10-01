import type { Metadata } from "next";
import { PageHeader, SectionHeader } from "@/components/intel/section-header";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { RunJobButton } from "@/components/settings/run-job-button";
import { relativeTime } from "@/lib/utils";
import { canRunJobs } from "@/server/actions/jobs";
import { recentJobRuns } from "@/server/jobs/runner";
import { sourcesOverview } from "@/server/repositories/ops";
import { Card } from "@/components/ui/card";
import { env } from "@/lib/env";
import { getViewer } from "@/server/auth/viewer";
import { getDbHandle } from "@/server/db/client";
import { getPreferences, usageSummary } from "@/server/repositories/user-data";
import { aiStatus } from "@/services/ai/registry";

export const metadata: Metadata = { title: "Settings" };

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-1 font-mono text-2xl text-fg tabular">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>}
    </Card>
  );
}

export default async function SettingsPage() {
  const viewer = await getViewer();
  const [prefs, usage, srcs, runs, admin] = await Promise.all([
    viewer ? getPreferences(viewer.id) : Promise.resolve({ interests: [], roles: [] }),
    usageSummary(30),
    sourcesOverview(),
    recentJobRuns(8),
    canRunJobs(),
  ]);
  const status = aiStatus();
  const e = env();
  const nf = new Intl.NumberFormat("en");

  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Settings" title="Personalization & system" description="Tune what AI Pulse prioritizes for you and monitor AI usage and cost." />

      <section>
        <SectionHeader title="Interests" description="Interests boost matching stories in your For You feed (+12% per match, up to 3)." />
        <Card className="p-6">
          {viewer ? (
            <PreferencesForm initialInterests={prefs.interests} initialRoles={prefs.roles} />
          ) : (
            <p className="text-sm text-fg-muted">Sign in to set your interests.</p>
          )}
          {viewer?.isGuest && <p className="mt-4 text-xs text-fg-subtle">You are the shared demo guest — changes are visible to other demo visitors.</p>}
        </Card>
      </section>

      <section>
        <SectionHeader title="AI usage · last 30 days" description="Every model call is metered. Costs are estimates from provider list prices." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Requests" value={nf.format(usage.totals.requests)} />
          <Stat label="Input tokens" value={nf.format(usage.totals.inputTokens)} hint="Estimated (≈4 chars/token) for the mock provider" />
          <Stat label="Output tokens" value={nf.format(usage.totals.outputTokens)} />
          <Stat label="Estimated cost" value={`$${usage.totals.costUsd.toFixed(4)}`} hint={`Daily budget $${e.AI_DAILY_BUDGET_USD.toFixed(2)}`} />
        </div>
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="px-5 py-3 font-normal">Task</th>
                <th className="px-3 py-3 font-normal">Provider / model</th>
                <th className="px-3 py-3 text-right font-normal">Requests</th>
                <th className="px-3 py-3 text-right font-normal">Tokens</th>
                <th className="px-5 py-3 text-right font-normal">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usage.byTask.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-fg-subtle">
                    No AI calls yet. Ask a question to see metering in action.
                  </td>
                </tr>
              ) : (
                usage.byTask.map((r) => (
                  <tr key={`${r.task}-${r.model}`}>
                    <td className="px-5 py-3 text-fg">{r.task}</td>
                    <td className="px-3 py-3 font-mono text-xs text-fg-muted">
                      {r.provider} / {r.model}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{nf.format(r.requests)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{nf.format(r.tokens)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs tabular">${r.costUsd.toFixed(4)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <SectionHeader
          title="Sources & ingestion"
          description="Live connectors run on a schedule (Vercel Cron). Each source is fetched independently; one failing feed never blocks the others."
        />
        {admin && (
          <Card className="mb-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-6">
            <RunJobButton job="ingest" label="Run ingestion now" />
            <RunJobButton job="daily" label="Rebuild briefing & scores" />
          </Card>
        )}
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="px-5 py-3 font-normal">Source</th>
                <th className="px-3 py-3 font-normal">Type</th>
                <th className="px-3 py-3 text-right font-normal">Credibility</th>
                <th className="px-3 py-3 text-right font-normal">Items</th>
                <th className="px-5 py-3 font-normal">Last fetched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {srcs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-fg-subtle">
                    No live sources yet — the first ingestion run registers them.
                  </td>
                </tr>
              ) : (
                srcs.map((src) => (
                  <tr key={src.slug}>
                    <td className="px-5 py-3">
                      <a href={src.homepage ?? "#"} target="_blank" rel="noreferrer" className="text-fg hover:underline">
                        {src.name}
                      </a>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-fg-muted">{src.kind}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{src.credibility.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right font-mono text-xs tabular">{src.items}</td>
                    <td className="px-5 py-3 text-xs text-fg-muted">{src.lastFetchedAt ? relativeTime(src.lastFetchedAt) : "never"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
        {runs.length > 0 && (
          <Card className="mt-4 divide-y divide-line text-sm">
            {runs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="w-16 font-mono text-xs text-fg">{r.job}</span>
                <span className={r.status === "succeeded" ? "text-xs text-up" : r.status === "failed" ? "text-xs text-down" : "text-xs text-warn"}>{r.status}</span>
                <span className="text-xs text-fg-subtle">{relativeTime(r.startedAt)}</span>
                <span className="ml-auto truncate font-mono text-[11px] text-fg-subtle">
                  {r.error ??
                    Object.entries(r.stats)
                      .filter(([, v]) => typeof v === "number")
                      .slice(0, 4)
                      .map(([k, v]) => `${k} ${v}`)
                      .join(" · ")}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section>
        <SectionHeader title="System" />
        <Card className="divide-y divide-line text-sm">
          {[
            ["AI provider", status.isMock ? `Offline mock (configured: ${status.configured})` : status.active],
            ["Embeddings", status.isMock ? "Feature-hashed 768-d (offline)" : "Provider embeddings"],
            ["Database", getDbHandle().driver === "pglite" ? "Embedded PGlite + pgvector (.data/pglite)" : "PostgreSQL + pgvector"],
            ["Demo mode", e.DEMO_MODE ? "On — guests use a shared demo account" : "Off"],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:justify-between">
              <span className="text-fg-muted">{k}</span>
              <span className="font-mono text-xs text-fg">{v}</span>
            </div>
          ))}
          {status.note && <p className="px-5 py-3.5 text-xs text-warn">{status.note}</p>}
        </Card>
      </section>
    </div>
  );
}
