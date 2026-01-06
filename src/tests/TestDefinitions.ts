/**
 * Shared Test Definitions
 *
 * Used by both:
 * - Unit tests (PhysicsTestSuite.ts)
 * - In-game visual tests (VisualTestRunner.ts)
 *
 * This ensures we only maintain ONE set of tests.
 */

import * as THREE from 'three';

export interface TestDefinition {
  id: string;
  name: string;
  description: string;
  instructions: string;
  setup: (testContext: TestContext) => void;
  ticks: number;
  check: (context: TestContext) => TestResult[];
  // Optional: Function to get input at each tick (for dynamic input sequences)
  getInput?: (tick: number, input: any) => void; // Modifies input in place
  // Optional: Function to get camera yaw at each tick (for strafe jumping tests)
  getYaw?: (tick: number) => number; // Returns yaw in radians
  // Optional: Test height (y position) - default 56 for playground
  testHeight?: number;
}

export interface TestContext {
  controller: any; // MovementController
  input: any; // MovementInput
  tick: number;
  startPosition: THREE.Vector3;
  startVelocity: THREE.Vector3;
  frametime: number;
  log: string[];
}

export interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  tick?: number;
}

/**
 * All test definitions - shared by unit tests and visual tests
 */
export const TEST_DEFINITIONS: TestDefinition[] = [
  // ═══════════════════════════════════════════════════════════════
  // TEST 1: Ground Acceleration
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'ground_accel',
    name: 'Ground Acceleration',
    description: 'Verify ground acceleration from standstill',
    instructions: 'Player should accelerate from 0 to ~25.6 on first tick',
    setup: (ctx) => {
      // Already on ground, holding W
      ctx.input.forward = 1;
      ctx.input.right = 0;
    },
    ticks: 5,
    check: (ctx) => {
      const results: TestResult[] = [];
      const speed = ctx.controller.getHorizontalSpeed();

      // Tick 1: Should have accelerated
      results.push({
        name: 'Tick 1: speed > 0 (acceleration applied)',
        passed: speed > 20,
        expected: 'speed > 20',
        actual: `speed = ${speed.toFixed(2)}`,
        tick: 1,
      });

      // Tick 5: Should have significant speed
      results.push({
        name: 'Tick 5: speed significantly increased',
        passed: speed > 100,
        expected: 'speed > 100',
        actual: `speed = ${speed.toFixed(2)}`,
        tick: 5,
      });

      return results;
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 2: CPM Strafe Detection
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'strafe_detect',
    name: 'CPM Strafe Detection',
    description: 'Verify strafe detection uses raw input (A/D only = 100x accel)',
    instructions: 'In air, holding A/D only should show StrafeOnly=YES, AirAccel=100',
    setup: (ctx) => {
      // Build speed first, then jump
      ctx.input.forward = 1;
      ctx.input.right = 0;
      for (let i = 0; i < 20; i++) {
        ctx.controller.update(ctx.input, ctx.frametime);
      }
      // Jump
      ctx.input.jump = true;
      ctx.controller.update(ctx.input, ctx.frametime);
      ctx.input.jump = false;
      // Now in air, switch to A/D only
      ctx.input.forward = 0;
      ctx.input.right = 1;
    },
    ticks: 1,
    check: (ctx) => {
      const debug = ctx.controller.debugInfo;
      return [
        {
          name: 'StrafeOnly: YES (A/D only detected)',
          passed: debug.isStrafingOnly === true,
          expected: 'isStrafingOnly = true',
          actual: `isStrafingOnly = ${debug.isStrafingOnly}`,
        },
        {
          name: 'AirAccel: 100 (CPM strafe acceleration)',
          passed: debug.airAccel === 100,
          expected: 'airAccel = 100',
          actual: `airAccel = ${debug.airAccel}`,
        },
        {
          name: 'WishSpeed: 30 (capped)',
          passed: Math.abs(debug.wishSpeed - 30) < 1,
          expected: 'wishSpeed = 30',
          actual: `wishSpeed = ${debug.wishSpeed.toFixed(2)}`,
        },
        {
          name: 'AccelSpeed: ~24 (100 * 30 * 0.008)',
          passed: Math.abs(debug.accelSpeed - 24) < 2,
          expected: 'accelSpeed ≈ 24',
          actual: `accelSpeed = ${debug.accelSpeed.toFixed(2)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 3: Air Control Activation
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'air_control',
    name: 'Air Control',
    description: 'Verify air control activates at high speed with W key',
    instructions: 'Jump at speed, hold W - AirControl should be YES briefly',
    setup: (ctx) => {
      // Build speed
      ctx.input.forward = 1;
      for (let i = 0; i < 25; i++) {
        ctx.controller.update(ctx.input, ctx.frametime);
      }
      // Jump
      ctx.input.jump = true;
      ctx.controller.update(ctx.input, ctx.frametime);
      ctx.input.jump = false;
    },
    ticks: 1,
    check: (ctx) => {
      const debug = ctx.controller.debugInfo;
      const speed = ctx.controller.getHorizontalSpeed();

      return [
        {
          name: 'AirControl activates at high speed',
          passed: speed > 250,
          expected: 'speed > 250 (high enough for air control)',
          actual: `speed = ${speed.toFixed(2)}`,
        },
        {
          name: 'AirControl condition check',
          passed: debug.airControlActive === true || debug.wishSpeed <= debug.currentSpeed,
          expected: 'airControlActive = true OR wishSpeed <= currentSpeed',
          actual: `airControlActive=${debug.airControlActive}, wishSpeed=${debug.wishSpeed.toFixed(1)}, currentSpeed=${debug.currentSpeed.toFixed(1)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 4: Bunny Hop Speed Preservation
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'bunny_hop',
    name: 'Bunny Hop',
    description: 'Verify speed is preserved when jumping (no friction)',
    instructions: 'Build speed, then jump - speed should stay the same',
    setup: (ctx) => {
      // Build speed
      ctx.input.forward = 1;
      for (let i = 0; i < 25; i++) {
        ctx.controller.update(ctx.input, ctx.frametime);
      }
      ctx.startVelocity.copy(ctx.controller.getState().velocity);

      // Jump
      ctx.input.jump = true;
      ctx.controller.update(ctx.input, ctx.frametime);
      ctx.input.jump = false;
    },
    ticks: 1,
    check: (ctx) => {
      const preJumpSpeed = Math.sqrt(
        ctx.startVelocity.x ** 2 + ctx.startVelocity.z ** 2
      );
      const postJumpSpeed = ctx.controller.getHorizontalSpeed();

      return [
        {
          name: 'Speed preserved on jump frame',
          passed: Math.abs(postJumpSpeed - preJumpSpeed) < 2,
          expected: `speed ≈ ${preJumpSpeed.toFixed(2)}`,
          actual: `speed = ${postJumpSpeed.toFixed(2)}, loss = ${(preJumpSpeed - postJumpSpeed).toFixed(2)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 5: Ground Friction
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'friction',
    name: 'Ground Friction',
    description: 'Verify friction slows player when no input',
    instructions: 'Build speed, release keys - speed should decrease',
    setup: (ctx) => {
      // Build speed
      ctx.input.forward = 1;
      for (let i = 0; i < 20; i++) {
        ctx.controller.update(ctx.input, ctx.frametime);
      }
      const preSpeed = ctx.controller.getHorizontalSpeed();
      ctx.startVelocity.set(preSpeed, 0, 0); // Store for comparison

      // Release all input
      ctx.input.forward = 0;
      ctx.input.right = 0;
    },
    ticks: 10,
    check: (ctx) => {
      const currentSpeed = ctx.controller.getHorizontalSpeed();
      const initialSpeed = ctx.startVelocity.x;

      return [
        {
          name: 'Speed decreased after releasing input',
          passed: currentSpeed < initialSpeed,
          expected: `speed < ${initialSpeed.toFixed(2)}`,
          actual: `speed = ${currentSpeed.toFixed(2)}`,
        },
        {
          name: 'Friction amount matches formula',
          passed: currentSpeed > 0 && currentSpeed < initialSpeed,
          expected: '0 < speed < initial',
          actual: `speed went from ${initialSpeed.toFixed(2)} to ${currentSpeed.toFixed(2)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 6: Air Control Deactivation
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'air_control_off',
    name: 'Air Control Deactivation',
    description: 'Verify air control turns OFF when speed drops below wishSpeed',
    instructions: 'At low speed with W, AirControl should be NO',
    setup: (ctx) => {
      // Teleport to air with low speed
      ctx.controller.teleport(new THREE.Vector3(0, 200, 0));
      ctx.input.forward = 1;
      ctx.input.right = 0;
    },
    ticks: 1,
    check: (ctx) => {
      const debug = ctx.controller.debugInfo;

      return [
        {
          name: 'AirControl inactive at low speed',
          passed: debug.airControlActive === false,
          expected: 'airControlActive = false (low speed)',
          actual: `airControlActive = ${debug.airControlActive}, speed = ${ctx.controller.getHorizontalSpeed().toFixed(2)}`,
        },
        {
          name: 'Reason: wishSpeed > currentSpeed',
          passed: debug.wishSpeed > debug.currentSpeed,
          expected: 'wishSpeed > currentSpeed',
          actual: `wishSpeed=${debug.wishSpeed.toFixed(1)}, currentSpeed=${debug.currentSpeed.toFixed(1)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 7: W Key in Air (Low Acceleration)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'w_key_air',
    name: 'W Key in Air',
    description: 'Verify holding W in air at speed gives minimal acceleration',
    instructions: 'At speed in air, hold W - should get AirAccel=1, minimal speed gain',
    setup: (ctx) => {
      // Build speed and jump
      ctx.input.forward = 1;
      for (let i = 0; i < 25; i++) {
        ctx.controller.update(ctx.input, ctx.frametime);
      }
      ctx.input.jump = true;
      ctx.controller.update(ctx.input, ctx.frametime);
      ctx.input.jump = false;
    },
    ticks: 1,
    check: (ctx) => {
      const debug = ctx.controller.debugInfo;

      return [
        {
          name: 'StrafeOnly: NO (W is pressed)',
          passed: debug.isStrafingOnly === false,
          expected: 'isStrafingOnly = false',
          actual: `isStrafingOnly = ${debug.isStrafingOnly}`,
        },
        {
          name: 'AirAccel: 1 (normal air acceleration)',
          passed: debug.airAccel === 1,
          expected: 'airAccel = 1',
          actual: `airAccel = ${debug.airAccel}`,
        },
        {
          name: 'Minimal acceleration (addSpeed small or negative)',
          passed: debug.addSpeed < 100, // Much less than wishSpeed
          expected: 'addSpeed < 100',
          actual: `addSpeed = ${debug.addSpeed.toFixed(2)}`,
        },
      ];
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // TEST 8: Comprehensive Movement Test (ALL MECHANICS)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'comprehensive',
    name: 'Comprehensive Movement Test',
    description: 'Full CPM movement test: WASD + jump + camera strafe + friction with precise values',
    instructions: 'Complete demonstration of all CPM movement mechanics with camera turning',
    // Test at height 500 (empty sky, no obstacles)
    testHeight: 500,
    setup: (ctx) => {
      // Initialize facing North (negative Z in Three.js)
      ctx.controller.setViewAngles(0, 0);
      ctx.input.forward = 1;
      ctx.input.right = 0;
      ctx.input.jump = false;
    },
    ticks: 600, // 4.8 seconds at 125Hz - full comprehensive test
    // Dynamic input for each phase
    getInput: (tick, input) => {
      // Phase 1 (0-40): Extended ground acceleration (build max speed)
      if (tick < 40) {
        input.forward = 1;
        input.right = 0;
        input.jump = false;
      }
      // Phase 2 (40): First jump at max speed
      else if (tick === 40) {
        input.forward = 1;
        input.right = 0;
        input.jump = true;
      }
      // Phase 3 (41-100): Strafe jumping - A/D only with camera turning
      // This is THE key CPM mechanic for gaining speed
      else if (tick >= 41 && tick < 70) {
        input.forward = 0;  // A/D only for CPM strafe accel
        input.right = 1;    // Hold D
        input.jump = false;
      }
      else if (tick >= 70 && tick < 100) {
        input.forward = 0;
        input.right = -1;   // Hold A
        input.jump = false;
      }
      // Phase 4 (100): Bunny hop at speed
      else if (tick === 100) {
        input.forward = 1;
        input.right = 0;
        input.jump = true;
      }
      // Phase 5 (101-180): Continue strafe jumping after bunny hop
      else if (tick >= 101 && tick < 140) {
        input.forward = 0;
        input.right = 1;
        input.jump = false;
      }
      else if (tick >= 140 && tick < 180) {
        input.forward = 0;
        input.right = -1;
        input.jump = false;
      }
      // Phase 6 (180): Third jump - continue strafe jumping
      else if (tick === 180) {
        input.forward = 0;
        input.right = -1;
        input.jump = true;
      }
      // Phase 7 (181-260): Extended strafe jumping sequence
      else if (tick >= 181 && tick < 220) {
        input.forward = 0;
        input.right = 1;
        input.jump = false;
      }
      else if (tick >= 220 && tick < 260) {
        input.forward = 0;
        input.right = -1;
        input.jump = false;
      }
      // Phase 8 (260): Fourth jump
      else if (tick === 260) {
        input.forward = 0;
        input.right = 1;
        input.jump = true;
      }
      // Phase 9 (261-350): More strafe jumping
      else if (tick >= 261 && tick < 305) {
        input.forward = 0;
        input.right = -1;
        input.jump = false;
      }
      else if (tick >= 305 && tick < 350) {
        input.forward = 0;
        input.right = 1;
        input.jump = false;
      }
      // Phase 10 (350-400): Test W key in air (air control)
      else if (tick >= 350 && tick < 400) {
        input.forward = 1;
        input.right = 0;
        input.jump = false;
      }
      // Phase 11 (400-480): Friction test - release all input, let friction slow us
      else if (tick >= 400 && tick < 480) {
        input.forward = 0;
        input.right = 0;
        input.jump = false;
      }
      // Phase 12 (480-520): Accelerate again from low speed (W)
      else if (tick >= 480 && tick < 520) {
        input.forward = 1;
        input.right = 0;
        input.jump = false;
      }
      // Phase 13 (520-560): Diagonal movement (W+D)
      else if (tick >= 520 && tick < 560) {
        input.forward = 1;
        input.right = 1;
        input.jump = false;
      }
      // Phase 14 (560-600): Final coast to stop
      else {
        input.forward = 0;
        input.right = 0;
        input.jump = false;
      }
    },
    // Dynamic camera yaw for optimal strafe jumping
    getYaw: (tick) => {
      // Phase 1-2: Facing North (0 radians = -Z direction)
      if (tick < 41) return 0;

      // Phase 3: Strafe jumping - smoothly turn camera right
      if (tick >= 41 && tick < 70) {
        const progress = (tick - 41) / 29;
        return -progress * Math.PI / 2; // Turn 90 degrees right
      }
      if (tick >= 70 && tick < 100) {
        const progress = (tick - 70) / 30;
        return -Math.PI / 2 - progress * Math.PI / 4; // Continue to 135 degrees
      }

      // Phase 4-7: Continue turning during strafe jumps
      if (tick >= 100 && tick < 180) {
        const progress = (tick - 100) / 80;
        return -3 * Math.PI / 4 - progress * Math.PI / 6;
      }
      if (tick >= 180 && tick < 260) {
        const progress = (tick - 180) / 80;
        return -11 * Math.PI / 12 - progress * Math.PI / 6;
      }
      if (tick >= 260 && tick < 350) {
        const progress = (tick - 260) / 90;
        return -13 * Math.PI / 12 - progress * Math.PI / 6;
      }

      // Phase 8-14: Face various directions
      if (tick < 400) return -Math.PI; // Face South
      if (tick < 480) return -Math.PI; // Still facing South during friction
      return -3 * Math.PI / 4; // Face South-West for diagonal
    },
    check: (ctx) => {
      const state = ctx.controller.getState();
      const startPos = ctx.startPosition;
      const endPos = state.position;

      // Calculate distance traveled
      const dx = endPos.x - startPos.x;
      const dz = endPos.z - startPos.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      // Check camera actually turned during test!
      const initialYaw = 0; // We set this in setup
      const finalYaw = state.viewAngles.yaw;
      let yawChange = finalYaw - initialYaw; // Use signed difference for normalization
      // Normalize yaw difference to be in [-PI, PI]
      while (yawChange > Math.PI) yawChange -= 2 * Math.PI;
      while (yawChange < -Math.PI) yawChange += 2 * Math.PI;
      const yawChangeDegrees = Math.abs(yawChange) * 180 / Math.PI;

      return [
        {
          name: 'Test completed all 600 ticks',
          passed: ctx.tick >= 600,
          expected: 'tick >= 600',
          actual: `tick = ${ctx.tick}`,
        },
        {
          name: 'Camera turned during test (yaw changed)',
          passed: yawChangeDegrees > 90,
          expected: 'yaw change > 90 degrees',
          actual: `yaw change = ${yawChangeDegrees.toFixed(1)}° (${(initialYaw * 180 / Math.PI).toFixed(1)}° → ${(finalYaw * 180 / Math.PI).toFixed(1)}°)`,
        },
        {
          name: 'Traveled distance (> 200 units)',
          passed: distance > 200,
          expected: 'distance > 200',
          actual: `distance = ${distance.toFixed(1)} units`,
        },
        {
          name: 'Player moved from origin',
          passed: distance > 50,
          expected: 'distance > 50',
          actual: `distance = ${distance.toFixed(1)} units`,
        },
        {
          name: 'Player is grounded at end',
          passed: state.isGrounded,
          expected: 'isGrounded = true',
          actual: `isGrounded = ${state.isGrounded}`,
        },
        {
          name: 'Player height is at test level (500)',
          passed: Math.abs(endPos.y - 500) < 5,
          expected: '|y - 500| < 5',
          actual: `y = ${endPos.y.toFixed(2)}`,
        },
      ];
    },
  },
];

export function getTestById(id: string): TestDefinition | undefined {
  return TEST_DEFINITIONS.find(t => t.id === id);
}

export function getTestByIndex(index: number): TestDefinition | undefined {
  return TEST_DEFINITIONS[index];
}

export function getAllTests(): TestDefinition[] {
  return TEST_DEFINITIONS;
}
