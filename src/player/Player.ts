import * as THREE from 'three';
import { MovementController, PlayerState } from '../physics/MovementController';
import { MovementConfig } from '../config/MovementConfig';
import { InputManager } from '../core/InputManager';

/**
 * Player entity - combines camera, movement controller, and input
 */
export class Player {
  public readonly camera: THREE.PerspectiveCamera;
  public readonly movement: MovementController;
  private input: InputManager;

  // Camera settings
  public fov: number = 90;
  public mouseSensitivity: number = 0.002;

  constructor(config: MovementConfig, input: InputManager) {
    this.input = input;
    this.movement = new MovementController(config);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      this.fov,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    );

    // Handle resize
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Update player state - call once per frame
   */
  update(dt: number): void {
    // Get input
    const movementInput = this.input.getMovementInput();
    const mouseInput = this.input.consumeMouseInput();

    // Update view angles from mouse
    if (this.input.pointerLocked) {
      this.movement.updateViewAngles(
        mouseInput.deltaX,
        mouseInput.deltaY,
        this.mouseSensitivity
      );
    }

    // Update movement physics
    this.movement.update(movementInput, dt);

    // Update camera from state
    this.updateCamera();
  }

  /**
   * Update camera position and rotation from movement state
   */
  private updateCamera(): void {
    const state = this.movement.getState();

    // Position camera at eye height
    const eyeHeight = state.isCrouching
      ? this.movement.EYE_HEIGHT_CROUCH
      : this.movement.EYE_HEIGHT;

    this.camera.position.set(
      state.position.x,
      state.position.y - this.movement.EYE_HEIGHT + eyeHeight,
      state.position.z
    );

    // Set camera rotation from view angles
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = state.viewAngles.yaw;
    this.camera.rotation.x = state.viewAngles.pitch;
  }

  /**
   * Get player state
   */
  getState(): PlayerState {
    return this.movement.getState();
  }

  /**
   * Get horizontal speed for HUD
   */
  getHorizontalSpeed(): number {
    return this.movement.getHorizontalSpeed();
  }

  /**
   * Get total speed
   */
  getTotalSpeed(): number {
    return this.movement.getTotalSpeed();
  }

  /**
   * Get debug info from movement controller
   */
  getDebugInfo() {
    return this.movement.debugInfo;
  }

  /**
   * Teleport player
   */
  teleport(position: THREE.Vector3): void {
    this.movement.teleport(position);
    this.updateCamera();
  }

  /**
   * Update config (for preset switching)
   */
  setConfig(config: MovementConfig): void {
    this.movement.setConfig(config);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    window.removeEventListener('resize', this.handleResize);
  }
}
