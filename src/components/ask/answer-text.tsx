import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import type { MessageCitation } from "@/server/db/schema";

/**
 * Safe, minimal markdown renderer for model answers: paragraphs, "- " bullets,
 * **bold**, _italic_, `code`, and [n] citation chips. No raw HTML is ever injected.
 */
function inline(text: string, sources: MessageCitation[], keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[\d{1,2}\])/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key} className="font-semibold text-fg">{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={key} className="text-fg-subtle">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) return <code key={key} className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[0.85em]">{part.slice(1, -1)}</code>;
    const cite = part.match(/^\[(\d{1,2})\]$/);
    if (cite) {
      const src = sources.find((s) => s.index === Number(cite[1]));
      if (!src) return null; // invalid citation markers are dropped
      return (
        <Link
          key={key}
          href={`/intel/${src.itemId}`}
          title={`${src.title} — ${src.source ?? ""}`}
          className="mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-accent/30 bg-accent-soft px-1 align-text-top font-mono text-[10.5px] text-accent-strong hover:bg-accent/25"
        >
          {src.index}
        </Link>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function AnswerText({ text, sources }: { text: string; sources: MessageCitation[] }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-fg-muted">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim().length > 0);
        if (lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l) || /^\*\*[^*]+\*\*$/.test(l.trim()))) {
          return (
            <div key={bi} className="space-y-1.5">
              {lines.map((l, li) =>
                /^\s*[-*]\s+/.test(l) ? (
                  <p key={li} className="flex gap-2 pl-1">
                    <span className="mt-[9px] size-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden />
                    <span>{inline(l.replace(/^\s*[-*]\s+/, ""), sources, `${bi}-${li}`)}</span>
                  </p>
                ) : (
                  <p key={li}>{inline(l, sources, `${bi}-${li}`)}</p>
                ),
              )}
            </div>
          );
        }
        return <p key={bi}>{inline(lines.join(" "), sources, `${bi}`)}</p>;
      })}
    </div>
  );
}
