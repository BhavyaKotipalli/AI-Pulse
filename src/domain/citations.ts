import type { Claim } from "./analysis";

/**
 * Citation validator: removes references to sources that were not part of the
 * retrieved context. A "fact" left with no valid sources is downgraded.
 */
export function validateClaims(claims: Claim[], allowedIds: ReadonlySet<string>): Claim[] {
  return claims.map((claim) => {
    const sourceItemIds = claim.sourceItemIds.filter((id) => allowedIds.has(id));
    if (claim.label === "fact" && sourceItemIds.length === 0) {
      return { ...claim, sourceItemIds, label: "analysis", confidence: "low" };
    }
    return { ...claim, sourceItemIds };
  });
}

const MARKER = /\[(\d{1,2})\]/g;

/**
 * Validates `[n]` markers in a generated answer against the number of sources supplied.
 * Returns the cleaned text and the 1-based indices that were actually cited.
 */
export function validateCitationMarkers(
  text: string,
  sourceCount: number,
): { text: string; cited: number[]; removed: number } {
  const cited = new Set<number>();
  let removed = 0;
  const cleaned = text.replace(MARKER, (match, n: string) => {
    const idx = Number(n);
    if (idx >= 1 && idx <= sourceCount) {
      cited.add(idx);
      return match;
    }
    removed += 1;
    return "";
  });
  return { text: cleaned, cited: [...cited].sort((a, b) => a - b), removed };
}
