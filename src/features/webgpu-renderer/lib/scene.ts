import { createNodeMap, cubicBezierPoint, getEdgeCurve, worldPointToBoard } from "../../../entities/graph";
import type { SceneSnapshot } from "./types";
import { appendEdgeQuadSegment, appendNodeQuad } from "./mesh";
import { EDGE_GLOW, EDGE_SEGMENTS, EDGE_WIDTH, NODE_BORDER_WIDTH, NODE_RADIUS, NODE_SHADOW_PAD } from "./constants";

export type SceneVertices = {
  edgeVertices: number[];
  nodeVertices: number[];
};

export const buildSceneVertices = (scene: SceneSnapshot, dpr: number): SceneVertices => {
  const { edges, nodes, viewport } = scene;
  const nodeMap = createNodeMap(nodes);

  const edgeVertices: number[] = [];
  const nodeVertices: number[] = [];
  const edgeScale = viewport.zoom * dpr;
  const edgeCoreHalf = (EDGE_WIDTH * edgeScale) / 2;
  const edgeGlow = Math.max(1.1 * dpr, EDGE_GLOW * edgeScale);

  const nodeScale = viewport.zoom * dpr;
  const nodeRadiusBase = Math.max(2 * dpr, NODE_RADIUS * nodeScale);
  const nodeBorder = Math.max(0.9 * dpr, NODE_BORDER_WIDTH * nodeScale);
  const nodeShadowPad = Math.max(7 * dpr, NODE_SHADOW_PAD * nodeScale);

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) return;

    const curve = getEdgeCurve(sourceNode, targetNode);
    let previous = cubicBezierPoint(0, curve);

    for (let i = 1; i <= EDGE_SEGMENTS; i += 1) {
      const t = i / EDGE_SEGMENTS;
      const next = cubicBezierPoint(t, curve);

      const p0 = worldPointToBoard(previous, viewport);
      const p1 = worldPointToBoard(next, viewport);

      appendEdgeQuadSegment(
        edgeVertices,
        { x: p0.x * dpr, y: p0.y * dpr },
        { x: p1.x * dpr, y: p1.y * dpr },
        edgeCoreHalf,
        edgeGlow,
      );

      previous = next;
    }
  });

  nodes.forEach((node) => {
    const topLeft = worldPointToBoard(node.position, viewport);
    const x = topLeft.x * dpr;
    const y = topLeft.y * dpr;
    const width = node.width * viewport.zoom * dpr;
    const height = node.height * viewport.zoom * dpr;
    const radius = Math.min(nodeRadiusBase, Math.max(1, Math.min(width, height) * 0.5 - 1));

    appendNodeQuad(nodeVertices, x, y, width, height, nodeShadowPad, radius, nodeBorder);
  });

  return {
    edgeVertices,
    nodeVertices,
  };
};
