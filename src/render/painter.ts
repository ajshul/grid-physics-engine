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
  viewW: number,
  viewH: number,
  worldW: number,
  worldH: number,
  viewX: number,
  viewY: number,
  _dirtyChunks: Set<number>,
  _chunkSize = 64,
  overlay: OverlayKind = "none"
): void {
  const data = new Uint32Array(imageData.data.buffer);
  // Always redraw the viewport; it is relatively small.
  const { mat, temp, pressure } = grid;
  for (let yv = 0; yv < viewH; yv++) {
    const yw = yv + viewY;
    if (yw < 0 || yw >= worldH) continue;
    const rowView = yv * viewW;
    const rowWorld = yw * worldW;
    for (let xv = 0; xv < viewW; xv++) {
      const xw = xv + viewX;
      if (xw < 0 || xw >= worldW) continue;
      const iWorld = rowWorld + xw;
      const iView = rowView + xv;
      const base = palette[mat[iWorld]] || 0x00000000;
      if (overlay === "none") {
        data[iView] = base;
      } else {
        const ov = overlayColor(overlay, temp[iWorld], pressure[iWorld]);
        data[iView] = blendABGR(
          base,
          ov,
          overlayAlpha(overlay, temp[iWorld], pressure[iWorld])
        );
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
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
