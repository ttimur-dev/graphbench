import { Edge } from "../components/Edge";
import { Node } from "../components/Node";
import type { ViewportType } from "../types/common";
import type { EdgeType } from "../types/edge";
import type { NodeDragStartHandler, NodeType } from "../types/node";
import styles from "../App.module.css";

type Props = {
  edges: EdgeType[];
  nodeById: (nodeId: string) => NodeType | undefined;
  nodes: NodeType[];
  onNodeDragStart: NodeDragStartHandler;
  viewport: ViewportType;
};

export const DomGraphRenderer = ({ edges, nodeById, nodes, onNodeDragStart, viewport }: Props) => (
  <div
    id="world"
    style={{
      position: "absolute",
      inset: 0,
      transform: `translate(${viewport.panX}px,${viewport.panY}px) scale(${viewport.zoom})`,
      transformOrigin: "0 0",
    }}
  >
    <svg className={styles.edgeLayer} xmlns="http://www.w3.org/2000/svg">
      {edges.map((edge) => (
        <Edge key={edge.id} nodeById={nodeById} {...edge} />
      ))}
    </svg>

    <div id="canvas" className={styles.canvas}>
      {nodes.map((node) => (
        <Node key={node.id} onDragStart={onNodeDragStart} {...node} />
      ))}
    </div>
  </div>
);
