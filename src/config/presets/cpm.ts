import { MovementPreset, DEFAULT_CONFIG } from '../MovementConfig';

/**
 * Quake 3 Challenge ProMode Arena (CPMA) Preset
 *
 * Reference: Free ProMode physics for OpenArena/Quake III Arena
 * Source: https://www.origamiparade.com/programming-projects/openarena/freepromode/
 *
 * CPM features enhanced movement compared to VQ3:
 * - Strafe acceleration: 100x when holding ONLY A/D (no W)
 * - Air control: 0.02 allows smooth turning without losing speed
 * - Circle jump: 600+ qu/s from standstill
 * - Unlimited max speed through strafe jumping
 */
export const CPM_PRESET: MovementPreset = {
  name: 'CPM',
  description: 'Quake 3 Challenge ProMode - Authentic physics from CPMA',
  reference: 'Quake 3 CPMA',
  config: {
    ...DEFAULT_CONFIG,
    // CPM values from actual source
    g_speed: 320,
    pm_maxspeed: 320,
    pm_accelerate: 10,
    pm_friction: 6,
    pm_stopspeed: 100,
    pm_airaccelerate: 1,           // Air acceleration when holding W
    cpm_strafeaccelerate: 100,     // 100x when holding ONLY A/D (no W)!
    cpm_aircontrol: 0.02,           // Air control for turning (0.02 recommended)
    cpm_airstrafe: 1,               // (not used in current implementation)
    cpm_wishspeed: 30,              // Air wish speed cap
    pm_jumpvelocity: 270,
    g_gravity: 800,
  },
};

export default CPM_PRESET;
