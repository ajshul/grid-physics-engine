import { create } from "zustand";
import type { Engine } from "../engine/engine";

interface UIState {
  selected: number;
  brush: number;
  speed: number;
  paused: boolean;
  overlay: "none" | "temp" | "pressure";
  engine: Engine | null;
  hovered?: {
    x: number;
    y: number;
    mat: number;
    temp: number;
    pressure: number;
    humidity: number;
  } | null;
}

export const useStore = create<UIState>(() => ({
  selected: 1,
  brush: 4,
  speed: 1,
  paused: false,
  overlay: "none",
  engine: null,
  hovered: null,
}));
