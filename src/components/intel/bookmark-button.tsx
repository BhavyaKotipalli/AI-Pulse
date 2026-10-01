"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bookmark, BookmarkCheck, Check } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { COLLECTION_LABELS, COLLECTIONS, type BookmarkTarget, type Collection } from "@/domain/taxonomy";
import { cn } from "@/lib/utils";
import { toggleBookmark } from "@/server/actions/bookmarks";

export function BookmarkButton({
  targetType,
  targetId,
  saved: initial = [],
  defaultCollection = "read_later",
  topics = [],
  className,
}: {
  targetType: BookmarkTarget;
  targetId: string;
  saved?: Collection[];
  defaultCollection?: Collection;
  topics?: string[];
  className?: string;
}) {
  const [saved, setSaved] = useState<Collection[]>(initial);
  const [optimistic, applyOptimistic] = useOptimistic(saved, (state, change: { collection: Collection; on: boolean }) =>
    change.on ? [...new Set([...state, change.collection])] : state.filter((c) => c !== change.collection),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const isSaved = optimistic.length > 0;

  function toggle(collection: Collection) {
    const on = !optimistic.includes(collection);
    setError(null);
    startTransition(async () => {
      applyOptimistic({ collection, on });
      const result = await toggleBookmark({ targetType, targetId, collection, saved: on, topics });
      if (result.ok) setSaved((prev) => (on ? [...new Set([...prev, collection])] : prev.filter((c) => c !== collection)));
      else setError(result.error);
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={isSaved ? "Saved — change collections" : "Save to library"}
          title={error ?? undefined}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg data-[state=open]:bg-surface-3",
            isSaved && "text-accent-strong",
            error && "text-down",
            className,
          )}
        >
          {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-52 animate-fade-up rounded-xl border border-line-strong bg-surface-2 p-1 shadow-2xl shadow-black/50"
        >
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 font-mono text-[10.5px] uppercase tracking-wider text-fg-subtle">
            Save to collection
          </DropdownMenu.Label>
          {[defaultCollection, ...COLLECTIONS.filter((c) => c !== defaultCollection)].map((c) => (
            <DropdownMenu.Item
              key={c}
              onSelect={(e) => {
                e.preventDefault();
                toggle(c);
              }}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px] text-fg-muted outline-none data-[highlighted]:bg-surface-3 data-[highlighted]:text-fg"
            >
              {COLLECTION_LABELS[c]}
              {optimistic.includes(c) && <Check className="size-3.5 text-accent-strong" />}
            </DropdownMenu.Item>
          ))}
          {error && <p className="px-2.5 py-1.5 text-xs text-down">{error}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
