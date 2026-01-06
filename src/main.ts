import { Game } from './core/Game';

/**
 * Source Movement Framework
 *
 * A web-based movement framework inspired by Quake 3 Challenge ProMode (CPM).
 *
 * Controls:
 * - WASD: Move
 * - Space: Jump
 * - Mouse: Look
 * - F1-F3: Switch presets (CPM, VQ3, CS:GO)
 * - R: Restart (teleport to spawn)
 * - ~: Toggle console (coming soon)
 *
 * Movement Techniques:
 * - Bunny Hop: Jump immediately on landing to preserve speed
 * - Strafe Jump: Hold W+A or W+D and move mouse in same direction
 * - Circle Jump: 90° turn into strafe jump for initial speed boost
 * - Air Control (CPM): Can turn in air by holding forward and turning
 */

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  // Create and start game
  const game = new Game(canvas);
  game.start();

  // Expose to window for debugging
  (window as any).game = game;
  (window as any).presets = game.getPresetManager();

  console.log('%c Source Movement Framework ', 'background: #1a1a2e; color: #00ff88; font-size: 20px; padding: 10px;');
  console.log('Based on Quake 3 CPM physics');
  console.log('');
  console.log('Debug commands:');
  console.log('  game.getPresetManager().loadPreset("VQ3")  - Switch to VQ3 preset');
  console.log('  game.getPresetManager().setConfigValue("g_gravity", 400)  - Half gravity');
  console.log('  game.getPresetManager().getConfig()  - View current config');
});
