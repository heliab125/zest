// Agents service - manages CLI agent configurations

import { invoke } from "@tauri-apps/api/core";

export interface ShellInfo {
  id: string;
  name: string;
  profile_path: string;
  available: boolean;
}

export interface AgentInfo {
  id: string;
  name: string;
  env_var: string;
  description: string;
  requires_api_key: boolean;
}

/**
 * Detect the current shell type
 */
export async function detectShell(): Promise<string> {
  return await invoke<string>("detect_shell");
}

/**
 * Get the profile path for a shell
 */
export async function getShellProfilePath(shell: string): Promise<string> {
  return await invoke<string>("get_shell_profile_path", { shell });
}

/**
 * Check if an agent is configured in the shell profile
 */
export async function isAgentConfigured(
  shell: string,
  agent: string
): Promise<boolean> {
  return await invoke<boolean>("is_agent_configured", { shell, agent });
}

/**
 * Configure an agent in the shell profile
 */
export async function configureAgent(
  shell: string,
  agent: string,
  apiKey?: string
): Promise<void> {
  return await invoke<void>("configure_agent", { shell, agent, apiKey });
}

/**
 * Remove agent configuration from shell profile
 */
export async function unconfigureAgent(
  shell: string,
  agent: string
): Promise<void> {
  return await invoke<void>("unconfigure_agent", { shell, agent });
}

/**
 * Create a backup of the shell profile
 */
export async function createShellBackup(shell: string): Promise<string> {
  return await invoke<string>("create_shell_backup", { shell });
}

/**
 * Get the environment command to copy-paste
 */
export async function getEnvCommand(
  agent: string,
  apiKey?: string
): Promise<string> {
  return await invoke<string>("get_env_command", { agent, apiKey });
}

/**
 * Get available shells
 */
export async function getAvailableShells(): Promise<ShellInfo[]> {
  return await invoke<ShellInfo[]>("get_available_shells");
}

/**
 * Get available agents
 */
export async function getAvailableAgents(): Promise<AgentInfo[]> {
  return await invoke<AgentInfo[]>("get_available_agents");
}

// ============================================================================
// Advanced Agent Configuration
// ============================================================================

export interface BackupFile {
  id: string;
  name: string;
  date: string;
  path: string;
}

export interface AgentConfiguration {
  agent: string;
  modelSlots: Record<string, string>;
  proxyURL: string;
  apiKey: string;
  useOAuth: boolean;
  setupMode: "proxy" | "default";
}

/**
 * Find agent binary path
 */
export async function findAgentBinary(binaryNames: string[]): Promise<string | null> {
  try {
    return await invoke<string | null>("find_agent_binary", { binaryNames });
  } catch {
    return null;
  }
}

/**
 * Configure agent with advanced options
 */
export async function configureAgentAdvanced(
  shell: string,
  agent: string,
  config: AgentConfiguration,
  configMode: "automatic" | "manual",
  storageOption: "json" | "shell" | "both"
): Promise<void> {
  return await invoke<void>("configure_agent_advanced", {
    shell,
    agent,
    config,
    configMode,
    storageOption,
  });
}

/**
 * Get available backups for an agent
 */
export async function getAgentBackups(agent: string): Promise<BackupFile[]> {
  try {
    return await invoke<BackupFile[]>("get_agent_backups", { agent });
  } catch {
    return [];
  }
}

/**
 * Restore agent configuration from backup
 */
export async function restoreAgentBackup(agent: string, backupPath: string): Promise<void> {
  return await invoke<void>("restore_agent_backup", { agent, backupPath });
}
