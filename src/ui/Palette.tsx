import { MATERIALS } from "../render/palette";
import { useStore } from "../state/useStore";

export default function Palette() {
  const { selected, overlay, hovered } = useStore();
  const set = useStore.setState;
  return (
    <div className="palette">
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
