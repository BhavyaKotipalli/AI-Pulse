import { cn } from "@/lib/utils";

const COLORS = {
  accent: "var(--color-accent)",
  up: "var(--color-up)",
  hot: "var(--color-hot)",
  down: "var(--color-down)",
  muted: "var(--color-fg-subtle)",
} as const;

/** Minimal SVG sparkline (server-renderable, no client JS). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
  tone = "accent",
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: keyof typeof COLORS;
  label?: string;
}) {
  if (values.length < 2) return <span className={cn("inline-block", className)} style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const color = COLORS[tone];
  const gid = `spark-${tone}`;
  const last = pts[pts.length - 1]!;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label={label ?? `Trend from ${values[0]} to ${values[values.length - 1]}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}
