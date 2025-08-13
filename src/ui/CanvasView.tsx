import { useEffect, useRef } from "react";
import { Engine } from "../engine/engine";
import { blit, makePalette } from "../render/painter";
import { COLORS } from "../render/palette";
import { useStore } from "../state/useStore";

export default function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const VIEW_W = 320;
    const VIEW_H = 200; // tune
    const WORLD_W = VIEW_W * 2; // exactly two screens wide
    const WORLD_H = VIEW_H;
    const engine = new Engine({ w: WORLD_W, h: WORLD_H });
    engine.viewW = VIEW_W;
    engine.viewH = VIEW_H;
    // Spawn player near top-center
    const px = 8; // start near the left edge
    const py = 10;
    engine.spawnPlayer(px, py);
    engineRef.current = engine;
    // expose engine in UI store for controls (clear, step, etc.)
    useStore.setState({ engine });
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    cvs.width = VIEW_W;
    cvs.height = VIEW_H;
    const id = ctx.createImageData(VIEW_W, VIEW_H);
    const pal = makePalette(COLORS);

    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const { paused, speed } = useStore.getState();
      acc += dt * speed;
      // Step at most 2 frames worth per render to avoid long catch-up work
      const stepDt = 1 / 60;
      let steps = 0;
      while (acc > stepDt && steps < 2) {
        if (!paused) engine.step();
        acc -= stepDt;
        steps++;
      }
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      const { overlay } = useStore.getState();
      blit(
        ctx,
        id,
        { mat: front.mat, temp: front.temp, pressure: front.pressure },
        pal,
        VIEW_W,
        VIEW_H,
        engine.grid.w,
        engine.grid.h,
        engine.cameraX,
        engine.cameraY,
        engine.dirty,
        engine.chunkSize,
        overlay,
        false
      );
      // Draw player overlay and HUD
      if (engine.player) {
        const p = engine.player;
        const px = Math.floor(p.x - engine.cameraX);
        const py = Math.floor(p.y - engine.cameraY);
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
      const vx = Math.floor(((e.clientX - rect.left) / rect.width) * VIEW_W);
      const vy = Math.floor(((e.clientY - rect.top) / rect.height) * VIEW_H);
      const x = vx + engine.cameraX;
      const y = vy + engine.cameraY;
      const { selected, brush } = useStore.getState();
      engine.paint(x, y, selected, brush);
    };
    const onMove = (e: PointerEvent) => {
      const rect = cvs.getBoundingClientRect();
      let vx = Math.floor(((e.clientX - rect.left) / rect.width) * VIEW_W);
      let vy = Math.floor(((e.clientY - rect.top) / rect.height) * VIEW_H);
      if (Number.isNaN(vx) || Number.isNaN(vy)) return;
      if (vx < 0) vx = 0;
      if (vy < 0) vy = 0;
      if (vx >= VIEW_W) vx = VIEW_W - 1;
      if (vy >= VIEW_H) vy = VIEW_H - 1;
      const x = vx + engine.cameraX;
      const y = vy + engine.cameraY;
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      const i = y * engine.grid.w + x;
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
      const update: Partial<
        Record<"left" | "right" | "jump" | "down", boolean>
      > = { [k]: true } as Record<string, boolean>;
      p.setInput(update);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const p = engine.player;
      if (!p) return;
      const k = key(e.code);
      if (!k) return;
      e.preventDefault();
      const update: Partial<
        Record<"left" | "right" | "jump" | "down", boolean>
      > = { [k]: false } as Record<string, boolean>;
      p.setInput(update);
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
