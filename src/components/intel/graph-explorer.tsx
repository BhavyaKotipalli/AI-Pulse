"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { GRAPH_WIDTH } from "@/domain/graph-layout";
import { cn, titleCase } from "@/lib/utils";

export interface ExplorerNode {
  id: string;
  label: string;
  type: string;
  description?: string | null;
  mentions?: number;
  href?: string;
}
export interface ExplorerEdge {
  source: string;
  target: string;
  relation: string;
}

const TYPE_COLOR: Record<string, string> = {
  company: "#5cc8ff",
  model: "#b493ff",
  technology: "#8b93ff",
  tool: "#3ecf8e",
  skill: "#f5c451",
  startup: "#ff8a4c",
  person: "#f06272",
  role: "#9aa1b1",
  trend: "#eceef3",
};

const WIDTH = GRAPH_WIDTH;
const HEIGHT = 620;

/**
 * Interactive knowledge graph: click or focus a node to see its relationships.
 * Layout is computed deterministically on the server, so there is no jitter and no animation loop.
 */
export function GraphExplorer({
  nodes,
  edges,
  positions: layout,
  height = HEIGHT,
}: {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  /** Node id → coordinates, computed on the server (see `layoutGraph`) so SSR and hydration match exactly. */
  positions: Record<string, { x: number; y: number }>;
  height?: number;
}) {
  const types = useMemo(() => [...new Set(nodes.map((n) => n.type))].sort(), [nodes]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visibleNodes = useMemo(() => nodes.filter((n) => !hidden.has(n.type)), [nodes, hidden]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)), [edges, visibleIds]);
  const positions = useMemo(() => new Map(Object.entries(layout)), [layout]);

  const neighbors = useMemo(() => {
    const set = new Set<string>();
    if (!selected) return set;
    for (const e of visibleEdges) {
      if (e.source === selected) set.add(e.target);
      if (e.target === selected) set.add(e.source);
    }
    return set;
  }, [selected, visibleEdges]);

  const q = query.trim().toLowerCase();
  const matches = (n: ExplorerNode) => q.length > 0 && n.label.toLowerCase().includes(q);
  const active = selected ? nodes.find((n) => n.id === selected) : undefined;
  const relations = selected
    ? visibleEdges
        .filter((e) => e.source === selected || e.target === selected)
        .map((e) => {
          const outgoing = e.source === selected;
          const other = nodes.find((n) => n.id === (outgoing ? e.target : e.source));
          return other ? { other, relation: e.relation, outgoing } : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
    : [];

  if (nodes.length === 0) {
    return <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-10 text-center text-sm text-fg-muted">No relationships to show yet.</p>;
  }

  const radius = (n: ExplorerNode) => (n.type === "trend" ? 9 : 5 + Math.min(6, Math.sqrt(n.mentions ?? 0)));

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-surface-1">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a node…"
            aria-label="Find a node in the graph"
            className="h-8 w-44 rounded-lg border border-line bg-surface-2 px-2.5 text-[13px] text-fg outline-none placeholder:text-fg-subtle focus:border-accent/40"
          />
          {types.map((t) => {
            const off = hidden.has(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={!off}
                onClick={() =>
                  setHidden((prev) => {
                    const next = new Set(prev);
                    if (off) next.delete(t);
                    else next.add(t);
                    return next;
                  })
                }
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-opacity",
                  off ? "border-line text-fg-subtle opacity-50" : "border-line-strong text-fg-muted",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[t] ?? "#9aa1b1" }} />
                {titleCase(t)}
              </button>
            );
          })}
        </div>
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block h-auto w-full" role="group" aria-label="Knowledge graph">
          <g>
            {visibleEdges.map((e, i) => {
              const a = positions.get(e.source);
              const b = positions.get(e.target);
              if (!a || !b) return null;
              const hot = selected !== null && (e.source === selected || e.target === selected);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={hot ? "var(--color-accent)" : "rgb(255 255 255 / 0.09)"}
                  strokeWidth={hot ? 1.5 : 1}
                  opacity={selected && !hot ? 0.35 : 1}
                />
              );
            })}
          </g>
          <g>
            {visibleNodes.map((n) => {
              const p = positions.get(n.id);
              if (!p) return null;
              const isSelected = n.id === selected;
              const dim = (selected !== null && !isSelected && !neighbors.has(n.id)) || (q.length > 0 && !matches(n));
              const showLabel = isSelected || neighbors.has(n.id) || matches(n) || n.type === "trend" || (n.mentions ?? 0) >= 6 || visibleNodes.length <= 40;
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  opacity={dim ? 0.22 : 1}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.label}, ${n.type}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(isSelected ? null : n.id)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected(isSelected ? null : n.id);
                    }
                  }}
                  className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-[3]"
                >
                  <circle
                    r={radius(n)}
                    fill={n.type === "trend" ? "var(--color-bg)" : (TYPE_COLOR[n.type] ?? "#9aa1b1")}
                    stroke={isSelected ? "var(--color-fg)" : n.type === "trend" ? TYPE_COLOR.trend : "var(--color-bg)"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  {showLabel && (
                    <text
                      y={radius(n) + 12}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      fill={isSelected ? "var(--color-fg)" : "var(--color-fg-muted)"}
                      fontSize={n.type === "trend" ? 11.5 : 10.5}
                      fontWeight={n.type === "trend" || isSelected ? 600 : 400}
                    >
                      {n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <aside className="rounded-[var(--radius-card)] border border-line bg-surface-1 p-5" aria-live="polite">
        {active ? (
          <div className="space-y-4">
            <div>
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">
                <span className="size-2 rounded-full" style={{ background: TYPE_COLOR[active.type] ?? "#9aa1b1" }} />
                {titleCase(active.type)}
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-fg">{active.label}</p>
              {active.description && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{active.description}</p>}
              {typeof active.mentions === "number" && active.type !== "trend" && (
                <p className="mt-2 text-xs text-fg-subtle">{active.mentions} linked items</p>
              )}
            </div>
            {active.href && (
              <Link href={active.href as Route} className="inline-block text-sm text-accent hover:underline">
                {active.type === "trend" ? "Open trend →" : "See related intelligence →"}
              </Link>
            )}
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-fg-subtle">Relationships ({relations.length})</p>
              <ul className="space-y-1.5">
                {relations.map((r, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setSelected(r.other.id)} className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
                      <span className="text-fg-subtle">{r.outgoing ? `${r.relation.replace(/_/g, " ")} → ` : `← ${r.relation.replace(/_/g, " ")} `}</span>
                      {r.other.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-fg-muted">
            <p className="font-medium text-fg">Explore the graph</p>
            <p>Select a node to see how companies, models, technologies, skills and trends connect. Use the chips to hide node types.</p>
            <p className="text-xs text-fg-subtle">
              {visibleNodes.length} nodes · {visibleEdges.length} relationships
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
