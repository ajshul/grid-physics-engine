import type { Engine } from "./engine";
import { front } from "./grid";
import { registry } from "./materials";
import {
  PLAYER_MOVE_SPEED,
  PLAYER_AIR_ACCEL,
  PLAYER_GROUND_ACCEL,
  PLAYER_FRICTION,
  PLAYER_GRAVITY,
  PLAYER_MAX_FALL_SPEED,
  PLAYER_JUMP_SPEED,
  PLAYER_QUICK_TURN_BOOST,
  PLAYER_HALF_WIDTH,
  PLAYER_FOOT_OFFSET,
  PLAYER_HEAD_OFFSET,
  PLAYER_SNAP_EPS,
  PLAYER_HEAD_CLEARANCE_EPS,
  PLAYER_BURN_DPS,
  PLAYER_CONTACT_DPS,
  PLAYER_CROUCH_DROP_TIME,
  PLAYER_CROUCH_DROP_COOLDOWN,
  POWDER_RISE_ACCEL,
  POWDER_RISE_MAX_UP_VY,
  RUBBER_BOUNCE_MIN_IMPACT,
  RUBBER_BOUNCE_MIN_VY,
  RUBBER_BOUNCE_FACTOR,
  GAS_STEAM_UP_ACCEL,
  GAS_SMOKE_UP_ACCEL,
  GAS_DRIFT_SCALE,
  GAS_UPWARD_MAX_VY,
  LIQUID_BUOYANCY_ACCEL,
  WATER_DRAG,
  LIQUID_JUMP_BOOST_RATIO,
} from "./player_constants";

type PlayerInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  down?: boolean;
};

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  onGround = false;
  health = 100;
  burning = false;
  spawnX: number;
  spawnY: number;
  input: PlayerInput = { left: false, right: false, jump: false, down: false };
  private downHold = 0;
  private dropCooldown = 0;

  // Tunables (cells are pixels)
  private readonly moveSpeed = PLAYER_MOVE_SPEED;
  private readonly airAcc = PLAYER_AIR_ACCEL;
  private readonly groundAcc = PLAYER_GROUND_ACCEL;
  private readonly friction = PLAYER_FRICTION;
  private readonly gravity = PLAYER_GRAVITY;
  private readonly maxFallSpeed = PLAYER_MAX_FALL_SPEED;
  private readonly jumpSpeed = PLAYER_JUMP_SPEED;
  private readonly burnDps = PLAYER_BURN_DPS;
  private readonly contactDps = PLAYER_CONTACT_DPS;
  // (fluid coupling tunables inline below for clarity)

  constructor(spawnX: number, spawnY: number) {
    this.x = spawnX;
    this.y = spawnY;
    this.spawnX = spawnX;
    this.spawnY = spawnY;
  }

  setInput(partial: Partial<PlayerInput>): void {
    this.input = { ...this.input, ...partial };
  }

  respawn(): void {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.health = 100;
    this.burning = false;
  }

  step(engine: Engine): void {
    const dt = engine.dt;
    const grid = front(engine.grid);
    const { w, h } = engine.grid;

    // update drop timers
    if (this.input.down) this.downHold = Math.min(5, this.downHold + dt);
    else this.downHold = 0;
    if (this.dropCooldown > 0)
      this.dropCooldown = Math.max(0, this.dropCooldown - dt);

    // Movement input → target velocity
    const want = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const targetVx = want * this.moveSpeed;
    const acc = this.onGround ? this.groundAcc : this.airAcc;
    if (targetVx !== 0) {
      const dv = targetVx - this.vx;
      const boost =
        this.onGround && Math.sign(this.vx) !== Math.sign(targetVx)
          ? PLAYER_QUICK_TURN_BOOST
          : 1;
      const step = Math.sign(dv) * acc * boost * dt;
      if (Math.abs(step) >= Math.abs(dv)) this.vx = targetVx;
      else this.vx += step;
    } else if (this.onGround) {
      // friction
      const dv = -this.vx;
      const step = Math.sign(dv) * this.friction * dt;
      if (Math.abs(step) >= Math.abs(dv)) this.vx = 0;
      else this.vx += step;
    }

    // Jump: only if on ground
    if (this.input.jump && this.onGround) {
      this.vy = -this.jumpSpeed;
      this.onGround = false;
    }

    // Gravity
    this.vy = Math.min(this.vy + this.gravity * dt, this.maxFallSpeed);

    // Integrate with simple discrete collision against blocking tiles
    const moveAxis = (dx: number, dy: number) => {
      const steps = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))
      );
      const sx = dx / steps;
      const sy = dy / steps;
      const halfW = PLAYER_HALF_WIDTH;
      const footOffset = PLAYER_FOOT_OFFSET;
      const headOffset = PLAYER_HEAD_OFFSET;
      for (let s = 0; s < steps; s++) {
        // Horizontal
        if (sx !== 0) {
          const nx = this.x + sx;
          const tx = Math.floor(nx);
          // sample feet and head since sprite is taller now
          const tyFoot = Math.floor(this.y + footOffset);
          const tyHead = Math.floor(this.y - headOffset);
          const iFoot = tyFoot * w + tx;
          const iHead = tyHead * w + tx;
          const hitFoot =
            iFoot >= 0 && iFoot < w * h && this.isBlocking(grid.mat[iFoot]);
          const hitHead =
            iHead >= 0 && iHead < w * h && this.isBlocking(grid.mat[iHead]);
          if (hitFoot || hitHead) {
            // hit wall
            this.vx = 0;
          } else {
            this.x = nx;
          }
        }
        // Vertical
        if (sy !== 0) {
          const ny = this.y + sy;
          const txCenter = Math.floor(this.x);
          if (sy > 0) {
            // moving down: test at feet row across 3 samples
            const tyBottom = Math.floor(ny + footOffset);
            const iL = tyBottom * w + (txCenter - halfW);
            const iC = tyBottom * w + txCenter;
            const iR = tyBottom * w + (txCenter + halfW);
            const hitL = iL >= 0 && iL < w * h && this.isBlocking(grid.mat[iL]);
            const hitC = iC >= 0 && iC < w * h && this.isBlocking(grid.mat[iC]);
            const hitR = iR >= 0 && iR < w * h && this.isBlocking(grid.mat[iR]);
            const liquidBelow = [iL, iC, iR].some(
              (k) => k >= 0 && k < w * h && this.isLiquid(grid.mat[k])
            );
            const powderBelow = [iL, iC, iR].some(
              (k) => registry[grid.mat[k]]?.category === "powder"
            );
            const requestDrop =
              !!this.input.down &&
              this.downHold >= PLAYER_CROUCH_DROP_TIME &&
              this.dropCooldown <= 0;
            const allowDrop = requestDrop && (powderBelow || liquidBelow);
            if ((hitL || hitC || hitR || liquidBelow) && !allowDrop) {
              // snap to surface
              this.y = tyBottom - footOffset - PLAYER_SNAP_EPS;
              // rubber bounce
              const onRubber = [iL, iC, iR].some(
                (k) => registry[grid.mat[k]]?.name === "Rubber"
              );
              if (onRubber) {
                const speed = Math.max(
                  RUBBER_BOUNCE_MIN_IMPACT,
                  Math.abs(this.vy)
                );
                this.vy = -Math.max(
                  RUBBER_BOUNCE_MIN_VY,
                  speed * RUBBER_BOUNCE_FACTOR
                );
                this.onGround = false;
              } else {
                this.vy = 0;
                this.onGround = true;
              }
            } else if (allowDrop) {
              // pass down through and start a small cooldown to avoid re-snapping immediately
              this.y = ny;
              this.onGround = false;
              this.dropCooldown = PLAYER_CROUCH_DROP_COOLDOWN;
              // Displace a column of powder/liquid upward to free space below feet
              const g = grid;
              const copyFromTo = (src: number, dst: number) => {
                g.mat[dst] = g.mat[src];
                g.temp[dst] = g.temp[src];
                g.velX[dst] = g.velX[src];
                g.velY[dst] = g.velY[src];
                g.flags[dst] = g.flags[src];
                g.pressure[dst] = g.pressure[src];
                g.impulse[dst] = g.impulse[src];
                g.aux[dst] = g.aux[src];
                g.humidity[dst] = g.humidity[src];
                g.phase[dst] = g.phase[src];
              };
              const clearCell = (idx: number) => {
                g.mat[idx] = 0;
              };
              const tryLiftColumn = (baseIdx: number) => {
                if (baseIdx < 0 || baseIdx >= w * h) return false;
                const cat = registry[g.mat[baseIdx]]?.category;
                if (cat !== "powder" && cat !== "liquid") return false;
                const maxScan = Math.min(engine.grid.h, 128);
                let top = baseIdx;
                for (let n = 1; n <= maxScan; n++) {
                  const cand = baseIdx - n * w;
                  if (cand < 0) break;
                  const id = g.mat[cand];
                  const ccat = registry[id]?.category;
                  if (id === 0 || ccat === "gas") {
                    top = cand;
                    break;
                  }
                }
                if (top === baseIdx) return false; // no space found
                // shift [baseIdx-w..top] upward by one cell
                for (let k = top; k <= baseIdx - w; k += w) {
                  copyFromTo(k + w, k);
                }
                clearCell(baseIdx);
                return true;
              };
              const bases = [iC, iL, iR];
              for (let rep = 0; rep < 2; rep++) {
                for (const b of bases) {
                  if (!tryLiftColumn(b)) {
                    const left = b + w - 1;
                    const right = b + w + 1;
                    if (
                      left >= 0 &&
                      left < w * h &&
                      (g.mat[left] === 0 ||
                        registry[g.mat[left]]?.category === "gas") &&
                      (registry[g.mat[b]]?.category === "powder" ||
                        registry[g.mat[b]]?.category === "liquid")
                    ) {
                      copyFromTo(b, left);
                      clearCell(b);
                    } else if (
                      right >= 0 &&
                      right < w * h &&
                      (g.mat[right] === 0 ||
                        registry[g.mat[right]]?.category === "gas") &&
                      (registry[g.mat[b]]?.category === "powder" ||
                        registry[g.mat[b]]?.category === "liquid")
                    ) {
                      copyFromTo(b, right);
                      clearCell(b);
                    }
                  }
                }
              }
            } else {
              this.y = ny;
              this.onGround = false;
            }
          } else {
            // moving up: test head row
            const tyTop = Math.floor(ny - headOffset);
            const iL = tyTop * w + (txCenter - halfW);
            const iC = tyTop * w + txCenter;
            const iR = tyTop * w + (txCenter + halfW);
            const hitL = iL >= 0 && iL < w * h && this.isBlocking(grid.mat[iL]);
            const hitC = iC >= 0 && iC < w * h && this.isBlocking(grid.mat[iC]);
            const hitR = iR >= 0 && iR < w * h && this.isBlocking(grid.mat[iR]);
            const powderAhead = [iL, iC, iR].some(
              (k) => registry[grid.mat[k]]?.category === "powder"
            );
            if (hitL || hitC || hitR) {
              if (powderAhead && this.input.jump) {
                // Attempt to lift the powder column above the head to create space
                const g = grid;
                const copyFromTo = (src: number, dst: number) => {
                  g.mat[dst] = g.mat[src];
                  g.temp[dst] = g.temp[src];
                  g.velX[dst] = g.velX[src];
                  g.velY[dst] = g.velY[src];
                  g.flags[dst] = g.flags[src];
                  g.pressure[dst] = g.pressure[src];
                  g.impulse[dst] = g.impulse[src];
                  g.aux[dst] = g.aux[src];
                  g.humidity[dst] = g.humidity[src];
                  g.phase[dst] = g.phase[src];
                };
                const clearCell = (idx: number) => {
                  g.mat[idx] = 0;
                };
                const tryLiftAbove = (baseIdx: number) => {
                  if (baseIdx < 0 || baseIdx >= w * h) return false;
                  if (registry[g.mat[baseIdx]]?.category !== "powder")
                    return false;
                  const maxScan = 12;
                  let top = baseIdx;
                  for (let n = 1; n <= maxScan; n++) {
                    const cand = baseIdx - n * w;
                    if (cand < 0) break;
                    const id = g.mat[cand];
                    const cat = registry[id]?.category;
                    if (id === 0 || cat === "gas") {
                      top = cand;
                      break;
                    }
                  }
                  if (top === baseIdx) return false;
                  for (let k = top; k <= baseIdx - w; k += w) {
                    copyFromTo(k + w, k);
                  }
                  clearCell(baseIdx);
                  return true;
                };
                const heads = [iC, iL, iR];
                let lifted = false;
                for (const b of heads) lifted = tryLiftAbove(b) || lifted;
                if (lifted) this.y = ny;
                else {
                  this.y = tyTop + headOffset + PLAYER_HEAD_CLEARANCE_EPS;
                  this.vy = 0;
                }
              } else {
                this.y = tyTop + headOffset + PLAYER_HEAD_CLEARANCE_EPS;
                this.vy = 0;
              }
            } else {
              this.y = ny;
            }
          }
        }
      }
    };

    moveAxis(this.vx * dt, this.vy * dt);

    // Clamp to bounds, treat edges as blocking
    this.x = Math.max(0, Math.min(w - 1e-3, this.x));
    this.y = Math.max(0, Math.min(h - 1e-3, this.y));

    // Interactions: fire/lava damages and ignites; water/foam quenches
    const cx = Math.floor(this.x);
    const cy = Math.floor(this.y);
    const i = cy * w + cx;
    const here = grid.mat[i] | 0;

    const neighbors = [i, i - 1, i + 1, i - w, i + w].filter(
      (j) => j >= 0 && j < w * h
    );
    const near = (name: string) =>
      neighbors.some((j) => registry[grid.mat[j]]?.name === name);
    // helper available if needed later

    const matName = registry[here]?.name;
    const temp = grid.temp[i];

    // Quenching first
    if (near("Water") || near("Foam")) {
      this.burning = false;
    }

    // Ignite if touching fire/lava or very hot air
    if (near("Fire") || near("Lava") || temp > 240) {
      this.burning = true;
    }

    // Damage
    if (this.burning) {
      this.health -= this.burnDps * dt;
      if (near("Fire") || near("Lava")) this.health -= this.contactDps * dt;
    }
    // Standing directly in lava hurts even if not flagged burning yet
    if (matName === "Lava")
      this.health -= (this.burnDps + this.contactDps) * dt;

    // Gentle healing when safe in water/foam
    if (!this.burning && (matName === "Water" || matName === "Foam")) {
      this.health = Math.min(100, this.health + 4 * dt);
    }

    if (this.health <= 0) this.respawn();

    // Fluid coupling after main interactions
    const isHereGas = registry[here]?.category === "gas";
    if (isHereGas) {
      const name = registry[here]?.name;
      if (name === "Steam") this.vy -= GAS_STEAM_UP_ACCEL * dt;
      else if (name === "Smoke") this.vy -= GAS_SMOKE_UP_ACCEL * dt;
      // drift with local gas velocity hints
      const vxHint = grid.velX[i] | 0;
      const vyHint = grid.velY[i] | 0;
      this.vx += vxHint * GAS_DRIFT_SCALE * dt;
      this.vy += vyHint * GAS_DRIFT_SCALE * dt;
      if (this.vy < GAS_UPWARD_MAX_VY) this.vy = GAS_UPWARD_MAX_VY;
    }
    const isHereLiquid = registry[here]?.category === "liquid";
    if (isHereLiquid) {
      this.vy -= LIQUID_BUOYANCY_ACCEL * dt;
      const damp = Math.pow(WATER_DRAG, dt);
      this.vx *= damp;
      if (
        this.input.jump &&
        this.vy > -this.jumpSpeed * LIQUID_JUMP_BOOST_RATIO
      )
        this.vy = -this.jumpSpeed * LIQUID_JUMP_BOOST_RATIO;
    }
    // Powder rising: if buried inside powder and holding jump/up, nudge upward
    const isHerePowder = registry[here]?.category === "powder";
    if (isHerePowder && this.input.jump) {
      this.vy -= POWDER_RISE_ACCEL * dt;
      if (this.vy < POWDER_RISE_MAX_UP_VY) this.vy = POWDER_RISE_MAX_UP_VY;
    }
  }

  private isBlocking(id: number): boolean {
    const m = registry[id];
    if (!m) return false;
    if (m.category === "solid" || m.category === "object") return true;
    if (m.category === "powder") return true; // treat powders as ground
    // liquids are non-blocking for simple swimming behavior
    return false;
  }

  private isLiquid(id: number): boolean {
    const m = registry[id];
    return !!m && m.category === "liquid";
  }
}
