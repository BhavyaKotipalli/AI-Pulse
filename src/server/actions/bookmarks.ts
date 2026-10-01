"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BOOKMARK_TARGETS, COLLECTIONS } from "@/domain/taxonomy";
import { logger } from "@/lib/logger";
import { getViewer } from "@/server/auth/viewer";
import { addBookmark, recordEvent, removeBookmark } from "@/server/repositories/user-data";

const Input = z.object({
  targetType: z.enum(BOOKMARK_TARGETS),
  targetId: z.string().min(1).max(100),
  collection: z.enum(COLLECTIONS),
  saved: z.boolean(),
  topics: z.array(z.string().max(60)).max(20).default([]),
});

export type ToggleBookmarkResult = { ok: true } | { ok: false; error: string };

export async function toggleBookmark(raw: z.input<typeof Input>): Promise<ToggleBookmarkResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid bookmark request" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to save intelligence" };

  const { targetType, targetId, collection, saved, topics } = parsed.data;
  try {
    if (saved) {
      await addBookmark(viewer.id, targetType, targetId, collection);
      await recordEvent(viewer.id, "save", { type: targetType, id: targetId }, topics);
    } else {
      await removeBookmark(viewer.id, targetType, targetId, collection);
    }
  } catch (err) {
    logger.error({ err, targetType, targetId }, "bookmark toggle failed");
    return { ok: false, error: "Could not update your library. Please try again." };
  }
  revalidatePath("/library");
  return { ok: true };
}
