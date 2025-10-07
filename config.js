import fs from "fs/promises";
import path from "path";
import os from "os";

export const CONFIG_DIR = path.join(os.homedir(), ".tdl");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

/**
 * Maximum category depth (all todos support up to 3 levels)
 * Can be increased in the future if needed
 */
export const MAX_CATEGORY_DEPTH = 3;

/**
 * Color profiles with aesthetically pleasing combinations
 */
export const COLOR_PROFILES = {
  default: {
    name: "Default",
    border: "\x1b[38;5;38m",        // Medium blue-cyan
    title: "\x1b[95m",              // Magenta
    index: "\x1b[46m\x1b[97m",      // Cyan background, bright white text
    category: "\x1b[35m",           // Magenta
    subcategory: "\x1b[36m",        // Cyan
    task: "\x1b[97m",               // Bright white
    timestamp: "\x1b[90m",          // Gray
    categoryHeader: "\x1b[1m\x1b[36m", // Bold cyan
    subcategoryHeader: "\x1b[36m",  // Cyan (not bold)
    untaggedHeader: "\x1b[90m",     // Gray
    completed: "\x1b[32m",          // Green
    empty: "\x1b[33m",              // Yellow
  },
  ocean: {
    name: "Ocean",
    border: "\x1b[38;5;24m",        // Deep blue
    title: "\x1b[38;5;39m",         // Bright blue
    index: "\x1b[48;5;24m\x1b[97m", // Deep blue background, white text
    category: "\x1b[38;5;45m",      // Bright cyan
    subcategory: "\x1b[38;5;51m",   // Light cyan
    task: "\x1b[38;5;231m",         // White
    timestamp: "\x1b[38;5;240m",    // Dark gray
    categoryHeader: "\x1b[1m\x1b[38;5;45m", // Bold bright cyan
    subcategoryHeader: "\x1b[38;5;51m", // Light cyan (not bold)
    untaggedHeader: "\x1b[38;5;240m", // Dark gray
    completed: "\x1b[38;5;42m",     // Sea green
    empty: "\x1b[38;5;215m",        // Peach
  },
  forest: {
    name: "Forest",
    border: "\x1b[38;5;28m",        // Forest green
    title: "\x1b[38;5;34m",         // Bright green
    index: "\x1b[48;5;22m\x1b[97m", // Dark green background, white text
    category: "\x1b[38;5;76m",      // Light green
    subcategory: "\x1b[38;5;114m",  // Pale green
    task: "\x1b[38;5;231m",         // White
    timestamp: "\x1b[38;5;240m",    // Dark gray
    categoryHeader: "\x1b[1m\x1b[38;5;76m", // Bold light green
    subcategoryHeader: "\x1b[38;5;114m", // Pale green (not bold)
    untaggedHeader: "\x1b[38;5;240m", // Dark gray
    completed: "\x1b[38;5;40m",     // Bright green
    empty: "\x1b[38;5;220m",        // Gold
  },
  sunset: {
    name: "Sunset",
    border: "\x1b[38;5;166m",       // Orange
    title: "\x1b[38;5;208m",        // Bright orange
    index: "\x1b[48;5;130m\x1b[97m", // Brown background, white text
    category: "\x1b[38;5;203m",     // Pink
    subcategory: "\x1b[38;5;215m",  // Peach
    task: "\x1b[38;5;231m",         // White
    timestamp: "\x1b[38;5;240m",    // Dark gray
    categoryHeader: "\x1b[1m\x1b[38;5;203m", // Bold pink
    subcategoryHeader: "\x1b[38;5;215m", // Peach (not bold)
    untaggedHeader: "\x1b[38;5;240m", // Dark gray
    completed: "\x1b[38;5;113m",    // Yellow-green
    empty: "\x1b[38;5;226m",        // Yellow
  },
  purple: {
    name: "Purple Haze",
    border: "\x1b[38;5;93m",        // Purple
    title: "\x1b[38;5;135m",        // Light purple
    index: "\x1b[48;5;54m\x1b[97m", // Dark purple background, white text
    category: "\x1b[38;5;141m",     // Lavender
    subcategory: "\x1b[38;5;183m",  // Light lavender
    task: "\x1b[38;5;231m",         // White
    timestamp: "\x1b[38;5;240m",    // Dark gray
    categoryHeader: "\x1b[1m\x1b[38;5;141m", // Bold lavender
    subcategoryHeader: "\x1b[38;5;183m", // Light lavender (not bold)
    untaggedHeader: "\x1b[38;5;240m", // Dark gray
    completed: "\x1b[38;5;120m",    // Light green
    empty: "\x1b[38;5;227m",        // Light yellow
  },
  monochrome: {
    name: "Monochrome",
    border: "\x1b[38;5;250m",       // Light gray
    title: "\x1b[1m\x1b[97m",       // Bold white
    index: "\x1b[48;5;240m\x1b[97m", // Gray background, white text
    category: "\x1b[38;5;255m",     // Bright white
    subcategory: "\x1b[38;5;250m",  // Light gray
    task: "\x1b[97m",               // Bright white
    timestamp: "\x1b[38;5;240m",    // Dark gray
    categoryHeader: "\x1b[1m\x1b[38;5;255m", // Bold bright white
    subcategoryHeader: "\x1b[38;5;250m", // Light gray (not bold)
    untaggedHeader: "\x1b[38;5;245m", // Medium gray
    completed: "\x1b[38;5;250m",    // Light gray
    empty: "\x1b[38;5;245m",        // Medium gray
  },
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  colorProfile: "default",
  scope: "project", // "project" or "global" - controls which todos are DISPLAYED (filter, not storage)
};

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

/**
 * Read configuration from file
 * @returns {Promise<Object>} Configuration object
 */
export async function readConfig() {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(data);

    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) {
      console.warn('Invalid config file format, using defaults');
      return { ...DEFAULT_CONFIG };
    }

    // Only accept known keys with valid values
    const config = { ...DEFAULT_CONFIG };

    if (typeof parsed.colorProfile === 'string' && COLOR_PROFILES[parsed.colorProfile]) {
      config.colorProfile = parsed.colorProfile;
    }

    if (parsed.scope === 'project' || parsed.scope === 'global') {
      config.scope = parsed.scope;
    }

    return config;
  } catch (error) {
    if (error.code === "ENOENT") {
      // Config file doesn't exist, return defaults
      return { ...DEFAULT_CONFIG };
    }
    // If JSON parsing fails, return defaults instead of crashing
    if (error instanceof SyntaxError) {
      console.warn('Config file contains invalid JSON, using defaults');
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

/**
 * Write configuration to file atomically
 * @param {Object} config - Configuration object
 */
export async function writeConfig(config) {
  await ensureConfigDir();
  const tempFile = CONFIG_FILE + '.tmp';

  // Write to temp file first
  await fs.writeFile(tempFile, JSON.stringify(config, null, 2), "utf-8");

  // Atomic rename (on most filesystems)
  await fs.rename(tempFile, CONFIG_FILE);
}

/**
 * Get the current color profile with validation
 * @returns {Promise<Object>} Color profile object
 */
export async function getColorProfile() {
  const config = await readConfig();
  const profileName = config.colorProfile || "default";
  const profile = COLOR_PROFILES[profileName] || COLOR_PROFILES.default;

  // Ensure all required keys exist by merging with default
  return { ...COLOR_PROFILES.default, ...profile };
}

/**
 * Set the color profile
 * @param {string} profileName - Name of the color profile to use
 * @throws {Error} If profile name is invalid
 */
export async function setColorProfile(profileName) {
  if (!COLOR_PROFILES[profileName]) {
    const available = Object.keys(COLOR_PROFILES).join(", ");
    throw new Error(`Invalid color profile "${profileName}". Available: ${available}`);
  }

  const config = await readConfig();
  config.colorProfile = profileName;
  await writeConfig(config);
}

/**
 * Get the current scope setting (project or global)
 * @returns {Promise<string>} "project" or "global"
 */
export async function getScope() {
  const config = await readConfig();
  return config.scope || "project";
}

/**
 * Set the scope setting
 * @param {string} scope - "project", "global", "local" (alias for "project")
 * @throws {Error} If scope is invalid
 */
export async function setScope(scope) {
  // Allow "local" as alias for "project" for API consistency
  const normalizedScope = scope === "local" ? "project" : scope;

  if (normalizedScope !== "project" && normalizedScope !== "global") {
    throw new Error(`Invalid scope "${scope}". Must be "project", "local", or "global"`);
  }

  const config = await readConfig();
  config.scope = normalizedScope;
  await writeConfig(config);
}
