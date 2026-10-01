/**
 * Detects "what's new" questions that should be answered from the highest-ranked recent
 * items rather than by lexical similarity (e.g. "What happened in AI today?").
 * Returns the look-back window in hours, or null when the question is topical.
 */
export function temporalWindowHours(question: string): number | null {
  const q = question.toLowerCase();
  if (/\b(today|tonight|this morning|last 24 hours|right now)\b/.test(q)) return 24;
  if (/\b(this week|past week|last week|last 7 days|recently|lately)\b/.test(q)) return 24 * 7;
  if (/\b(this month|past month|last month|last 30 days)\b/.test(q)) return 24 * 30;
  if (/\b(latest|newest|biggest|most important|top)\b.*\b(news|stories|developments?|updates?|happen(ed|ing)?)\b/.test(q)) return 24 * 3;
  return null;
}
