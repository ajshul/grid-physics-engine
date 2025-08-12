// Player tuning constants

// Movement and physics
export const PLAYER_MOVE_SPEED = 38; // cells/sec
export const PLAYER_AIR_ACCEL = 280; // cells/sec^2
export const PLAYER_GROUND_ACCEL = 800; // cells/sec^2
export const PLAYER_FRICTION = 700; // cells/sec^2 (grounded)
export const PLAYER_GRAVITY = 45; // cells/sec^2
export const PLAYER_MAX_FALL_SPEED = 55; // cells/sec
export const PLAYER_JUMP_SPEED = 22; // cells/sec
export const PLAYER_QUICK_TURN_BOOST = 3.2; // multiplier when reversing on ground

// Health and fire
export const PLAYER_BURN_DPS = 18;
export const PLAYER_CONTACT_DPS = 10;

// Collision sampling extents (in cells)
export const PLAYER_HALF_WIDTH = 1; // sample left/center/right at feet/head
export const PLAYER_FOOT_OFFSET = 2; // from center y to bottom of sprite
export const PLAYER_HEAD_OFFSET = 9; // from center y to top of sprite
export const PLAYER_SNAP_EPS = 0.001;
export const PLAYER_HEAD_CLEARANCE_EPS = 1.001;
export const PLAYER_CROUCH_DROP_TIME = 0.12; // seconds required holding down to fall through
export const PLAYER_CROUCH_DROP_COOLDOWN = 0.2; // seconds after dropping to avoid instant re-snap

// Rubber bounce behavior
export const RUBBER_BOUNCE_MIN_IMPACT = 8; // min magnitude to consider bounce
export const RUBBER_BOUNCE_MIN_VY = 14; // min upward vy after bounce
export const RUBBER_BOUNCE_FACTOR = 0.88; // fraction of impact speed -> upward

// Gas coupling
export const GAS_STEAM_UP_ACCEL = 16; // upward accel in steam
export const GAS_SMOKE_UP_ACCEL = 12; // upward accel in smoke
export const GAS_DRIFT_SCALE = 14; // velX/velY hint coupling
export const GAS_UPWARD_MAX_VY = -20; // clamp upward speed when riding gas

// Liquid coupling
export const LIQUID_BUOYANCY_ACCEL = 28; // upward accel when submerged
export const WATER_DRAG = 0.82; // multiplicative damping per second (vx)
export const LIQUID_JUMP_BOOST_RATIO = 0.6; // jump push when submerged
