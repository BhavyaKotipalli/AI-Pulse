"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useState } from "react";
import { authClient } from "@/server/auth/auth-client";

export function UserMenu({ name, email, isGuest }: { name: string; email: string | null; isGuest: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function signOut() {
    setPending(true);
    setError(null);
    const { error: err } = await authClient.signOut();
    setPending(false);
    if (err) setError(err.message ?? "Sign out failed");
    else router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface-3 text-[11px] font-semibold text-fg-muted">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-fg">{name}</p>
        <p className="truncate text-[11px] text-fg-subtle">{error ?? (isGuest ? "Guest · demo mode" : email)}</p>
      </div>
      {isGuest ? (
        <Link
          href="/sign-in"
          aria-label="Sign in"
          className="inline-flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg"
        >
          <LogIn className="size-4" />
        </Link>
      ) : (
        <button
          type="button"
          onClick={signOut}
          disabled={pending}
          aria-label="Sign out"
          className="inline-flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          <LogOut className="size-4" />
        </button>
      )}
    </div>
  );
}
