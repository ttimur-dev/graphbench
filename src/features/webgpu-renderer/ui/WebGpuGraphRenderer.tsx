import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewportType } from "../../../entities/graph";
import type { EdgeType } from "../../../entities/edge";
import type { NodeType } from "../../../entities/node";
import { uploadEdgeVertices, uploadNodeVertices } from "../lib/buffers";
import { drawPass } from "../lib/drawPass";
import { destroyRuntime, initializeRuntime, syncRuntimeCanvasSize } from "../lib/runtime";
import { buildSceneVertices } from "../lib/scene";
import type { DynamicVertexBuffer, Runtime, SceneSnapshot } from "../lib/types";
import styles from "./WebGpuGraphRenderer.module.css";

type Props = {
  edges: EdgeType[];
  nodes: NodeType[];
  viewport: ViewportType;
};

const createEmptyDynamicBuffer = (): DynamicVertexBuffer => ({
  buffer: null,
  capacityBytes: 0,
  vertexCount: 0,
});

export const WebGpuGraphRenderer = ({ edges, nodes, viewport }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const dprRef = useRef(1);
  const sceneRef = useRef<SceneSnapshot>({ edges, nodes, viewport });
  const edgeBufferRef = useRef<DynamicVertexBuffer>(createEmptyDynamicBuffer());
  const nodeBufferRef = useRef<DynamicVertexBuffer>(createEmptyDynamicBuffer());
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const draw = useCallback(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas || canvas.width === 0 || canvas.height === 0) return;

    const { edgeVertices, nodeVertices } = buildSceneVertices(sceneRef.current, dprRef.current);
    uploadEdgeVertices(runtime.device, edgeBufferRef.current, edgeVertices);
    uploadNodeVertices(runtime.device, nodeBufferRef.current, nodeVertices);

    drawPass({
      edgeBuffer: edgeBufferRef.current,
      nodeBuffer: nodeBufferRef.current,
      runtime,
    });
  }, []);

  const syncCanvasSize = useCallback(() => {
    const runtime = runtimeRef.current;
    const canvas = canvasRef.current;
    if (!runtime || !canvas) return;

    const { dpr } = syncRuntimeCanvasSize({ canvas, runtime });
    dprRef.current = dpr;
  }, []);

  useEffect(() => {
    sceneRef.current = { edges, nodes, viewport };
    draw();
  }, [draw, edges, nodes, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;

    const initialize = async () => {
      try {
        const { error, runtime } = await initializeRuntime(canvas);

        if (disposed) {
          destroyRuntime({
            edgeBuffer: edgeBufferRef.current,
            nodeBuffer: nodeBufferRef.current,
            runtime,
          });
          return;
        }

        if (!runtime || error) {
          setRuntimeError(error ?? "Failed to initialize WebGPU device.");
          return;
        }

        runtimeRef.current = runtime;
        setRuntimeError(null);
        const { dpr } = syncRuntimeCanvasSize({ canvas, runtime });
        dprRef.current = dpr;
        draw();
      } catch {
        if (!disposed) {
          setRuntimeError("Failed to initialize WebGPU device.");
        }
      }
    };

    void initialize();

    return () => {
      disposed = true;

      destroyRuntime({
        edgeBuffer: edgeBufferRef.current,
        nodeBuffer: nodeBufferRef.current,
        runtime: runtimeRef.current,
      });

      runtimeRef.current = null;
    };
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      syncCanvasSize();
      draw();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [draw, syncCanvasSize]);

  const browserHasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  const statusText = !browserHasWebGpu ? "WebGPU is unavailable in this browser." : runtimeError;

  return (
    <div className={styles.webGpuLayer}>
      <canvas ref={canvasRef} className={styles.webGpuCanvas} />
      {statusText ? <p className={styles.webGpuFallback}>{statusText}</p> : null}
    </div>
  );
};
