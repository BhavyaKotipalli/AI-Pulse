export interface MatchableEntity {
  id: string;
  name: string;
  aliases: string[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Surface forms for an entity: its name without parentheticals, plus aliases. */
function surfaceForms(e: MatchableEntity): string[] {
  const base = e.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  return [...new Set([base, ...e.aliases].map((s) => s.trim()).filter((s) => s.length >= 2))];
}

/**
 * Dictionary-based entity linking — deterministic and free. Short all-caps acronyms
 * (MCP, RAG, GPT) match case-sensitively to avoid hits on ordinary words; everything
 * else matches case-insensitively on word boundaries.
 */
export function buildEntityMatcher(entities: MatchableEntity[]) {
  const patterns = entities.flatMap((e) =>
    surfaceForms(e).map((form) => {
      const acronym = /^[A-Z0-9]{2,5}$/.test(form);
      return { id: e.id, re: new RegExp(`(?<![\\w-])${escapeRe(form)}(?![\\w])`, acronym ? "" : "i") };
    }),
  );
  return (text: string): string[] => {
    const found: string[] = [];
    for (const p of patterns) if (!found.includes(p.id) && p.re.test(text)) found.push(p.id);
    return found;
  };
}
