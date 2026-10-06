export interface LayoutNode {
  id: string;
  /** Larger weight → larger node and stronger pull to the center. */
  weight?: number;
}
export interface LayoutEdge {
  source: string;
  target: string;
}
export interface Point {
  x: number;
  y: number;
}

/**
 * Small deterministic force-directed layout (repulsion + springs + centering).
 * Pure and synchronous: the same graph always yields the same picture, which keeps
 * server and client renders identical and makes it unit-testable. Fine for a few hundred nodes.
 */
export function forceLayout(nodes: LayoutNode[], edges: LayoutEdge[], opts: { width: number; height: number; iterations?: number }): Map<string, Point> {
  const { width, height } = opts;
  const iterations = opts.iterations ?? 260;
  const n = nodes.length;
  const pos = new Map<string, Point>();
  if (n === 0) return pos;

  // Deterministic start: a golden-angle spiral avoids symmetric deadlocks.
  nodes.forEach((node, i) => {
    const r = Math.sqrt((i + 0.5) / n) * Math.min(width, height) * 0.42;
    const a = i * 2.399963;
    pos.set(node.id, { x: width / 2 + r * Math.cos(a), y: height / 2 + r * Math.sin(a) });
  });

  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const links = edges.filter((e) => index.has(e.source) && index.has(e.target) && e.source !== e.target);
  const k = Math.sqrt((width * height) / n) * 0.34; // ideal edge length
  const pts = nodes.map((node) => pos.get(node.id)!);

  for (let step = 0; step < iterations; step++) {
    const temperature = (1 - step / iterations) * Math.min(width, height) * 0.08;
    const dx = new Float64Array(n);
    const dy = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let vx = pts[i]!.x - pts[j]!.x;
        let vy = pts[i]!.y - pts[j]!.y;
        let d2 = vx * vx + vy * vy;
        if (d2 < 0.01) {
          vx = (i - j) * 0.1 + 0.1;
          vy = 0.1;
          d2 = vx * vx + vy * vy;
        }
        const force = (k * k) / d2;
        dx[i]! += vx * force;
        dy[i]! += vy * force;
        dx[j]! -= vx * force;
        dy[j]! -= vy * force;
      }
    }
    for (const e of links) {
      const a = index.get(e.source)!;
      const b = index.get(e.target)!;
      const vx = pts[a]!.x - pts[b]!.x;
      const vy = pts[a]!.y - pts[b]!.y;
      const d = Math.sqrt(vx * vx + vy * vy) || 0.01;
      const force = d / k;
      dx[a]! -= vx * force;
      dy[a]! -= vy * force;
      dx[b]! += vx * force;
      dy[b]! += vy * force;
    }
    for (let i = 0; i < n; i++) {
      // Gravity keeps disconnected components on the canvas and well-connected hubs near the middle.
      const pull = 0.6 * (1 + Math.min(1, (nodes[i]!.weight ?? 0) / 20));
      dx[i]! += (width / 2 - pts[i]!.x) * pull;
      dy[i]! += (height / 2 - pts[i]!.y) * pull * (width / height);
      const len = Math.sqrt(dx[i]! * dx[i]! + dy[i]! * dy[i]!) || 0.01;
      const move = Math.min(len, temperature);
      pts[i]!.x = Math.min(width - 24, Math.max(24, pts[i]!.x + (dx[i]! / len) * move));
      pts[i]!.y = Math.min(height - 24, Math.max(24, pts[i]!.y + (dy[i]! / len) * move));
    }
  }
  // Rounded so server-rendered and client-rendered coordinates are byte-identical.
  for (const p of pts) {
    p.x = Math.round(p.x * 10) / 10;
    p.y = Math.round(p.y * 10) / 10;
  }
  return pos;
}

export const GRAPH_WIDTH = 960;

/** Lays out a node/edge list for the explorer canvas and returns plain coordinates keyed by node id. */
export function layoutGraph(
  nodes: Array<{ id: string; mentions?: number }>,
  edges: LayoutEdge[],
  height = 620,
): Record<string, Point> {
  const pos = forceLayout(nodes.map((n) => ({ id: n.id, weight: n.mentions })), edges, { width: GRAPH_WIDTH, height });
  return Object.fromEntries(pos);
}
