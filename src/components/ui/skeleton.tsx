import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,rgb(255_255_255/0.03)_25%,rgb(255_255_255/0.07)_50%,rgb(255_255_255/0.03)_75%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
