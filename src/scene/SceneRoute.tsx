import { useEffect, useState } from "react";
import { compileScene, parseSDL } from "./sdl.compiler";
import { applyCompiledToEngine } from "./apply";
import { useStore } from "../state/useStore";

function parseHash(): string | null {
  const h = window.location.hash || "";
  const m = h.match(/^#\/scenes\/([^?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function SceneRoute() {
  const [name, setName] = useState<string | null>(() => parseHash());
  const [err, setErr] = useState<string | null>(null);
  const engine = useStore((s) => s.engine);

  useEffect(() => {
    const onHash = () => setName(parseHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    // Apply scene to the global engine when both engine and name are available
    if (!engine || !name) return;
    setErr(null);
    const url = `/scenes/${name}.yaml`;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const txt = await res.text();
        if (cancelled) return;
        const parsed = parseSDL(txt, ".yaml");
        const compiled = compileScene(parsed);
        if (cancelled) return;
        applyCompiledToEngine(engine, compiled);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(`Failed to load scene '${name}': ${msg}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [engine, name]);

  // Non-visual loader: render nothing; optionally surface errors in console
  if (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  return null;
}
