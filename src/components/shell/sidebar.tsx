"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NAV_GROUPS, isActive } from "./nav";

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, Icon, shortcut }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors",
                      active ? "bg-surface-3 text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <Icon className={cn("size-4", active ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
                    <span className="flex-1 truncate">{label}</span>
                    {shortcut && (
                      <span className="hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 xl:flex" aria-hidden>
                        <Kbd>G</Kbd>
                        <Kbd>{shortcut.toUpperCase()}</Kbd>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ footer }: { footer: React.ReactNode }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-bg lg:flex">
      <div className="flex h-14 items-center px-5">
        <Link href="/" aria-label="AI Pulse home">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavList />
      </div>
      <div className="border-t border-line p-3">{footer}</div>
    </aside>
  );
}
