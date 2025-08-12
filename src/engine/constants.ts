// Core simulation constants centralized for maintainability

// Thermal
export const AMBIENT_TEMPERATURE_C = 20; // °C
export const CONDUCTION_SCALE_PER_SEC = 0.35; // base pairwise conduction coupling
export const LATENT_FUSION_ENERGY = 4000; // energy units to melt/freeze a cell
export const MAX_LATENT_STEP_AT_60HZ = 20; // per-step cap (scaled by dt*60)

// Thermal defaults by category/material (used when material lacks explicit values)
export const CONDUCTIVITY_DEFAULT_GAS = 0.03;
export const CONDUCTIVITY_DEFAULT_LIQUID = 0.15;
export const CONDUCTIVITY_DEFAULT_POWDER = 0.12;
export const CONDUCTIVITY_DEFAULT_SOLID = 0.2;
export const CONDUCTIVITY_DEFAULT_EMPTY = 0.1;

export const HEAT_CAPACITY_DEFAULT_GAS = 1.0;
export const HEAT_CAPACITY_DEFAULT_LIQUID = 4.0;
export const HEAT_CAPACITY_DEFAULT_POWDER = 0.6;
export const HEAT_CAPACITY_DEFAULT_SOLID = 0.9;
export const HEAT_CAPACITY_DEFAULT_EMPTY = 1.0;

export const MIN_EFFECTIVE_MASS = 0.2;

// Ambient and radiative cooling parameters
export const BASE_COOLING_SOLID_PER_SEC = 0.5;
export const BASE_COOLING_LIQUID_PER_SEC = 0.7;
export const BASE_COOLING_GAS_PER_SEC = 0.5;
export const EMPTY_COUPLING_PER_SEC = 6.0; // empty strongly coupled to ambient
export const STEAM_BASE_COOLING_PER_SEC = 0.05;
export const COOLANT_BOOST_WATER = 0.02;
export const COOLANT_BOOST_ICE = 0.035;
export const COOLANT_BOOST_FOAM = 0.01;
export const RADIATIVE_TEMP_START_C = 150;
export const RADIATIVE_TEMP_DIVISOR = 600;
export const RADIATIVE_COOLING_SCALE = 0.4;

// Painting presets / initial temperatures
export const ICE_INIT_TEMP_BELOW_C = -5; // place ice slightly below freezing
export const ICE_NEIGHBOR_CHILL_TO_C = 0;
export const LAVA_INIT_TEMP_C = 800;
export const WATER_INIT_TEMP_C = 25;
export const FIRE_INIT_TEMP_C = 420;

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
export const LAVA_SOLIDIFY_ACCUM_SCALE = 30; // contribution scale toward solidify budget (per sec)

// Lava neighborhood heating / preheat
export const LAVA_NEARBY_PREHEAT_BASE_BOOST_C = 80;
export const LAVA_NEARBY_PREHEAT_MAX_ADD_C = 120;
export const LAVA_NEARBY_PREHEAT_AMBIENT_DIFF_COEFF = -0.05; // (AMBIENT - T) * coeff
export const LAVA_NEIGHBOR_HEAT_FACTOR = 0.3; // factor applied to (T_lava - T_neighbor)
export const LAVA_NEIGHBOR_HEAT_MAX_ADD_C = 120;
export const LAVA_PREHEAT_NEIGHBOR_TARGET_MAX_C = 450;
export const LAVA_PREHEAT_NEIGHBOR_OFFSET_C = 200;

// Water boiling and steam condensation
export const WATER_BP_PRESSURE_CAP_C = 80; // max increase to boiling point from pressure
export const WATER_BP_PRESSURE_COEFF_SQRT = 0.8; // scale on sqrt(pressure)
export const WATER_BOIL_THRESHOLD_ENERGY = 6000;
export const WATER_BOIL_ACCUM_MULT_AT_60HZ = 10; // progress per second multiplier
export const WATER_BOIL_PROGRESS_DECAY_PER_SEC = 10; // decay rate per second when under BP
export const STEAM_CONDENSE_TEMP_C = 90;
export const STEAM_CONDENSE_AGE_MIN = 80;
export const STEAM_CONDENSE_NEAR_COOL_AGE_MIN = 40;

// Combustion and ignition
export const NEAR_LAVA_IGNITION_ADD_PER_60HZ = 12; // budget added per 60Hz frame when near lava
export const NEAR_LAVA_IGNITION_BUDGET = 24;
export const OIL_AUTO_IGNITE_TEMP_C = 250;
export const IGNITION_DETERMINISTIC_MARGIN_C = 40; // T >= threshold + margin
export const FOAM_HALO_SUPPRESSION_PER_NEIGHBOR = 0.15;
export const FOAM_HALO_MAX_SUPPRESSION = 0.5;
export const HUMIDITY_IGNITION_REDUCTION_SCALE = 0.6; // max fractional reduction
export const FIRE_NEIGHBOR_HEAT_DROP_C = 22;
export const FOAM_SUPPRESS_MAX_TEMP_C = 800;
export const FOAM_SUPPRESS_PERSIST_CHANCE_AT_HIGH_TEMP = 0.05;
export const BASE_IGNITION_CHANCE = 0.05;
export const TEMP_IGNITION_BOOST_CAP = 0.35;
export const TEMP_IGNITION_BOOST_DIVISOR = 600; // (T - threshold) / divisor
export const OIL_NEIGHBOR_IGNITION_BONUS_PER = 0.06;
export const OIL_NEIGHBOR_IGNITION_BONUS_CAP = 0.2;
export const FIRE_WOOD_SMOKE_EMIT_PROB = 0.08;
export const FIRE_BASE_LIFE_WOOD_FRAMES = 160;
export const FIRE_BASE_LIFE_OIL_FRAMES = 18;
export const FIRE_BASE_LIFE_DEFAULT_FRAMES = 25;
export const FIRE_COLD_NEIGHBOR_THRESHOLD = 3;
export const FIRE_NO_FUEL_BURNOUT_ACCEL = 2;
export const FIRE_QUENCH_WOOD_MAX_TEMP_C = 240;
export const FIRE_QUENCH_OIL_MAX_TEMP_C = 200;
export const FIRE_QUENCH_DEFAULT_MAX_TEMP_C = 220;
export const FIRE_COLD_NEIGHBOR_TEMP_C = 100;

// Ember lifecycle
export const EMBER_INITIAL_LIFE_STEPS = 500;
export const EMBER_COOL_DECAY_PER_STEP = 0.5;
export const EMBER_MIN_TEMP_C = 150;
export const EMBER_NEIGHBOR_WARM_DELTA_C = 12;
export const EMBER_REIGNITE_TEMP_C = 380;
export const EMBER_ASH_COOL_TEMP_C = 140;
export const EMBER_IGNITE_DUST_CHANCE = 0.35;
export const EMBER_CRUMBLE_AFTER_IGNITING_CHANCE = 0.15;
export const EMBER_FREE_FALL_CRUMBLE_CHANCE = 0.05;

// Smoke temperature clamp when produced from cooling fire
export const SMOKE_TEMP_CLAMP_MIN_C = 80;
export const SMOKE_TEMP_CLAMP_MAX_C = 220;
export const DUST_FLASH_DENSITY_THRESHOLD = 3;
export const DUST_FLASH_PROB = 0.2;
export const DUST_FLASH_IMPULSE_CENTER = 20;
export const DUST_FLASH_IMPULSE_NEIGHBOR = 12;

// Ice neighborhood cooling
export const ICE_NEIGHBOR_COOL_CLAMP_MIN_C = -40;
export const ICE_NEIGHBOR_COOL_DELTA_C = 0.8;

// Rubber thermal behavior
export const RUBBER_POP_TEMP_C = 260;

// Wood charring
export const WOOD_CHARRING_MIN_TEMP_C = 220;
export const WOOD_CHARRING_MAX_TEMP_C = 300;
export const WOOD_CHARRING_PROB_PER_STEP = 0.001;

// Foam decay
export const FOAM_DECAY_PROB_PER_STEP = 0.0005;

// Humidity mechanics
export const HUMIDITY_DECAY_PER_STEP = 1; // decrement per step
export const HUMIDITY_FROM_WATER_PER_STEP = 12;
export const HUMIDITY_FROM_FOAM_PER_STEP = 8;
export const HUMIDITY_FROM_ACID_PER_STEP = 10;
export const DUST_TO_MUD_PROB_PER_STEP = 0.1;
export const MUD_INITIAL_HUMIDITY = 200;
export const MUD_DRY_HUMIDITY_THRESHOLD = 40;
export const MUD_DRY_PROB_PER_STEP = 0.02;
export const MUD_WETTING_TRANSFER_PER_STEP_MAX = 6;
export const DUST_WETTING_AUX_THRESHOLD = 120;
export const MUD_WET_HUMIDITY_AFTER_CONVERT = 160;
export const WET_SLIP_REDUCTION = 0.4;
export const WIND_NUDGE_PER_AXIS = 0.1;

// Sand vitrification
export const SAND_VITRIFY_TEMP_C = 900;
export const SAND_VITRIFY_PROB_PER_STEP = 0.002;

// Gas behavior
export const BUOYANCY_TEMP_BASE_C = 100;
export const BUOYANCY_TEMP_DIVISOR = 100;
export const BUOYANCY_MAX_BOOST = 2;
export const BUBBLE_SWAP_BASE = 0.25;
export const BUBBLE_SWAP_BUOYANCY_FACTOR = 0.12;
export const HOT_BOOST_START_C = 100;
export const HOT_BOOST_DIVISOR = 150;
export const HOT_BOOST_MAX = 0.5;
export const GAS_UPWARD_BASE = 0.3;
export const GAS_UPWARD_BUOYANCY_FACTOR = 0.15;
export const GAS_UPWARD_MAX = 0.9;
export const GAS_DIAGONAL_SLIP_BASE = 0.5;
export const GAS_DIAGONAL_SLIP_BOOST = 0.2;
export const GAS_LATERAL_BIAS_TEMP_C = 110;
export const GAS_LATERAL_BIAS_RIGHT = 0.6;
export const GAS_LATERAL_BIAS_NEUTRAL = 0.5;
export const SMOKE_DISSIPATION_BASE = 0.015;
export const SMOKE_DISSIPATION_PRESSURE_BONUS_MAX = 0.03;
export const SMOKE_DISSIPATION_PRESSURE_DIVISOR = 4000;
export const VENTING_PRESSURE_DIFF_THRESHOLD = 2;
export const VENTING_CHANCE_BASE = 0.1;
export const VENTING_CHANCE_BUOYANCY_FACTOR = 0.05;

// Liquid behavior
export const WATER_LAVA_REACT_WATER_TEMP_C = 80;
export const WATER_LAVA_REACT_LAVA_TEMP_C = 500;
export const WATER_NEAR_BOIL_HOLD_DELTA_C = 5; // skip motion if within 5 C of BP
export const IMMISCIBILITY_DENSITY_DELTA_THRESHOLD = 1.5;
export const WATER_MOVE_INTO_HOT_GAS_COOL_DELTA_C = 2;
export const WATER_MOVE_COOL_MIN_TEMP_C = 50;
export const WATER_LAVA_REACTION_IMPULSE_RADIUS = 2;
export const REACTION_IMPULSE_RADIAL_SCALE = 4;

// Objects and explosions
export const BOMB_DEFAULT_FUSE_STEPS = 180;
export const METEOR_HEAT_NEIGHBORS_AMOUNT = 2.0;
export const BOMB_EXPLOSION_RADIUS = 8;
export const EXPLOSION_HEAT_C = 300;
export const IMPULSE_RADIAL_SCALE = 20;
export const EXPLOSION_SHRAPNEL_CHANCE = 0.05;
export const EXPLOSION_SHRAPNEL_MIN_RADIUS_FRAC = 0.5;

// Acid etching
export const ACID_ETCHANT_BUDGET_THRESHOLD = 100;
export const ACID_ETCHANT_GAIN_PER_60HZ = 8;
export const ACID_EXOTHERM_HEAT_C = 5;
export const ACID_HUMIDITY_INCREASE = 30;
export const ACID_SMOKE_EMIT_CONVERSIONS = 3;
