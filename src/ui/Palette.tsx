import { MATERIALS } from "../render/palette";
import { useStore } from "../state/useStore";

export default function Palette() {
  const { selected, overlay, hovered } = useStore();
  const set = useStore.setState;
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
    >
      {MATERIALS.map((m) => (
        <button
          key={m.id}
          onClick={() => set({ selected: m.id })}
          style={{
            background: `#${m.color.toString(16).padStart(6, "0")}`,
            height: 32,
            borderRadius: 6,
            border: selected === m.id ? "2px solid #fff" : "1px solid #333",
            color: "#000",
          }}
          title={m.name}
        >
          {m.name}
        </button>
      ))}
      <div
        style={{ gridColumn: "span 3", display: "flex", gap: 8, marginTop: 8 }}
      >
        <label style={{ color: "#ddd" }}>Overlay:</label>
        <button
          onClick={() => set({ overlay: "none" })}
          style={{
            padding: "4px 8px",
            border: overlay === "none" ? "2px solid #fff" : "1px solid #333",
            borderRadius: 6,
            background: "#222",
            color: "#ddd",
          }}
        >
          None
        </button>
        <button
          onClick={() => set({ overlay: "temp" })}
          style={{
            padding: "4px 8px",
            border: overlay === "temp" ? "2px solid #fff" : "1px solid #333",
            borderRadius: 6,
            background: "#222",
            color: "#ddd",
          }}
        >
          Temperature
        </button>
        <button
          onClick={() => set({ overlay: "pressure" })}
          style={{
            padding: "4px 8px",
            border:
              overlay === "pressure" ? "2px solid #fff" : "1px solid #333",
            borderRadius: 6,
            background: "#222",
            color: "#ddd",
          }}
        >
          Pressure
        </button>
      </div>
      {hovered && (
        <div
          style={{
            gridColumn: "span 3",
            color: "#ddd",
            fontSize: 12,
            marginTop: 8,
          }}
        >
          <div>
            <strong>Inspector</strong> — x:{hovered.x} y:{hovered.y} mat:
            {hovered.mat} T:{hovered.temp.toFixed(1)}°C P:{hovered.pressure} H:
            {hovered.humidity}
          </div>
        </div>
      )}
    </div>
  );
}
