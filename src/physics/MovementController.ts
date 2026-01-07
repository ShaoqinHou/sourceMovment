import * as THREE from 'three';
import { MovementConfig } from '../config/MovementConfig';
import { MovementInput } from '../core/InputManager';

/**
 * Player movement state flags
 */
export interface PlayerState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  viewAngles: { pitch: number; yaw: number }; // radians
  isGrounded: boolean;
  isOnSlope: boolean;  // On a surf ramp
  isCrouching: boolean;
  isOnLadder: boolean;
  groundNormal: THREE.Vector3;
  jumpQueued: boolean;
  lastJumpTime: number;
}

/**
 * Collision info from world
 */
export interface CollisionResult {
  grounded: boolean;
  groundNormal: THREE.Vector3;
  isSlope: boolean;       // Surface is a surf ramp
  isLadder: boolean;
  newPosition: THREE.Vector3;
  hitWall: boolean;
}

/**
 * Collision callback type
 */
export type CollisionCallback = (
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  height: number
) => CollisionResult;

/**
 * Quake 3 / Source Engine Movement Controller
 *
 * Key Mechanics:
 * - Ground acceleration with friction
 * - Air acceleration for strafe jumping
 * - CPM air control (turning without strafing)
 * - Bunny hopping (no friction on jump frame)
 *
 * STRAFE JUMPING TECHNIQUE:
 * - Do NOT hold W in air for optimal speed gain
 * - Hold A or D (strafe key)
 * - Turn mouse in the same direction as strafe
 * - This keeps wishdir perpendicular to velocity = maximum acceleration
 * - Jump immediately upon landing to preserve speed
 *
 * Reference: Quake III Arena bg_pmove.c + Source engine
 */
export class MovementController {
  private config: MovementConfig;
  private state: PlayerState;
  private collisionCallback: CollisionCallback | null = null;

  // Player dimensions (Quake units)
  public readonly PLAYER_HEIGHT = 56;
  public readonly PLAYER_HEIGHT_CROUCH = 32;
  public readonly PLAYER_WIDTH = 32;
  public readonly EYE_HEIGHT = 48;
  public readonly EYE_HEIGHT_CROUCH = 24;

  // Temporary vectors (reused for performance)
  private tempVec = new THREE.Vector3();
  private wishDir = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();

  // Debug info (exposed for HUD)
  public debugInfo = {
    // Input
    forwardInput: 0,
    rightInput: 0,
    jumpInput: false,
    // Velocity
    speed: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    // Acceleration
    wishDirX: 0,
    wishDirZ: 0,
    wishSpeed: 0,
    currentSpeed: 0,  // dot product of velocity and wishdir
    addSpeed: 0,      // wishspeed - currentspeed
    accelSpeed: 0,    // actual acceleration applied
    airAccel: 1,
    velWishAngle: 0,  // angle between velocity and wishdir (degrees)
    // CPM
    isStrafingOnly: false,
    airControlActive: false,
    // State
    isGrounded: true,
    isAir: false,
  };

  constructor(config: MovementConfig) {
    this.config = config;
    this.state = this.createDefaultState();
  }

  private createDefaultState(): PlayerState {
    return {
      position: new THREE.Vector3(0, this.EYE_HEIGHT, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      viewAngles: { pitch: 0, yaw: 0 },
      isGrounded: true,
      isOnSlope: false,
      isCrouching: false,
      isOnLadder: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      jumpQueued: false,
      lastJumpTime: 0,
    };
  }

  /**
   * Update config (for preset switching)
   */
  setConfig(config: MovementConfig): void {
    this.config = config;
  }

  /**
   * Get current config
   */
  getConfig(): MovementConfig {
    return this.config;
  }

  /**
   * Get current player state
   */
  getState(): PlayerState {
    return this.state;
  }

  /**
   * Set collision callback
   */
  setCollisionCallback(callback: CollisionCallback): void {
    this.collisionCallback = callback;
  }

  /**
   * Update view angles from mouse input
   */
  updateViewAngles(deltaX: number, deltaY: number, sensitivity: number): void {
    this.state.viewAngles.yaw -= deltaX * sensitivity;
    this.state.viewAngles.pitch -= deltaY * sensitivity;

    // Clamp pitch to prevent flipping
    const maxPitch = Math.PI / 2 - 0.01;
    this.state.viewAngles.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.state.viewAngles.pitch));

    // Normalize yaw
    while (this.state.viewAngles.yaw > Math.PI) this.state.viewAngles.yaw -= Math.PI * 2;
    while (this.state.viewAngles.yaw < -Math.PI) this.state.viewAngles.yaw += Math.PI * 2;
  }

  /**
   * Set view angles directly (for testing)
   * @param yaw - Horizontal angle in radians
   * @param pitch - Vertical angle in radians (optional, defaults to 0)
   */
  setViewAngles(yaw: number, pitch: number = 0): void {
    this.state.viewAngles.yaw = yaw;
    this.state.viewAngles.pitch = pitch;
  }

  /**
   * Main movement update - runs at fixed timestep
   */
  update(input: MovementInput, dt: number): void {
    const config = this.config;

    // Update debug input values
    this.debugInfo.forwardInput = input.forward;
    this.debugInfo.rightInput = input.right;
    this.debugInfo.jumpInput = input.jump;

    // Handle crouching
    this.state.isCrouching = input.crouch;

    // Calculate forward and right vectors (ignore pitch for movement)
    // Three.js camera looks down -Z axis, so forward is -Z direction
    this.forward.set(
      -Math.sin(this.state.viewAngles.yaw),
      0,
      -Math.cos(this.state.viewAngles.yaw)
    ).normalize();

    // Right is perpendicular to forward (rotated 90 degrees clockwise around Y)
    this.right.set(
      Math.cos(this.state.viewAngles.yaw),
      0,
      -Math.sin(this.state.viewAngles.yaw)
    ).normalize();

    // Calculate wish direction from input
    this.wishDir.set(0, 0, 0);
    if (input.forward !== 0) {
      this.wishDir.addScaledVector(this.forward, input.forward);
    }
    if (input.right !== 0) {
      this.wishDir.addScaledVector(this.right, input.right);
    }

    // Calculate wish speed
    let wishSpeed = 0;
    if (this.wishDir.lengthSq() > 0) {
      this.wishDir.normalize();
      wishSpeed = config.pm_maxspeed;

      if (this.state.isCrouching) {
        wishSpeed *= config.pm_crouchspeed;
      }
    }

    // Queue jump (for bunny hop timing)
    if (input.jump && !this.state.jumpQueued) {
      this.state.jumpQueued = true;
    }

    // Main movement logic
    if (this.state.isOnLadder) {
      this.moveLadder(input, dt);
    } else if (this.state.isOnSlope) {
      this.moveSurf(wishSpeed, dt);
    } else if (this.state.isGrounded) {
      this.moveGround(wishSpeed, input, dt);
    } else {
      this.moveAir(wishSpeed, input, dt);
    }

    // Apply gravity (unless on ladder or grounded)
    if (!this.state.isOnLadder && !this.state.isGrounded) {
      this.state.velocity.y -= config.g_gravity * dt;
    }

    // Apply velocity to position
    this.tempVec.copy(this.state.velocity).multiplyScalar(dt);
    this.state.position.add(this.tempVec);

    // Collision detection and response
    if (this.collisionCallback) {
      const height = this.state.isCrouching ? this.PLAYER_HEIGHT_CROUCH : this.PLAYER_HEIGHT;
      const result = this.collisionCallback(
        this.state.position,
        this.state.velocity,
        height
      );

      this.state.position.copy(result.newPosition);
      this.state.isGrounded = result.grounded;
      this.state.groundNormal.copy(result.groundNormal);
      this.state.isOnSlope = result.isSlope;
      this.state.isOnLadder = result.isLadder;

      // Stop vertical velocity when hitting ground
      if (result.grounded && this.state.velocity.y < 0) {
        this.state.velocity.y = 0;
      }

      // Stop velocity into walls (don't bounce, just stop)
      if (result.hitWall) {
        // Only zero out the velocity component going into the wall
        const dot = this.state.velocity.dot(result.groundNormal);
        if (dot < 0) {
          // Moving into wall - remove that component
          this.state.velocity.x -= result.groundNormal.x * dot;
          this.state.velocity.z -= result.groundNormal.z * dot;
        }
      }
    }

    // Reset jump queue if not pressing jump
    if (!input.jump) {
      this.state.jumpQueued = false;
    }

    // Update debug velocity and state info (at end of frame)
    this.debugInfo.speed = Math.round(this.getHorizontalSpeed());
    this.debugInfo.vx = this.state.velocity.x;
    this.debugInfo.vy = this.state.velocity.y;
    this.debugInfo.vz = this.state.velocity.z;
    this.debugInfo.isGrounded = this.state.isGrounded;
    this.debugInfo.isAir = !this.state.isGrounded && !this.state.isOnLadder;
  }

  /**
   * Ground movement with friction and acceleration
   */
  private moveGround(wishSpeed: number, input: MovementInput, dt: number): void {
    const config = this.config;

    // Update debug info for ground movement
    this.debugInfo.wishDirX = this.wishDir.x;
    this.debugInfo.wishDirZ = this.wishDir.z;
    this.debugInfo.wishSpeed = wishSpeed;
    this.debugInfo.airAccel = config.pm_accelerate;
    this.debugInfo.isStrafingOnly = false;
    this.debugInfo.airControlActive = false;

    // Check for jump - this is the bunny hop window
    // Jump happens BEFORE friction is applied
    if (this.state.jumpQueued) {
      this.jump();
      this.moveAir(wishSpeed, input, dt);
      return;
    }

    // Apply friction
    this.applyFriction(dt);

    // Accelerate
    this.accelerate(this.wishDir, wishSpeed, config.pm_accelerate, dt);
  }

  /**
   * Air movement - Quake 3 / CPM style
   *
   * Based on actual CPMA source code:
   * https://www.origamiparade.com/programming-projects/openarena/freepromode/
   *
   * CPM Strafe Detection (from source):
   * - rightmove != 0 && forwardmove == 0 -> use strafeaccelerate (100)
   * - Otherwise -> use airaccelerate (1)
   *
   * Air Control (from source):
   * - Activates when: rightmove == 0 && forwardmove != 0 && wishspeed <= currentspeed
   * - Allows turning without adding speed
   */
  private moveAir(wishSpeed: number, input: MovementInput, dt: number): void {
    const config = this.config;

    // Air wish speed is capped to 30 (CPM default: g_wishspeed)
    // This is the "magic number" for strafe jumping
    const airWishSpeed = Math.min(wishSpeed, config.cpm_wishspeed || 30);

    // CPM STRAFE DETECTION (from actual source code):
    // Check RAW input values, not the calculated wishDir!
    // Condition: forwardmove == 0 && rightmove != 0
    const isStrafingOnly = input.forward === 0 && input.right !== 0;

    // Use different acceleration based on CPM strafe detection
    let airAccel = config.pm_airaccelerate; // Default = 1

    if (config.cpm_strafeaccelerate > 0 && isStrafingOnly) {
      // CPM strafe mode: use strafeaccelerate (100 for CPM!)
      airAccel = config.cpm_strafeaccelerate;
    }

    // Update debug info
    this.debugInfo.wishDirX = this.wishDir.x;
    this.debugInfo.wishDirZ = this.wishDir.z;
    this.debugInfo.wishSpeed = airWishSpeed;
    this.debugInfo.airAccel = airAccel;
    this.debugInfo.isStrafingOnly = isStrafingOnly;
    this.debugInfo.airControlActive = false;

    // Apply air acceleration
    this.accelerate(this.wishDir, airWishSpeed, airAccel, dt);

    // CPM AIR CONTROL (from actual source code)
    // Activates when:
    // - rightmove == 0 (NOT strafing)
    // - forwardmove != 0 (holding W or S)
    // - wishspeed <= currentspeed (already going faster than wishdir in that direction)
    if (config.cpm_aircontrol > 0 && input.right === 0 && input.forward !== 0) {
      const currentSpeed = this.state.velocity.dot(this.wishDir);
      if (wishSpeed <= currentSpeed) {
        this.debugInfo.airControlActive = true;
        this.applyAirControl();
      }
    }
  }

  /**
   * CPM Air Control - from actual CPMA source code
   *
   * Original C code:
   * zspeed = pm->ps->velocity[2];
   * pm->ps->velocity[2] = 0;
   * speed = VectorLength(pm->ps->velocity);
   * pm->ps->velocity[0] += wishdir[0] * speed * g_aircontrol.value;
   * pm->ps->velocity[1] += wishdir[1] * speed * g_aircontrol.value;
   * VectorNormalize(pm->ps->velocity);
   * for (i=0; i<2; i++)
   *     pm->ps->velocity[i] = speed*pm->ps->velocity[i];
   * pm->ps->velocity[2] = zspeed;
   *
   * Recommended g_aircontrol value: 0.02
   */
  private applyAirControl(): void {
    const config = this.config;

    // Get horizontal speed (length of velocity on XZ plane)
    const speed = Math.sqrt(
      this.state.velocity.x * this.state.velocity.x +
      this.state.velocity.z * this.state.velocity.z
    );

    if (speed < 0.1) return;

    // Save vertical velocity
    const zSpeed = this.state.velocity.y;

    // Zero out vertical component for calculation
    this.state.velocity.y = 0;

    // Get horizontal velocity direction and add wishdir contribution
    // Formula: velocity += wishdir * speed * g_aircontrol
    this.state.velocity.x += this.wishDir.x * speed * config.cpm_aircontrol;
    this.state.velocity.z += this.wishDir.z * speed * config.cpm_aircontrol;

    // Normalize to unit length
    const len = Math.sqrt(
      this.state.velocity.x * this.state.velocity.x +
      this.state.velocity.z * this.state.velocity.z
    );

    if (len > 0) {
      // Restore original horizontal speed
      this.state.velocity.x = (this.state.velocity.x / len) * speed;
      this.state.velocity.z = (this.state.velocity.z / len) * speed;
    }

    // Restore vertical velocity
    this.state.velocity.y = zSpeed;
  }

  /**
   * Surf ramp movement
   */
  private moveSurf(wishSpeed: number, dt: number): void {
    const config = this.config;

    // Apply reduced friction on surf ramps
    this.applyFriction(dt, config.pm_slickfriction);

    // Accelerate along the ramp
    this.accelerate(this.wishDir, wishSpeed, config.pm_slickaccel, dt);

    // Gravity pulls down the slope
    // Project gravity onto slope plane for sliding effect
    if (!this.state.isGrounded) {
      this.state.velocity.y -= config.g_gravity * dt * 0.5;
    }
  }

  /**
   * Ladder movement - CS style: W = up, S = down
   */
  private moveLadder(input: MovementInput, _dt: number): void {
    const config = this.config;
    const ladderSpeed = config.pm_ladderSpeed;

    // Slow down horizontal velocity on ladder
    this.state.velocity.x *= 0.9;
    this.state.velocity.z *= 0.9;

    // Simple vertical movement: W = up, S = down (like CS)
    if (input.forward > 0) {
      // W = climb up
      this.state.velocity.y = ladderSpeed;
    } else if (input.forward < 0) {
      // S = climb down
      this.state.velocity.y = -ladderSpeed;
    } else {
      // No input = slow stop
      this.state.velocity.y *= 0.8;
    }

    // Jump off ladder
    if (this.state.jumpQueued) {
      this.state.isOnLadder = false;
      // Push away from ladder in look direction
      this.state.velocity.addScaledVector(this.forward, 200);
      this.state.velocity.y = config.pm_jumpvelocity * 0.5;
      this.state.jumpQueued = false;
    }
  }

  /**
   * Apply jump velocity
   */
  private jump(): void {
    this.state.velocity.y = this.config.pm_jumpvelocity;
    this.state.isGrounded = false;
    this.state.jumpQueued = false;
    this.state.lastJumpTime = performance.now();
  }

  /**
   * Core acceleration function (Quake-style)
   *
   * THE KEY TO STRAFE JUMPING:
   * We only limit the projection of velocity onto wish direction.
   * This means:
   * - When wishdir is perpendicular to velocity: currentSpeed = 0, MAX acceleration
   * - When wishdir is aligned with velocity: currentSpeed = speed, NO acceleration
   *
   * This is why you should NOT hold W in air for optimal strafe jumping!
   * Holding W makes wishdir align with velocity = minimal acceleration.
   * Using A/D keeps wishdir perpendicular = maximum acceleration.
   */
  private accelerate(
    wishDir: THREE.Vector3,
    wishSpeed: number,
    accel: number,
    dt: number
  ): void {
    // Current speed in the wish direction (dot product)
    const currentSpeed = this.state.velocity.dot(wishDir);

    // Amount we can add (capped by difference between wish and current)
    const addSpeed = wishSpeed - currentSpeed;

    // Calculate acceleration amount
    let accelSpeed = 0;
    if (wishSpeed > 0 && addSpeed > 0) {
      accelSpeed = accel * wishSpeed * dt;
      // Cap acceleration to not exceed addSpeed
      if (accelSpeed > addSpeed) {
        accelSpeed = addSpeed;
      }

      // Add acceleration in wish direction
      this.state.velocity.addScaledVector(wishDir, accelSpeed);
    }

    // Calculate angle between velocity and wishdir (for debugging)
    const actualSpeed = this.getHorizontalSpeed();
    if (actualSpeed > 0.1) {
      // cos(angle) = currentSpeed / actualSpeed
      const cosAngle = Math.max(-1, Math.min(1, currentSpeed / actualSpeed));
      const angleRad = Math.acos(cosAngle);
      this.debugInfo.velWishAngle = angleRad * 180 / Math.PI;
    } else {
      this.debugInfo.velWishAngle = 0;
    }

    // Update debug info (always update, even when no acceleration)
    this.debugInfo.currentSpeed = currentSpeed;
    this.debugInfo.addSpeed = addSpeed;
    this.debugInfo.accelSpeed = accelSpeed;
  }

  /**
   * Apply friction to velocity
   */
  private applyFriction(dt: number, frictionMult: number = 1.0): void {
    const config = this.config;
    const vel = this.state.velocity;

    // Get horizontal speed
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speed < 0.1) {
      vel.x = 0;
      vel.z = 0;
      return;
    }

    // Calculate friction drop
    const control = speed < config.pm_stopspeed ? config.pm_stopspeed : speed;
    const drop = control * config.pm_friction * frictionMult * dt;

    // Scale velocity
    let newSpeed = speed - drop;
    if (newSpeed < 0) newSpeed = 0;

    const scale = newSpeed / speed;
    vel.x *= scale;
    vel.z *= scale;
  }

  /**
   * Teleport player to position
   */
  teleport(position: THREE.Vector3): void {
    this.state.position.copy(position);
    this.state.velocity.set(0, 0, 0);
    this.state.isGrounded = false;
  }

  /**
   * Reset player state
   */
  reset(): void {
    const pos = new THREE.Vector3().copy(this.state.position);
    this.state = this.createDefaultState();
    this.state.position.copy(pos);
  }

  /**
   * Get horizontal speed (for HUD)
   */
  getHorizontalSpeed(): number {
    const vel = this.state.velocity;
    return Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  }

  /**
   * Get total speed (including vertical)
   */
  getTotalSpeed(): number {
    return this.state.velocity.length();
  }
}
