import Link from "next/link";
import { CommandPaletteProvider } from "@/components/shell/command-palette";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { UserMenu } from "@/components/shell/user-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { env } from "@/lib/env";
import { getViewer } from "@/server/auth/viewer";
import { aiStatus } from "@/services/ai/registry";

export const dynamic = "force-dynamic";

function AIStatusPill() {
  const status = aiStatus();
  return (
    <Tooltip
      content={
        status.isMock
          ? (status.note ??
            "No AI provider configured. Answers are composed extractively from retrieved sources; enrichment uses precomputed demo analysis.")
          : `Live provider: ${status.active}`
      }
      side="bottom"
    >
      <Link
        href="/settings"
        className="inline-flex h-8 items-center gap-2 rounded-lg border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
      >
        <span className={status.isMock ? "size-1.5 rounded-full bg-warn" : "size-1.5 animate-pulse-ring rounded-full bg-up"} />
        {status.isMock ? "Offline AI" : status.active}
      </Link>
    </Tooltip>
  );
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  const demo = env().DEMO_MODE;
  const footer = viewer ? (
    <UserMenu name={viewer.name} email={viewer.email} isGuest={viewer.isGuest} />
  ) : (
    <Link href="/sign-in" className="block rounded-lg px-3 py-2 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
      Sign in to personalize
    </Link>
  );

  return (
    <CommandPaletteProvider>
      <div className="flex min-h-dvh">
        <Sidebar footer={footer} />
        <div className="flex min-w-0 flex-1 flex-col">
          {demo && (
            <div className="border-b border-warn/15 bg-warn/[0.06] px-4 py-1.5 text-center text-[12px] text-warn/90 sm:px-6">
              Demo dataset — real developments, papers and repositories with <strong className="font-medium">simulated dates</strong> and
              approximate metrics. Live ingestion replaces this in Phase 2.
            </div>
          )}
          <Topbar status={<AIStatusPill />} footer={footer} />
          <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
