import { MovementPreset, DEFAULT_CONFIG } from '../MovementConfig';

/**
 * Counter-Strike: Global Offensive Preset
 *
 * Reference: CS:GO default server settings
 * Source: https://developer.valvesoftware.com/wiki/List_of_CS:GO_Cvars
 *
 * CS:GO uses Source engine with higher air acceleration (12).
 * Bunny hopping is limited by stamina system in competitive,
 * but this preset uses bhop-friendly settings.
 */
export const CSGO_PRESET: MovementPreset = {
  name: 'CS:GO',
  description: 'Counter-Strike: Global Offensive - Source engine',
  reference: 'CS:GO',
  config: {
    ...DEFAULT_CONFIG,
    // CS:GO-specific values (with bhop settings)
    g_speed: 250,      // CS:GO knife speed
    pm_maxspeed: 250,
    pm_accelerate: 5.6,
    pm_friction: 4.8,  // sv_friction default
    pm_stopspeed: 75,
    pm_airaccelerate: 12, // sv_airaccelerate default
    cpm_strafeaccelerate: 0,  // No CPM strafe boost in Source
    cpm_aircontrol: 0,    // No CPM-style air control
    cpm_airstrafe: 0,
    cpm_wishspeed: 30,
    pm_jumpvelocity: 301.993377, // sqrt(2 * 800 * 57) for 57 unit jump height
    g_gravity: 800,
  },
};

export default CSGO_PRESET;
