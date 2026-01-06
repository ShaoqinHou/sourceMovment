import {
  MovementConfig,
  MovementPreset,
  DEFAULT_CONFIG,
  cloneConfig,
} from './MovementConfig';
import { CPM_PRESET } from './presets/cpm';
import { VQ3_PRESET } from './presets/vq3';
import { CSGO_PRESET } from './presets/csgo';

const STORAGE_KEY = 'sourceMovement_presets';
const CURRENT_PRESET_KEY = 'sourceMovement_currentPreset';

/**
 * Manages movement presets - loading, saving, switching
 */
export class PresetManager {
  private builtInPresets: Map<string, MovementPreset> = new Map();
  private customPresets: Map<string, MovementPreset> = new Map();
  private currentPresetName: string = 'CPM';
  private currentConfig: MovementConfig;
  private listeners: Set<(config: MovementConfig, presetName: string) => void> = new Set();

  constructor() {
    // Register built-in presets
    this.builtInPresets.set('CPM', CPM_PRESET);
    this.builtInPresets.set('VQ3', VQ3_PRESET);
    this.builtInPresets.set('CS:GO', CSGO_PRESET);

    // Load custom presets from localStorage
    this.loadCustomPresets();

    // Load last used preset or default to CPM
    const lastPreset = localStorage.getItem(CURRENT_PRESET_KEY) || 'CPM';
    const preset = this.getPreset(lastPreset);
    this.currentPresetName = preset ? lastPreset : 'CPM';
    this.currentConfig = cloneConfig(
      preset?.config || CPM_PRESET.config
    );
  }

  /**
   * Get the current active configuration
   */
  getConfig(): MovementConfig {
    return this.currentConfig;
  }

  /**
   * Get the current preset name
   */
  getCurrentPresetName(): string {
    return this.currentPresetName;
  }

  /**
   * Get a specific preset by name
   */
  getPreset(name: string): MovementPreset | undefined {
    return this.builtInPresets.get(name) || this.customPresets.get(name);
  }

  /**
   * List all available presets
   */
  listPresets(): { name: string; preset: MovementPreset; isBuiltIn: boolean }[] {
    const result: { name: string; preset: MovementPreset; isBuiltIn: boolean }[] = [];

    for (const [name, preset] of this.builtInPresets) {
      result.push({ name, preset, isBuiltIn: true });
    }

    for (const [name, preset] of this.customPresets) {
      result.push({ name, preset, isBuiltIn: false });
    }

    return result;
  }

  /**
   * Load a preset by name
   */
  loadPreset(name: string): boolean {
    const preset = this.getPreset(name);
    if (!preset) {
      console.warn(`Preset "${name}" not found`);
      return false;
    }

    this.currentPresetName = name;
    this.currentConfig = cloneConfig(preset.config);
    localStorage.setItem(CURRENT_PRESET_KEY, name);
    this.notifyListeners();
    return true;
  }

  /**
   * Save current config as a new preset
   */
  savePreset(name: string, description?: string): boolean {
    if (this.builtInPresets.has(name)) {
      console.warn(`Cannot overwrite built-in preset "${name}"`);
      return false;
    }

    const preset: MovementPreset = {
      name,
      description: description || `Custom preset: ${name}`,
      reference: 'Custom',
      config: cloneConfig(this.currentConfig),
    };

    this.customPresets.set(name, preset);
    this.currentPresetName = name;
    this.saveCustomPresets();
    localStorage.setItem(CURRENT_PRESET_KEY, name);
    this.notifyListeners();
    return true;
  }

  /**
   * Delete a custom preset
   */
  deletePreset(name: string): boolean {
    if (this.builtInPresets.has(name)) {
      console.warn(`Cannot delete built-in preset "${name}"`);
      return false;
    }

    if (!this.customPresets.has(name)) {
      console.warn(`Custom preset "${name}" not found`);
      return false;
    }

    this.customPresets.delete(name);
    this.saveCustomPresets();

    // If we deleted the current preset, switch to CPM
    if (this.currentPresetName === name) {
      this.loadPreset('CPM');
    }

    return true;
  }

  /**
   * Update a single config value
   */
  setConfigValue<K extends keyof MovementConfig>(
    key: K,
    value: MovementConfig[K]
  ): void {
    this.currentConfig[key] = value;
    this.currentPresetName = 'Custom*'; // Mark as modified
    this.notifyListeners();
  }

  /**
   * Reset to current preset defaults
   */
  resetToPreset(): void {
    const preset = this.getPreset(this.currentPresetName);
    if (preset) {
      this.currentConfig = cloneConfig(preset.config);
      this.notifyListeners();
    }
  }

  /**
   * Subscribe to config changes
   */
  onChange(listener: (config: MovementConfig, presetName: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentConfig, this.currentPresetName);
    }
  }

  private loadCustomPresets(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as Record<string, MovementPreset>;
        for (const [name, preset] of Object.entries(data)) {
          // Ensure preset has all required fields
          const fullConfig: MovementConfig = {
            ...DEFAULT_CONFIG,
            ...preset.config,
          };
          this.customPresets.set(name, {
            ...preset,
            config: fullConfig,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load custom presets:', e);
    }
  }

  private saveCustomPresets(): void {
    try {
      const data: Record<string, MovementPreset> = {};
      for (const [name, preset] of this.customPresets) {
        data[name] = preset;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save custom presets:', e);
    }
  }
}

// Singleton instance
let presetManagerInstance: PresetManager | null = null;

export function getPresetManager(): PresetManager {
  if (!presetManagerInstance) {
    presetManagerInstance = new PresetManager();
  }
  return presetManagerInstance;
}
