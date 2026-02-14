import { useGraphController } from "./hooks/useGraphController";
import { DomGraphRenderer } from "./renderers/DomGraphRenderer";
import { WebGpuGraphRenderer } from "./renderers/WebGpuGraphRenderer";
import styles from "./App.module.css";

function App() {
  const { boardRef, edges, nodeById, nodes, onNodeDragStart, renderMode, setRenderMode, viewport, webGpuAvailable } =
    useGraphController();

  return (
    <main className={styles.app}>
      <div className={styles.atmospherePrimary} />
      <div className={styles.atmosphereAccent} />

      <section ref={boardRef} className={styles.board}>
        <header className={styles.toolbar} data-role="toolbar">
          <p className={styles.kicker}>Graph Playground</p>
          <h1 className={styles.title}>Desk Flow</h1>
          <div className={styles.rendererToggle}>
            <button
              type="button"
              className={renderMode === "dom" ? styles.modeButtonActive : styles.modeButton}
              onClick={() => setRenderMode("dom")}
            >
              DOM
            </button>
            <button
              type="button"
              className={renderMode === "webgpu" ? styles.modeButtonActive : styles.modeButton}
              onClick={() => setRenderMode("webgpu")}
              disabled={!webGpuAvailable}
              title={!webGpuAvailable ? "WebGPU is unavailable in this browser." : "Switch to WebGPU renderer"}
            >
              WebGPU
            </button>
          </div>
        </header>

        {renderMode === "dom" ? (
          <DomGraphRenderer
            edges={edges}
            nodeById={nodeById}
            nodes={nodes}
            onNodeDragStart={onNodeDragStart}
            viewport={viewport}
          />
        ) : (
          <WebGpuGraphRenderer edges={edges} nodes={nodes} viewport={viewport} />
        )}
      </section>
    </main>
  );
}

export default App;
