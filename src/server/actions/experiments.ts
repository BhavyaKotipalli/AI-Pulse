"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getViewer } from "@/server/auth/viewer";
import { addBookmark, recordEvent } from "@/server/repositories/user-data";

const Input = z.object({ experimentId: z.string().min(1).max(100), skills: z.array(z.string().max(80)).max(20) });

/** "Start building": tracks the experiment as an active project and feeds personalization. */
export async function startExperiment(raw: z.input<typeof Input>): Promise<{ ok: boolean; error?: string }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to track projects" };
  try {
    await addBookmark(viewer.id, "experiment", parsed.data.experimentId, "project_ideas");
    await recordEvent(viewer.id, "experiment_start", { type: "experiment", id: parsed.data.experimentId }, parsed.data.skills);
  } catch (err) {
    logger.error({ err }, "startExperiment failed");
    return { ok: false, error: "Could not start this experiment. Please try again." };
  }
  revalidatePath("/library");
  return { ok: true };
}
