import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/intel/section-header";
import { StoryCard } from "@/components/intel/story-card";
import { Button } from "@/components/ui/button";
import { personalize } from "@/domain/personalization";
import { INTEREST_LABELS } from "@/domain/taxonomy";
import { getViewer } from "@/server/auth/viewer";
import { entitySlugsFor, listItems } from "@/server/repositories/items";
import { bookmarkState, engagedTopics, getPreferences } from "@/server/repositories/user-data";

export const metadata: Metadata = { title: "For You" };

export default async function ForYouPage() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <EmptyState title="Sign in for a personalized feed" description="Your interests and saved items shape this feed.">
        <Button asChild variant="primary">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </EmptyState>
    );
  }
  const [prefs, topics, candidates] = await Promise.all([
    getPreferences(viewer.id),
    engagedTopics(viewer.id),
    listItems({ sinceHours: 24 * 14, limit: 60 }),
  ]);
  const slugs = await entitySlugsFor(candidates.map((c) => c.id));
  const ranked = personalize(
    candidates.map((c) => ({ id: c.id, score: c.score, category: c.category, tags: c.tags, entitySlugs: slugs.get(c.id) ?? [] })),
    prefs.interests,
    topics,
  ).slice(0, 20);
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const saved = await bookmarkState(viewer.id, "item", ranked.map((r) => r.id));

  return (
    <div>
      <PageHeader
        eyebrow="For you"
        title="Your intelligence feed"
        description="Ranked by intelligence score, boosted by the interests you follow and the topics you save. Every boost is explained."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Edit interests</Link>
        </Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {prefs.interests.length === 0 ? (
          <p className="text-sm text-fg-subtle">You don&apos;t follow any interests yet — the feed is ranked by score alone.</p>
        ) : (
          prefs.interests.map((i) => (
            <span key={i} className="rounded-full border border-accent/25 bg-accent-soft px-2.5 py-1 text-xs text-accent-strong">
              {INTEREST_LABELS[i]}
            </span>
          ))
        )}
      </div>

      <ol className="space-y-3">
        {ranked.map((r) => {
          const item = byId.get(r.id)!;
          return (
            <li key={r.id}>
              <StoryCard item={item} saved={saved.get(r.id)} />
              {r.reasons.length > 0 && (
                <p className="mt-1.5 pl-5 text-[11.5px] text-fg-subtle">
                  <span className="text-fg-muted">Why you&apos;re seeing this:</span> {r.reasons.join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
