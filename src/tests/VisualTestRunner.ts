/**
 * Visual Test Runner
 *
 * Runs physics tests in-game with visual feedback and overlays.
 * Uses the same test definitions as the unit tests.
 * Creates its OWN test controller (separate from player) for identical results.
 */

import * as THREE from 'three';
import { MovementController } from '../physics/MovementController.js';
import { MovementConfig } from '../config/MovementConfig.js';
import { TEST_DEFINITIONS, TestDefinition, TestContext, TestResult } from './TestDefinitions.js';

// Visual test result
export interface VisualTestResult {
  test: TestDefinition;
  passed: boolean;
  results: TestResult[];
  duration: number; // ticks
}

export class VisualTestRunner {
  private testController: MovementController | null = null;
  private testConfig: MovementConfig;
  private frametime: number = 0.008;
  private currentTestIndex: number = -1;
  private currentTest: VisualTestResult | null = null;
  private testTick: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private cachedInput: any = null; // Store input after setup, don't re-run setup!
  private testContext: TestContext | null = null; // Preserve context so check() gets same mutated values

  // UI element IDs
  private readonly OVERLAY_ID = 'test-overlay';

  constructor(config: MovementConfig) {
    this.testConfig = config;
    this.createOverlay();
  }

  /**
   * Create a fresh test controller (separate from player!)
   * This ensures identical behavior to headless tests
   */
  private createTestController(testHeight: number = 56): MovementController {
    const mc = new MovementController(this.testConfig);
    mc.teleport(new THREE.Vector3(0, testHeight, 0));

    // Same mock collision as headless tests - infinite flat plane
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
   * Get the test controller's state for rendering
   */
  getTestState() {
    if (!this.testController) return null;
    return this.testController.getState();
  }

  /**
   * Create the test overlay UI
   */
  private createOverlay(): void {
    // Remove existing if any
    const existing = document.getElementById(this.OVERLAY_ID);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = this.OVERLAY_ID;
    overlay.innerHTML = `
      <style>
        #test-overlay {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(0, 0, 0, 0.9);
          border: 2px solid #00ff88;
          border-radius: 8px;
          padding: 20px;
          color: #fff;
          font-family: 'Consolas', monospace;
          font-size: 14px;
          z-index: 1000;
          pointer-events: none;
          display: none;
          min-width: 400px;
        }
        #test-overlay.visible {
          display: block;
        }
        #test-overlay h2 {
          margin: 0 0 10px 0;
          color: #00ff88;
          font-size: 18px;
        }
        #test-overlay .description {
          color: #aaa;
          margin-bottom: 10px;
        }
        #test-overlay .instructions {
          color: #ffaa00;
          margin-bottom: 15px;
          font-style: italic;
        }
        #test-overlay .phase {
          color: #00aaff;
          margin-bottom: 10px;
          font-weight: bold;
          font-size: 13px;
        }
        #test-overlay .progress {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          color: #888;
        }
        #test-overlay .results {
          max-height: 300px;
          overflow-y: auto;
        }
        #test-overlay .result-item {
          display: flex;
          justify-content: space-between;
          padding: 5px 0;
          border-bottom: 1px solid #333;
        }
        #test-overlay .result-item.pass {
          color: #00ff88;
        }
        #test-overlay .result-item.fail {
          color: #ff4444;
        }
        #test-overlay .result-name {
          flex: 1;
        }
        #test-overlay .result-values {
          text-align: right;
          font-size: 11px;
          color: #aaa;
        }
        #test-overlay .summary {
          margin-top: 15px;
          padding-top: 10px;
          border-top: 2px solid #333;
          display: flex;
          justify-content: space-between;
        }
        #test-overlay .summary.passed {
          color: #00ff88;
        }
        #test-overlay .summary.failed {
          color: #ff4444;
        }
        #test-overlay .controls {
          margin-top: 10px;
          font-size: 11px;
          color: #666;
        }
      </style>
      <h2 id="test-name">Test Name</h2>
      <div class="description" id="test-desc">Description</div>
      <div class="instructions" id="test-instructions">Instructions</div>
      <div class="phase" id="test-phase"></div>
      <div class="progress">
        <span id="test-progress">0/0</span>
        <span id="test-status">Running...</span>
      </div>
      <div class="results" id="test-results"></div>
      <div class="summary" id="test-summary"></div>
      <div class="controls">
        F6: Next test | F7: Previous test | F8: Pause/Resume
      </div>
    `;
    document.body.appendChild(overlay);
  }

  /**
   * Start running a test by index
   */
  startTest(index: number): void {
    if (index < 0 || index >= TEST_DEFINITIONS.length) return;

    this.currentTestIndex = index;
    const testDef = TEST_DEFINITIONS[index];

    // Get test height (default to 56 if not specified)
    const testHeight = testDef.testHeight ?? 56;

    // Create fresh test controller at specified height
    this.testController = this.createTestController(testHeight);

    // CRITICAL: Warmup tick FIRST to establish ground contact
    // (teleport sets isGrounded=false, need one tick to fix that)
    this.testController.update(
      { forward: 0, right: 0, jump: false, crouch: false, walk: false },
      this.frametime
    );

    // Create test context AFTER warmup (will be preserved for check())
    const context: TestContext = {
      controller: this.testController,
      input: { forward: 0, right: 0, jump: false, crouch: false, walk: false },
      tick: 0,
      startPosition: new THREE.Vector3(0, testHeight, 0),
      startVelocity: new THREE.Vector3(0, 0, 0),
      frametime: this.frametime,
      log: [],
    };

    // Run test setup (may do additional controller updates AND modify context.startVelocity)
    testDef.setup(context);

    // Cache the input after setup - don't re-run setup!
    this.cachedInput = { ...context.input };

    // Preserve context so check() gets the same mutated values (like startVelocity)
    this.testContext = context;

    // Initialize test result
    this.currentTest = {
      test: testDef,
      passed: true,
      results: [],
      duration: testDef.ticks,
    };

    this.testTick = 0;
    this.isRunning = true;
    this.isPaused = false;

    // Update UI
    this.updateUI(true);
  }

  /**
   * Update the current test (call each frame)
   */
  update(): void {
    if (!this.isRunning || this.isPaused || !this.testController || !this.testContext) return;

    if (this.testTick >= this.currentTest!.duration) {
      // Test complete
      this.completeTest();
      return;
    }

    // Check if test has dynamic input callback
    if (this.currentTest!.test.getInput) {
      // Call getInput to modify input based on current tick
      this.currentTest!.test.getInput(this.testTick, this.cachedInput);
    }

    // Check if test has dynamic yaw callback (for strafe jumping)
    if (this.currentTest!.test.getYaw) {
      const yaw = this.currentTest!.test.getYaw(this.testTick);
      this.testController.setViewAngles(yaw, 0);
    }

    // Run one tick with cached input
    this.testController.update(this.cachedInput, this.frametime);
    this.testTick++;
    this.testContext.tick = this.testTick; // Update context tick for check()

    // Update phase description for dynamic tests
    this.updatePhaseDescription();

    // Update UI with progress
    this.updateProgress();
  }

  /**
   * Update the current phase description for display
   */
  private updatePhaseDescription(): void {
    if (!this.currentTest || !this.currentTest.test.getInput) return;

    const tick = this.testTick;
    let phase = '';

    if (tick < 40) phase = '1: Ground accel (W) - building speed';
    else if (tick === 40) phase = '2: JUMP!';
    else if (tick >= 41 && tick < 100) phase = '3: Strafe jump (A/D + turn)';
    else if (tick === 100) phase = '4: BUNNY HOP!';
    else if (tick >= 101 && tick < 180) phase = '5: Post-hop strafing';
    else if (tick === 180) phase = '6: JUMP!';
    else if (tick >= 181 && tick < 260) phase = '7: Strafe jumping';
    else if (tick === 260) phase = '8: JUMP!';
    else if (tick >= 261 && tick < 350) phase = '9: Strafe jumping';
    else if (tick >= 350 && tick < 400) phase = '10: Air control (W)';
    else if (tick >= 400 && tick < 480) phase = '11: Friction test (no input)';
    else if (tick >= 480 && tick < 520) phase = '12: Ground accel (W)';
    else if (tick >= 520 && tick < 560) phase = '13: Diagonal (W+D)';
    else phase = '14: Coast to stop';

    // Update phase display in UI
    const phaseEl = document.getElementById('test-phase');
    if (phaseEl) phaseEl.textContent = phase;
  }

  /**
   * Complete the test and check results
   */
  private completeTest(): void {
    if (!this.currentTest || !this.testController || !this.testContext) return;

    // Run check function with the preserved context (contains mutated startVelocity etc)
    const results = this.currentTest.test.check(this.testContext);
    this.currentTest.results = results;
    this.currentTest.passed = results.every(r => r.passed);

    this.isRunning = false;

    // Update UI with final results
    this.updateUI(false);
  }

  /**
   * Update the overlay UI
   */
  private updateUI(isRunning: boolean): void {
    if (!this.currentTest) return;

    const test = this.currentTest.test;
    const overlay = document.getElementById(this.OVERLAY_ID);
    if (!overlay) return;

    document.getElementById('test-name')!.textContent = `${this.currentTestIndex + 1}. ${test.name}`;
    document.getElementById('test-desc')!.textContent = test.description;
    document.getElementById('test-instructions')!.textContent = test.instructions;

    if (isRunning) {
      document.getElementById('test-status')!.textContent = 'Running...';
      document.getElementById('test-results')!.innerHTML = '<div style="color:#666">Running test...</div>';
      document.getElementById('test-summary')!.innerHTML = '';
    } else {
      document.getElementById('test-status')!.textContent = this.currentTest.passed ? 'PASSED' : 'FAILED';

      // Show results
      const resultsHtml = this.currentTest.results.map(r => `
        <div class="result-item ${r.passed ? 'pass' : 'fail'}">
          <span class="result-name">${r.passed ? '✓' : '✗'} ${r.name}</span>
          <span class="result-values">
            Expected: ${r.expected}<br>
            Actual: ${r.actual}
          </span>
        </div>
      `).join('');
      document.getElementById('test-results')!.innerHTML = resultsHtml;

      // Summary
      const passedCount = this.currentTest.results.filter(r => r.passed).length;
      const totalCount = this.currentTest.results.length;
      document.getElementById('test-summary')!.innerHTML = `
        <span class="${this.currentTest.passed ? 'passed' : 'failed'}">
          ${this.currentTest.passed ? '✓ PASSED' : '✗ FAILED'}
        </span>
        <span>${passedCount}/${totalCount} checks passed</span>
      `;
    }

    overlay.classList.add('visible');
  }

  /**
   * Update progress display
   */
  private updateProgress(): void {
    if (!this.currentTest) return;
    document.getElementById('test-progress')!.textContent =
      `${this.testTick}/${this.currentTest.duration} ticks`;
  }

  /**
   * Move to next test
   */
  nextTest(): void {
    let nextIndex = this.currentTestIndex + 1;
    if (nextIndex >= TEST_DEFINITIONS.length) nextIndex = 0;
    this.startTest(nextIndex);
  }

  /**
   * Move to previous test
   */
  prevTest(): void {
    let prevIndex = this.currentTestIndex - 1;
    if (prevIndex < 0) prevIndex = TEST_DEFINITIONS.length - 1;
    this.startTest(prevIndex);
  }

  /**
   * Toggle pause
   */
  togglePause(): void {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    document.getElementById('test-status')!.textContent =
      this.isPaused ? 'PAUSED' : 'Running...';
  }

  /**
   * Stop and hide overlay
   */
  stop(): void {
    this.isRunning = false;
    this.currentTest = null;
    this.currentTestIndex = -1;
    this.testController = null;
    this.cachedInput = null;
    this.testContext = null;

    // Clear phase display
    const phaseEl = document.getElementById('test-phase');
    if (phaseEl) phaseEl.textContent = '';

    const overlay = document.getElementById(this.OVERLAY_ID);
    if (overlay) overlay.classList.remove('visible');
  }

  /**
   * Get current test info
   */
  getCurrentTest() {
    return this.currentTest;
  }

  isTestRunning(): boolean {
    return this.isRunning;
  }

  getTestCount(): number {
    return TEST_DEFINITIONS.length;
  }
}
