import type { ViewportType } from "../../../entities/graph";
import type { EdgeType } from "../../../entities/edge";
import type { NodeType } from "../../../entities/node";

export type GpuBufferLike = {
  destroy?: () => void;
};

export type GpuQueueLike = {
  submit: (commands: unknown[]) => void;
  writeBuffer: (
    buffer: GpuBufferLike,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ) => void;
};

export type GpuRenderPassLike = {
  draw: (vertexCount: number) => void;
  end: () => void;
  setBindGroup: (index: number, bindGroup: unknown) => void;
  setPipeline: (pipeline: unknown) => void;
  setVertexBuffer: (slot: number, buffer: GpuBufferLike) => void;
};

export type GpuCommandEncoderLike = {
  beginRenderPass: (descriptor: {
    colorAttachments: Array<{
      clearValue: { r: number; g: number; b: number; a: number };
      loadOp: "clear";
      storeOp: "store";
      view: unknown;
    }>;
  }) => GpuRenderPassLike;
  finish: () => unknown;
};

export type GpuDeviceLike = {
  createBindGroup: (descriptor: {
    layout: unknown;
    entries: Array<{ binding: number; resource: { buffer: GpuBufferLike } }>;
  }) => unknown;
  createBindGroupLayout: (descriptor: {
    entries: Array<{ binding: number; visibility: number; buffer: { type: "uniform" } }>;
  }) => unknown;
  createBuffer: (descriptor: { size: number; usage: number }) => GpuBufferLike;
  createCommandEncoder: () => GpuCommandEncoderLike;
  createPipelineLayout: (descriptor: { bindGroupLayouts: unknown[] }) => unknown;
  createRenderPipeline: (descriptor: unknown) => unknown;
  createShaderModule: (descriptor: { code: string }) => unknown;
  destroy?: () => void;
  queue: GpuQueueLike;
};

export type GpuCanvasContextLike = {
  configure: (options: { device: GpuDeviceLike; format: string; alphaMode: "premultiplied" }) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

export type GpuAdapterLike = {
  requestDevice: () => Promise<GpuDeviceLike>;
};

export type GpuNavigatorLike = {
  getPreferredCanvasFormat: () => string;
  requestAdapter: () => Promise<GpuAdapterLike | null>;
};

export type Runtime = {
  bindGroup: unknown;
  context: GpuCanvasContextLike;
  device: GpuDeviceLike;
  edgePipeline: unknown;
  nodePipeline: unknown;
  uniformBuffer: GpuBufferLike;
};

export type DynamicVertexBuffer = {
  buffer: GpuBufferLike | null;
  capacityBytes: number;
  vertexCount: number;
};

export type SceneSnapshot = {
  edges: EdgeType[];
  nodes: NodeType[];
  viewport: ViewportType;
};
