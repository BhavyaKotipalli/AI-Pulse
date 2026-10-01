"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-down">Something broke</p>
      <h1 className="mt-2 text-xl font-semibold text-fg">We couldn&apos;t load this intelligence</h1>
      <p className="mt-2 text-sm text-fg-muted">
        The error has been logged{error.digest ? ` (ref ${error.digest})` : ""}. If you are running locally, make sure the database is set up with
        <code className="mx-1 rounded bg-surface-3 px-1 font-mono text-xs">npm run setup</code>.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
