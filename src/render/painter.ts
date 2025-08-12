export type OverlayKind = "none" | "temp" | "pressure";

export interface GridForBlit {
  mat: Uint16Array;
  temp: Float32Array;
  pressure: Int16Array;
}

export function blit(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  grid: GridForBlit,
  palette: Uint32Array,
  w: number,
  h: number,
  dirtyChunks: Set<number>,
  chunkSize = 64,
  overlay: OverlayKind = "none"
): void {
  const data = new Uint32Array(imageData.data.buffer);
  const fullRedraw =
    dirtyChunks.size === 0 ||
    dirtyChunks.size > ((w * h) / (chunkSize * chunkSize)) * 0.6;
  if (fullRedraw) {
    drawRect(0, 0, w, h);
  } else {
    for (const key of dirtyChunks) {
      const cx = key & 0xffff;
      const cy = key >>> 16;
      const x0 = cx * chunkSize;
      const y0 = cy * chunkSize;
      const x1 = Math.min(w, x0 + chunkSize);
      const y1 = Math.min(h, y0 + chunkSize);
      drawRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  ctx.putImageData(imageData, 0, 0);

  function drawRect(x0: number, y0: number, width: number, height: number) {
    const { mat, temp, pressure } = grid;
    const x1 = x0 + width;
    const y1 = y0 + height;
    for (let y = y0; y < y1; y++) {
      const row = y * w;
      for (let x = x0; x < x1; x++) {
        const i = row + x;
        const base = palette[mat[i]] || 0x00000000;
        if (overlay === "none") {
          data[i] = base;
          continue;
        }
        const ov = overlayColor(overlay, temp[i], pressure[i]);
        data[i] = blendABGR(
          base,
          ov,
          overlayAlpha(overlay, temp[i], pressure[i])
        );
      }
    }
  }
}

export function makePalette(colors: number[]): Uint32Array {
  const pal = new Uint32Array(colors.length);
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i] || 0;
    const r = (c >> 16) & 255;
    const g = (c >> 8) & 255;
    const b = c & 255;
    pal[i] = (255 << 24) | (b << 16) | (g << 8) | r; // ABGR for putImageData
  }
  return pal;
}

function overlayColor(
  kind: OverlayKind,
  temp: number,
  pressure: number
): number {
  switch (kind) {
    case "temp": {
      // map 0..600 C to blue→red gradient
      const t = clamp01(temp / 600);
      // simple gradient via two stops: blue (0,0,255) to red (255,64,0)
      const r = (t * 255) | 0;
      const g = (t * 64) | 0;
      const b = ((1 - t) * 255) | 0;
      return packABGR(255, r, g, b);
    }
    case "pressure": {
      // map -200..200 to blue(-) to white(0) to red(+)
      const p = Math.max(-200, Math.min(200, pressure | 0));
      const t = (p + 200) / 400; // 0..1
      const r = (t * 255) | 0;
      const g = ((1 - Math.abs(t - 0.5) * 2) * 255) | 0; // white near zero
      const b = ((1 - t) * 255) | 0;
      return packABGR(255, r, g, b);
    }
    default:
      return 0x00000000;
  }
}

function overlayAlpha(
  kind: OverlayKind,
  temp: number,
  pressure: number
): number {
  switch (kind) {
    case "temp":
      // visualize both cold and hot relative to ambient (20 C)
      return clamp01(Math.abs(temp - 20) / 200) * 0.6;
    case "pressure":
      return Math.min(0.6, Math.abs(pressure) / 200) * 0.5;
    default:
      return 0;
  }
}

function packABGR(a: number, r: number, g: number, b: number): number {
  return ((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

function blendABGR(base: number, overlay: number, alpha: number): number {
  if (alpha <= 0) return base;
  const a = clamp01(alpha);
  const br = base & 255;
  const bg = (base >>> 8) & 255;
  const bb = (base >>> 16) & 255;
  const or = overlay & 255;
  const og = (overlay >>> 8) & 255;
  const ob = (overlay >>> 16) & 255;
  const r = (br * (1 - a) + or * a) | 0;
  const g = (bg * (1 - a) + og * a) | 0;
  const b = (bb * (1 - a) + ob * a) | 0;
  return packABGR(255, r, g, b);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
