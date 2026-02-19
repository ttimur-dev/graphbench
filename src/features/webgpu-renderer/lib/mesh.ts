export type Point = {
  x: number;
  y: number;
};

const appendEdgeVertex = (
  vertices: number[],
  x: number,
  y: number,
  signedDistance: number,
  coreHalfWidth: number,
  glowSize: number,
) => {
  vertices.push(x, y, signedDistance, coreHalfWidth, glowSize);
};

export const appendEdgeQuadSegment = (
  vertices: number[],
  start: Point,
  end: Point,
  coreHalfWidth: number,
  glowSize: number,
) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;

  const nx = -dy / length;
  const ny = dx / length;
  const outerHalf = coreHalfWidth + glowSize;

  const ox = nx * outerHalf;
  const oy = ny * outerHalf;

  const left0 = { x: start.x - ox, y: start.y - oy };
  const right0 = { x: start.x + ox, y: start.y + oy };
  const left1 = { x: end.x - ox, y: end.y - oy };
  const right1 = { x: end.x + ox, y: end.y + oy };

  appendEdgeVertex(vertices, left0.x, left0.y, -outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, right0.x, right0.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, left1.x, left1.y, -outerHalf, coreHalfWidth, glowSize);

  appendEdgeVertex(vertices, right0.x, right0.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, right1.x, right1.y, outerHalf, coreHalfWidth, glowSize);
  appendEdgeVertex(vertices, left1.x, left1.y, -outerHalf, coreHalfWidth, glowSize);
};

const appendNodeVertex = (
  vertices: number[],
  x: number,
  y: number,
  localX: number,
  localY: number,
  halfWidth: number,
  halfHeight: number,
  radius: number,
  borderWidth: number,
) => {
  vertices.push(x, y, localX, localY, halfWidth, halfHeight, radius, borderWidth);
};

export const appendNodeQuad = (
  vertices: number[],
  x: number,
  y: number,
  width: number,
  height: number,
  shadowPadding: number,
  radius: number,
  borderWidth: number,
) => {
  const left = x - shadowPadding;
  const top = y - shadowPadding;
  const right = x + width + shadowPadding;
  const bottom = y + height + shadowPadding;

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const localLeft = -halfWidth - shadowPadding;
  const localTop = -halfHeight - shadowPadding;
  const localRight = halfWidth + shadowPadding;
  const localBottom = halfHeight + shadowPadding;

  appendNodeVertex(vertices, left, top, localLeft, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, right, top, localRight, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, left, bottom, localLeft, localBottom, halfWidth, halfHeight, radius, borderWidth);

  appendNodeVertex(vertices, right, top, localRight, localTop, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, right, bottom, localRight, localBottom, halfWidth, halfHeight, radius, borderWidth);
  appendNodeVertex(vertices, left, bottom, localLeft, localBottom, halfWidth, halfHeight, radius, borderWidth);
};
