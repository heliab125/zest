// Settings service - handles app settings

import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types";

/**
 * Get all settings
 */
export async function getSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_settings");
}

/**
 * Save all settings
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  return await invoke<void>("save_settings", { newSettings: settings });
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: AppSettings = {
  port: 8317,
  allow_network_access: false,
  use_bridge_mode: true,
  logging_to_file: false,
  routing_strategy: "round-robin",
  launch_at_login: false,
  show_in_tray: true,
  menu_bar_provider: undefined,
  theme: "system",
  language: "en",
  proxy_url: "",
};

/**
 * Routing strategies available
 */
export const ROUTING_STRATEGIES = [
  { value: "round-robin", label: "Round Robin" },
  { value: "random", label: "Random" },
  { value: "first-available", label: "First Available" },
  { value: "least-used", label: "Least Used" },
];

/**
 * Available themes
 */
export const THEMES = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

/**
 * Available languages
 */
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
  { value: "es", label: "Español" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
];
