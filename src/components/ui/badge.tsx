import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-3/60 text-fg-muted",
        accent: "border-accent/25 bg-accent-soft text-accent-strong",
        up: "border-up/25 bg-up/10 text-up",
        hot: "border-hot/25 bg-hot/10 text-hot",
        warn: "border-warn/25 bg-warn/10 text-warn",
        down: "border-down/25 bg-down/10 text-down",
        fact: "border-fact/25 bg-fact/10 text-fact",
        analysis: "border-analysis/25 bg-analysis/10 text-analysis",
        speculation: "border-speculation/25 bg-speculation/10 text-speculation",
        muted: "border-transparent bg-transparent text-fg-subtle",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
