import CanvasView from "./ui/CanvasView";
import SceneRoute from "./scene/SceneRoute";
import Palette from "./ui/Palette";
import { useStore } from "./state/useStore";
import "./App.css";

export default function App() {
  const { brush, speed, paused, engine } = useStore();
  const set = useStore.setState;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="title">GRID SANDBOX</span>
          <span className="subtitle">2D Physics Lab</span>
        </div>
        <div className="controls">
          <div className="control">
            <label className="label">Brush</label>
            <div className="range-row">
              <input
                className="range"
                type="range"
                min={1}
                max={16}
                value={brush}
                onChange={(e) => set({ brush: Number(e.target.value) })}
              />
              <span className="value">{brush}</span>
            </div>
          </div>
          <div className="control">
            <label className="label">Speed</label>
            <div className="range-row">
              <input
                className="range"
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={speed}
                onChange={(e) => set({ speed: Number(e.target.value) })}
              />
              <span className="value">{speed.toFixed(2)}x</span>
            </div>
          </div>
          <div className="buttons-row">
            <button className="btn" onClick={() => set({ paused: !paused })}>
              {paused ? "RESUME" : "PAUSE"}
            </button>
            <button className="btn" onClick={() => engine?.clear()}>
              CLEAR
            </button>
            <button
              className="btn"
              onClick={() => engine?.step()}
              disabled={!paused}
            >
              STEP
            </button>
          </div>
          {/* CRT toggle removed */}
        </div>
        <Palette />
        <footer className="footer">
          Deterministic. Test‑driven. 8‑bit vibes.
        </footer>
      </aside>
      <main className="stage">
        <div className="viewport">
          {location.hash.startsWith("#/scenes/") ? (
            <SceneRoute />
          ) : (
            <CanvasView />
          )}
        </div>
      </main>
    </div>
  );
}
