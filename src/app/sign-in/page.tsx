import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/shell/logo";
import { env } from "@/lib/env";
import { isGithubEnabled } from "@/server/auth/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4">
      <div className="aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center" aria-label="AI Pulse home">
          <Logo />
        </Link>
        <div className="rounded-2xl border border-line bg-surface-1/90 p-7 shadow-2xl shadow-black/40">
          <h1 className="text-xl font-semibold tracking-tight text-fg">Welcome back</h1>
          <p className="mb-6 mt-1 text-sm text-fg-muted">Sign in for a private library, personalized feed and conversation history.</p>
          <AuthForm githubEnabled={isGithubEnabled()} />
        </div>
        {env().DEMO_MODE && (
          <p className="mt-6 text-center text-sm text-fg-subtle">
            Or{" "}
            <Link href="/" className="text-fg-muted underline-offset-4 hover:underline">
              continue as the demo guest
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
