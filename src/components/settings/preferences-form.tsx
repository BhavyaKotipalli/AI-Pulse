"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { INTEREST_LABELS, INTERESTS, ROLE_LABELS, ROLES, type Interest, type Role } from "@/domain/taxonomy";
import { cn } from "@/lib/utils";
import { updatePreferences } from "@/server/actions/preferences";

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
        on ? "border-accent/40 bg-accent-soft text-accent-strong" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
      )}
    >
      {on && <Check className="size-3.5" />}
      {label}
    </button>
  );
}

export function PreferencesForm({ initialInterests, initialRoles }: { initialInterests: Interest[]; initialRoles: Role[] }) {
  const [interests, setInterests] = useState(new Set(initialInterests));
  const [roles, setRoles] = useState(new Set(initialRoles));
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const flip = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-fg">Interests</p>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => (
            <Toggle key={i} on={interests.has(i)} label={INTEREST_LABELS[i]} onClick={() => setInterests((s) => flip(s, i))} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-fg">Your roles</p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <Toggle key={r} on={roles.has(r)} label={ROLE_LABELS[r]} onClick={() => setRoles((s) => flip(s, r))} />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await updatePreferences({ interests: [...interests], roles: [...roles] });
              setStatus(res.ok ? { ok: true, message: "Saved — your For You feed is updated." } : { ok: false, message: res.error ?? "Failed" });
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />}
          Save preferences
        </Button>
        {status && <p className={cn("text-sm", status.ok ? "text-up" : "text-down")}>{status.message}</p>}
      </div>
    </div>
  );
}
