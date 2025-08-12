import CanvasView from "./ui/CanvasView";
import Palette from "./ui/Palette";
import { useStore } from "./state/useStore";

export default function App() {
  const { brush, speed, paused } = useStore();
  const set = useStore.setState;
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ width: 260, padding: 12, borderRight: "1px solid #333" }}>
        <h1
          style={{ fontWeight: 700, fontSize: 18, margin: 0, marginBottom: 8 }}
        >
          Grid Sandbox
        </h1>
        <Palette />
        <div style={{ marginTop: 12 }}>
          <label>
            Brush: {brush}
            <input
              type="range"
              min={1}
              max={12}
              value={brush}
              onChange={(e) => set({ brush: Number(e.target.value) })}
            />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>
            Speed: {speed.toFixed(2)}x
            <input
              type="range"
              min={0.25}
              max={3}
              step={0.25}
              value={speed}
              onChange={(e) => set({ speed: Number(e.target.value) })}
            />
          </label>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => set({ paused: !paused })}>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, background: "#111", padding: 12, height: "100%" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            border: "1px solid #333",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <CanvasView />
        </div>
      </div>
    </div>
  );
}
