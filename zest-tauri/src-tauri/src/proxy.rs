//! Proxy management module
//!
//! Handles starting, stopping, and monitoring the CLIProxyAPI binary.
//! This is a port of CLIProxyManager.swift to Rust.

use crate::models::{AuthFile, AuthFilesResponse, ProxyStatus, ApiKeysResponse};
use serde::Serialize;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use thiserror::Error;

/// GitHub repository for CLIProxyAPI releases
const GITHUB_REPO: &str = "router-for-me/CLIProxyAPIPlus";
const BINARY_NAME: &str = "CLIProxyAPI";

#[derive(Error, Debug)]
pub enum ProxyError {
    #[error("Binary not found. Click 'Install' to download.")]
    BinaryNotFound,
    #[error("Failed to start proxy server: {0}")]
    StartupFailed(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("No compatible binary found for your system")]
    NoCompatibleBinary,
    #[error("Failed to extract binary from archive: {0}")]
    ExtractionFailed(String),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("Config error: {0}")]
    ConfigError(String),
    #[error("Process error: {0}")]
    ProcessError(String),
    #[error("API error: {0}")]
    ApiError(String),
}

impl Serialize for ProxyError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Shared proxy state managed by Tauri
pub struct ProxyState {
    pub inner: Arc<Mutex<ProxyStateInner>>,
}

impl ProxyState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ProxyStateInner::new())),
        }
    }
}

impl Default for ProxyState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ProxyStateInner {
    pub status: ProxyStatus,
    pub process: Option<Child>,
    pub management_key: String,
    pub is_starting: bool,
    pub is_downloading: bool,
    pub download_progress: f64,
    pub last_error: Option<String>,
}

impl ProxyStateInner {
    pub fn new() -> Self {
        // Read port from existing config, fallback to 8317
        let port = Self::read_port_from_config().unwrap_or(8317);

        // Read management key: prioritize UserDefaults (has plaintext key),
        // fallback to config.yaml (which may have bcrypt hash - reject those),
        // then environment variable, finally generate new one
        let management_key = Self::read_management_key_from_defaults()
            .or_else(|| Self::read_api_key_from_config())
            .or_else(|| std::env::var("ZEST_MANAGEMENT_KEY").ok())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        // Log the key source for debugging (show only first 8 chars for security)
        let key_preview = if management_key.len() > 8 {
            format!("{}...", &management_key[..8])
        } else {
            management_key.clone()
        };
        log::info!("Using management key: {} (len={})", key_preview, management_key.len());

        Self {
            status: ProxyStatus {
                running: false,
                port,
                pid: None,
                version: None,
                uptime_seconds: None,
            },
            process: None,
            management_key,
            is_starting: false,
            is_downloading: false,
            download_progress: 0.0,
            last_error: None,
        }
    }

    /// Read management key from Quotio's UserDefaults (macOS)
    #[cfg(target_os = "macos")]
    fn read_management_key_from_defaults() -> Option<String> {
        use std::process::Command;

        // Try to read from Quotio's UserDefaults using 'defaults read' command
        let output = match Command::new("defaults")
            .args(["read", "proseek.io.vn.Quotio", "managementKey"])
            .output()
        {
            Ok(o) => o,
            Err(e) => {
                log::warn!("Failed to execute defaults command: {}", e);
                return None;
            }
        };

        if output.status.success() {
            let key = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();
            // Reject empty keys and bcrypt hashes (start with $2a$, $2b$, etc.)
            if !key.is_empty() && !key.starts_with("$2") {
                log::info!("Successfully read management key from UserDefaults");
                return Some(key);
            } else if key.starts_with("$2") {
                log::warn!("UserDefaults has bcrypt hash, not plaintext key");
            }
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            log::debug!("defaults read failed: {}", stderr.trim());
        }
        None
    }

    #[cfg(not(target_os = "macos"))]
    fn read_management_key_from_defaults() -> Option<String> {
        None
    }

    /// Get the data directory - uses Quotio directory for compatibility
    pub fn data_dir() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Quotio")
    }

    /// Read port from existing config file
    fn read_port_from_config() -> Option<u16> {
        let config_path = Self::data_dir().join("config.yaml");
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            // Parse port from YAML
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with("port:") {
                    if let Some(port_str) = line.strip_prefix("port:") {
                        if let Ok(port) = port_str.trim().parse::<u16>() {
                            return Some(port);
                        }
                    }
                }
            }
        }
        None
    }

    /// Read api-keys from existing config file
    /// NOTE: This reads from api-keys section which is used for client auth
    /// Rejects bcrypt hashes (starting with $2a$) as they are not usable as API keys
    fn read_api_key_from_config() -> Option<String> {
        let config_path = Self::data_dir().join("config.yaml");
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            // First try to read secret-key from remote-management section
            // This is what the Management API uses for authentication
            let mut in_remote_management = false;
            for line in content.lines() {
                let line_trimmed = line.trim();
                if line_trimmed.starts_with("remote-management:") {
                    in_remote_management = true;
                    continue;
                }
                if in_remote_management {
                    if line_trimmed.starts_with("secret-key:") {
                        let key = line_trimmed.strip_prefix("secret-key:").unwrap_or("").trim();
                        let key = key.trim_matches('"').trim_matches('\'');
                        // Reject bcrypt hashes - they start with $2a$ or similar
                        if !key.is_empty() && !key.starts_with("$2") {
                            return Some(key.to_string());
                        }
                    }
                    // Check if we've exited the remote-management section
                    if !line_trimmed.is_empty() && !line_trimmed.starts_with('#') &&
                       !line.starts_with(' ') && !line.starts_with('\t') {
                        in_remote_management = false;
                    }
                }
            }

            // Fallback: parse api-keys from YAML (first key in the list)
            // Some older configs may not have remote-management section
            let mut in_api_keys = false;
            for line in content.lines() {
                let line_trimmed = line.trim();
                if line_trimmed.starts_with("api-keys:") {
                    in_api_keys = true;
                    continue;
                }
                if in_api_keys {
                    if line_trimmed.starts_with("- ") {
                        // Extract the key from format: - "key" or - key
                        let key = line_trimmed.strip_prefix("- ").unwrap_or("");
                        let key = key.trim_matches('"').trim_matches('\'');
                        // Reject bcrypt hashes
                        if !key.is_empty() && !key.starts_with("$2") {
                            return Some(key.to_string());
                        }
                    } else if !line_trimmed.is_empty() && !line_trimmed.starts_with('#') {
                        // End of api-keys section
                        break;
                    }
                }
            }
        }
        None
    }

    /// Get the path to the proxy binary
    pub fn binary_path() -> PathBuf {
        Self::data_dir().join(if cfg!(windows) {
            "CLIProxyAPI.exe"
        } else {
            "CLIProxyAPI"
        })
    }

    /// Get the path to the config file
    pub fn config_path() -> PathBuf {
        Self::data_dir().join("config.yaml")
    }

    /// Get the auth directory
    pub fn auth_dir() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".cli-proxy-api")
    }

    /// Check if the binary is installed
    pub fn is_binary_installed() -> bool {
        Self::binary_path().exists()
    }

    /// Get the base URL for the management API
    pub fn base_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.status.port)
    }

    /// Get the management API URL
    pub fn management_url(&self) -> String {
        format!("{}/v0/management", self.base_url())
    }

    /// Ensure config file exists with default values
    pub fn ensure_config_exists(&self) -> Result<(), ProxyError> {
        let config_path = Self::config_path();

        // Create data directory if it doesn't exist
        if let Some(parent) = config_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| ProxyError::ConfigError(e.to_string()))?;
        }

        // Create auth directory if it doesn't exist
        std::fs::create_dir_all(Self::auth_dir())
            .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

        if !config_path.exists() {
            let default_config = format!(
                r#"host: "127.0.0.1"
port: {}
auth-dir: "{}"
proxy-url: ""

api-keys:
  - "zest-local-{}"

remote-management:
  allow-remote: false
  secret-key: "{}"

debug: false
logging-to-file: false
usage-statistics-enabled: true

routing:
  strategy: "round-robin"

quota-exceeded:
  switch-project: true
  switch-preview-model: true

request-retry: 3
max-retry-interval: 30
"#,
                self.status.port,
                Self::auth_dir().display(),
                uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or(""),
                self.management_key
            );

            std::fs::write(&config_path, default_config)
                .map_err(|e| ProxyError::ConfigError(e.to_string()))?;
        }

        Ok(())
    }

    /// Update the port in the config file
    pub fn update_config_port(&self, new_port: u16) -> Result<(), ProxyError> {
        let config_path = Self::config_path();
        if !config_path.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

        let re = regex::Regex::new(r"port:\s*\d+").unwrap();
        let new_content = re.replace(&content, format!("port: {}", new_port));

        std::fs::write(&config_path, new_content.as_ref())
            .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

        Ok(())
    }

    /// Sync the secret key in config file
    fn sync_secret_key_in_config(&self) -> Result<(), ProxyError> {
        let config_path = Self::config_path();
        if !config_path.exists() {
            return Ok(());
        }

        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

        let re = regex::Regex::new(r#"secret-key:\s*"[^"]*""#).unwrap();
        let new_content = re.replace(&content, format!(r#"secret-key: "{}""#, self.management_key));

        std::fs::write(&config_path, new_content.as_ref())
            .map_err(|e| ProxyError::ConfigError(e.to_string()))?;

        Ok(())
    }
}

impl Default for ProxyStateInner {
    fn default() -> Self {
        Self::new()
    }
}

/// Start the proxy server
pub async fn start_proxy(state: &Arc<Mutex<ProxyStateInner>>) -> Result<ProxyStatus, ProxyError> {
    let mut inner = state.lock().await;

    if !ProxyStateInner::is_binary_installed() {
        return Err(ProxyError::BinaryNotFound);
    }

    if inner.status.running {
        return Ok(inner.status.clone());
    }

    inner.is_starting = true;
    inner.last_error = None;

    // Ensure config exists
    inner.ensure_config_exists()?;
    inner.sync_secret_key_in_config()?;

    let binary_path = ProxyStateInner::binary_path();
    let config_path = ProxyStateInner::config_path();

    // Start the process
    let mut cmd = Command::new(&binary_path);
    cmd.arg("-config")
        .arg(&config_path)
        .current_dir(binary_path.parent().unwrap_or(&PathBuf::from(".")))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // On Windows, hide the console window
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn()
        .map_err(|e| ProxyError::StartupFailed(e.to_string()))?;

    let pid = child.id();

    // Drain stdout/stderr to prevent buffer deadlock
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(_line)) = lines.next_line().await {
                // Discard output to prevent buffer filling
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(_line)) = lines.next_line().await {
                // Discard errors to prevent buffer filling
            }
        });
    }

    // Wait for startup
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

    // Check if process is still running
    match child.try_wait() {
        Ok(Some(status)) => {
            inner.is_starting = false;
            inner.last_error = Some(format!("Process exited with status: {:?}", status));
            return Err(ProxyError::StartupFailed(format!("Process exited immediately with status: {:?}", status)));
        }
        Err(e) => {
            inner.is_starting = false;
            inner.last_error = Some(e.to_string());
            return Err(ProxyError::ProcessError(e.to_string()));
        }
        Ok(None) => {
            // Process is running
        }
    }

    inner.status.running = true;
    inner.status.pid = pid;
    inner.process = Some(child);
    inner.is_starting = false;

    // Re-read management key from UserDefaults to ensure we have the correct key
    // This is important because the key may have changed since the app started
    if let Some(new_key) = ProxyStateInner::read_management_key_from_defaults() {
        if new_key != inner.management_key {
            log::info!("Updating management key from UserDefaults (was different)");
            inner.management_key = new_key;
        }
    }

    log::info!("Proxy started successfully on port {} with management key prefix: {}...",
               inner.status.port,
               if inner.management_key.len() > 8 { &inner.management_key[..8] } else { &inner.management_key });

    Ok(inner.status.clone())
}

/// Stop the proxy server
pub async fn stop_proxy(state: &Arc<Mutex<ProxyStateInner>>) -> Result<ProxyStatus, ProxyError> {
    let mut inner = state.lock().await;

    if let Some(mut process) = inner.process.take() {
        // Try graceful shutdown first
        if let Err(e) = process.kill().await {
            log::warn!("Failed to kill proxy process: {}", e);
        }

        // Wait for process to exit
        let _ = tokio::time::timeout(
            tokio::time::Duration::from_secs(2),
            process.wait()
        ).await;
    }

    // Also try to kill by port (in case of orphan processes)
    kill_process_on_port(inner.status.port).await;

    inner.status.running = false;
    inner.status.pid = None;
    inner.status.uptime_seconds = None;

    log::info!("Proxy stopped");

    Ok(inner.status.clone())
}

/// Kill any process listening on a specific port
async fn kill_process_on_port(port: u16) {
    #[cfg(unix)]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!("tcp:{}", port)])
            .output()
            .await;

        if let Ok(output) = output {
            if let Ok(pids) = String::from_utf8(output.stdout) {
                for pid_str in pids.lines() {
                    if let Ok(pid) = pid_str.trim().parse::<i32>() {
                        unsafe {
                            libc::kill(pid, libc::SIGKILL);
                        }
                    }
                }
            }
        }
    }

    #[cfg(windows)]
    {
        // On Windows, use netstat to find PIDs
        let output = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{}", port)])
            .output()
            .await;

        if let Ok(output) = output {
            if let Ok(lines) = String::from_utf8(output.stdout) {
                for line in lines.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(pid_str) = parts.last() {
                        if let Ok(pid) = pid_str.parse::<u32>() {
                            let _ = Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .output()
                                .await;
                        }
                    }
                }
            }
        }
    }
}

/// Download and install the proxy binary
pub async fn install_binary(state: &Arc<Mutex<ProxyStateInner>>) -> Result<String, ProxyError> {
    let mut inner = state.lock().await;

    inner.is_downloading = true;
    inner.download_progress = 0.0;
    inner.last_error = None;

    drop(inner); // Release lock for async operations

    // Fetch latest release info
    let release_url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let client = reqwest::Client::new();
    let release: crate::models::GitHubRelease = client
        .get(&release_url)
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "Zest/1.0")
        .send()
        .await
        .map_err(|e| ProxyError::NetworkError(e.to_string()))?
        .json()
        .await
        .map_err(|e| ProxyError::NetworkError(e.to_string()))?;

    // Find compatible asset
    let asset = find_compatible_asset(&release.assets)
        .ok_or(ProxyError::NoCompatibleBinary)?;

    // Update progress
    {
        let mut inner = state.lock().await;
        inner.download_progress = 0.1;
    }

    // Download the asset
    let binary_data = client
        .get(&asset.browser_download_url)
        .header("User-Agent", "Zest/1.0")
        .send()
        .await
        .map_err(|e| ProxyError::DownloadFailed(e.to_string()))?
        .bytes()
        .await
        .map_err(|e| ProxyError::DownloadFailed(e.to_string()))?;

    // Update progress
    {
        let mut inner = state.lock().await;
        inner.download_progress = 0.7;
    }

    // Extract and install
    extract_and_install(&binary_data, &asset.name).await?;

    // Update progress
    {
        let mut inner = state.lock().await;
        inner.download_progress = 1.0;
        inner.is_downloading = false;
    }

    // Extract version from tag
    let version = release.tag_name.strip_prefix('v')
        .unwrap_or(&release.tag_name)
        .to_string();

    log::info!("Installed CLIProxyAPI version {}", version);

    Ok(version)
}

/// Find a compatible asset for the current platform
fn find_compatible_asset(assets: &[crate::models::GitHubAsset]) -> Option<&crate::models::GitHubAsset> {
    let (platform, arch) = if cfg!(target_os = "windows") {
        ("windows", if cfg!(target_arch = "aarch64") { "arm64" } else { "amd64" })
    } else if cfg!(target_os = "macos") {
        ("darwin", if cfg!(target_arch = "aarch64") { "arm64" } else { "amd64" })
    } else {
        ("linux", if cfg!(target_arch = "aarch64") { "arm64" } else { "amd64" })
    };

    let target_pattern = format!("{}_{}", platform, arch);
    let skip_patterns = ["checksum"];

    for asset in assets {
        let name_lower = asset.name.to_lowercase();

        // Skip checksum files and other platforms
        let should_skip = skip_patterns.iter().any(|p| name_lower.contains(p));
        if should_skip {
            continue;
        }

        if name_lower.contains(&target_pattern) {
            return Some(asset);
        }
    }

    None
}

/// Extract and install the downloaded binary
async fn extract_and_install(data: &[u8], asset_name: &str) -> Result<(), ProxyError> {
    let temp_dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

    let downloaded_file = temp_dir.join(asset_name);
    std::fs::write(&downloaded_file, data)
        .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

    let data_dir = ProxyStateInner::data_dir();
    std::fs::create_dir_all(&data_dir)
        .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

    let binary_path = ProxyStateInner::binary_path();

    if asset_name.ends_with(".tar.gz") || asset_name.ends_with(".tgz") {
        // Extract tar.gz
        let output = Command::new("tar")
            .args(["-xzf", downloaded_file.to_str().unwrap(), "-C", temp_dir.to_str().unwrap()])
            .output()
            .await
            .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

        if !output.status.success() {
            return Err(ProxyError::ExtractionFailed("tar extraction failed".to_string()));
        }

        // Find the binary in extracted files
        if let Some(binary) = find_binary_in_directory(&temp_dir) {
            if binary_path.exists() {
                std::fs::remove_file(&binary_path)
                    .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
            }
            std::fs::copy(&binary, &binary_path)
                .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
        } else {
            return Err(ProxyError::ExtractionFailed("Binary not found in archive".to_string()));
        }
    } else if asset_name.ends_with(".zip") {
        // Extract zip
        #[cfg(unix)]
        {
            let output = Command::new("unzip")
                .args(["-o", downloaded_file.to_str().unwrap(), "-d", temp_dir.to_str().unwrap()])
                .output()
                .await
                .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

            if !output.status.success() {
                return Err(ProxyError::ExtractionFailed("unzip extraction failed".to_string()));
            }
        }

        #[cfg(windows)]
        {
            // Use PowerShell to extract on Windows
            let output = Command::new("powershell")
                .args([
                    "-Command",
                    &format!(
                        "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                        downloaded_file.display(),
                        temp_dir.display()
                    ),
                ])
                .output()
                .await
                .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

            if !output.status.success() {
                return Err(ProxyError::ExtractionFailed("PowerShell extraction failed".to_string()));
            }
        }

        // Find the binary
        if let Some(binary) = find_binary_in_directory(&temp_dir) {
            if binary_path.exists() {
                std::fs::remove_file(&binary_path)
                    .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
            }
            std::fs::copy(&binary, &binary_path)
                .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
        } else {
            return Err(ProxyError::ExtractionFailed("Binary not found in archive".to_string()));
        }
    } else {
        // Direct binary file
        if binary_path.exists() {
            std::fs::remove_file(&binary_path)
                .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
        }
        std::fs::copy(&downloaded_file, &binary_path)
            .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;
    }

    // Make the binary executable (Unix only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&binary_path, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| ProxyError::ExtractionFailed(e.to_string()))?;

        // Ad-hoc sign on macOS
        #[cfg(target_os = "macos")]
        {
            let _ = Command::new("codesign")
                .args(["-f", "-s", "-", binary_path.to_str().unwrap()])
                .output()
                .await;
        }
    }

    // Cleanup temp directory
    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok(())
}

/// Find the binary file in a directory (recursively)
fn find_binary_in_directory(dir: &PathBuf) -> Option<PathBuf> {
    let binary_names = ["CLIProxyAPI", "cli-proxy-api", "cli-proxy-api-plus", "CLIProxyAPI.exe"];

    // First check for known binary names
    for name in &binary_names {
        let path = dir.join(name);
        if path.exists() && path.is_file() {
            return Some(path);
        }
    }

    // Recursively search subdirectories
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(found) = find_binary_in_directory(&path) {
                    return Some(found);
                }
            } else if path.is_file() {
                let name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                if name.contains("cliproxyapi") || name.contains("cli-proxy-api") {
                    return Some(path);
                }
            }
        }
    }

    None
}

/// Fetch auth files from the management API
/// Returns empty list if proxy not running or authentication fails (allows frontend fallback)
pub async fn fetch_auth_files(state: &Arc<Mutex<ProxyStateInner>>) -> Result<Vec<AuthFile>, ProxyError> {
    let mut inner = state.lock().await;

    if !inner.status.running {
        log::debug!("Proxy not running, returning empty auth files list");
        return Ok(Vec::new());
    }

    let url = format!("{}/auth-files", inner.management_url());
    log::debug!("Fetching auth files from: {}", url);

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
            log::warn!("Failed to connect to proxy API for auth files: {}", e);
            // Return empty to allow fallback to direct scan
            return Ok(Vec::new());
        }
    };

    // If we get 401, try to re-read the management key and retry once
    if response.status() == reqwest::StatusCode::UNAUTHORIZED
        || response.status() == reqwest::StatusCode::FORBIDDEN
    {
        log::warn!("Auth files request got {} - trying to refresh management key", response.status());

        // Try to get the correct key from UserDefaults
        if let Some(new_key) = ProxyStateInner::read_management_key_from_defaults() {
            if new_key != inner.management_key {
                log::info!("Found different management key in UserDefaults, retrying...");
                inner.management_key = new_key.clone();

                // Retry with new key
                let retry_response = match client
                    .get(&url)
                    .header("Authorization", format!("Bearer {}", new_key))
                    .send()
                    .await
                {
                    Ok(r) => r,
                    Err(e) => {
                        log::warn!("Retry failed: {}", e);
                        return Ok(Vec::new());
                    }
                };

                if retry_response.status().is_success() {
                    let response_data: AuthFilesResponse = match retry_response.json().await {
                        Ok(data) => data,
                        Err(e) => {
                            log::error!("Failed to parse auth files response on retry: {}", e);
                            return Ok(Vec::new());
                        }
                    };
                    log::debug!("Fetched {} auth files from proxy (after key refresh)", response_data.files.len());
                    return Ok(response_data.files);
                }
            }
        }

        log::warn!("Auth files request still failing after key refresh - returning empty");
        return Ok(Vec::new());
    }

    if !response.status().is_success() {
        let status = response.status();
        log::error!("Auth files request failed with status: {}", status);
        // Return empty to allow fallback instead of error
        return Ok(Vec::new());
    }

    let response_data: AuthFilesResponse = match response.json().await {
        Ok(data) => data,
        Err(e) => {
            log::error!("Failed to parse auth files response: {}", e);
            // Return empty to allow fallback
            return Ok(Vec::new());
        }
    };

    log::debug!("Fetched {} auth files from proxy", response_data.files.len());

    // Log details for debugging
    for file in &response_data.files {
        log::debug!(
            "AuthFile: {} (provider: {}, status: {}, disabled: {}, unavailable: {})",
            file.name, file.provider, file.status, file.disabled, file.unavailable
        );
    }

    Ok(response_data.files)
}

/// Fetch API keys from the management API
pub async fn fetch_api_keys(state: &Arc<Mutex<ProxyStateInner>>) -> Result<Vec<String>, ProxyError> {
    let inner = state.lock().await;

    if !inner.status.running {
        return Ok(Vec::new());
    }

    let url = format!("{}/api-keys", inner.management_url());
    let client = reqwest::Client::new();

    let response: ApiKeysResponse = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", inner.management_key))
        .send()
        .await
        .map_err(|e| ProxyError::ApiError(e.to_string()))?
        .json()
        .await
        .map_err(|e| ProxyError::ApiError(e.to_string()))?;

    Ok(response.api_keys)
}

/// Check proxy health
pub async fn check_health(state: &Arc<Mutex<ProxyStateInner>>) -> bool {
    let inner = state.lock().await;

    if !inner.status.running {
        return false;
    }

    let url = format!("{}/meta", inner.base_url());
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    client.get(&url).send().await.is_ok()
}
