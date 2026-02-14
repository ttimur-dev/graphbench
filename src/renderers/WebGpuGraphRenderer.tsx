import { useCallback, useEffect, useRef, useState } from "react";
import { worldPointToBoard } from "../graph/coordinates";
import { createNodeMap, cubicBezierPoint, getEdgeCurve } from "../graph/geometry";
import type { ViewportType } from "../types/common";
import type { EdgeType } from "../types/edge";
import type { NodeType } from "../types/node";
import styles from "../App.module.css";

const FLOATS_PER_VERTEX = 6;
const BUFFER_USAGE_COPY_DST = 0x0008;
const BUFFER_USAGE_VERTEX = 0x0020;
const BUFFER_USAGE_UNIFORM = 0x0040;
const SHADER_STAGE_VERTEX = 0x1;
const COLOR_WRITE_ALL = 0xf;
const EDGE_SEGMENTS = 24;

const NODE_COLOR: [number, number, number, number] = [1.0, 0.91, 0.8, 0.96];
const EDGE_COLOR: [number, number, number, number] = [1.0, 0.48, 0.2, 0.95];

const SHADER_CODE = `
struct Globals {
  resolution: vec2f,
  _pad: vec2f,
}

@group(0) @binding(0) var<uniform> globals: Globals;

struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let clipX = (input.position.x / globals.resolution.x) * 2.0 - 1.0;
  let clipY = 1.0 - (input.position.y / globals.resolution.y) * 2.0;

  output.clipPosition = vec4f(clipX, clipY, 0.0, 1.0);
  output.color = input.color;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;

type DynamicVertexBuffer = {
  buffer: GpuBufferLike | null;
  capacityBytes: number;
  vertexCount: number;
};

type GpuBufferLike = {
  destroy?: () => void;
};

type GpuQueueLike = {
  submit: (buffers: unknown[]) => void;
  writeBuffer: (
    buffer: GpuBufferLike,
    bufferOffset: number,
    data: BufferSource,
    dataOffset?: number,
    size?: number,
  ) => void;
};

type GpuRenderPassLike = {
  draw: (vertexCount: number) => void;
  end: () => void;
  setBindGroup: (index: number, bindGroup: unknown) => void;
  setPipeline: (pipeline: unknown) => void;
  setVertexBuffer: (slot: number, buffer: GpuBufferLike) => void;
};

type GpuCommandEncoderLike = {
  beginRenderPass: (descriptor: {
    colorAttachments: Array<{
      clearValue: { a: number; b: number; g: number; r: number };
      loadOp: "clear";
      storeOp: "store";
      view: unknown;
    }>;
  }) => GpuRenderPassLike;
  finish: () => unknown;
};

type GpuDeviceLike = {
  createBindGroup: (descriptor: {
    entries: Array<{ binding: number; resource: { buffer: GpuBufferLike } }>;
    layout: unknown;
  }) => unknown;
  createBindGroupLayout: (descriptor: {
    entries: Array<{ binding: number; buffer: { type: "uniform" }; visibility: number }>;
  }) => unknown;
  createBuffer: (descriptor: { size: number; usage: number }) => GpuBufferLike;
  createCommandEncoder: () => GpuCommandEncoderLike;
  createPipelineLayout: (descriptor: { bindGroupLayouts: unknown[] }) => unknown;
  createRenderPipeline: (descriptor: unknown) => unknown;
  createShaderModule: (descriptor: { code: string }) => unknown;
  destroy?: () => void;
  queue: GpuQueueLike;
};

type GpuCanvasContextLike = {
  configure: (configuration: { alphaMode: "premultiplied"; device: GpuDeviceLike; format: string }) => void;
  getCurrentTexture: () => { createView: () => unknown };
};

type GpuAdapterLike = {
  requestDevice: () => Promise<GpuDeviceLike>;
};

type NavigatorGpuLike = {
  getPreferredCanvasFormat: () => string;
  requestAdapter: () => Promise<GpuAdapterLike | null>;
};

type Runtime = {
  bindGroup: unknown;
  context: GpuCanvasContextLike;
  device: GpuDeviceLike;
  linePipeline: unknown;
  trianglePipeline: unknown;
  uniformBuffer: GpuBufferLike;
};

type Props = {
  edges: EdgeType[];
  nodes: NodeType[];
  viewport: ViewportType;
};

const pushVertex = (target: number[], x: number, y: number, color: [number, number, number, number]) => {
  target.push(x, y, color[0], color[1], color[2], color[3]);
};

const uploadVertices = (device: GpuDeviceLike, target: DynamicVertexBuffer, values: number[]) => {
  target.vertexCount = values.length / FLOATS_PER_VERTEX;
  if (values.length === 0) return;

  const data = new Float32Array(values);
  const requiredBytes = data.byteLength;

  if (!target.buffer || target.capacityBytes < requiredBytes) {
    target.buffer?.destroy?.();
    target.capacityBytes = Math.max(requiredBytes, Math.max(4096, target.capacityBytes * 2));
    target.buffer = device.createBuffer({
      size: target.capacityBytes,
      usage: BUFFER_USAGE_VERTEX | BUFFER_USAGE_COPY_DST,
    });
  }

  device.queue.writeBuffer(target.buffer, 0, data.buffer, data.byteOffset, data.byteLength);
};

export const WebGpuGraphRenderer = ({ edges, nodes, viewport }: Props) => {
  const browserHasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const dprRef = useRef(1);
  const sceneRef = useRef({ edges, nodes, viewport });
  const lineBufferRef = useRef<DynamicVertexBuffer>({ buffer: null, capacityBytes: 0, vertexCount: 0 });
  const triangleBufferRef = useRef<DynamicVertexBuffer>({ buffer: null, capacityBytes: 0, vertexCount: 0 });
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const render = useCallback(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas || canvas.width === 0 || canvas.height === 0) return;

    const { edges: sceneEdges, nodes: sceneNodes, viewport: sceneViewport } = sceneRef.current;
    const nodeMap = createNodeMap(sceneNodes);
    const dpr = dprRef.current;

    const lineVertices: number[] = [];
    const triangleVertices: number[] = [];

    sceneEdges.forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return;

      const curve = getEdgeCurve(source, target);
      let prev = cubicBezierPoint(0, curve);

      for (let i = 1; i <= EDGE_SEGMENTS; i += 1) {
        const t = i / EDGE_SEGMENTS;
        const next = cubicBezierPoint(t, curve);
        const p0 = worldPointToBoard(prev, sceneViewport);
        const p1 = worldPointToBoard(next, sceneViewport);
        pushVertex(lineVertices, p0.x * dpr, p0.y * dpr, EDGE_COLOR);
        pushVertex(lineVertices, p1.x * dpr, p1.y * dpr, EDGE_COLOR);
        prev = next;
      }
    });

    sceneNodes.forEach((node) => {
      const topLeft = worldPointToBoard(node.position, sceneViewport);
      const x = topLeft.x * dpr;
      const y = topLeft.y * dpr;
      const width = node.width * sceneViewport.zoom * dpr;
      const height = node.height * sceneViewport.zoom * dpr;

      pushVertex(triangleVertices, x, y, NODE_COLOR);
      pushVertex(triangleVertices, x + width, y, NODE_COLOR);
      pushVertex(triangleVertices, x, y + height, NODE_COLOR);

      pushVertex(triangleVertices, x + width, y, NODE_COLOR);
      pushVertex(triangleVertices, x + width, y + height, NODE_COLOR);
      pushVertex(triangleVertices, x, y + height, NODE_COLOR);
    });

    uploadVertices(runtime.device, lineBufferRef.current, lineVertices);
    uploadVertices(runtime.device, triangleBufferRef.current, triangleVertices);

    const encoder = runtime.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: runtime.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
        },
      ],
    });

    pass.setBindGroup(0, runtime.bindGroup);

    if (triangleBufferRef.current.vertexCount > 0 && triangleBufferRef.current.buffer) {
      pass.setPipeline(runtime.trianglePipeline);
      pass.setVertexBuffer(0, triangleBufferRef.current.buffer);
      pass.draw(triangleBufferRef.current.vertexCount);
    }

    if (lineBufferRef.current.vertexCount > 0 && lineBufferRef.current.buffer) {
      pass.setPipeline(runtime.linePipeline);
      pass.setVertexBuffer(0, lineBufferRef.current.buffer);
      pass.draw(lineBufferRef.current.vertexCount);
    }

    pass.end();
    runtime.device.queue.submit([encoder.finish()]);
  }, []);

  useEffect(() => {
    sceneRef.current = { edges, nodes, viewport };
    render();
  }, [edges, nodes, render, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const nav = navigator as Navigator & { gpu?: unknown };
    const gpu = nav.gpu as NavigatorGpuLike | undefined;

    if (!gpu) {
      return;
    }

    let disposed = false;

    const init = async () => {
      try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
          if (!disposed) setRuntimeError("WebGPU adapter is unavailable.");
          return;
        }

        const device = await adapter.requestDevice();
        if (disposed) return;

        const context = canvas.getContext("webgpu") as GpuCanvasContextLike | null;
        if (!context) {
          if (!disposed) setRuntimeError("Failed to acquire WebGPU canvas context.");
          return;
        }

        const format = gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format,
          alphaMode: "premultiplied",
        });

        const shader = device.createShaderModule({ code: SHADER_CODE });
        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: SHADER_STAGE_VERTEX,
              buffer: { type: "uniform" },
            },
          ],
        });

        const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        });

        const vertex = {
          module: shader,
          entryPoint: "vs_main",
          buffers: [
            {
              arrayStride: FLOATS_PER_VERTEX * 4,
              attributes: [
                { shaderLocation: 0, format: "float32x2", offset: 0 },
                { shaderLocation: 1, format: "float32x4", offset: 8 },
              ],
            },
          ],
        };

        const fragment = {
          module: shader,
          entryPoint: "fs_main",
          targets: [{ format, writeMask: COLOR_WRITE_ALL }],
        };

        const trianglePipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex,
          fragment,
          primitive: {
            topology: "triangle-list",
            cullMode: "none",
          },
        });

        const linePipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex,
          fragment,
          primitive: {
            topology: "line-list",
          },
        });

        const uniformBuffer = device.createBuffer({
          size: 16,
          usage: BUFFER_USAGE_UNIFORM | BUFFER_USAGE_COPY_DST,
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: uniformBuffer },
            },
          ],
        });

        runtimeRef.current = {
          bindGroup,
          context,
          device,
          linePipeline,
          trianglePipeline,
          uniformBuffer,
        };

        if (!disposed) setRuntimeError(null);
      } catch {
        if (!disposed) setRuntimeError("Failed to initialize WebGPU device.");
      }
    };

    void init();

    return () => {
      disposed = true;
      lineBufferRef.current.buffer?.destroy?.();
      triangleBufferRef.current.buffer?.destroy?.();
      runtimeRef.current?.uniformBuffer?.destroy?.();
      runtimeRef.current?.device?.destroy?.();
      runtimeRef.current = null;
      lineBufferRef.current = { buffer: null, capacityBytes: 0, vertexCount: 0 };
      triangleBufferRef.current = { buffer: null, capacityBytes: 0, vertexCount: 0 };
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const runtime = runtimeRef.current;
      const host = canvas.parentElement;
      if (!runtime || !host) return;

      const rect = host.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
      const nextHeight = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }

      dprRef.current = dpr;
      runtime.device.queue.writeBuffer(runtime.uniformBuffer, 0, new Float32Array([nextWidth, nextHeight, 0, 0]));
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", resize);
    resize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [render]);

  const statusText = !browserHasWebGpu ? "WebGPU is unavailable in this browser." : runtimeError;

  return (
    <div className={styles.webGpuLayer}>
      <canvas ref={canvasRef} className={styles.webGpuCanvas} />
      {statusText ? <p className={styles.webGpuFallback}>{statusText}</p> : null}
    </div>
  );
};
