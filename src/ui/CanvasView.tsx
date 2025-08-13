import { useEffect, useRef } from "react";
import { Engine } from "../engine/engine";
import { blit, makePalette } from "../render/painter";
import { COLORS } from "../render/palette";
import { useStore } from "../state/useStore";

export default function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const W = 320;
    const H = 200; // tune
    const engine = new Engine({ w: W, h: H });
    // Spawn player near top-center
    const px = (W / 2) | 0;
    const py = 10;
    engine.spawnPlayer(px, py);
    engineRef.current = engine;
    // expose engine in UI store for controls (clear, step, etc.)
    useStore.setState({ engine });
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    cvs.width = W;
    cvs.height = H;
    const id = ctx.createImageData(W, H);
    const pal = makePalette(COLORS);

    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const { paused, speed } = useStore.getState();
      acc += dt * speed;
      while (acc > 1 / 60) {
        if (!paused) engine.step();
        acc -= 1 / 60;
      }
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      const { overlay } = useStore.getState();
      blit(
        ctx,
        id,
        { mat: front.mat, temp: front.temp, pressure: front.pressure },
        pal,
        W,
        H,
        engine.dirty,
        engine.chunkSize,
        overlay
      );
      // Draw player overlay and HUD
      if (engine.player) {
        const p = engine.player;
        const px = Math.floor(p.x);
        const py = Math.floor(p.y);
        // stickman: larger and colored (8-10px tall, multi-color)
        const outline = "#000000";
        const skin = "#f2cda0";
        const shirt = p.burning ? "#ff3b1a" : "#3aa0ff";
        const pants = "#2f3350";
        const boots = "#222222";
        ctx.fillStyle = outline;
        // head outline (5x5)
        ctx.fillRect(px - 2, py - 10, 5, 5);
        // torso outline (3x6)
        ctx.fillRect(px - 2, py - 5, 5, 7);
        // arms outline (extend sideways)
        ctx.fillRect(px - 5, py - 4, 11, 2);
        // legs outline
        ctx.fillRect(px - 3, py + 2, 7, 2);

        // head fill
        ctx.fillStyle = skin;
        ctx.fillRect(px - 1, py - 9, 3, 3);
        // eyes
        ctx.fillStyle = outline;
        ctx.fillRect(px - 1, py - 8, 1, 1);
        ctx.fillRect(px + 1, py - 8, 1, 1);

        // torso fill (shirt)
        ctx.fillStyle = shirt;
        ctx.fillRect(px - 1, py - 5, 3, 5);
        // arms fill (skin sleeves)
        ctx.fillStyle = skin;
        ctx.fillRect(px - 4, py - 4, 3, 1);
        ctx.fillRect(px + 2, py - 4, 3, 1);

        // pants
        ctx.fillStyle = pants;
        ctx.fillRect(px - 1, py, 3, 2);
        // boots
        ctx.fillStyle = boots;
        ctx.fillRect(px - 2, py + 2, 2, 1);
        ctx.fillRect(px + 1, py + 2, 2, 1);

        // health bar (top-left)
        const wBar = 140;
        const hBar = 5;
        const hpFrac = Math.max(0, Math.min(1, p.health / 100));
        ctx.fillStyle = "#000000";
        ctx.fillRect(6 - 1, 6 - 1, wBar + 2, hBar + 2);
        ctx.fillStyle = "#333333";
        ctx.fillRect(6, 6, wBar, hBar);
        ctx.fillStyle = p.burning ? "#ff3b1a" : "#2afc6e";
        ctx.fillRect(6, 6, Math.floor(wBar * hpFrac), hBar);
        // label
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px PressStart, monospace";
        ctx.textBaseline = "top";
        ctx.fillText("HEALTH", 6, 6 + hBar + 3);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onDrag = (e: PointerEvent) => {
      const rect = cvs.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      const { selected, brush } = useStore.getState();
      engine.paint(x, y, selected, brush);
    };
    const onMove = (e: PointerEvent) => {
      const rect = cvs.getBoundingClientRect();
      let x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      let y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x >= W) x = W - 1;
      if (y >= H) y = H - 1;
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      const i = y * W + x;
      useStore.setState({
        hovered: {
          x,
          y,
          mat: front.mat[i],
          temp: front.temp[i],
          pressure: front.pressure[i],
          humidity: front.humidity[i],
        },
      });
    };
    const down = (e: PointerEvent) => {
      onDrag(e);
      cvs.setPointerCapture(e.pointerId);
      cvs.addEventListener("pointermove", onDrag);
    };
    const up = () => cvs.removeEventListener("pointermove", onDrag);

    cvs.addEventListener("pointerdown", down);
    cvs.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);

    // Keyboard controls
    const key = (code: string): "left" | "right" | "jump" | "down" | null => {
      if (code === "ArrowLeft" || code === "KeyA") return "left";
      if (code === "ArrowRight" || code === "KeyD") return "right";
      if (code === "ArrowUp" || code === "Space" || code === "KeyW")
        return "jump";
      if (code === "ArrowDown" || code === "KeyS") return "down";
      return null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const p = engine.player;
      if (!p) return;
      const k = key(e.code);
      if (!k) return;
      // prevent scrolling on space/arrow keys
      e.preventDefault();
      p.setInput({ [k]: true } as any);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const p = engine.player;
      if (!p) return;
      const k = key(e.code);
      if (!k) return;
      e.preventDefault();
      p.setInput({ [k]: false } as any);
    };
    const onKeyPress = (e: KeyboardEvent) => {
      if (e.code === "KeyR") {
        engine.player?.respawn();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("keypress", onKeyPress);

    return () => {
      window.removeEventListener("pointerup", up);
      cvs.removeEventListener("pointerdown", down);
      cvs.removeEventListener("pointermove", onMove);
      cvs.removeEventListener("pointermove", onDrag);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keypress", onKeyPress);
      cancelAnimationFrame(raf);
    };
    // only set up once; reactive values are read from the store inside loop/handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="image-render-pixel game-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
