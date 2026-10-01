import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="6.5" fill="var(--color-surface-3)" stroke="var(--color-line-strong)" />
      <path
        d="M4.5 12.5h3.2l1.9-4.6 3.1 8.6 2.2-5.4 1.2 1.4h3.4"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        AI Pulse
      </span>
    </span>
  );
}
