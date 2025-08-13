import { MATERIALS } from "../render/palette";
import { useStore } from "../state/useStore";
import { useEffect, useState } from "react";
import { compileScene, parseSDL } from "../scene/sdl.compiler";
import { applyCompiledToEngine } from "../scene/apply";

export default function Palette() {
  const { selected, overlay, hovered } = useStore();
  const set = useStore.setState;
  const [scenes, setScenes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setScenes([
      "Campfire-Containment",
      "Forest-Wildfire",
      "Laboratory-Spill",
      "Supply-Delivery",
      "Crisis-Coordination",
      "Cave-Exploration",
    ]);
  }, []);

  const loadScene = async (name: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/scenes/${name}.yaml`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const txt = await res.text();
      const parsed = parseSDL(txt, ".yaml");
      const compiled = compileScene(parsed);
      const { engine } = useStore.getState();
      if (engine) {
        applyCompiledToEngine(engine, compiled);
        window.location.hash = `#/scenes/${encodeURIComponent(name)}`;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="palette">
      <div className="scene-row" style={{ marginBottom: 8 }}>
        <label className="label" style={{ marginRight: 8 }}>
          Scene
        </label>
        <select
          onChange={(e) => e.target.value && loadScene(e.target.value)}
          defaultValue=""
          disabled={loading}
        >
          <option value="" disabled>
            {loading ? "Loading…" : "Select a scene"}
          </option>
          {scenes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="material-grid">
        {MATERIALS.map((m) => (
          <button
            key={m.id}
            onClick={() => set({ selected: m.id })}
            className={`chip ${selected === m.id ? "active" : ""}`}
            style={{ background: `#${m.color.toString(16).padStart(6, "0")}` }}
            title={m.name}
          >
            <span className="chip-label">{m.name}</span>
          </button>
        ))}
      </div>
      <div className="overlay-row">
        <span className="label">Overlay</span>
        <div className="segmented">
          <button
            className={`seg ${overlay === "none" ? "selected" : ""}`}
            onClick={() => set({ overlay: "none" })}
          >
            None
          </button>
          <button
            className={`seg ${overlay === "temp" ? "selected" : ""}`}
            onClick={() => set({ overlay: "temp" })}
          >
            Temp
          </button>
          <button
            className={`seg ${overlay === "pressure" ? "selected" : ""}`}
            onClick={() => set({ overlay: "pressure" })}
          >
            Pressure
          </button>
        </div>
      </div>
      {hovered && (
        <div className="inspector">
          <div className="ins-row">
            <span>xy</span>
            <span>
              {hovered.x},{hovered.y}
            </span>
          </div>
          <div className="ins-row">
            <span>mat</span>
            <span>{hovered.mat}</span>
          </div>
          <div className="ins-row">
            <span>T</span>
            <span>{hovered.temp.toFixed(1)}°C</span>
          </div>
          <div className="ins-row">
            <span>P</span>
            <span>{hovered.pressure}</span>
          </div>
          <div className="ins-row">
            <span>H</span>
            <span>{hovered.humidity}</span>
          </div>
        </div>
      )}
    </div>
  );
}
