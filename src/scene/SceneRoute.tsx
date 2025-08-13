import { useEffect, useState } from "react";
import ScenePreview from "./scene.preview";

function parseHash(): string | null {
  const h = window.location.hash || "";
  const m = h.match(/^#\/scenes\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function SceneRoute() {
  const [name, setName] = useState<string | null>(() => parseHash());
  const [sdl, setSdl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const onHash = () => setName(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setSdl(null);
    setErr(null);
    if (!name) return;
    const url = `/scenes/${name}.yaml`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      })
      .then((txt) => setSdl(txt))
      .catch((e) =>
        setErr(`Failed to fetch scene '${name}': ${e?.message ?? e}`)
      );
  }, [name]);

  if (!name)
    return (
      <div style={{ padding: 16 }}>
        No scene in URL. Use #/scenes/Scene-Name
      </div>
    );
  if (err) return <div style={{ padding: 16, color: "#f55" }}>{err}</div>;
  if (!sdl) return <div style={{ padding: 16 }}>Loading {name}…</div>;
  return <ScenePreview sdlText={sdl} ext={".yaml"} />;
}
