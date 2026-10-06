import { z, type ZodType } from "zod";
import { ProviderError, type GenerateRequest, type GenerateResult } from "./types";

/** Extracts the first JSON value from model output, tolerating code fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new SyntaxError("No JSON found in model output");
  }
}

/**
 * Provider-agnostic structured generation: asks for JSON matching the schema, validates
 * with Zod, and makes one repair attempt that shows the model its validation errors.
 * Invalid output never reaches the database — after the repair attempt it throws.
 */
export async function generateStructured<T>(
  generate: (req: GenerateRequest) => Promise<GenerateResult>,
  req: GenerateRequest,
  schema: ZodType<T>,
): Promise<T> {
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const system = `${req.system ?? ""}\n\nRespond with a single JSON value that validates against this JSON Schema. Output JSON only — no prose, no code fences.\n${jsonSchema}`.trim();
  const base: GenerateRequest = { ...req, system, json: true, temperature: req.temperature ?? 0.2 };

  const first = await generate(base);
  const attempt = tryParse(first.text, schema);
  if (attempt.ok) return attempt.value;

  const repair = await generate({
    ...base,
    messages: [
      ...req.messages,
      { role: "assistant", content: first.text.slice(0, 6000) },
      { role: "user", content: `That output was invalid: ${attempt.error}\nReturn the corrected JSON only.` },
    ],
  });
  const second = tryParse(repair.text, schema);
  if (second.ok) return second.value;
  throw new ProviderError(`Structured output for task "${req.task}" failed validation after repair: ${second.error}`);
}

function tryParse<T>(text: string, schema: ZodType<T>): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const parsed = schema.safeParse(extractJson(text));
    if (parsed.success) return { ok: true, value: parsed.data };
    return { ok: false, error: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unparseable JSON" };
  }
}
