// Core simulation constants centralized for maintainability

// Thermal
export const AMBIENT_TEMPERATURE_C = 20; // °C
export const CONDUCTION_SCALE_PER_SEC = 0.35; // base pairwise conduction coupling
export const LATENT_FUSION_ENERGY = 4000; // energy units to melt/freeze a cell
export const MAX_LATENT_STEP_AT_60HZ = 20; // per-step cap (scaled by dt*60)

// Pressure/Impulse
export const STATIC_PRESSURE_DECAY_PER_STEP = 0.95; // decays each 60Hz step
export const IMPULSE_DECAY_PER_STEP = 0.8; // faster decay for impulse
export const PRESSURE_DIFFUSION_ALPHA = 0.05; // blending weight for smoothing
export const IMPULSE_BLEND_FACTOR = 0.6; // fraction of impulse added to static

// Lava solidification (tunable)
// Temperature at/below which lava begins to solidify (°C)
export const LAVA_SOLIDIFY_TEMP_C = 180;
// Latent-like energy budget required (arbitrary energy units) before turning to Stone
export const LAVA_SOLIDIFY_ENERGY = 6000;
// Per-second cooling scale for lava toward ambient (smaller = slower cooling)
export const LAVA_COOLING_PER_SEC = 0.15;
