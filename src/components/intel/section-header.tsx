import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "View all",
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: Route;
  hrefLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">{eyebrow}</p>}
        <h2 className="text-[17px] font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-[13px] text-fg-muted transition-colors hover:text-fg">
          {hrefLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="relative mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
        <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-[-0.02em] text-fg">{title}</h1>
        {description && <p className="mt-2 text-pretty text-[15px] leading-relaxed text-fg-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-14 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-fg-muted">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
