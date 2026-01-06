/**
 * Movement Configuration Interface
 * Based on Quake 3 Challenge ProMode (CPM) physics
 *
 * Unit System: Quake units (qu)
 * - 1 qu ≈ 1 inch ≈ 2.54 cm
 * - 16 qu = 1 foot
 * - Player height: 56 qu (standing), 32 qu (crouching)
 * - Player width: 32 qu
 */

export interface MovementConfig {
  // === Speed Limits ===
  /** Base max speed - server's speed limit (qu/s). Default: 320 */
  g_speed: number;
  /** Max ground movement speed (qu/s). Default: 320 */
  pm_maxspeed: number;

  // === Ground Movement ===
  /** Ground acceleration multiplier. Default: 10 */
  pm_accelerate: number;
  /** Ground friction coefficient. Default: 6 */
  pm_friction: number;
  /** Speed threshold below which friction is stronger (qu/s). Default: 100 */
  pm_stopspeed: number;

  // === Air Movement ===
  /** Air acceleration multiplier (VQ3-style component). Default: 1 */
  pm_airaccelerate: number;
  /** CPM strafe acceleration when NOT holding forward (A/D only). Default: 100 */
  cpm_strafeaccelerate: number;
  /** CPM air control amount - allows turning without strafing. Default: 150 */
  cpm_aircontrol: number;
  /** CPM air strafe acceleration multiplier. Default: 1 */
  cpm_airstrafe: number;
  /** Per-frame wish speed cap for air strafing (qu). Default: 30 */
  cpm_wishspeed: number;

  // === Jumping ===
  /** Upward velocity applied on jump (qu/s). Default: 270 */
  pm_jumpvelocity: number;
  /** Gravity acceleration (qu/s^2). Default: 800 */
  g_gravity: number;

  // === Surfing ===
  /** Friction multiplier on slick/surf surfaces. Default: 0.25 */
  pm_slickfriction: number;
  /** Acceleration on surf ramps. Default: 10 */
  pm_slickaccel: number;
  /** Minimum surface angle to be considered a surf ramp (degrees). Default: 45 */
  pm_surfangle: number;

  // === Ladder ===
  /** Ladder climbing speed (qu/s). Default: 200 */
  pm_ladderSpeed: number;

  // === Crouch ===
  /** Speed multiplier when crouching. Default: 0.5 */
  pm_crouchspeed: number;

  // === Physics Tick ===
  /** Fixed physics timestep (seconds). Default: 0.008 (125Hz) */
  pm_frametime: number;
}

/**
 * Movement preset metadata
 */
export interface MovementPreset {
  /** Display name for the preset */
  name: string;
  /** Short description */
  description: string;
  /** Reference game/source */
  reference: string;
  /** The actual config values */
  config: MovementConfig;
}

/**
 * Default CPM configuration values
 * Reference: Quake 3 Challenge ProMode Arena
 */
export const DEFAULT_CONFIG: MovementConfig = {
  // Speed limits
  g_speed: 320,
  pm_maxspeed: 320,

  // Ground movement
  pm_accelerate: 10,
  pm_friction: 6,
  pm_stopspeed: 100,

  // Air movement (CPM)
  pm_airaccelerate: 1,
  cpm_strafeaccelerate: 100,  // THE SECRET: 100x when strafing without W!
  cpm_aircontrol: 0.02,       // Air control for turning (0.02 recommended)
  cpm_airstrafe: 1,
  cpm_wishspeed: 30,

  // Jumping
  pm_jumpvelocity: 270,
  g_gravity: 800,

  // Surfing
  pm_slickfriction: 0.25,
  pm_slickaccel: 10,
  pm_surfangle: 45,

  // Ladder
  pm_ladderSpeed: 200,

  // Crouch
  pm_crouchspeed: 0.5,

  // Physics tick
  pm_frametime: 0.008, // 125Hz
};

/**
 * Create a copy of a config
 */
export function cloneConfig(config: MovementConfig): MovementConfig {
  return { ...config };
}

/**
 * Merge partial config into base config
 */
export function mergeConfig(
  base: MovementConfig,
  partial: Partial<MovementConfig>
): MovementConfig {
  return { ...base, ...partial };
}

/**
 * Config parameter metadata for UI/console
 */
export interface ConfigParamMeta {
  key: keyof MovementConfig;
  name: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  category: 'speed' | 'ground' | 'air' | 'jump' | 'surf' | 'misc';
}

export const CONFIG_PARAMS: ConfigParamMeta[] = [
  // Speed
  { key: 'g_speed', name: 'g_speed', description: 'Base max speed', min: 100, max: 1000, step: 10, unit: 'qu/s', category: 'speed' },
  { key: 'pm_maxspeed', name: 'pm_maxspeed', description: 'Max ground speed', min: 100, max: 1000, step: 10, unit: 'qu/s', category: 'speed' },

  // Ground
  { key: 'pm_accelerate', name: 'pm_accelerate', description: 'Ground acceleration', min: 1, max: 50, step: 1, unit: '', category: 'ground' },
  { key: 'pm_friction', name: 'pm_friction', description: 'Ground friction', min: 0, max: 20, step: 0.5, unit: '', category: 'ground' },
  { key: 'pm_stopspeed', name: 'pm_stopspeed', description: 'Stop speed threshold', min: 10, max: 200, step: 10, unit: 'qu/s', category: 'ground' },

  // Air
  { key: 'pm_airaccelerate', name: 'pm_airaccelerate', description: 'Air acceleration (VQ3)', min: 0, max: 100, step: 1, unit: '', category: 'air' },
  { key: 'cpm_strafeaccelerate', name: 'cpm_strafeaccelerate', description: 'CPM strafe accel (A/D only)', min: 0, max: 200, step: 10, unit: '', category: 'air' },
  { key: 'cpm_aircontrol', name: 'cpm_aircontrol', description: 'CPM air control', min: 0, max: 0.1, step: 0.005, unit: '', category: 'air' },
  { key: 'cpm_airstrafe', name: 'cpm_airstrafe', description: 'CPM air strafe', min: 0, max: 10, step: 0.5, unit: '', category: 'air' },
  { key: 'cpm_wishspeed', name: 'cpm_wishspeed', description: 'Air wish speed cap', min: 1, max: 100, step: 1, unit: 'qu', category: 'air' },

  // Jump
  { key: 'pm_jumpvelocity', name: 'pm_jumpvelocity', description: 'Jump velocity', min: 100, max: 500, step: 10, unit: 'qu/s', category: 'jump' },
  { key: 'g_gravity', name: 'g_gravity', description: 'Gravity', min: 100, max: 2000, step: 50, unit: 'qu/s²', category: 'jump' },

  // Surf
  { key: 'pm_slickfriction', name: 'pm_slickfriction', description: 'Surf friction', min: 0, max: 1, step: 0.05, unit: '', category: 'surf' },
  { key: 'pm_slickaccel', name: 'pm_slickaccel', description: 'Surf acceleration', min: 0, max: 50, step: 1, unit: '', category: 'surf' },
  { key: 'pm_surfangle', name: 'pm_surfangle', description: 'Surf ramp angle', min: 30, max: 60, step: 1, unit: '°', category: 'surf' },

  // Misc
  { key: 'pm_ladderSpeed', name: 'pm_ladderSpeed', description: 'Ladder speed', min: 50, max: 500, step: 10, unit: 'qu/s', category: 'misc' },
  { key: 'pm_crouchspeed', name: 'pm_crouchspeed', description: 'Crouch speed multiplier', min: 0.1, max: 1, step: 0.1, unit: '', category: 'misc' },
];
