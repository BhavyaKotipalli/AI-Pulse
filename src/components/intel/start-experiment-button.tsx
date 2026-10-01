"use client";

import Link from "next/link";
import { Check, Hammer, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { startExperiment } from "@/server/actions/experiments";

export function StartExperimentButton({ experimentId, skills, started: initial }: { experimentId: string; skills: string[]; started: boolean }) {
  const [started, setStarted] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (started) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-up">
          <Check className="size-4" /> Tracking in your projects
        </span>
        <Link href="/library?collection=project_ideas" className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline">
          Open library
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="accent"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await startExperiment({ experimentId, skills });
            if (res.ok) setStarted(true);
            else setError(res.error ?? "Something went wrong");
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Hammer />}
        Build this experiment
      </Button>
      {error && <p className="text-xs text-down">{error}</p>}
    </div>
  );
}
