// Proxy service - communicates with Rust backend via Tauri IPC

import { invoke } from "@tauri-apps/api/core";
import type { ProxyStatus, AuthFile } from "../types";

/**
 * Start the proxy server
 */
export async function startProxy(): Promise<ProxyStatus> {
  return await invoke<ProxyStatus>("start_proxy");
}

/**
 * Stop the proxy server
 */
export async function stopProxy(): Promise<ProxyStatus> {
  return await invoke<ProxyStatus>("stop_proxy");
}

/**
 * Get current proxy status
 */
export async function getProxyStatus(): Promise<ProxyStatus> {
  return await invoke<ProxyStatus>("get_proxy_status");
}

/**
 * Install the proxy binary
 */
export async function installProxyBinary(): Promise<string> {
  return await invoke<string>("install_proxy_binary");
}

/**
 * Get proxy version
 */
export async function getProxyVersion(): Promise<string | null> {
  return await invoke<string | null>("get_proxy_version");
}

/**
 * Check if binary is installed
 */
export async function isBinaryInstalled(): Promise<boolean> {
  return await invoke<boolean>("is_binary_installed");
}

/**
 * Get download progress (0.0 to 1.0)
 */
export async function getDownloadProgress(): Promise<number> {
  return await invoke<number>("get_download_progress");
}

/**
 * Check if currently downloading
 */
export async function isDownloading(): Promise<boolean> {
  return await invoke<boolean>("is_downloading");
}

/**
 * Get current port
 */
export async function getPort(): Promise<number> {
  return await invoke<number>("get_port");
}

/**
 * Set proxy port
 */
export async function setPort(port: number): Promise<void> {
  return await invoke<void>("set_port", { port });
}

/**
 * Get all auth files
 */
export async function getAuthFiles(): Promise<AuthFile[]> {
  return await invoke<AuthFile[]>("get_auth_files");
}

/**
 * Delete an auth file by name (via proxy API)
 */
export async function deleteAuthFile(fileName: string): Promise<void> {
  return await invoke<void>("delete_auth_file", { fileName });
}

/**
 * Toggle auth file enabled/disabled
 */
export async function toggleAuthFile(fileId: string, disabled: boolean): Promise<void> {
  return await invoke<void>("toggle_auth_file", { fileId, disabled });
}

/**
 * Get API keys
 */
export async function getApiKeys(): Promise<string[]> {
  return await invoke<string[]>("get_api_keys");
}

/**
 * Add an API key
 */
export async function addApiKey(key: string): Promise<void> {
  return await invoke<void>("add_api_key", { key });
}

/**
 * Delete an API key
 */
export async function deleteApiKey(key: string): Promise<void> {
  return await invoke<void>("delete_api_key", { key });
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  return await invoke<void>("copy_to_clipboard", { text });
}

/**
 * Open config folder
 */
export async function openConfigFolder(): Promise<void> {
  return await invoke<void>("open_config_folder");
}

/**
 * Open logs folder
 */
export async function openLogsFolder(): Promise<void> {
  return await invoke<void>("open_logs_folder");
}

// ============================================================================
// Direct Auth File Operations (when proxy is not running)
// ============================================================================

/**
 * Scan auth files directly from filesystem
 * Use this when proxy is not running
 */
export async function scanAuthFilesDirect(): Promise<AuthFile[]> {
  return await invoke<AuthFile[]>("scan_auth_files_direct");
}

/**
 * Get the auth directory path
 */
export async function getAuthDir(): Promise<string> {
  return await invoke<string>("get_auth_dir");
}

/**
 * Create a new auth file manually
 */
export async function createAuthFile(
  provider: string,
  email: string,
  token: string
): Promise<AuthFile> {
  return await invoke<AuthFile>("create_auth_file", { provider, email, token });
}

/**
 * Delete an auth file by path (direct, when proxy not running)
 */
export async function deleteAuthFileDirect(filePath: string): Promise<void> {
  return await invoke<void>("delete_auth_file_direct", { filePath });
}

/**
 * Toggle auth file enabled/disabled by path (direct, when proxy not running)
 */
export async function toggleAuthFileDirect(
  filePath: string,
  disable: boolean
): Promise<string> {
  return await invoke<string>("toggle_auth_file_direct", { filePath, disable });
}

/**
 * Get auth files - tries proxy first, falls back to direct scan
 * Always falls back to direct scan if proxy returns empty (e.g., auth error)
 */
export async function getAuthFilesWithFallback(): Promise<AuthFile[]> {
  // First, check if proxy is running
  let proxyRunning = false;
  try {
    const status = await getProxyStatus();
    proxyRunning = status.running;
  } catch {
    proxyRunning = false;
  }

  if (proxyRunning) {
    try {
      // Try to get from proxy API first
      const files = await invoke<AuthFile[]>("get_auth_files");
      if (files.length > 0) {
        return files;
      }
      // Proxy returned empty (possibly due to 401 or other error)
      // Fall through to direct scan
      console.log("Proxy returned empty, falling back to direct scan");
    } catch (err) {
      // Proxy error, fall through to direct scan
      console.log("Proxy API error, falling back to direct scan:", err);
    }
  }

  // Fall back to direct file scan
  return await scanAuthFilesDirect();
}
