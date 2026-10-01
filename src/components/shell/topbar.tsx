"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Kbd } from "@/components/ui/kbd";
import { useCommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { NavList } from "./sidebar";

function MobileNav({ footer }: { footer: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="Open navigation" className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 lg:hidden">
          <Menu className="size-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 lg:hidden" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[280px] animate-fade-up flex-col border-r border-line bg-bg lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Dialog.Title asChild>
              <span>
                <Logo />
              </span>
            </Dialog.Title>
            <Dialog.Close aria-label="Close navigation" className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
          <div className="border-t border-line p-3">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Topbar({ status, footer }: { status: ReactNode; footer: ReactNode }) {
  const { open } = useCommandPalette();
  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line px-4 sm:px-6">
      <MobileNav footer={footer} />
      <Link href="/" className="lg:hidden" aria-label="AI Pulse home">
        <Logo />
      </Link>
      <button
        type="button"
        onClick={() => open()}
        className="ml-auto flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-line bg-surface-1/80 px-3 text-left text-[13px] text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted lg:ml-0"
        aria-label="Search or ask (Ctrl+K)"
      >
        <Search className="size-4" />
        <span className="flex-1 truncate">Search intelligence or ask anything…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <div className="ml-auto hidden items-center gap-2 sm:flex">{status}</div>
    </header>
  );
}
