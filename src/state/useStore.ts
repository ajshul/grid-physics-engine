import { create } from "zustand";

interface UIState {
  selected: number;
  brush: number;
  speed: number;
  paused: boolean;
  overlay: "none" | "temp" | "pressure";
}

export const useStore = create<UIState>(() => ({
  selected: 1,
  brush: 4,
  speed: 1,
  paused: false,
  overlay: "none",
}));


