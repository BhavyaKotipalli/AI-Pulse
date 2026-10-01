import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { DEMO_USER_ID } from "@/domain/constants";
import { env } from "@/lib/env";
import { getAuth } from "./auth";

export interface Viewer {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  /** True for the shared demo guest (not signed in). */
  isGuest: boolean;
}

/**
 * The current viewer. Signed-in users get their own data; in DEMO_MODE anonymous
 * visitors act as the shared demo guest so every feature is explorable without an account.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session?.user) {
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
      isGuest: false,
    };
  }
  if (env().DEMO_MODE) {
    return { id: DEMO_USER_ID, name: "Demo Explorer", email: null, image: null, isGuest: true };
  }
  return null;
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new UnauthorizedError();
  return viewer;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in required");
    this.name = "UnauthorizedError";
  }
}
