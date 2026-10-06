import type { Metadata } from "next";
import { GraphExplorer } from "@/components/intel/graph-explorer";
import { PageHeader } from "@/components/intel/section-header";
import { layoutGraph } from "@/domain/graph-layout";
import { knowledgeGraph } from "@/server/repositories/intel";

export const metadata: Metadata = { title: "Knowledge graph" };

export default async function GraphPage() {
  const graph = await knowledgeGraph();
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge graph"
        title="How everything connects"
        description="Companies, models, tools, technologies, skills and trends, linked by typed relationships. Node size reflects how many collected items mention it."
      />
      <GraphExplorer nodes={graph.nodes} edges={graph.edges} positions={layoutGraph(graph.nodes, graph.edges)} />
    </div>
  );
}
