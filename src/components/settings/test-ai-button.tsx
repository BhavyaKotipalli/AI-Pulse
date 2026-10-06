"use client";

import { Loader2, PlugZap } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { testAiConnection, type AiTestResult } from "@/server/actions/ai";

export function TestAiButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiTestResult | null>(null);
  return (
    <div className="space-y-3">
      <Button size="sm" disabled={pending} onClick={() => start(async () => setResult(await testAiConnection()))}>
        {pending ? <Loader2 className="animate-spin" /> : <PlugZap />}
        Test AI connection
      </Button>
      {result && (
        <ul className="space-y-1 font-mono text-[11.5px]" aria-live="polite">
          {result.lines.map((l) => (
            <li key={l} className={cn(l.startsWith("OK") ? "text-up" : l.startsWith("FAIL") ? "text-down" : "text-fg-muted")}>
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
