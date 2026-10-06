"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BuildPlanSchema } from "@/domain/analysis";
import { logger } from "@/lib/logger";
import { ai } from "@/server/ai/gateway";
import { getViewer } from "@/server/auth/viewer";
import { getDb } from "@/server/db/client";
import { experiments } from "@/server/db/schema";
import { aiStatus } from "@/services/ai/registry";
import { BudgetExceededError, RateLimitError } from "@/services/ai/types";
import { canRunJobs } from "./jobs";

export interface AiTestResult {
  ok: boolean;
  lines: string[];
}

const describe = (err: unknown) => (err instanceof Error ? err.message : "Unknown error");

/** Makes one tiny call per capability and reports what worked. Error text never includes credentials. */
export async function testAiConnection(): Promise<AiTestResult> {
  if (!(await canRunJobs())) return { ok: false, lines: ["Only admins can test the AI connection."] };
  const status = aiStatus();
  if (status.isMock && status.embeddingsMock) {
    return { ok: false, lines: ["No AI provider is configured — running on the offline mock.", ...status.notes] };
  }
  const gw = ai({ interactive: true });
  const lines: string[] = [];
  let ok = true;
  const step = async (label: string, fn: () => Promise<string>) => {
    const started = Date.now();
    try {
      lines.push(`OK  ${label}: ${await fn()} (${Date.now() - started} ms)`);
    } catch (err) {
      ok = false;
      lines.push(`FAIL ${label}: ${describe(err)}`);
    }
  };
  if (!status.isMock) {
    for (const tier of ["fast", "strong"] as const) {
      await step(`${tier} model ${status.models[tier]}`, async () => {
        const r = await gw.llm.generate({ tier, task: "connection-test", messages: [{ role: "user", content: "Reply with the single word: ready" }], maxOutputTokens: 256 });
        return `replied "${r.text.trim().slice(0, 40)}"`;
      });
    }
    await step("structured output", async () => {
      const r = await gw.llm.generateObject(
        { tier: "fast", task: "connection-test", messages: [{ role: "user", content: "Return status ok and the number 3." }], maxOutputTokens: 512 },
        z.object({ status: z.string(), number: z.number() }),
      );
      return `valid JSON (${r.status}, ${r.number})`;
    });
  }
  if (!status.embeddingsMock) {
    await step(`embeddings ${status.embeddings}`, async () => {
      const [v] = await gw.embed(["connection test"], "query");
      return `${v?.length ?? 0} dimensions`;
    });
  }
  return { ok, lines };
}

const PLAN_SYSTEM = `You are a senior engineer writing a build plan for a hands-on AI project. Given the experiment brief, produce a practical plan a developer can follow over the stated time.
- milestones: ordered, each with a concrete outcome and specific tasks.
- repoStructure: suggested files/folders as paths with a short purpose after " — ".
- evaluation: how to measure whether the project worked (metrics, test sets, comparisons).
- risks: what commonly goes wrong and how to de-risk it.
- stretchGoals: optional extensions.
Use only openly available tools and free tiers where possible. Do not invent library names; if unsure, describe the capability generically.`;

/** "Build this": generates (once) and caches a detailed implementation plan for an experiment. */
export async function generateBuildPlan(experimentId: string): Promise<{ ok: boolean; error?: string }> {
  const id = z.string().min(1).max(100).safeParse(experimentId);
  if (!id.success) return { ok: false, error: "Invalid experiment" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Sign in to generate build plans" };
  const gw = ai({ interactive: true });
  if (gw.llm.isMock) return { ok: false, error: "Build plans need an AI provider. Add a free API key (see Settings)." };

  const db = getDb();
  const [exp] = await db.select().from(experiments).where(eq(experiments.id, id.data)).limit(1);
  if (!exp) return { ok: false, error: "Experiment not found" };
  if (exp.plan) return { ok: true };
  try {
    const brief = [
      `<title>${exp.title}</title>`,
      `<summary>${exp.summary}</summary>`,
      `<difficulty>${exp.difficulty}</difficulty>`,
      `<time>${exp.timeEstimate}</time>`,
      `<architecture>${exp.architecture}</architecture>`,
      `<technologies>${exp.technologies.join(", ")}</technologies>`,
      `<data>${exp.dataRequirements}</data>`,
      `<expected_result>${exp.expectedResult}</expected_result>`,
      `<outline>\n${exp.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.detail}`).join("\n")}\n</outline>`,
    ].join("\n");
    const plan = await gw.llm.generateObject(
      { tier: "strong", task: "build-plan", system: PLAN_SYSTEM, messages: [{ role: "user", content: `<experiment>\n${brief}\n</experiment>` }], maxOutputTokens: 6000 },
      BuildPlanSchema,
    );
    await db.update(experiments).set({ plan }).where(eq(experiments.id, exp.id));
  } catch (err) {
    logger.warn({ err: describe(err), experimentId: exp.id }, "build plan generation failed");
    if (err instanceof BudgetExceededError) return { ok: false, error: err.message };
    if (err instanceof RateLimitError) return { ok: false, error: "The AI provider is rate limiting requests. Try again in a minute." };
    return { ok: false, error: "The plan could not be generated. Please try again." };
  }
  revalidatePath(`/experiments/${exp.slug}`);
  return { ok: true };
}
