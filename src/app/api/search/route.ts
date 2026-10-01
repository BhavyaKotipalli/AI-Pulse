import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { globalSearch } from "@/server/repositories/search";

const Query = z.object({ q: z.string().trim().min(1).max(200) });

export async function GET(req: NextRequest) {
  const parsed = Query.safeParse({ q: req.nextUrl.searchParams.get("q") ?? "" });
  if (!parsed.success) return NextResponse.json({ hits: [] });

  const limit = rateLimit(`search:${clientKey(req)}`, { capacity: 30, refillPerMinute: 60 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } });
  }

  try {
    const hits = await globalSearch(parsed.data.q);
    return NextResponse.json({ hits });
  } catch (err) {
    logger.error({ err }, "search failed");
    return NextResponse.json({ error: "Search is temporarily unavailable" }, { status: 500 });
  }
}
