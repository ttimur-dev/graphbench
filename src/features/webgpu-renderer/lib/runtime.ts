import {
  BYTES_PER_FLOAT,
  EDGE_STRIDE_BYTES,
  GPU_BUFFER_USAGE_COPY_DST,
  GPU_BUFFER_USAGE_UNIFORM,
  GPU_COLOR_WRITE_ALL,
  GPU_SHADER_STAGE_VERTEX,
  NODE_STRIDE_BYTES,
} from "./constants";
import { EDGE_SHADER, NODE_SHADER } from "./shaders";
import type { DynamicVertexBuffer, GpuCanvasContextLike, GpuNavigatorLike, Runtime } from "./types";

export const resolveGpuNavigator = (): GpuNavigatorLike | null => {
  const nav = navigator as Navigator & { gpu?: unknown };
  const gpu = nav.gpu as GpuNavigatorLike | undefined;
  return gpu ?? null;
};

export const syncRuntimeCanvasSize = ({
  canvas,
  runtime,
}: {
  canvas: HTMLCanvasElement;
  runtime: Runtime;
}) => {
  const host = canvas.parentElement ?? canvas;
  const rect = host.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  runtime.device.queue.writeBuffer(runtime.uniformBuffer, 0, new Float32Array([width, height, 0, 0]), 0, 4);

  return { dpr };
};

const createBlendState = () => ({
  color: {
    operation: "add",
    srcFactor: "src-alpha",
    dstFactor: "one-minus-src-alpha",
  },
  alpha: {
    operation: "add",
    srcFactor: "one",
    dstFactor: "one-minus-src-alpha",
  },
});

export const initializeRuntime = async (canvas: HTMLCanvasElement): Promise<{ error: string | null; runtime: Runtime | null }> => {
  const gpu = resolveGpuNavigator();
  if (!gpu) {
    return { error: "WebGPU is unavailable in this browser.", runtime: null };
  }

  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    return { error: "WebGPU adapter is unavailable.", runtime: null };
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu") as GpuCanvasContextLike | null;

  if (!context) {
    return { error: "Failed to acquire WebGPU context.", runtime: null };
  }

  const format = gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  const edgeShaderModule = device.createShaderModule({ code: EDGE_SHADER });
  const nodeShaderModule = device.createShaderModule({ code: NODE_SHADER });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPU_SHADER_STAGE_VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const blendState = createBlendState();

  const edgePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: edgeShaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: EDGE_STRIDE_BYTES,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 2 * BYTES_PER_FLOAT, format: "float32" },
            { shaderLocation: 2, offset: 3 * BYTES_PER_FLOAT, format: "float32" },
            { shaderLocation: 3, offset: 4 * BYTES_PER_FLOAT, format: "float32" },
          ],
        },
      ],
    },
    fragment: {
      module: edgeShaderModule,
      entryPoint: "fs_main",
      targets: [{ format, writeMask: GPU_COLOR_WRITE_ALL, blend: blendState }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  const nodePipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: nodeShaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: NODE_STRIDE_BYTES,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 2 * BYTES_PER_FLOAT, format: "float32x2" },
            { shaderLocation: 2, offset: 4 * BYTES_PER_FLOAT, format: "float32x2" },
            { shaderLocation: 3, offset: 6 * BYTES_PER_FLOAT, format: "float32" },
            { shaderLocation: 4, offset: 7 * BYTES_PER_FLOAT, format: "float32" },
          ],
        },
      ],
    },
    fragment: {
      module: nodeShaderModule,
      entryPoint: "fs_main",
      targets: [{ format, writeMask: GPU_COLOR_WRITE_ALL, blend: blendState }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });

  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPU_BUFFER_USAGE_UNIFORM | GPU_BUFFER_USAGE_COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    error: null,
    runtime: {
      bindGroup,
      context,
      device,
      edgePipeline,
      nodePipeline,
      uniformBuffer,
    },
  };
};

export const destroyRuntime = ({
  edgeBuffer,
  nodeBuffer,
  runtime,
}: {
  edgeBuffer: DynamicVertexBuffer;
  nodeBuffer: DynamicVertexBuffer;
  runtime: Runtime | null;
}) => {
  edgeBuffer.buffer?.destroy?.();
  nodeBuffer.buffer?.destroy?.();
  runtime?.uniformBuffer?.destroy?.();
  runtime?.device?.destroy?.();

  edgeBuffer.buffer = null;
  edgeBuffer.capacityBytes = 0;
  edgeBuffer.vertexCount = 0;

  nodeBuffer.buffer = null;
  nodeBuffer.capacityBytes = 0;
  nodeBuffer.vertexCount = 0;
};
