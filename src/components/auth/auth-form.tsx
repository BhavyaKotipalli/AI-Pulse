"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/server/auth/auth-client";

const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface-1 px-3 text-sm text-fg outline-none placeholder:text-fg-subtle focus:border-accent/40";

export function AuthForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "");
    setPending(true);
    setError(null);
    const { error: err } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name || email.split("@")[0]! });
    setPending(false);
    if (err) {
      setError(err.message ?? "Authentication failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {githubEnabled && (
        <>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github", callbackURL: "/" })}
          >
            <svg viewBox="0 0 16 16" aria-hidden className="size-4 fill-current"><path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg> Continue with GitHub
          </Button>
          <div className="flex items-center gap-3 text-xs text-fg-subtle">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "sign-up" && <input name="name" placeholder="Name" autoComplete="name" className={inputClass} aria-label="Name" />}
        <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputClass} aria-label="Email" />
        <input
          name="password"
          type="password"
          required
          minLength={10}
          placeholder="Password (10+ characters)"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className={inputClass}
          aria-label="Password"
        />
        {error && <p className="text-sm text-down">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <p className="text-center text-sm text-fg-muted">
        {mode === "sign-in" ? "New to AI Pulse?" : "Already have an account?"}{" "}
        <button type="button" className="text-accent hover:underline" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
          {mode === "sign-in" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
