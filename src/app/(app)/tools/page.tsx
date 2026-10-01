import type { Metadata } from "next";
import { EmptyState, PageHeader, SectionHeader } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { getViewer } from "@/server/auth/viewer";
import { listItems } from "@/server/repositories/items";
import { bookmarkState } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "Tools" };

export default async function ToolsPage() {
  const viewer = await getViewer();
  const [tools, launches] = await Promise.all([listItems({ kinds: ["tool"], limit: 30 }), listItems({ kinds: ["launch"], limit: 30, sort: "recent" })]);
  const saved = viewer ? await bookmarkState(viewer.id, "item", [...tools, ...launches].map((t) => t.id)) : new Map();

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Tools"
        title="AI tools worth trying"
        description="Developer tools, platforms and product launches — ranked by career relevance and real adoption signals, not hype."
      />
      <section>
        <SectionHeader title="Tools" description="Products you can use today." />
        {tools.length === 0 ? (
          <EmptyState title="No tools tracked yet" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tools.map((t) => (
              <StoryCard key={t.id} item={t} saved={saved.get(t.id)} />
            ))}
          </div>
        )}
      </section>
      <section>
        <SectionHeader title="Recent launches" description="APIs, SDKs and platform releases." />
        {launches.length === 0 ? (
          <EmptyState title="No launches tracked yet" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {launches.map((t) => (
              <StoryCard key={t.id} item={t} saved={saved.get(t.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
