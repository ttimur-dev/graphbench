import type { EdgeType } from "../types/edge";
import type { NodeType } from "../types/node";
import { getEdgeCurve } from "../graph/geometry";
import styles from "./Edge.module.css";

type Props = EdgeType & {
  nodeById: (nodeId: string) => NodeType | undefined;
};

export const Edge = ({ source, target, nodeById }: Props) => {
  const sourceNode = nodeById(source);
  const targetNode = nodeById(target);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, x1, y1, x2, y2 } = getEdgeCurve(sourceNode, targetNode);

  return <path className={styles.edgePath} d={`M ${sx} ${sy} C ${x1} ${y1}, ${x2} ${y2}, ${tx} ${ty}`} />;
};
