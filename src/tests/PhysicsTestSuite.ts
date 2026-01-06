/**
 * Physics Test Suite
 *
 * Automated tests to verify CPM physics implementation against expected values.
 * Uses shared TestDefinitions.ts for consistency with visual tests.
 * Run with: npx tsx src/tests/PhysicsTestSuite.ts
 */

import { MovementController } from '../physics/MovementController.js';
import { MovementConfig } from '../config/MovementConfig.js';
import { TEST_DEFINITIONS, TestContext, TestResult } from './TestDefinitions.js';
import * as THREE from 'three';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

/**
 * Physics Test Runner
 */
class PhysicsTestRunner {
  private config: MovementConfig;
  private frametime: number = 0.008; // 125Hz
  private results: TestResult[] = [];

  constructor() {
    // CPM preset configuration
    this.config = {
      g_speed: 320,
      pm_maxspeed: 320,
      pm_accelerate: 10,
      pm_friction: 6,
      pm_stopspeed: 100,
      pm_airaccelerate: 1,
      cpm_strafeaccelerate: 100,
      cpm_aircontrol: 0.02,
      cpm_airstrafe: 1,
      cpm_wishspeed: 30,
      pm_jumpvelocity: 270,
      g_gravity: 800,
      pm_slickfriction: 0.25,
      pm_slickaccel: 10,
      pm_surfangle: 45,
      pm_ladderSpeed: 200,
      pm_crouchspeed: 0.5,
      pm_frametime: 0.008,
    };
  }

  /**
   * Create a fresh movement controller for testing
   */
  createController(testHeight: number = 56): MovementController {
    const mc = new MovementController(this.config);
    mc.teleport(new THREE.Vector3(0, testHeight, 0));

    // Set up mock collision callback
    mc.setCollisionCallback((position: THREE.Vector3) => {
      return {
        grounded: position.y <= testHeight + 1,
        groundNormal: new THREE.Vector3(0, 1, 0),
        isSlope: false,
        isLadder: false,
        newPosition: position.clone(),
        hitWall: false,
      };
    });

    return mc;
  }

  /**
   * Run a single test definition
   */
  runTest(testDef: typeof TEST_DEFINITIONS[0]): TestResult[] {
    // Get test height (default to 56 if not specified)
    const testHeight = testDef.testHeight ?? 56;

    // Create fresh controller
    const mc = this.createController(testHeight);

    // Warmup tick FIRST to establish ground contact
    // (teleport sets isGrounded=false, need one tick to fix that)
    mc.update({ forward: 0, right: 0, jump: false, crouch: false, walk: false }, this.frametime);

    // Create test context AFTER warmup
    const context: TestContext = {
      controller: mc,
      input: { forward: 0, right: 0, jump: false, crouch: false, walk: false },
      tick: 0,
      startPosition: new THREE.Vector3(0, testHeight, 0),
      startVelocity: new THREE.Vector3(0, 0, 0),
      frametime: this.frametime,
      log: [],
    };

    // Run test setup (can set input and do additional controller updates)
    testDef.setup(context);

    // Run the test for specified ticks
    for (let i = 0; i < testDef.ticks; i++) {
      // Check if test has dynamic input callback
      if (testDef.getInput) {
        testDef.getInput(i, context.input);
      }

      // Check if test has dynamic yaw callback
      if (testDef.getYaw) {
        mc.setViewAngles(testDef.getYaw(i), 0);
      }

      mc.update(context.input, this.frametime);
      context.tick++;
    }

    // Run check function
    return testDef.check(context);
  }

  /**
   * Print test results
   */
  printResults(): void {
    console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.bold}             PHYSICS TEST RESULTS${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}═══════════════════════════════════════════════════════${colors.reset}\n`);

    let passed = 0;
    let failed = 0;

    for (const result of this.results) {
      const icon = result.passed ? '✓' : '✗';
      const color = result.passed ? colors.green : colors.red;

      console.log(`${color}${icon} ${result.name}${colors.reset}`);
      if (!result.passed) {
        console.log(`  ${colors.yellow}Expected: ${result.expected}${colors.reset}`);
        console.log(`  ${colors.yellow}Actual:   ${result.actual}${colors.reset}`);
      }

      if (result.passed) passed++;
      else failed++;
    }

    console.log(`\n${colors.bold}${colors.cyan}───────────────────────────────────────────────────────${colors.reset}`);
    console.log(`${colors.bold}Passed: ${colors.green}${passed}${colors.reset} ${colors.bold}| Failed: ${colors.red}${failed}${colors.reset} ${colors.bold}| Total: ${this.results.length}${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}───────────────────────────────────────────────────────${colors.reset}\n`);

    if (failed > 0) {
      process.exit(1);
    }
  }

  /**
   * Run all tests
   */
  runAll(): void {
    console.log(`\n${colors.bold}${colors.cyan}╔═══════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║     CPM PHYSICS TEST SUITE                        ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}║     Using TestDefinitions.ts (shared)            ║${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}╚═══════════════════════════════════════════════════════╝${colors.reset}\n`);

    console.log(`${colors.cyan}Config:${colors.reset}`);
    console.log(`  pm_airaccelerate: ${this.config.pm_airaccelerate}`);
    console.log(`  cpm_strafeaccelerate: ${this.config.cpm_strafeaccelerate}`);
    console.log(`  cpm_wishspeed: ${this.config.cpm_wishspeed}`);
    console.log(`  pm_frametime: ${this.config.pm_frametime}s (125Hz)\n`);

    this.results = [];

    // Run each test definition
    for (let i = 0; i < TEST_DEFINITIONS.length; i++) {
      const testDef = TEST_DEFINITIONS[i];
      console.log(`${colors.blue}Running ${i + 1}. ${testDef.name}...${colors.reset}`);

      const testResults = this.runTest(testDef);
      this.results.push(...testResults);
    }

    this.printResults();
  }
}

// Run tests
const runner = new PhysicsTestRunner();
runner.runAll();
