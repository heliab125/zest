//! Tauri IPC commands
//!
//! These are the commands exposed to the frontend via Tauri's invoke system.

use crate::models::{AuthFile, AuthFileModel, AuthFileModelsResponse, ProxyStatus, QuotaInfo, OAuthFlowResult};
use crate::proxy::{self, ProxyState};
use crate::settings::{self, AppSettings, SettingsState};
use crate::credentials;
use crate::shell_profile::{self, ShellType, CLIAgent};
use tauri::State;
use std::path::Path;

// ============================================================================
// Proxy Commands
// ============================================================================

#[tauri::command]
pub async fn start_proxy(state: State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    proxy::start_proxy(&state.inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_proxy(state: State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    proxy::stop_proxy(&state.inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_proxy_status(state: State<'_, ProxyState>) -> Result<ProxyStatus, String> {
    let inner = state.inner.lock().await;
    Ok(inner.status.clone())
}

#[tauri::command]
pub async fn install_proxy_binary(state: State<'_, ProxyState>) -> Result<String, String> {
    proxy::install_binary(&state.inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_proxy_version(state: State<'_, ProxyState>) -> Result<Option<String>, String> {
    let inner = state.inner.lock().await;
    Ok(inner.status.version.clone())
}

/// Returns the management API key used by the proxy
/// This is needed for the frontend to authenticate with the proxy's /models endpoint
#[tauri::command]
pub async fn get_proxy_api_key(state: State<'_, ProxyState>) -> Result<String, String> {
    let inner = state.inner.lock().await;
    Ok(inner.management_key.clone())
}

/// Extracts a real API key from an auth file
/// This is needed for endpoints like /models that require a real provider API key
#[tauri::command]
pub fn get_provider_api_key(auth_file_path: Option<String>) -> Result<String, String> {
    use std::fs;

    // If a specific path is provided, read from that file
    if let Some(path) = auth_file_path {
        return extract_api_key_from_path(&path);
    }

    // Otherwise, find the first "ready" auth file and extract its key
    let auth_dir = crate::proxy::ProxyStateInner::auth_dir();

    if !auth_dir.exists() {
        return Err("Auth directory not found".to_string());
    }

    // First, try to find an auth file with "ready" status
    if let Ok(entries) = fs::read_dir(&auth_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Skip directories, non-JSON files, and disabled files
            if path.is_dir() {
                continue;
            }
            if !path.extension().map(|e| e == "json").unwrap_or(false) {
                continue;
            }
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if filename.starts_with('.') {
                continue;
            }

            // Try to extract API key from this file
            if let Ok(api_key) = extract_api_key_from_path(&path.display().to_string()) {
                return Ok(api_key);
            }
        }
    }

    // Also check subdirectories
    let subdirs = ["gemini-cli", "cursor", "claude", "anthropic", "codex"];
    for subdir in subdirs {
        let subdir_path = auth_dir.join(subdir);
        if subdir_path.exists() && subdir_path.is_dir() {
            if let Ok(entries) = fs::read_dir(&subdir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() || !path.extension().map(|e| e == "json").unwrap_or(false) {
                        continue;
                    }
                    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if filename.starts_with('.') {
                        continue;
                    }

                    if let Ok(api_key) = extract_api_key_from_path(&path.display().to_string()) {
                        return Ok(api_key);
                    }
                }
            }
        }
    }

    Err("No valid API key found in auth files".to_string())
}

/// Helper function to extract API key from a specific auth file
fn extract_api_key_from_path(path: &str) -> Result<String, String> {
    use std::fs;

    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Try various common field names for API keys/tokens
    let key = parsed.get("access_token")
        .or_else(|| parsed.get("accessToken"))
        .or_else(|| parsed.get("api_key"))
        .or_else(|| parsed.get("apiKey"))
        .or_else(|| parsed.get("token"))
        .or_else(|| parsed.get("oauth_token"))
        .or_else(|| parsed.get("oauthToken"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    key.ok_or_else(|| "No API key found in file".to_string())
}

#[tauri::command]
pub fn is_binary_installed() -> bool {
    crate::proxy::ProxyStateInner::is_binary_installed()
}

#[tauri::command]
pub async fn get_download_progress(state: State<'_, ProxyState>) -> Result<f64, String> {
    let inner = state.inner.lock().await;
    Ok(inner.download_progress)
}

#[tauri::command]
pub async fn is_downloading(state: State<'_, ProxyState>) -> Result<bool, String> {
    let inner = state.inner.lock().await;
    Ok(inner.is_downloading)
}

// ============================================================================
// Settings Commands
// ============================================================================

#[tauri::command]
pub async fn get_settings(state: State<'_, SettingsState>) -> Result<AppSettings, String> {
    let settings = state.inner.lock().await;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, SettingsState>,
    new_settings: AppSettings,
) -> Result<(), String> {
    let mut settings = state.inner.lock().await;
    *settings = new_settings.clone();
    settings::save_settings(&new_settings).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_port(state: State<'_, ProxyState>) -> Result<u16, String> {
    let inner = state.inner.lock().await;
    Ok(inner.status.port)
}

#[tauri::command]
pub async fn set_port(
    proxy_state: State<'_, ProxyState>,
    settings_state: State<'_, SettingsState>,
    port: u16,
) -> Result<(), String> {
    // Update proxy state
    {
        let mut inner = proxy_state.inner.lock().await;
        inner.status.port = port;
        inner.update_config_port(port).map_err(|e| e.to_string())?;
    }

    // Update settings
    {
        let mut settings = settings_state.inner.lock().await;
        settings.port = port;
        settings::save_settings(&settings).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============================================================================
// Auth Files Commands
// ============================================================================

#[tauri::command]
pub async fn get_auth_files(state: State<'_, ProxyState>) -> Result<Vec<AuthFile>, String> {
    proxy::fetch_auth_files(&state.inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_auth_file(
    state: State<'_, ProxyState>,
    file_name: String,
) -> Result<(), String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    // Use query param ?name= as in Swift ManagementAPIClient.swift
    let url = format!("{}/auth-files?name={}", inner.management_url(), file_name);
    let client = reqwest::Client::new();

    client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_auth_file(
    state: State<'_, ProxyState>,
    file_id: String,
    disabled: bool,
) -> Result<(), String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    let url = format!("{}/auth-files/{}/toggle", inner.management_url(), file_id);
    let client = reqwest::Client::new();

    client
        .post(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .json(&serde_json::json!({ "disabled": disabled }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Fetch models available for a specific auth file
/// This mirrors Swift's fetchAuthFileModels(name:) in ManagementAPIClient.swift
#[tauri::command]
pub async fn fetch_auth_file_models(
    state: State<'_, ProxyState>,
    auth_file_name: String,
) -> Result<Vec<AuthFileModel>, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    let encoded = urlencoding::encode(&auth_file_name);
    let url = format!("{}/auth-files/models?name={}", inner.management_url(), encoded);
    let client = reqwest::Client::new();

    log::debug!("Fetching models for auth file: {} from {}", auth_file_name, url);

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to fetch auth file models: {}", e);
            e.to_string()
        })?;

    if !response.status().is_success() {
        let status = response.status();
        log::error!("Auth file models request failed with status: {}", status);
        return Err(format!("Request failed with status: {}", status));
    }

    let response_data: AuthFileModelsResponse = response
        .json()
        .await
        .map_err(|e| {
            log::error!("Failed to parse auth file models response: {}", e);
            e.to_string()
        })?;

    log::debug!("Fetched {} models for auth file {}", response_data.models.len(), auth_file_name);

    Ok(response_data.models)
}

// ============================================================================
// Quota Commands
// ============================================================================

#[tauri::command]
pub async fn fetch_quota(
    state: State<'_, ProxyState>,
    provider: String,
    account: String,
) -> Result<QuotaInfo, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    let url = format!("{}/quota/{}/{}", inner.management_url(), provider, account);
    let client = reqwest::Client::new();

    client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<QuotaInfo>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_all_quotas(state: State<'_, ProxyState>) -> Result<Vec<QuotaInfo>, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Ok(Vec::new());
    }

    let url = format!("{}/quotas", inner.management_url());
    let client = reqwest::Client::new();

    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        response.json::<Vec<QuotaInfo>>().await.map_err(|e| e.to_string())
    } else {
        Ok(Vec::new())
    }
}

// ============================================================================
// API Keys Commands
// ============================================================================

#[tauri::command]
pub async fn get_api_keys(state: State<'_, ProxyState>) -> Result<Vec<String>, String> {
    proxy::fetch_api_keys(&state.inner)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_api_key(state: State<'_, ProxyState>, key: String) -> Result<(), String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    let url = format!("{}/api-keys", inner.management_url());
    let client = reqwest::Client::new();

    client
        .post(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .json(&serde_json::json!({ "key": key }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_api_key(state: State<'_, ProxyState>, key: String) -> Result<(), String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    let url = format!("{}/api-keys/{}", inner.management_url(), key);
    let client = reqwest::Client::new();

    client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Logs Commands
// ============================================================================

/// Fetch logs from the proxy management API
#[tauri::command]
pub async fn fetch_logs(
    state: State<'_, ProxyState>,
    after_timestamp: Option<i64>,
) -> Result<crate::models::LogsResponse, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        log::debug!("Proxy not running, returning empty logs");
        return Ok(crate::models::LogsResponse {
            lines: Some(vec![]),
            line_count: Some(0),
            latest_timestamp: None,
        });
    }

    let mut url = format!("{}/logs", inner.management_url());
    if let Some(after) = after_timestamp {
        url = format!("{}?after={}", url, after);
    }

    log::debug!("Fetching logs from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let response = match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Failed to fetch logs from proxy: {}", e);
            return Ok(crate::models::LogsResponse {
                lines: Some(vec![]),
                line_count: Some(0),
                latest_timestamp: None,
            });
        }
    };

    let status = response.status();
    log::debug!("Logs response status: {}", status);

    if status.is_success() {
        // Get raw text first for debugging
        let raw_text = match response.text().await {
            Ok(text) => text,
            Err(e) => {
                log::warn!("Failed to read logs response body: {}", e);
                return Ok(crate::models::LogsResponse {
                    lines: Some(vec![]),
                    line_count: Some(0),
                    latest_timestamp: None,
                });
            }
        };

        log::debug!("Logs raw response: {}", if raw_text.len() > 200 { &raw_text[..200] } else { &raw_text });

        // Parse JSON
        match serde_json::from_str::<crate::models::LogsResponse>(&raw_text) {
            Ok(logs) => {
                log::debug!("Parsed {} log lines", logs.lines.as_ref().map(|l| l.len()).unwrap_or(0));
                Ok(logs)
            }
            Err(e) => {
                log::warn!("Failed to parse logs response: {} - Raw: {}", e, &raw_text);
                Ok(crate::models::LogsResponse {
                    lines: Some(vec![]),
                    line_count: Some(0),
                    latest_timestamp: None,
                })
            }
        }
    } else {
        log::warn!("Logs request failed with status: {}", status);
        Ok(crate::models::LogsResponse {
            lines: Some(vec![]),
            line_count: Some(0),
            latest_timestamp: None,
        })
    }
}

/// Clear logs from the proxy
#[tauri::command]
pub async fn clear_logs(state: State<'_, ProxyState>) -> Result<(), String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Ok(());
    }

    let url = format!("{}/logs", inner.management_url());
    let client = reqwest::Client::new();

    client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Fetch usage data from the proxy (includes model information)
#[tauri::command]
pub async fn fetch_usage(state: State<'_, ProxyState>) -> Result<serde_json::Value, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Ok(serde_json::json!({}));
    }

    let url = format!("{}/usage", inner.management_url());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let response = match client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            log::warn!("Failed to fetch usage: {}", e);
            return Ok(serde_json::json!({}));
        }
    };

    if response.status().is_success() {
        match response.json::<serde_json::Value>().await {
            Ok(data) => Ok(data),
            Err(e) => {
                log::warn!("Failed to parse usage response: {}", e);
                Ok(serde_json::json!({}))
            }
        }
    } else {
        Ok(serde_json::json!({}))
    }
}

/// Fetch request history from the request-history.json file
/// This is the same approach Quotio uses to display logs
#[tauri::command]
pub fn fetch_request_history() -> Result<Vec<crate::models::RequestHistoryEntry>, String> {
    use std::fs;

    let data_dir = crate::proxy::ProxyStateInner::data_dir();
    let history_path = data_dir.join("request-history.json");

    if !history_path.exists() {
        log::debug!("request-history.json not found at {:?}", history_path);
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&history_path)
        .map_err(|e| format!("Failed to read request-history.json: {}", e))?;

    let history: crate::models::RequestHistoryFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse request-history.json: {}", e))?;

    log::debug!("Loaded {} request history entries", history.entries.len());

    // Return entries in reverse order (newest first) and limit to 50
    let mut entries = history.entries;
    entries.reverse();
    entries.truncate(50);

    Ok(entries)
}

/// Clear request history file
#[tauri::command]
pub fn clear_request_history() -> Result<(), String> {
    use std::fs;

    let data_dir = crate::proxy::ProxyStateInner::data_dir();
    let history_path = data_dir.join("request-history.json");

    if history_path.exists() {
        // Write empty history
        let empty = crate::models::RequestHistoryFile {
            version: 1,
            entries: Vec::new(),
        };
        let content = serde_json::to_string_pretty(&empty)
            .map_err(|e| e.to_string())?;
        fs::write(&history_path, content)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ============================================================================
// Credentials Commands
// ============================================================================

#[tauri::command]
pub fn store_credential(key: String, value: String) -> Result<(), String> {
    credentials::store_credential(&key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_credential(key: String) -> Result<String, String> {
    credentials::get_credential(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_credential(key: String) -> Result<(), String> {
    credentials::delete_credential(&key).map_err(|e| e.to_string())
}

// ============================================================================
// OAuth Commands
// ============================================================================

#[tauri::command]
pub async fn start_oauth_flow(
    state: State<'_, ProxyState>,
    provider: String,
) -> Result<OAuthFlowResult, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    // Determine the OAuth endpoint for this provider
    // WebUI providers need ?is_webui=true to get browser-based OAuth URLs
    let endpoint = match provider.as_str() {
        "gemini" | "gemini-cli" => "/gemini-cli-auth-url?is_webui=true",
        "claude" => "/anthropic-auth-url?is_webui=true",
        "codex" => "/codex-auth-url?is_webui=true",
        "qwen" => "/qwen-auth-url", // Qwen uses API key, not WebUI OAuth
        "iflow" => "/iflow-auth-url?is_webui=true",
        "antigravity" => "/antigravity-auth-url?is_webui=true",
        "kiro" => "/kiro-auth-url?is_webui=true",
        _ => return Err(format!("OAuth not supported for provider: {}", provider)),
    };

    let url = format!("{}{}", inner.management_url(), endpoint);
    let client = reqwest::Client::new();

    let response: crate::models::OAuthUrlResponse = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(oauth_url) = response.url {
        // Extract or use the state from response
        let oauth_state = response.state.unwrap_or_else(|| {
            // If no state in response, try to extract from URL query params
            if let Some(pos) = oauth_url.find("state=") {
                let start = pos + 6;
                let end = oauth_url[start..].find('&').map(|i| start + i).unwrap_or(oauth_url.len());
                oauth_url[start..end].to_string()
            } else {
                // Generate a fallback state
                uuid::Uuid::new_v4().to_string()
            }
        });

        // Open the OAuth URL in the default browser
        if let Err(e) = open::that(&oauth_url) {
            log::warn!("Failed to open browser: {}", e);
        }

        Ok(OAuthFlowResult {
            url: oauth_url,
            state: oauth_state,
        })
    } else if let Some(error) = response.error {
        Err(error)
    } else {
        Err("No OAuth URL returned".to_string())
    }
}

#[tauri::command]
pub async fn check_oauth_status(
    state: State<'_, ProxyState>,
    oauth_state: String,
) -> Result<String, String> {
    let inner = state.inner.lock().await;

    if !inner.status.running {
        return Err("Proxy is not running".to_string());
    }

    // Use the correct endpoint format: /get-auth-status?state={state}
    // This matches the Swift implementation in ManagementAPIClient.swift
    let url = format!("{}/get-auth-status?state={}", inner.management_url(), oauth_state);
    let client = reqwest::Client::new();

    let response: crate::models::OAuthStatusResponse = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(error) = response.error {
        Err(error)
    } else {
        Ok(response.status)
    }
}

// ============================================================================
// System Commands
// ============================================================================

#[tauri::command]
pub fn open_config_folder() -> Result<(), String> {
    let path = crate::proxy::ProxyStateInner::data_dir();
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_logs_folder() -> Result<(), String> {
    let path = crate::proxy::ProxyStateInner::data_dir().join("logs");
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    }
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    // Use clipboard functionality
    // This is a simplified implementation - Tauri has clipboard plugins
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let mut child = Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        if let Some(stdin) = child.stdin.as_mut() {
            use std::io::Write;
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }

        child.wait().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW flag (0x08000000) prevents cmd window from appearing
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut child = Command::new("cmd")
            .args(["/C", "clip"])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;

        if let Some(stdin) = child.stdin.as_mut() {
            use std::io::Write;
            stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
        }

        child.wait().map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Try xclip first, then xsel
        let result = Command::new("xclip")
            .args(["-selection", "clipboard"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                if let Some(stdin) = child.stdin.as_mut() {
                    use std::io::Write;
                    stdin.write_all(text.as_bytes())?;
                }
                child.wait()
            });

        if result.is_err() {
            // Fallback to xsel
            let mut child = Command::new("xsel")
                .args(["--clipboard", "--input"])
                .stdin(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| e.to_string())?;

            if let Some(stdin) = child.stdin.as_mut() {
                use std::io::Write;
                stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
            }

            child.wait().map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// ============================================================================
// Shell Profile Commands
// ============================================================================

#[tauri::command]
pub fn detect_shell() -> String {
    let shell = shell_profile::detect_shell();
    format!("{:?}", shell).to_lowercase()
}

#[tauri::command]
pub fn get_shell_profile_path(shell: String) -> Result<String, String> {
    let shell_type = parse_shell_type(&shell)?;
    Ok(shell_profile::get_profile_path(shell_type).display().to_string())
}

#[tauri::command]
pub fn is_agent_configured(shell: String, agent: String) -> Result<bool, String> {
    let shell_type = parse_shell_type(&shell)?;
    let agent_type = parse_agent_type(&agent)?;
    Ok(shell_profile::is_configured_in_profile(shell_type, agent_type))
}

#[tauri::command]
pub async fn configure_agent(
    proxy_state: State<'_, ProxyState>,
    shell: String,
    agent: String,
    api_key: Option<String>,
) -> Result<(), String> {
    let shell_type = parse_shell_type(&shell)?;
    let agent_type = parse_agent_type(&agent)?;

    let port = {
        let inner = proxy_state.inner.lock().await;
        inner.status.port
    };

    shell_profile::add_to_profile(
        shell_type,
        agent_type,
        port,
        api_key.as_deref(),
    ).map_err(|e: shell_profile::ShellProfileError| e.to_string())
}

#[tauri::command]
pub fn unconfigure_agent(shell: String, agent: String) -> Result<(), String> {
    let shell_type = parse_shell_type(&shell)?;
    let agent_type = parse_agent_type(&agent)?;
    shell_profile::remove_from_profile(shell_type, agent_type)
        .map_err(|e: shell_profile::ShellProfileError| e.to_string())
}

#[tauri::command]
pub fn create_shell_backup(shell: String) -> Result<String, String> {
    let shell_type = parse_shell_type(&shell)?;
    shell_profile::create_backup(shell_type)
        .map(|p: std::path::PathBuf| p.display().to_string())
        .map_err(|e: shell_profile::ShellProfileError| e.to_string())
}

#[tauri::command]
pub async fn get_env_command(
    proxy_state: State<'_, ProxyState>,
    agent: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let agent_type = parse_agent_type(&agent)?;

    let port = {
        let inner = proxy_state.inner.lock().await;
        inner.status.port
    };

    Ok(shell_profile::get_env_command(agent_type, port, api_key.as_deref()))
}

#[tauri::command]
pub fn get_available_shells() -> Vec<ShellInfo> {
    vec![
        ShellInfo {
            id: "zsh".to_string(),
            name: "Zsh".to_string(),
            profile_path: ShellType::Zsh.profile_path().display().to_string(),
            available: ShellType::Zsh.profile_path().parent().map(|p: &Path| p.exists()).unwrap_or(false),
        },
        ShellInfo {
            id: "bash".to_string(),
            name: "Bash".to_string(),
            profile_path: ShellType::Bash.profile_path().display().to_string(),
            available: true,
        },
        ShellInfo {
            id: "fish".to_string(),
            name: "Fish".to_string(),
            profile_path: ShellType::Fish.profile_path().display().to_string(),
            available: ShellType::Fish.profile_path().parent().map(|p: &Path| p.exists()).unwrap_or(false),
        },
        #[cfg(windows)]
        ShellInfo {
            id: "powershell".to_string(),
            name: "PowerShell".to_string(),
            profile_path: ShellType::Powershell.profile_path().display().to_string(),
            available: true,
        },
        #[cfg(windows)]
        ShellInfo {
            id: "cmd".to_string(),
            name: "Command Prompt".to_string(),
            profile_path: ShellType::Cmd.profile_path().display().to_string(),
            available: true,
        },
    ]
}

#[tauri::command]
pub fn get_available_agents() -> Vec<AgentInfo> {
    vec![
        AgentInfo {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            env_var: "ANTHROPIC_BASE_URL".to_string(),
            description: "Anthropic's Claude AI coding assistant".to_string(),
            requires_api_key: true,
        },
        AgentInfo {
            id: "gemini-cli".to_string(),
            name: "Gemini CLI".to_string(),
            env_var: "GEMINI_API_BASE".to_string(),
            description: "Google's Gemini AI assistant".to_string(),
            requires_api_key: false,
        },
        AgentInfo {
            id: "codex".to_string(),
            name: "Codex (OpenAI)".to_string(),
            env_var: "OPENAI_BASE_URL".to_string(),
            description: "OpenAI's Codex coding assistant".to_string(),
            requires_api_key: true,
        },
        AgentInfo {
            id: "qwen".to_string(),
            name: "Qwen".to_string(),
            env_var: "QWEN_BASE_URL".to_string(),
            description: "Alibaba's Qwen AI assistant".to_string(),
            requires_api_key: true,
        },
    ]
}

// Helper types for shell/agent info
#[derive(serde::Serialize)]
pub struct ShellInfo {
    pub id: String,
    pub name: String,
    pub profile_path: String,
    pub available: bool,
}

#[derive(serde::Serialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub env_var: String,
    pub description: String,
    pub requires_api_key: bool,
}

// Helper functions
fn parse_shell_type(shell: &str) -> Result<ShellType, String> {
    match shell.to_lowercase().as_str() {
        "zsh" => Ok(ShellType::Zsh),
        "bash" => Ok(ShellType::Bash),
        "fish" => Ok(ShellType::Fish),
        "powershell" | "pwsh" => Ok(ShellType::Powershell),
        "cmd" => Ok(ShellType::Cmd),
        _ => Err(format!("Unknown shell type: {}", shell)),
    }
}

fn parse_agent_type(agent: &str) -> Result<CLIAgent, String> {
    match agent.to_lowercase().as_str() {
        "claude-code" | "claude" | "anthropic" => Ok(CLIAgent::ClaudeCode),
        "gemini-cli" | "gemini" => Ok(CLIAgent::GeminiCLI),
        "codex" | "openai" => Ok(CLIAgent::Codex),
        "qwen" => Ok(CLIAgent::Qwen),
        "iflow" => Ok(CLIAgent::Iflow),
        "antigravity" => Ok(CLIAgent::Antigravity),
        "amp" => Ok(CLIAgent::ClaudeCode), // Amp uses similar config
        "opencode" => Ok(CLIAgent::Codex), // OpenCode uses similar config
        "factory-droid" => Ok(CLIAgent::Codex), // Factory Droid uses similar config
        _ => Err(format!("Unknown agent type: {}", agent)),
    }
}

// ============================================================================
// Direct Auth File Scanning (when proxy is not running)
// ============================================================================

/// Scan auth files directly from the file system
/// This mirrors DirectAuthFileService.swift functionality
#[tauri::command]
pub fn scan_auth_files_direct() -> Vec<AuthFile> {
    use std::fs;

    let auth_dir = crate::proxy::ProxyStateInner::auth_dir();

    if !auth_dir.exists() {
        return vec![];
    }

    let mut auth_files = Vec::new();

    if let Ok(entries) = fs::read_dir(&auth_dir) {
        for entry in entries.flatten() {
            let path = entry.path();

            // Skip directories and non-JSON files
            if path.is_dir() || !path.extension().map(|e| e == "json").unwrap_or(false) {
                continue;
            }

            let filename = path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            // Skip disabled files (prefixed with .)
            if filename.starts_with('.') {
                continue;
            }

            // Try to parse the auth file
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                    let auth_file = parse_auth_file_content(&filename, &path, &parsed);
                    auth_files.push(auth_file);
                }
            }
        }
    }

    // Also scan subdirectories for providers like gemini-cli, cursor, etc.
    let subdirs = ["gemini-cli", "cursor", "trae", "kiro", "copilot", "github-copilot"];
    for subdir in subdirs {
        let subdir_path = auth_dir.join(subdir);
        if subdir_path.exists() && subdir_path.is_dir() {
            if let Ok(entries) = fs::read_dir(&subdir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() || !path.extension().map(|e| e == "json").unwrap_or(false) {
                        continue;
                    }

                    let filename = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    if filename.starts_with('.') {
                        continue;
                    }

                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                            let mut auth_file = parse_auth_file_content(&filename, &path, &parsed);
                            // Override provider from subdirectory
                            auth_file.provider = subdir.to_string();
                            auth_files.push(auth_file);
                        }
                    }
                }
            }
        }
    }

    auth_files
}

fn parse_auth_file_content(filename: &str, path: &std::path::Path, parsed: &serde_json::Value) -> AuthFile {
    // Determine provider from filename or content
    let provider = if filename.starts_with("gemini") || filename.contains("gemini") {
        "gemini-cli"
    } else if filename.starts_with("claude") || filename.contains("anthropic") {
        "claude"
    } else if filename.starts_with("codex") || filename.contains("openai") {
        "codex"
    } else if filename.starts_with("qwen") {
        "qwen"
    } else if filename.starts_with("cursor") {
        "cursor"
    } else if filename.starts_with("github-copilot") || filename.starts_with("copilot") {
        "github-copilot"
    } else if filename.starts_with("trae") {
        "trae"
    } else if filename.starts_with("iflow") {
        "iflow"
    } else if filename.starts_with("antigravity") {
        "antigravity"
    } else if filename.starts_with("kiro") {
        "kiro"
    } else if filename.starts_with("warp") {
        "warp"
    } else if filename.starts_with("glm") {
        "glm"
    } else {
        // Try to detect from content
        if parsed.get("access_token").is_some() || parsed.get("accessToken").is_some() {
            "claude"
        } else if parsed.get("refresh_token").is_some() {
            "gemini-cli"
        } else {
            "unknown"
        }
    };

    // Extract email/account from various fields
    let email = parsed.get("email")
        .or_else(|| parsed.get("user_email"))
        .or_else(|| parsed.get("account"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let account_type = parsed.get("account_type")
        .or_else(|| parsed.get("accountType"))
        .or_else(|| parsed.get("type"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Check if token seems valid (has required fields)
    let has_token = parsed.get("access_token").is_some()
        || parsed.get("accessToken").is_some()
        || parsed.get("token").is_some()
        || parsed.get("refresh_token").is_some()
        || parsed.get("refreshToken").is_some();

    let status = if has_token { "ready" } else { "error" };

    // Generate a unique ID from the path
    let id = format!("{:x}", md5::compute(path.to_string_lossy().as_bytes()));

    AuthFile {
        id,
        name: filename.to_string(),
        provider: provider.to_string(),
        label: email.clone(),
        status: status.to_string(),
        status_message: None,
        disabled: false,
        unavailable: false,
        runtime_only: Some(false),
        source: Some("file".to_string()),
        path: Some(path.to_string_lossy().to_string()),
        email,
        account_type,
        account: None,
        auth_index: None,
        created_at: None,
        updated_at: None,
        last_refresh: None,
    }
}

/// Get the auth directory path
#[tauri::command]
pub fn get_auth_dir() -> String {
    crate::proxy::ProxyStateInner::auth_dir().display().to_string()
}

/// Create a new auth file manually (for token paste)
#[tauri::command]
pub fn create_auth_file(provider: String, email: String, token: String) -> Result<AuthFile, String> {
    use std::fs;

    let auth_dir = crate::proxy::ProxyStateInner::auth_dir();
    fs::create_dir_all(&auth_dir).map_err(|e| e.to_string())?;

    // Generate filename based on provider and email
    let safe_email = email.replace('@', "_at_").replace('.', "_");
    let filename = format!("{}-{}.json", provider, safe_email);
    let file_path = auth_dir.join(&filename);

    // Create auth file content
    let content = serde_json::json!({
        "provider": provider,
        "email": email,
        "access_token": token,
        "created_at": chrono::Utc::now().to_rfc3339(),
    });

    fs::write(&file_path, serde_json::to_string_pretty(&content).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;

    let id = format!("{:x}", md5::compute(file_path.to_string_lossy().as_bytes()));

    Ok(AuthFile {
        id,
        name: filename,
        provider,
        label: Some(email.clone()),
        status: "ready".to_string(),
        status_message: None,
        disabled: false,
        unavailable: false,
        runtime_only: Some(false),
        source: Some("manual".to_string()),
        path: Some(file_path.display().to_string()),
        email: Some(email),
        account_type: None,
        account: None,
        auth_index: None,
        created_at: Some(chrono::Utc::now().to_rfc3339()),
        updated_at: None,
        last_refresh: None,
    })
}

/// Delete an auth file by path
#[tauri::command]
pub fn delete_auth_file_direct(file_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;

    let path = PathBuf::from(&file_path);

    // Ensure the file is in the auth directory for safety
    let auth_dir = crate::proxy::ProxyStateInner::auth_dir();
    if !path.starts_with(&auth_dir) {
        return Err("Cannot delete files outside auth directory".to_string());
    }

    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Toggle auth file enabled/disabled (by renaming with . prefix)
#[tauri::command]
pub fn toggle_auth_file_direct(file_path: String, disable: bool) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let path = PathBuf::from(&file_path);

    // Ensure the file is in the auth directory for safety
    let auth_dir = crate::proxy::ProxyStateInner::auth_dir();
    if !path.starts_with(&auth_dir) {
        return Err("Cannot modify files outside auth directory".to_string());
    }

    if !path.exists() {
        return Err("File not found".to_string());
    }

    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    let new_filename = if disable {
        if !filename.starts_with('.') {
            format!(".{}", filename)
        } else {
            filename.to_string()
        }
    } else {
        filename.strip_prefix('.').unwrap_or(filename).to_string()
    };

    let new_path = path.parent().ok_or("Invalid path")?.join(&new_filename);

    if path != new_path {
        fs::rename(&path, &new_path).map_err(|e| e.to_string())?;
    }

    Ok(new_path.display().to_string())
}

// ============================================================================
// Advanced Agent Configuration
// ============================================================================

#[derive(serde::Deserialize)]
pub struct AgentConfiguration {
    pub agent: String,
    #[serde(rename = "modelSlots")]
    pub model_slots: std::collections::HashMap<String, String>,
    #[serde(rename = "proxyURL")]
    pub proxy_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "useOAuth")]
    pub use_oauth: bool,
    #[serde(rename = "setupMode")]
    pub setup_mode: String,
}

#[derive(serde::Serialize)]
pub struct BackupFile {
    pub id: String,
    pub name: String,
    pub date: String,
    pub path: String,
}

/// Robust agent binary detection
/// Mirrors the Swift AgentDetectionService.swift implementation
/// Works on macOS, Linux, and Windows
#[tauri::command]
pub fn find_agent_binary(binary_names: Vec<String>) -> Option<String> {
    let home = dirs::home_dir().unwrap_or_default();

    for name in &binary_names {
        // Strategy 1: Try 'which' on Unix / 'where' on Windows
        // Note: This may not work in GUI apps due to limited PATH
        if let Some(path) = find_via_which_or_where(name) {
            return Some(path);
        }

        // Strategy 2: Check common static paths
        if let Some(path) = find_in_common_paths(&home, name) {
            return Some(path);
        }

        // Strategy 3: Check version managers (nvm, fnm, volta, asdf, mise)
        if let Some(path) = find_in_version_managers(&home, name) {
            return Some(path);
        }
    }

    None
}

/// Try to find binary using 'which' (Unix) or 'where' (Windows)
fn find_via_which_or_where(name: &str) -> Option<String> {
    use std::process::{Command, Stdio};

    #[cfg(unix)]
    {
        // Try /usr/bin/which to avoid PATH issues
        if let Ok(output) = Command::new("/usr/bin/which")
            .arg(name)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let path = path.trim();
                    if !path.is_empty() && std::path::Path::new(path).exists() {
                        return Some(path.to_string());
                    }
                }
            }
        }
    }

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW flag (0x08000000) prevents cmd/powershell window from appearing
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if let Ok(output) = Command::new("where")
            .arg(name)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let path = path.lines().next().unwrap_or("").trim();
                    if !path.is_empty() && std::path::Path::new(path).exists() {
                        return Some(path.to_string());
                    }
                }
            }
        }
    }

    None
}

/// Check common binary installation paths
fn find_in_common_paths(home: &std::path::Path, name: &str) -> Option<String> {
    use std::path::PathBuf;

    // Common paths for CLI tools (ordered by priority)
    let common_paths: Vec<PathBuf> = vec![
        // macOS Homebrew paths
        PathBuf::from("/opt/homebrew/bin"),          // Apple Silicon
        PathBuf::from("/usr/local/bin"),             // Intel Mac / Linux

        // System paths
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),

        // User local paths
        home.join(".local/bin"),

        // Package manager paths
        home.join(".cargo/bin"),                     // Rust/Cargo
        home.join(".bun/bin"),                       // Bun
        home.join(".deno/bin"),                      // Deno
        home.join(".npm-global/bin"),                // npm global
        home.join("node_modules/.bin"),              // Local npm

        // Tool-specific paths
        home.join(".opencode/bin"),
        home.join(".warp/bin"),
        home.join(".claude/bin"),
        home.join(".amp/bin"),

        // Version manager shims (static paths)
        home.join(".volta/bin"),                     // Volta
        home.join(".asdf/shims"),                    // asdf
        home.join(".local/share/mise/shims"),        // mise (modern asdf alternative)
        home.join(".mise/shims"),                    // mise alternative path

        // pnpm
        home.join(".pnpm"),
        home.join("Library/pnpm"),                   // macOS pnpm

        // Yarn
        home.join(".yarn/bin"),

        // Go
        home.join("go/bin"),
        home.join(".go/bin"),

        // Additional common paths
        PathBuf::from("/opt/local/bin"),             // MacPorts
        PathBuf::from("/snap/bin"),                  // Snap (Linux)

        // Windows-specific paths
        #[cfg(windows)]
        home.join("AppData/Local/Programs"),
        #[cfg(windows)]
        home.join("AppData/Roaming/npm"),
        #[cfg(windows)]
        PathBuf::from("C:/Program Files/nodejs"),
        #[cfg(windows)]
        PathBuf::from("C:/ProgramData/chocolatey/bin"),
    ];

    for dir in common_paths {
        let binary_path = if cfg!(windows) {
            // Try with .exe, .cmd, .bat extensions on Windows
            let exe_path = dir.join(format!("{}.exe", name));
            if exe_path.exists() && is_executable(&exe_path) {
                return Some(exe_path.display().to_string());
            }
            let cmd_path = dir.join(format!("{}.cmd", name));
            if cmd_path.exists() {
                return Some(cmd_path.display().to_string());
            }
            dir.join(name)
        } else {
            dir.join(name)
        };

        if binary_path.exists() && is_executable(&binary_path) {
            return Some(binary_path.display().to_string());
        }
    }

    None
}

/// Check version managers that use versioned directories (nvm, fnm)
fn find_in_version_managers(home: &std::path::Path, name: &str) -> Option<String> {
    use std::path::PathBuf;

    // nvm: ~/.nvm/versions/node/v*/bin/<name>
    let nvm_versions = home.join(".nvm/versions/node");
    if nvm_versions.exists() {
        if let Some(path) = find_in_versioned_dir(&nvm_versions, "bin", name) {
            return Some(path);
        }
    }

    // fnm: Uses XDG_DATA_HOME or fallback paths
    // Modern: $XDG_DATA_HOME/fnm/node-versions/<version>/installation/bin/<name>
    // Legacy: ~/.fnm/node-versions/<version>/installation/bin/<name>
    let xdg_data = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| home.join(".local/share"));

    let fnm_paths = vec![
        xdg_data.join("fnm/node-versions"),
        home.join(".fnm/node-versions"),
        home.join(".local/share/fnm/node-versions"),
    ];

    for fnm_base in fnm_paths {
        if fnm_base.exists() {
            if let Some(path) = find_in_fnm_versions(&fnm_base, name) {
                return Some(path);
            }
        }
    }

    // n (node version manager): /usr/local/n/versions/node/*/bin/<name>
    let n_versions = PathBuf::from("/usr/local/n/versions/node");
    if n_versions.exists() {
        if let Some(path) = find_in_versioned_dir(&n_versions, "bin", name) {
            return Some(path);
        }
    }

    // nvm for Windows: $APPDATA/nvm/v*/
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let nvm_win = PathBuf::from(appdata).join("nvm");
            if nvm_win.exists() {
                if let Some(path) = find_in_versioned_dir(&nvm_win, "", name) {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Find binary in versioned directory structure (for nvm-style layouts)
fn find_in_versioned_dir(base_dir: &std::path::Path, bin_subdir: &str, name: &str) -> Option<String> {
    use std::fs;

    let mut versions: Vec<_> = fs::read_dir(base_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();

    // Sort versions descending (prefer newer versions)
    versions.sort_by(|a, b| {
        let a_name = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let b_name = b.file_name().and_then(|n| n.to_str()).unwrap_or("");
        version_compare(b_name, a_name)
    });

    for version_dir in versions {
        let binary_path = if bin_subdir.is_empty() {
            version_dir.join(name)
        } else {
            version_dir.join(bin_subdir).join(name)
        };

        // Also check .exe on Windows
        #[cfg(windows)]
        {
            let exe_path = if bin_subdir.is_empty() {
                version_dir.join(format!("{}.exe", name))
            } else {
                version_dir.join(bin_subdir).join(format!("{}.exe", name))
            };
            if exe_path.exists() && is_executable(&exe_path) {
                return Some(exe_path.display().to_string());
            }
        }

        if binary_path.exists() && is_executable(&binary_path) {
            return Some(binary_path.display().to_string());
        }
    }

    None
}

/// Find binary in fnm version directory structure
/// fnm uses: <version>/installation/bin/<name>
fn find_in_fnm_versions(base_dir: &std::path::Path, name: &str) -> Option<String> {
    use std::fs;

    let mut versions: Vec<_> = fs::read_dir(base_dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();

    // Sort versions descending
    versions.sort_by(|a, b| {
        let a_name = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let b_name = b.file_name().and_then(|n| n.to_str()).unwrap_or("");
        version_compare(b_name, a_name)
    });

    for version_dir in versions {
        let binary_path = version_dir.join("installation/bin").join(name);

        #[cfg(windows)]
        {
            let exe_path = version_dir.join("installation").join(format!("{}.exe", name));
            if exe_path.exists() && is_executable(&exe_path) {
                return Some(exe_path.display().to_string());
            }
        }

        if binary_path.exists() && is_executable(&binary_path) {
            return Some(binary_path.display().to_string());
        }
    }

    None
}

/// Simple version comparison (handles v1.2.3 format)
fn version_compare(a: &str, b: &str) -> std::cmp::Ordering {
    let parse_version = |s: &str| -> Vec<u32> {
        s.trim_start_matches('v')
            .split(|c: char| c == '.' || c == '-')
            .filter_map(|p| p.parse::<u32>().ok())
            .collect()
    };

    let a_parts = parse_version(a);
    let b_parts = parse_version(b);

    for (a_part, b_part) in a_parts.iter().zip(b_parts.iter()) {
        match a_part.cmp(b_part) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }

    a_parts.len().cmp(&b_parts.len())
}

/// Check if a path is executable
fn is_executable(path: &std::path::Path) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            return metadata.permissions().mode() & 0o111 != 0;
        }
        return false;
    }

    #[cfg(windows)]
    {
        // On Windows, check if file exists and has executable extension
        if let Some(ext) = path.extension() {
            let ext = ext.to_string_lossy().to_lowercase();
            return ext == "exe" || ext == "cmd" || ext == "bat" || ext == "ps1";
        }
        // Files without extension in Windows may still be executable (e.g., npm scripts)
        return path.exists();
    }

    #[cfg(not(any(unix, windows)))]
    {
        path.exists()
    }
}

#[tauri::command]
pub async fn configure_agent_advanced(
    proxy_state: State<'_, ProxyState>,
    shell: String,
    agent: String,
    config: AgentConfiguration,
    config_mode: String,
    storage_option: String,
) -> Result<(), String> {
    let shell_type = parse_shell_type(&shell)?;
    let agent_type = parse_agent_type(&agent)?;

    let port = {
        let inner = proxy_state.inner.lock().await;
        inner.status.port
    };

    // If setup mode is "default", remove proxy configuration
    if config.setup_mode == "default" {
        return shell_profile::remove_from_profile(shell_type, agent_type)
            .map_err(|e| e.to_string());
    }

    // Apply configuration based on storage option
    match storage_option.as_str() {
        "json" => {
            // Only update JSON config file
            configure_agent_json(&agent, &config)?;
        }
        "shell" => {
            // Only update shell profile
            shell_profile::add_to_profile(
                shell_type,
                agent_type,
                port,
                Some(&config.api_key),
            ).map_err(|e| e.to_string())?;
        }
        "both" | _ => {
            // Update both JSON and shell profile
            configure_agent_json(&agent, &config)?;
            shell_profile::add_to_profile(
                shell_type,
                agent_type,
                port,
                Some(&config.api_key),
            ).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

fn configure_agent_json(agent: &str, config: &AgentConfiguration) -> Result<(), String> {
    use std::fs;

    let home = dirs::home_dir().ok_or("Could not find home directory")?;

    match agent {
        "claude-code" => {
            // Claude Code uses ~/.claude/settings.json (matching Swift quotio-master)
            let config_dir = home.join(".claude");
            fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

            let config_path = config_dir.join("settings.json");

            // Read existing config to preserve user settings (permissions, hooks, mcpServers, etc.)
            let mut settings: serde_json::Value = if config_path.exists() {
                let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
                serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
            } else {
                serde_json::json!({})
            };

            // Extract models from slots
            let opus_model = config.model_slots
                .get("opus")
                .cloned()
                .unwrap_or_else(|| "gemini-claude-opus-4-5-thinking".to_string());
            let sonnet_model = config.model_slots
                .get("sonnet")
                .cloned()
                .unwrap_or_else(|| "gemini-claude-sonnet-4-5".to_string());
            let haiku_model = config.model_slots
                .get("haiku")
                .cloned()
                .unwrap_or_else(|| "gemini-3-flash-preview".to_string());

            // Remove /v1 from proxy URL if present (Claude Code adds it automatically)
            let base_url = config.proxy_url.trim_end_matches("/v1").to_string();

            // Create the correct structure with 'env' block
            // This matches the Swift quotio-master format in AgentConfigurationService.swift
            if let Some(obj) = settings.as_object_mut() {
                // Get or create the env object, preserving existing user env keys
                let env = obj.entry("env".to_string())
                    .or_insert(serde_json::json!({}));

                if let Some(env_obj) = env.as_object_mut() {
                    // Update only Quotio-managed ANTHROPIC_* keys, preserve user's other keys
                    env_obj.insert("ANTHROPIC_BASE_URL".to_string(), serde_json::json!(base_url));
                    env_obj.insert("ANTHROPIC_AUTH_TOKEN".to_string(), serde_json::json!(config.api_key));
                    env_obj.insert("ANTHROPIC_DEFAULT_OPUS_MODEL".to_string(), serde_json::json!(opus_model));
                    env_obj.insert("ANTHROPIC_DEFAULT_SONNET_MODEL".to_string(), serde_json::json!(sonnet_model));
                    env_obj.insert("ANTHROPIC_DEFAULT_HAIKU_MODEL".to_string(), serde_json::json!(haiku_model));
                }

                // Set the default model at root level
                obj.insert("model".to_string(), serde_json::json!(opus_model));
            }

            // Create backup before writing
            if config_path.exists() {
                let backup_path = config_dir.join(format!(
                    "settings.json.backup.{}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs()
                ));
                fs::copy(&config_path, &backup_path).map_err(|e| e.to_string())?;
            }

            // Write new config with proper formatting
            let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
            fs::write(&config_path, content).map_err(|e| e.to_string())?;
        }
        _ => {
            // Other agents might not have JSON config, just use shell profile
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_agent_backups(agent: String) -> Vec<BackupFile> {
    use std::fs;

    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };

    let config_dir = match agent.as_str() {
        "claude-code" => home.join(".claude"),  // Fixed: was ~/.config/claude
        "codex" => home.join(".codex"),
        "amp" => home.join(".config").join("amp"),
        "opencode" => home.join(".config").join("opencode"),
        "factory-droid" => home.join(".factory"),
        _ => return vec![],
    };

    if !config_dir.exists() {
        return vec![];
    }

    let mut backups = vec![];

    if let Ok(entries) = fs::read_dir(&config_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

            if filename.contains(".backup.") {
                // Extract date from filename (e.g., settings.json.backup.1234567890)
                let date_part = filename
                    .replace("settings.json.backup.", "")
                    .replace("settings.backup.", "")
                    .replace(".json", "");

                backups.push(BackupFile {
                    id: filename.to_string(),
                    name: format!("Backup {}", date_part),
                    date: date_part,
                    path: path.display().to_string(),
                });
            }
        }
    }

    // Sort by date descending
    backups.sort_by(|a, b| b.date.cmp(&a.date));

    backups
}

#[tauri::command]
pub fn restore_agent_backup(agent: String, backup_path: String) -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;

    let backup = PathBuf::from(&backup_path);
    if !backup.exists() {
        return Err("Backup file not found".to_string());
    }

    let home = dirs::home_dir().ok_or("Could not find home directory")?;

    let config_path = match agent.as_str() {
        "claude-code" => home.join(".claude").join("settings.json"),  // Fixed: was ~/.config/claude/config.json
        "codex" => home.join(".codex").join("config.toml"),
        "amp" => home.join(".config").join("amp").join("settings.json"),
        "opencode" => home.join(".config").join("opencode").join("opencode.json"),
        "factory-droid" => home.join(".factory").join("config.json"),
        _ => return Err("Unknown agent".to_string()),
    };

    // Create backup of current config first
    if config_path.exists() {
        let backup_dir = config_path.parent().ok_or("Invalid config path")?;
        let new_backup = backup_dir.join(format!(
            "settings.json.backup.{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
        ));
        fs::copy(&config_path, &new_backup).map_err(|e| e.to_string())?;
    }

    // Restore from backup
    fs::copy(&backup, &config_path).map_err(|e| e.to_string())?;

    Ok(())
}
