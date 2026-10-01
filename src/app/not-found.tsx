import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">No intelligence here</h1>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">This page doesn&apos;t exist, or the item it pointed to has been removed.</p>
      <Button asChild variant="primary" className="mt-6">
        <Link href="/">Back to overview</Link>
      </Button>
    </div>
  );
}
