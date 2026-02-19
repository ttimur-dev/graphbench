import { EDGE_FLOATS_PER_VERTEX, GPU_BUFFER_USAGE_COPY_DST, GPU_BUFFER_USAGE_VERTEX, NODE_FLOATS_PER_VERTEX } from "./constants";
import type { DynamicVertexBuffer, GpuDeviceLike } from "./types";

const ensureVertexBuffer = (device: GpuDeviceLike, state: DynamicVertexBuffer, requiredBytes: number) => {
  if (state.buffer && state.capacityBytes >= requiredBytes) return;

  state.buffer?.destroy?.();
  state.capacityBytes = Math.max(4096, Math.max(requiredBytes, state.capacityBytes * 2));
  state.buffer = device.createBuffer({
    size: state.capacityBytes,
    usage: GPU_BUFFER_USAGE_VERTEX | GPU_BUFFER_USAGE_COPY_DST,
  });
};

const uploadVertices = (device: GpuDeviceLike, state: DynamicVertexBuffer, data: number[], floatsPerVertex: number) => {
  state.vertexCount = data.length / floatsPerVertex;
  if (data.length === 0) return;

  const floatData = new Float32Array(data);
  ensureVertexBuffer(device, state, floatData.byteLength);
  if (!state.buffer) return;

  device.queue.writeBuffer(state.buffer, 0, floatData, 0, floatData.length);
};

export const uploadEdgeVertices = (device: GpuDeviceLike, state: DynamicVertexBuffer, data: number[]) => {
  uploadVertices(device, state, data, EDGE_FLOATS_PER_VERTEX);
};

export const uploadNodeVertices = (device: GpuDeviceLike, state: DynamicVertexBuffer, data: number[]) => {
  uploadVertices(device, state, data, NODE_FLOATS_PER_VERTEX);
};
