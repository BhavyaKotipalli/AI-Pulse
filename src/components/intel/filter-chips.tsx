import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/** Server-rendered filter chips driven by a URL search param (shareable, no client JS). */
export function FilterChips({
  basePath,
  param,
  options,
  active,
  allLabel = "All",
}: {
  basePath: string;
  param: string;
  options: Array<{ value: string; label: string; count?: number }>;
  active: string | undefined;
  allLabel?: string;
}) {
  const chip = (value: string | undefined, label: string, count?: number) => {
    const href = (value ? `${basePath}?${param}=${encodeURIComponent(value)}` : basePath) as Route;
    const isActive = active === value;
    return (
      <Link
        key={value ?? "__all"}
        href={href}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
          isActive ? "border-accent/40 bg-accent-soft text-accent-strong" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
        )}
      >
        {label}
        {count !== undefined && <span className="font-mono text-[11px] opacity-60">{count}</span>}
      </Link>
    );
  };
  return (
    <div className="mb-6 flex flex-wrap gap-2" role="navigation" aria-label="Filters">
      {chip(undefined, allLabel)}
      {options.map((o) => chip(o.value, o.label, o.count))}
    </div>
  );
}
