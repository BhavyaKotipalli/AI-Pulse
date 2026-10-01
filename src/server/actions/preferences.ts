"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { INTERESTS, ROLES } from "@/domain/taxonomy";
import { logger } from "@/lib/logger";
import { getViewer } from "@/server/auth/viewer";
import { savePreferences } from "@/server/repositories/user-data";

const Input = z.object({
  interests: z.array(z.enum(INTERESTS)).max(INTERESTS.length),
  roles: z.array(z.enum(ROLES)).max(ROLES.length),
});

export async function updatePreferences(raw: z.input<typeof Input>): Promise<{ ok: boolean; error?: string }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid preferences" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to save preferences" };
  try {
    await savePreferences(viewer.id, parsed.data.interests, parsed.data.roles);
  } catch (err) {
    logger.error({ err }, "updatePreferences failed");
    return { ok: false, error: "Could not save preferences" };
  }
  revalidatePath("/for-you");
  revalidatePath("/settings");
  return { ok: true };
}
