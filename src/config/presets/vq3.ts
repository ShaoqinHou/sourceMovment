import { MovementPreset, DEFAULT_CONFIG } from '../MovementConfig';

/**
 * Vanilla Quake 3 Arena (VQ3) Preset
 *
 * Reference: Original Quake 3 Arena
 * Source: id Software Quake III Arena source code
 * https://github.com/id-Software/Quake-III-Arena
 *
 * VQ3 has minimal air acceleration (1.0) and no special air control.
 * Strafe jumping requires precise angle management.
 * Circle jump starts around 500-545 qu/s.
 */
export const VQ3_PRESET: MovementPreset = {
  name: 'VQ3',
  description: 'Vanilla Quake 3 Arena - Classic physics',
  reference: 'Quake 3 Arena',
  config: {
    ...DEFAULT_CONFIG,
    // VQ3-specific values
    g_speed: 320,
    pm_maxspeed: 320,
    pm_accelerate: 10,
    pm_friction: 6,
    pm_stopspeed: 100,
    pm_airaccelerate: 1,
    cpm_strafeaccelerate: 0,  // No CPM strafe boost in VQ3
    cpm_aircontrol: 0, // No CPM air control in VQ3
    cpm_airstrafe: 0,  // No CPM air strafe
    cpm_wishspeed: 30,
    pm_jumpvelocity: 270,
    g_gravity: 800,
  },
};

export default VQ3_PRESET;
