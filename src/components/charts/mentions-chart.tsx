"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MentionsChart({ data, height = 220 }: { data: Array<{ date: string; mentions: number }>; height?: number }) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Daily mentions over time">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="mentionsFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgb(255 255 255 / 0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric" })}
            tick={{ fill: "var(--color-fg-subtle)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis tick={{ fill: "var(--color-fg-subtle)", fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            cursor={{ stroke: "rgb(255 255 255 / 0.15)" }}
            contentStyle={{
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-line-strong)",
              borderRadius: 10,
              fontSize: 12,
              color: "var(--color-fg)",
            }}
            labelStyle={{ color: "var(--color-fg-muted)" }}
          />
          <Area type="monotone" dataKey="mentions" stroke="var(--color-accent)" strokeWidth={1.75} fill="url(#mentionsFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
