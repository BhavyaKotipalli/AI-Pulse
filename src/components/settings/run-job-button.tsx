"use client";

import { Loader2, Play } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { triggerJob } from "@/server/actions/jobs";

export function RunJobButton({ job, label }: { job: "ingest" | "enrich" | "insights" | "daily"; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm" disabled={pending} onClick={() => start(async () => setResult(await triggerJob(job)))}>
        {pending ? <Loader2 className="animate-spin" /> : <Play />}
        {label}
      </Button>
      {result && <span className={cn("text-xs", result.ok ? "text-up" : "text-down")}>{result.message}</span>}
    </div>
  );
}
