import * as THREE from 'three';
import { CollisionResult } from './MovementController';

/**
 * Axis-Aligned Bounding Box for collision
 */
export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Collision surface with normal and properties
 */
export interface CollisionSurface {
  aabb: AABB;
  normal?: THREE.Vector3;
  isLadder?: boolean;
  isSurf?: boolean;
  surfAngle?: number;
}

// Quake-style step height (can step up obstacles this high without jumping)
const STEP_HEIGHT = 18;

/**
 * Simple AABB collision detection system
 */
export class CollisionDetection {
  private surfaces: CollisionSurface[] = [];
  private groundY: number = 0;

  // Player dimensions
  private playerWidth: number = 32;

  /**
   * Add a collision surface (box)
   */
  addBox(
    min: THREE.Vector3,
    max: THREE.Vector3,
    options?: { isLadder?: boolean; isSurf?: boolean; surfAngle?: number }
  ): void {
    const surface: CollisionSurface = {
      aabb: { min: min.clone(), max: max.clone() },
      ...options,
    };

    // Calculate normal for surf ramps
    if (options?.isSurf && options.surfAngle) {
      const angle = THREE.MathUtils.degToRad(options.surfAngle);
      surface.normal = new THREE.Vector3(0, Math.cos(angle), Math.sin(angle)).normalize();
    }

    this.surfaces.push(surface);
  }

  /**
   * Add a platform at specific position
   */
  addPlatform(x: number, y: number, z: number, width: number, depth: number, height: number = 16): void {
    this.addBox(
      new THREE.Vector3(x - width / 2, y, z - depth / 2),
      new THREE.Vector3(x + width / 2, y + height, z + depth / 2)
    );
  }

  /**
   * Add a surf ramp
   */
  addSurfRamp(
    x: number, y: number, z: number,
    width: number, height: number, depth: number,
    angle: number
  ): void {
    this.addBox(
      new THREE.Vector3(x - width / 2, y, z - depth / 2),
      new THREE.Vector3(x + width / 2, y + height, z + depth / 2),
      { isSurf: true, surfAngle: angle }
    );
  }

  /**
   * Add a ladder
   */
  addLadder(x: number, y: number, z: number, width: number, height: number): void {
    this.addBox(
      new THREE.Vector3(x - width / 2, y, z - 8),
      new THREE.Vector3(x + width / 2, y + height, z + 8),
      { isLadder: true }
    );
  }

  /**
   * Set ground level
   */
  setGroundLevel(y: number): void {
    this.groundY = y;
  }

  /**
   * Clear all surfaces
   */
  clear(): void {
    this.surfaces = [];
  }

  /**
   * Check collision and return result
   */
  checkCollision(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    playerHeight: number
  ): CollisionResult {
    const halfWidth = this.playerWidth / 2;
    const result: CollisionResult = {
      grounded: false,
      groundNormal: new THREE.Vector3(0, 1, 0),
      isSlope: false,
      isLadder: false,
      newPosition: position.clone(),
      hitWall: false,
    };

    const feetY = position.y - playerHeight;

    // Check world ground collision
    if (feetY <= this.groundY) {
      result.newPosition.y = this.groundY + playerHeight;
      result.grounded = true;
    }

    // Check for ladder first (doesn't block movement)
    for (const surface of this.surfaces) {
      if (!surface.isLadder) continue;

      if (this.pointInAABBHorizontal(position.x, position.z, halfWidth, surface.aabb)) {
        const feetCheck = result.newPosition.y - playerHeight;
        if (feetCheck < surface.aabb.max.y && feetCheck + playerHeight > surface.aabb.min.y) {
          result.isLadder = true;
        }
      }
    }

    // Check platform collisions
    for (const surface of this.surfaces) {
      if (surface.isLadder) continue;

      // Check for surf ramp
      if (surface.isSurf && surface.normal) {
        if (this.pointInAABBHorizontal(position.x, position.z, halfWidth, surface.aabb)) {
          const feetCheck = result.newPosition.y - playerHeight;
          if (feetCheck < surface.aabb.max.y && feetCheck + playerHeight > surface.aabb.min.y) {
            result.isSlope = true;
            result.groundNormal.copy(surface.normal);
          }
        }
        continue;
      }

      // Regular platform/wall collision
      const platformTop = surface.aabb.max.y;

      // Check if horizontally overlapping
      if (this.pointInAABBHorizontal(result.newPosition.x, result.newPosition.z, halfWidth, surface.aabb)) {
        const newFeetY = result.newPosition.y - playerHeight;

        // Landing on top of platform (falling down onto it)
        if (velocity.y <= 0 &&
            newFeetY <= platformTop &&
            newFeetY > platformTop - Math.abs(velocity.y) * 0.02 - 4) {  // Small tolerance based on velocity
          result.newPosition.y = platformTop + playerHeight;
          result.grounded = true;
          continue;
        }

        // Inside platform - need to resolve
        if (newFeetY < platformTop && result.newPosition.y > surface.aabb.min.y) {
          // Calculate penetration from each side
          const penetrations = this.calculatePenetrations(
            result.newPosition, halfWidth, playerHeight, surface.aabb
          );

          // Try step-up first if penetration is small enough
          // Only step up when grounded (not in mid-air)
          const stepUpHeight = platformTop - newFeetY;
          if (stepUpHeight > 0 && stepUpHeight <= STEP_HEIGHT &&
              result.grounded && velocity.y >= -50) {
            // Can step up (only when on ground)
            result.newPosition.y = platformTop + playerHeight;
            result.grounded = true;
            continue;
          }

          // Otherwise push out horizontally (wall collision)
          if (penetrations) {
            // Only push out horizontally, don't bounce
            if (penetrations.axis === 'x') {
              result.newPosition.x += penetrations.dir * penetrations.depth;
            } else if (penetrations.axis === 'z') {
              result.newPosition.z += penetrations.dir * penetrations.depth;
            }
            result.hitWall = true;
            result.groundNormal.set(
              penetrations.axis === 'x' ? penetrations.dir : 0,
              0,
              penetrations.axis === 'z' ? penetrations.dir : 0
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if a point (with width) is horizontally inside an AABB
   */
  private pointInAABBHorizontal(x: number, z: number, halfWidth: number, aabb: AABB): boolean {
    return (
      x + halfWidth > aabb.min.x &&
      x - halfWidth < aabb.max.x &&
      z + halfWidth > aabb.min.z &&
      z - halfWidth < aabb.max.z
    );
  }

  /**
   * Calculate horizontal penetration (for wall collision)
   */
  private calculatePenetrations(
    pos: THREE.Vector3,
    halfWidth: number,
    _playerHeight: number,
    aabb: AABB
  ): { axis: 'x' | 'z'; dir: number; depth: number } | null {
    const playerMinX = pos.x - halfWidth;
    const playerMaxX = pos.x + halfWidth;
    const playerMinZ = pos.z - halfWidth;
    const playerMaxZ = pos.z + halfWidth;

    // Only consider horizontal penetration
    const overlapLeft = playerMaxX - aabb.min.x;
    const overlapRight = aabb.max.x - playerMinX;
    const overlapBack = playerMaxZ - aabb.min.z;
    const overlapFront = aabb.max.z - playerMinZ;

    // Find smallest horizontal overlap
    const minX = Math.min(overlapLeft, overlapRight);
    const minZ = Math.min(overlapBack, overlapFront);

    if (minX <= 0 || minZ <= 0) return null;

    if (minX < minZ) {
      return {
        axis: 'x',
        dir: overlapLeft < overlapRight ? -1 : 1,
        depth: minX + 0.1, // Small extra to prevent sticking
      };
    } else {
      return {
        axis: 'z',
        dir: overlapBack < overlapFront ? -1 : 1,
        depth: minZ + 0.1,
      };
    }
  }

  /**
   * Get all surfaces (for debug rendering)
   */
  getSurfaces(): CollisionSurface[] {
    return this.surfaces;
  }
}
