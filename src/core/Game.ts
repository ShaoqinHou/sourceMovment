import * as THREE from 'three';
import { Player } from '../player/Player';
import { InputManager } from './InputManager';
import { TestMap } from '../world/TestMap';
import { getPresetManager, PresetManager } from '../config/PresetManager';
import { VisualTestRunner } from '../tests/VisualTestRunner.js';

/**
 * Main game class - manages the game loop, rendering, and systems
 */
export class Game {
  // Core systems
  private renderer: THREE.WebGLRenderer;
  private player: Player;
  private input: InputManager;
  private map: TestMap;
  private presets: PresetManager;
  private visualTestRunner: VisualTestRunner;

  // Game loop
  private isRunning: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly FIXED_TIMESTEP: number = 1 / 125; // 125Hz physics

  // HUD elements
  private hudSpeed: HTMLElement | null;
  private hudPosition: HTMLElement | null;
  private hudAngles: HTMLElement | null;
  private hudState: HTMLElement | null;
  private presetName: HTMLElement | null;
  private overlay: HTMLElement | null;
  private debugPanel: HTMLElement | null;
  private debugVisible: boolean = false;

  // Debug panel elements
  private dbgFwd: HTMLElement | null;
  private dbgRight: HTMLElement | null;
  private dbgJump: HTMLElement | null;
  private dbgSpeed: HTMLElement | null;
  private dbgVx: HTMLElement | null;
  private dbgVy: HTMLElement | null;
  private dbgVz: HTMLElement | null;
  private dbgWdx: HTMLElement | null;
  private dbgWdz: HTMLElement | null;
  private dbgWishspeed: HTMLElement | null;
  private dbgCurrentspeed: HTMLElement | null;
  private dbgAddspeed: HTMLElement | null;
  private dbgAccelspeed: HTMLElement | null;
  private dbgState: HTMLElement | null;
  private dbgAccmode: HTMLElement | null;
  private dbgAccval: HTMLElement | null;
  private dbgYaw: HTMLElement | null;
  private dbgPitch: HTMLElement | null;
  private dbgStrafeonly: HTMLElement | null;
  private dbgAircontrol: HTMLElement | null;

  constructor(canvas: HTMLCanvasElement) {
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup input
    this.input = new InputManager(canvas);

    // Setup presets
    this.presets = getPresetManager();

    // Setup player
    this.player = new Player(this.presets.getConfig(), this.input);

    // Setup map
    this.map = new TestMap();

    // Connect collision
    this.player.movement.setCollisionCallback(
      this.map.collision.checkCollision.bind(this.map.collision)
    );

    // Spawn player
    this.player.teleport(this.map.getSpawnPosition());

    // Setup visual test runner (creates its own test controller)
    this.visualTestRunner = new VisualTestRunner(
      this.presets.getConfig()
    );

    // Get HUD elements
    this.hudSpeed = document.getElementById('hud-speed');
    this.hudPosition = document.getElementById('hud-position');
    this.hudAngles = document.getElementById('hud-angles');
    this.hudState = document.getElementById('hud-state');
    this.presetName = document.getElementById('preset-name');
    this.overlay = document.getElementById('overlay');
    this.debugPanel = document.getElementById('debug-panel');

    // Get debug panel elements
    this.dbgFwd = document.getElementById('dbg-fwd');
    this.dbgRight = document.getElementById('dbg-right');
    this.dbgJump = document.getElementById('dbg-jump');
    this.dbgSpeed = document.getElementById('dbg-speed');
    this.dbgVx = document.getElementById('dbg-vx');
    this.dbgVy = document.getElementById('dbg-vy');
    this.dbgVz = document.getElementById('dbg-vz');
    this.dbgWdx = document.getElementById('dbg-wdx');
    this.dbgWdz = document.getElementById('dbg-wdz');
    this.dbgWishspeed = document.getElementById('dbg-wishspeed');
    this.dbgCurrentspeed = document.getElementById('dbg-currentspeed');
    this.dbgAddspeed = document.getElementById('dbg-addspeed');
    this.dbgAccelspeed = document.getElementById('dbg-accelspeed');
    this.dbgState = document.getElementById('dbg-state');
    this.dbgAccmode = document.getElementById('dbg-accmode');
    this.dbgAccval = document.getElementById('dbg-accval');
    this.dbgYaw = document.getElementById('dbg-yaw');
    this.dbgPitch = document.getElementById('dbg-pitch');
    this.dbgStrafeonly = document.getElementById('dbg-strafeonly');
    this.dbgAircontrol = document.getElementById('dbg-aircontrol');

    // Setup event handlers
    this.setupEventHandlers();

    // Handle window resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private setupEventHandlers(): void {
    // Pointer lock change
    this.input.setOnLockChange((locked) => {
      if (this.overlay) {
        this.overlay.classList.toggle('hidden', locked);
      }
    });

    // Click on overlay to start game (overlay blocks canvas clicks)
    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        this.input.requestPointerLock();
      });
    }

    // Preset switching
    this.input.setOnPresetSwitch((index) => {
      const presets = this.presets.listPresets();
      if (index <= presets.length) {
        const preset = presets[index - 1];
        if (preset) {
          this.presets.loadPreset(preset.name);
        }
      }
    });

    // Config changes
    this.presets.onChange((config, name) => {
      this.player.setConfig(config);
      if (this.presetName) {
        this.presetName.textContent = name;
      }
    });

    // Console toggle (placeholder - will implement full console later)
    this.input.setOnConsoleToggle(() => {
      console.log('Console toggle - to be implemented');
    });

    // Debug toggle (F4)
    this.input.setOnDebugToggle(() => {
      this.debugVisible = !this.debugVisible;
      if (this.debugPanel) {
        this.debugPanel.classList.toggle('visible', this.debugVisible);
      }
    });

    // Test mode: Start test (F5) - also closes overlay
    this.input.setOnTestStart(() => {
      if (!this.visualTestRunner.isTestRunning()) {
        this.visualTestRunner.startTest(0); // Start first test
      } else {
        // Test running or finished - just hide overlay
        this.visualTestRunner.hideOverlay();
      }
    });

    // Test mode: Next test (F6) - always works, shows overlay if hidden
    this.input.setOnTestNext(() => {
      this.visualTestRunner.showOverlay();
      this.visualTestRunner.nextTest();
    });

    // Test mode: Previous test (F7) - always works, shows overlay if hidden
    this.input.setOnTestPrev(() => {
      this.visualTestRunner.showOverlay();
      this.visualTestRunner.prevTest();
    });

    // Test mode: Pause/Resume (F8) - only works during test execution
    this.input.setOnTestPause(() => {
      if (this.visualTestRunner.isTestRunning()) {
        this.visualTestRunner.togglePause();
      }
    });

    // Initial preset display
    if (this.presetName) {
      this.presetName.textContent = this.presets.getCurrentPresetName();
    }
  }

  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.player.camera.aspect = width / height;
    this.player.camera.updateProjectionMatrix();
  }

  /**
   * Start the game loop
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  /**
   * Stop the game loop
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Main game loop with fixed timestep physics
   */
  private gameLoop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Accumulate time for fixed timestep
    this.accumulator += deltaTime;

    // Cap accumulator to prevent spiral of death
    if (this.accumulator > 0.25) {
      this.accumulator = 0.25;
    }

    // Fixed timestep physics updates
    while (this.accumulator >= this.FIXED_TIMESTEP) {
      this.update(this.FIXED_TIMESTEP);
      this.accumulator -= this.FIXED_TIMESTEP;
    }

    // Render
    this.render();

    // Update HUD
    this.updateHUD();

    // Schedule next frame
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Fixed timestep update
   */
  private update(dt: number): void {
    // If test is running, let test runner control the physics
    if (this.visualTestRunner.isTestRunning()) {
      this.visualTestRunner.update();
    } else {
      // Normal player update
      this.player.update(dt);
    }

    // Check for restart (R key) - only when not in test mode
    if (!this.visualTestRunner.isTestRunning() && this.input.isKeyPressed('KeyR')) {
      this.player.teleport(this.map.getSpawnPosition());
    }
  }

  /**
   * Render the scene
   */
  private render(): void {
    // If test is running, render test controller's position instead of player
    if (this.visualTestRunner.isTestRunning()) {
      const testState = this.visualTestRunner.getTestState();
      if (testState) {
        // Temporarily move camera to test position for visualization
        const originalPosition = this.player.camera.position.clone();
        const originalRotation = this.player.camera.quaternion.clone();

        this.player.camera.position.copy(testState.position);
        // Use test controller's view angles (yaw, pitch)
        this.player.camera.rotation.set(
          testState.viewAngles.pitch,
          testState.viewAngles.yaw,
          0,
          'YXZ'
        );

        this.renderer.render(this.map.scene, this.player.camera);

        // Restore camera
        this.player.camera.position.copy(originalPosition);
        this.player.camera.quaternion.copy(originalRotation);
        return;
      }
    }

    this.renderer.render(this.map.scene, this.player.camera);
  }

  /**
   * Update HUD elements
   */
  private updateHUD(): void {
    // If test is running, show test state instead of player state
    if (this.visualTestRunner.isTestRunning()) {
      const testState = this.visualTestRunner.getTestState();
      if (testState) {
        this.updateHUDFromState(testState);
        return;
      }
    }

    // Normal player HUD
    const state = this.player.getState();
    this.updateHUDFromState(state);
  }

  /**
   * Update HUD from a given state (player or test)
   */
  private updateHUDFromState(state: any): void {
    // Calculate horizontal speed from velocity
    const velocity = state.velocity;
    const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);

    // Speed display
    if (this.hudSpeed) {
      const speed = Math.round(horizontalSpeed);
      this.hudSpeed.textContent = speed.toString();

      // Color based on speed thresholds
      if (speed > 600) {
        this.hudSpeed.style.color = '#ff4444'; // Very fast
      } else if (speed > 400) {
        this.hudSpeed.style.color = '#ffaa00'; // Fast
      } else if (speed > 320) {
        this.hudSpeed.style.color = '#44ff44'; // Above base
      } else {
        this.hudSpeed.style.color = '#00ff88'; // Normal
      }
    }

    // Position display
    if (this.hudPosition) {
      const pos = state.position;
      this.hudPosition.textContent = `X: ${Math.round(pos.x)} Y: ${Math.round(pos.y)} Z: ${Math.round(pos.z)}`;
    }

    // Camera angles display
    if (this.hudAngles) {
      const yawDeg = (state.viewAngles.yaw * 180 / Math.PI).toFixed(0);
      const pitchDeg = (state.viewAngles.pitch * 180 / Math.PI).toFixed(0);
      this.hudAngles.textContent = `Yaw: ${yawDeg}° Pitch: ${pitchDeg}°`;
    }

    // Ground/Air state
    if (this.hudState) {
      if (state.isOnLadder) {
        this.hudState.textContent = 'LADDER';
        this.hudState.className = 'state';
        this.hudState.style.color = '#ff8800';
      } else if (state.isOnSlope) {
        this.hudState.textContent = 'SURF';
        this.hudState.className = 'state';
        this.hudState.style.color = '#00aaff';
      } else if (state.isGrounded) {
        this.hudState.textContent = 'GROUND';
        this.hudState.className = 'state ground';
      } else {
        this.hudState.textContent = 'AIR';
        this.hudState.className = 'state air';
      }
    }

    // Debug panel
    if (this.debugVisible) {
      this.updateDebugPanel();
    }
  }

  /**
   * Update debug panel with physics values
   */
  private updateDebugPanel(): void {
    const debug = this.player.getDebugInfo();

    // Helper to update element
    const update = (el: HTMLElement | null, val: number | string | boolean, precision = 2) => {
      if (el) {
        if (typeof val === 'boolean') {
          el.textContent = val ? 'YES' : 'NO';
          el.style.color = val ? '#00ff88' : '#666';
        } else if (typeof val === 'number') {
          el.textContent = precision === 0
            ? Math.round(val).toString()
            : val.toFixed(precision);
        } else {
          el.textContent = val;
        }
      }
    };

    // Input section
    update(this.dbgFwd, debug.forwardInput);
    update(this.dbgRight, debug.rightInput);
    update(this.dbgJump, debug.jumpInput);

    // Velocity section
    update(this.dbgSpeed, debug.speed, 0);
    update(this.dbgVx, debug.vx);
    update(this.dbgVy, debug.vy);
    update(this.dbgVz, debug.vz);

    // Acceleration section
    update(this.dbgWdx, debug.wishDirX);
    update(this.dbgWdz, debug.wishDirZ);
    update(this.dbgWishspeed, debug.wishSpeed);
    update(this.dbgCurrentspeed, debug.currentSpeed);
    update(this.dbgAddspeed, debug.addSpeed);
    update(this.dbgAccelspeed, debug.accelSpeed);

    // Movement State section
    const state = this.player.getState();
    if (this.dbgState) {
      if (state.isOnLadder) {
        this.dbgState.textContent = 'LADDER';
        this.dbgState.style.color = '#ff8800';
      } else if (state.isOnSlope) {
        this.dbgState.textContent = 'SURF';
        this.dbgState.style.color = '#00aaff';
      } else if (state.isGrounded) {
        this.dbgState.textContent = 'GROUND';
        this.dbgState.style.color = '#00ff88';
      } else {
        this.dbgState.textContent = 'AIR';
        this.dbgState.style.color = '#ff8800';
      }
    }
    if (this.dbgAccmode) {
      const accel = debug.airAccel;
      if (accel === 10) {
        this.dbgAccmode.textContent = 'Ground';
        this.dbgAccmode.style.color = '#00ff88';
      } else if (accel === 100) {
        this.dbgAccmode.textContent = 'Strafe';
        this.dbgAccmode.style.color = '#ffaa00';
      } else {
        this.dbgAccmode.textContent = 'Air';
        this.dbgAccmode.style.color = '#aaa';
      }
    }
    update(this.dbgAccval, debug.airAccel, 0);

    // Camera section - get from state (not debugInfo)
    if (this.dbgYaw) {
      const yawDeg = (state.viewAngles.yaw * 180 / Math.PI).toFixed(0);
      this.dbgYaw.textContent = `${yawDeg}°`;
    }
    if (this.dbgPitch) {
      const pitchDeg = (state.viewAngles.pitch * 180 / Math.PI).toFixed(0);
      this.dbgPitch.textContent = `${pitchDeg}°`;
    }

    // CPM Mechanics section
    update(this.dbgStrafeonly, debug.isStrafingOnly);
    update(this.dbgAircontrol, debug.airControlActive);
  }

  /**
   * Get preset manager for external access
   */
  getPresetManager(): PresetManager {
    return this.presets;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stop();
    this.input.dispose();
    this.player.dispose();
    this.renderer.dispose();
  }
}
