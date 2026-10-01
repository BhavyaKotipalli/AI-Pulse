"use client";

import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Box, FileSearch, FlaskConical, Loader2, MessageSquareText, Rocket, Search, TrendingUp } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/server/repositories/search";
import { NAV_ITEMS } from "./nav";

const PaletteContext = createContext<{ open: (query?: string) => void }>({ open: () => {} });
export const useCommandPalette = () => useContext(PaletteContext);

const HIT_ICON: Record<SearchHit["type"], typeof Box> = {
  item: FileSearch,
  trend: TrendingUp,
  experiment: FlaskConical,
  startup: Rocket,
  entity: Box,
};
const HIT_GROUP: Record<SearchHit["type"], string> = {
  item: "Intelligence",
  trend: "Trends",
  experiment: "Experiments",
  startup: "Startups",
  entity: "Companies, models & technologies",
};

function isTypingTarget(el: EventTarget | null) {
  return el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingG = useRef<number | null>(null);

  const openPalette = useCallback((q = "") => {
    setQuery(q);
    setOpen(true);
  }, []);

  // Global shortcuts: ⌘K / Ctrl+K, "/", and "g <key>" navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current);
        pendingG.current = null;
        const target = NAV_ITEMS.find((n) => n.shortcut === e.key.toLowerCase());
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 900);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, openPalette]);

  // Debounced server search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 429 ? "Slow down — too many searches" : "Search failed");
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href as Route);
    },
    [router],
  );

  const q = query.trim().toLowerCase();
  const navMatches = useMemo(
    () => NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)),
    [q],
  );
  // Results only apply to queries long enough to search; stale hits are hidden rather than cleared in an effect.
  const searchable = q.length >= 2;
  const visibleHits = useMemo(() => (searchable ? hits : []), [searchable, hits]);
  const visibleError = searchable ? error : null;
  const grouped = useMemo(() => {
    const map = new Map<SearchHit["type"], SearchHit[]>();
    for (const h of visibleHits) map.set(h.type, [...(map.get(h.type) ?? []), h]);
    return [...map.entries()];
  }, [visibleHits]);

  const itemClass =
    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] text-fg-muted data-[selected=true]:bg-surface-3 data-[selected=true]:text-fg";

  return (
    <PaletteContext.Provider value={{ open: openPalette }}>
      {children}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className="glass fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line-strong shadow-2xl shadow-black/60"
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>
            <Command shouldFilter={false} loop label="Command palette">
              <div className="flex items-center gap-3 border-b border-line px-4">
                {loading && searchable ? <Loader2 className="size-4 animate-spin text-fg-subtle" /> : <Search className="size-4 text-fg-subtle" />}
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search intelligence, companies, papers — or ask a question…"
                  className="h-13 flex-1 bg-transparent py-4 text-[15px] text-fg outline-none placeholder:text-fg-subtle"
                />
                <Kbd>ESC</Kbd>
              </div>
              <Command.List className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
                {q.length > 0 && (
                  <Command.Group heading="Ask" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle">
                    <Command.Item value="ask-ai" onSelect={() => go(`/ask?q=${encodeURIComponent(query.trim())}`)} className={itemClass}>
                      <MessageSquareText className="size-4 text-accent" />
                      <span className="flex-1 truncate">
                        Ask AI: <span className="text-fg">“{query.trim()}”</span>
                      </span>
                      <ArrowRight className="size-3.5" />
                    </Command.Item>
                    <Command.Item value="search-page" onSelect={() => go(`/search?q=${encodeURIComponent(query.trim())}`)} className={itemClass}>
                      <Search className="size-4" />
                      <span className="flex-1">See all results</span>
                    </Command.Item>
                  </Command.Group>
                )}
                {visibleError && <p className="px-3 py-2 text-sm text-down">{visibleError}</p>}
                {grouped.map(([type, list]) => {
                  const Icon = HIT_ICON[type];
                  return (
                    <Command.Group
                      key={type}
                      heading={HIT_GROUP[type]}
                      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle"
                    >
                      {list.map((h) => (
                        <Command.Item key={`${h.type}:${h.id}`} value={`${h.type}:${h.id}`} onSelect={() => go(h.href)} className={itemClass}>
                          <Icon className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-fg">{h.title}</span>
                            {h.subtitle && <span className="block truncate text-xs text-fg-subtle">{h.subtitle}</span>}
                          </span>
                          {h.meta && <span className="shrink-0 font-mono text-[11px] text-fg-subtle">{h.meta}</span>}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
                {navMatches.length > 0 && (
                  <Command.Group
                    heading="Navigate"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle"
                  >
                    {navMatches.map(({ href, label, Icon, description, shortcut }) => (
                      <Command.Item key={href} value={`nav:${href}`} onSelect={() => go(href)} className={itemClass}>
                        <Icon className="size-4" />
                        <span className="flex-1">
                          {label}
                          <span className="ml-2 text-xs text-fg-subtle">{description}</span>
                        </span>
                        {shortcut && (
                          <span className="flex gap-0.5">
                            <Kbd>G</Kbd>
                            <Kbd>{shortcut.toUpperCase()}</Kbd>
                          </span>
                        )}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {searchable && !loading && visibleHits.length === 0 && navMatches.length === 0 && !visibleError && (
                  <p className="px-3 py-6 text-center text-sm text-fg-subtle">No matches. Press Enter to ask AI instead.</p>
                )}
              </Command.List>
              <div className={cn("flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-fg-subtle")}>
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>↵</Kbd> open
                </span>
                <span className="ml-auto">Hybrid search · vector + full-text</span>
              </div>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PaletteContext.Provider>
  );
}
