/**
 * Input state for movement
 */
export interface MovementInput {
  forward: number;   // -1 to 1 (S to W)
  right: number;     // -1 to 1 (A to D)
  jump: boolean;     // Space
  crouch: boolean;   // Ctrl/C
  walk: boolean;     // Shift
}

/**
 * Mouse input state
 */
export interface MouseInput {
  deltaX: number;    // Raw mouse X movement
  deltaY: number;    // Raw mouse Y movement
}

/**
 * Manages keyboard and mouse input with Pointer Lock API
 */
export class InputManager {
  private keys: Set<string> = new Set();
  private mouseInput: MouseInput = { deltaX: 0, deltaY: 0 };
  private canvas: HTMLCanvasElement;
  private isLocked: boolean = false;

  // Callbacks
  private onLockChange: ((locked: boolean) => void) | null = null;
  private onConsoleToggle: (() => void) | null = null;
  private onPresetSwitch: ((index: number) => void) | null = null;
  private onDebugToggle: (() => void) | null = null;
  private onTestStart: (() => void) | null = null;
  private onTestNext: (() => void) | null = null;
  private onTestPrev: (() => void) | null = null;
  private onTestPause: (() => void) | null = null;

  // Mouse sensitivity
  public sensitivity: number = 0.002;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Mouse events
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));

    // Pointer lock events
    document.addEventListener('pointerlockchange', this.handlePointerLockChange.bind(this));
    document.addEventListener('pointerlockerror', this.handlePointerLockError.bind(this));

    // Click to lock
    this.canvas.addEventListener('click', () => {
      if (!this.isLocked) {
        this.requestPointerLock();
      }
    });
  }

  /**
   * Request pointer lock with optional unadjusted movement (no mouse acceleration)
   */
  public requestPointerLock(): void {
    // Use standard pointer lock (most compatible)
    this.canvas.requestPointerLock();
  }

  /**
   * Exit pointer lock
   */
  public exitPointerLock(): void {
    document.exitPointerLock();
  }

  /**
   * Check if pointer is locked
   */
  public get pointerLocked(): boolean {
    return this.isLocked;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Prevent default for game keys
    if (this.isGameKey(e.code)) {
      e.preventDefault();
    }

    // Console toggle (backtick/tilde)
    if (e.code === 'Backquote' && this.onConsoleToggle) {
      this.onConsoleToggle();
      return;
    }

    // Debug toggle (F4)
    if (e.code === 'F4' && this.onDebugToggle) {
      e.preventDefault();
      this.onDebugToggle();
      return;
    }

    // Test mode keys (F5-F8)
    if (e.code === 'F5' && this.onTestStart) {
      e.preventDefault();
      this.onTestStart();
      return;
    }
    if (e.code === 'F6' && this.onTestNext) {
      e.preventDefault();
      this.onTestNext();
      return;
    }
    if (e.code === 'F7' && this.onTestPrev) {
      e.preventDefault();
      this.onTestPrev();
      return;
    }
    if (e.code === 'F8' && this.onTestPause) {
      e.preventDefault();
      this.onTestPause();
      return;
    }

    // Preset switching (F1-F3, F9)
    if (e.code.startsWith('F') && e.code.length <= 3) {
      const num = parseInt(e.code.substring(1));
      // Skip F4 (debug), F5-F8 (test keys)
      if (num >= 1 && num <= 9 && num !== 4 && !(num >= 5 && num <= 8) && this.onPresetSwitch) {
        e.preventDefault();
        this.onPresetSwitch(num);
        return;
      }
    }

    // Escape to unlock
    if (e.code === 'Escape' && this.isLocked) {
      this.exitPointerLock();
      return;
    }

    this.keys.add(e.code);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isLocked) {
      this.mouseInput.deltaX += e.movementX;
      this.mouseInput.deltaY += e.movementY;
    }
  }

  private handlePointerLockChange(): void {
    this.isLocked = document.pointerLockElement === this.canvas;
    if (this.onLockChange) {
      this.onLockChange(this.isLocked);
    }

    if (!this.isLocked) {
      // Clear input when unlocked
      this.keys.clear();
      this.mouseInput = { deltaX: 0, deltaY: 0 };
    }
  }

  private handlePointerLockError(): void {
    console.error('Pointer lock failed');
  }

  private isGameKey(code: string): boolean {
    const gameKeys = [
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
      'Space', 'ControlLeft', 'ControlRight',
      'ShiftLeft', 'ShiftRight', 'KeyC',
    ];
    return gameKeys.includes(code);
  }

  /**
   * Get current movement input state
   */
  public getMovementInput(): MovementInput {
    return {
      forward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      right: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
      jump: this.keys.has('Space'),
      crouch: this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyC'),
      walk: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  /**
   * Get and reset mouse input (call once per frame)
   */
  public consumeMouseInput(): MouseInput {
    const input = { ...this.mouseInput };
    this.mouseInput = { deltaX: 0, deltaY: 0 };
    return input;
  }

  /**
   * Check if a specific key is pressed
   */
  public isKeyPressed(code: string): boolean {
    return this.keys.has(code);
  }

  /**
   * Set callback for pointer lock state changes
   */
  public setOnLockChange(callback: (locked: boolean) => void): void {
    this.onLockChange = callback;
  }

  /**
   * Set callback for console toggle
   */
  public setOnConsoleToggle(callback: () => void): void {
    this.onConsoleToggle = callback;
  }

  /**
   * Set callback for preset switching
   */
  public setOnPresetSwitch(callback: (index: number) => void): void {
    this.onPresetSwitch = callback;
  }

  /**
   * Set callback for debug toggle
   */
  public setOnDebugToggle(callback: () => void): void {
    this.onDebugToggle = callback;
  }

  /**
   * Set callback for test start (F5)
   */
  public setOnTestStart(callback: () => void): void {
    this.onTestStart = callback;
  }

  /**
   * Set callback for test next (F6)
   */
  public setOnTestNext(callback: () => void): void {
    this.onTestNext = callback;
  }

  /**
   * Set callback for test previous (F7)
   */
  public setOnTestPrev(callback: () => void): void {
    this.onTestPrev = callback;
  }

  /**
   * Set callback for test pause (F8)
   */
  public setOnTestPause(callback: () => void): void {
    this.onTestPause = callback;
  }

  /**
   * Cleanup event listeners
   */
  public dispose(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
  }
}
