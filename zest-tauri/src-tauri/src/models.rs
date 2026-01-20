//! Data models for Zest
//!
//! These models mirror the Swift models from the original Zest app.

use serde::{Deserialize, Serialize};

/// AI Provider types supported by Zest
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AIProvider {
    #[serde(rename = "gemini-cli")]
    Gemini,
    Claude,
    Codex,
    Qwen,
    Iflow,
    Antigravity,
    Vertex,
    Kiro,
    #[serde(rename = "github-copilot")]
    Copilot,
    Cursor,
    Trae,
    Glm,
    Warp,
}

impl AIProvider {
    pub fn display_name(&self) -> &'static str {
        match self {
            AIProvider::Gemini => "Gemini CLI",
            AIProvider::Claude => "Claude Code",
            AIProvider::Codex => "Codex (OpenAI)",
            AIProvider::Qwen => "Qwen Code",
            AIProvider::Iflow => "iFlow",
            AIProvider::Antigravity => "Antigravity",
            AIProvider::Vertex => "Vertex AI",
            AIProvider::Kiro => "Kiro (CodeWhisperer)",
            AIProvider::Copilot => "GitHub Copilot",
            AIProvider::Cursor => "Cursor",
            AIProvider::Trae => "Trae",
            AIProvider::Glm => "GLM",
            AIProvider::Warp => "Warp",
        }
    }

    pub fn raw_value(&self) -> &'static str {
        match self {
            AIProvider::Gemini => "gemini-cli",
            AIProvider::Claude => "claude",
            AIProvider::Codex => "codex",
            AIProvider::Qwen => "qwen",
            AIProvider::Iflow => "iflow",
            AIProvider::Antigravity => "antigravity",
            AIProvider::Vertex => "vertex",
            AIProvider::Kiro => "kiro",
            AIProvider::Copilot => "github-copilot",
            AIProvider::Cursor => "cursor",
            AIProvider::Trae => "trae",
            AIProvider::Glm => "glm",
            AIProvider::Warp => "warp",
        }
    }

    pub fn color(&self) -> &'static str {
        match self {
            AIProvider::Gemini => "#4285F4",
            AIProvider::Claude => "#D97706",
            AIProvider::Codex => "#10A37F",
            AIProvider::Qwen => "#7C3AED",
            AIProvider::Iflow => "#06B6D4",
            AIProvider::Antigravity => "#EC4899",
            AIProvider::Vertex => "#EA4335",
            AIProvider::Kiro => "#9046FF",
            AIProvider::Copilot => "#238636",
            AIProvider::Cursor => "#00D4AA",
            AIProvider::Trae => "#00B4D8",
            AIProvider::Glm => "#3B82F6",
            AIProvider::Warp => "#01E5FF",
        }
    }

    pub fn supports_quota_only_mode(&self) -> bool {
        matches!(
            self,
            AIProvider::Claude
                | AIProvider::Codex
                | AIProvider::Cursor
                | AIProvider::Gemini
                | AIProvider::Antigravity
                | AIProvider::Copilot
                | AIProvider::Trae
                | AIProvider::Glm
                | AIProvider::Warp
        )
    }

    pub fn uses_browser_auth(&self) -> bool {
        matches!(self, AIProvider::Cursor | AIProvider::Trae)
    }

    pub fn oauth_endpoint(&self) -> Option<&'static str> {
        match self {
            AIProvider::Gemini => Some("/gemini-cli-auth-url"),
            AIProvider::Claude => Some("/anthropic-auth-url"),
            AIProvider::Codex => Some("/codex-auth-url"),
            AIProvider::Qwen => Some("/qwen-auth-url"),
            AIProvider::Iflow => Some("/iflow-auth-url"),
            AIProvider::Antigravity => Some("/antigravity-auth-url"),
            AIProvider::Kiro => Some("/kiro-auth-url"),
            _ => None,
        }
    }
}

/// Proxy status information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub pid: Option<u32>,
    pub version: Option<String>,
    pub uptime_seconds: Option<u64>,
}

impl ProxyStatus {
    pub fn endpoint(&self) -> String {
        format!("http://localhost:{}/v1", self.port)
    }
}

/// Auth file from the Management API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub label: Option<String>,
    pub status: String,
    #[serde(rename = "status_message")]
    pub status_message: Option<String>,
    pub disabled: bool,
    pub unavailable: bool,
    #[serde(rename = "runtime_only")]
    pub runtime_only: Option<bool>,
    pub source: Option<String>,
    pub path: Option<String>,
    pub email: Option<String>,
    #[serde(rename = "account_type")]
    pub account_type: Option<String>,
    pub account: Option<String>,
    #[serde(rename = "auth_index")]
    pub auth_index: Option<String>,
    #[serde(rename = "created_at")]
    pub created_at: Option<String>,
    #[serde(rename = "updated_at")]
    pub updated_at: Option<String>,
    #[serde(rename = "last_refresh")]
    pub last_refresh: Option<String>,
}

impl AuthFile {
    pub fn is_ready(&self) -> bool {
        self.status == "ready" && !self.disabled && !self.unavailable
    }

    pub fn status_color(&self) -> &'static str {
        match self.status.as_str() {
            "ready" if !self.disabled => "#22c55e", // green
            "cooling" => "#f59e0b", // orange
            "error" => "#ef4444", // red
            _ => "#71717a", // gray
        }
    }

    pub fn quota_lookup_key(&self) -> String {
        if let Some(email) = &self.email {
            if !email.is_empty() {
                return email.clone();
            }
        }
        if let Some(account) = &self.account {
            if !account.is_empty() {
                return account.clone();
            }
        }

        let mut key = self.name.clone();
        if key.starts_with("github-copilot-") {
            key = key.strip_prefix("github-copilot-").unwrap_or(&key).to_string();
        }
        if key.ends_with(".json") {
            key = key.strip_suffix(".json").unwrap_or(&key).to_string();
        }
        key
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFilesResponse {
    pub files: Vec<AuthFile>,
}

/// API Keys response from Management API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeysResponse {
    #[serde(rename = "api-keys")]
    pub api_keys: Vec<String>,
}

/// Usage statistics
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UsageStats {
    #[serde(rename = "total_requests")]
    pub total_requests: Option<i64>,
    #[serde(rename = "success_count")]
    pub success_count: Option<i64>,
    #[serde(rename = "failure_count")]
    pub failure_count: Option<i64>,
    #[serde(rename = "total_tokens")]
    pub total_tokens: Option<i64>,
    #[serde(rename = "input_tokens")]
    pub input_tokens: Option<i64>,
    #[serde(rename = "output_tokens")]
    pub output_tokens: Option<i64>,
}

impl UsageStats {
    pub fn success_rate(&self) -> f64 {
        match (self.total_requests, self.success_count) {
            (Some(total), Some(success)) if total > 0 => {
                (success as f64 / total as f64) * 100.0
            }
            _ => 0.0,
        }
    }
}

/// Quota information for a provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaInfo {
    pub provider: String,
    pub account: String,
    pub used: i64,
    pub limit: i64,
    pub reset_at: Option<String>,
    pub is_unlimited: bool,
    pub is_pro: bool,
    pub status: String,
}

impl QuotaInfo {
    pub fn percentage_used(&self) -> f64 {
        if self.is_unlimited || self.limit == 0 {
            return 0.0;
        }
        (self.used as f64 / self.limit as f64) * 100.0
    }
}

/// OAuth flow response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthUrlResponse {
    pub status: String,
    pub url: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

/// Response returned to frontend when starting OAuth flow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthFlowResult {
    pub url: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthStatusResponse {
    pub status: String,
    pub error: Option<String>,
}

/// Navigation pages
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NavigationPage {
    Dashboard,
    Quota,
    Providers,
    Fallback,
    Agents,
    ApiKeys,
    Logs,
    Settings,
    About,
}

impl NavigationPage {
    pub fn all() -> Vec<NavigationPage> {
        vec![
            NavigationPage::Dashboard,
            NavigationPage::Quota,
            NavigationPage::Providers,
            NavigationPage::Fallback,
            NavigationPage::Agents,
            NavigationPage::ApiKeys,
            NavigationPage::Logs,
            NavigationPage::Settings,
            NavigationPage::About,
        ]
    }

    pub fn display_name(&self) -> &'static str {
        match self {
            NavigationPage::Dashboard => "Dashboard",
            NavigationPage::Quota => "Quota",
            NavigationPage::Providers => "Providers",
            NavigationPage::Fallback => "Fallback",
            NavigationPage::Agents => "Agents",
            NavigationPage::ApiKeys => "API Keys",
            NavigationPage::Logs => "Logs",
            NavigationPage::Settings => "Settings",
            NavigationPage::About => "About",
        }
    }
}

/// App configuration (mirrors config.yaml structure)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(rename = "auth-dir", default = "default_auth_dir")]
    pub auth_dir: String,
    #[serde(rename = "proxy-url", default)]
    pub proxy_url: String,
    #[serde(rename = "api-keys", default)]
    pub api_keys: Vec<String>,
    #[serde(default)]
    pub debug: bool,
    #[serde(rename = "logging-to-file", default)]
    pub logging_to_file: bool,
    #[serde(rename = "usage-statistics-enabled", default = "default_true")]
    pub usage_statistics_enabled: bool,
    #[serde(rename = "request-retry", default = "default_retry")]
    pub request_retry: i32,
    #[serde(rename = "max-retry-interval", default = "default_max_retry")]
    pub max_retry_interval: i32,
    #[serde(rename = "ws-auth", default)]
    pub ws_auth: bool,
    #[serde(default)]
    pub routing: RoutingConfig,
    #[serde(rename = "quota-exceeded", default)]
    pub quota_exceeded: QuotaExceededConfig,
    #[serde(rename = "remote-management", default)]
    pub remote_management: RemoteManagementConfig,
}

fn default_host() -> String { "127.0.0.1".to_string() }
fn default_port() -> u16 { 8317 }
fn default_auth_dir() -> String { "~/.cli-proxy-api".to_string() }
fn default_true() -> bool { true }
fn default_retry() -> i32 { 3 }
fn default_max_retry() -> i32 { 30 }

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            auth_dir: default_auth_dir(),
            proxy_url: String::new(),
            api_keys: Vec::new(),
            debug: false,
            logging_to_file: false,
            usage_statistics_enabled: true,
            request_retry: 3,
            max_retry_interval: 30,
            ws_auth: false,
            routing: RoutingConfig::default(),
            quota_exceeded: QuotaExceededConfig::default(),
            remote_management: RemoteManagementConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RoutingConfig {
    #[serde(default = "default_strategy")]
    pub strategy: String,
}

fn default_strategy() -> String { "round-robin".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuotaExceededConfig {
    #[serde(rename = "switch-project", default = "default_true")]
    pub switch_project: bool,
    #[serde(rename = "switch-preview-model", default = "default_true")]
    pub switch_preview_model: bool,
}

impl Default for QuotaExceededConfig {
    fn default() -> Self {
        Self {
            switch_project: true,
            switch_preview_model: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteManagementConfig {
    #[serde(rename = "allow-remote", default)]
    pub allow_remote: bool,
    #[serde(rename = "secret-key", default)]
    pub secret_key: String,
    #[serde(rename = "disable-control-panel", default)]
    pub disable_control_panel: bool,
}

/// Log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: LogLevel,
    pub message: String,
    pub source: Option<String>,
    pub status_code: Option<i32>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Debug,
}

impl LogLevel {
    pub fn color(&self) -> &'static str {
        match self {
            LogLevel::Info => "#fafafa",
            LogLevel::Warn => "#f59e0b",
            LogLevel::Error => "#ef4444",
            LogLevel::Debug => "#71717a",
        }
    }
}

/// Logs response from the proxy API
/// Note: API uses kebab-case (line-count, latest-timestamp) but we serialize to camelCase for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogsResponse {
    pub lines: Option<Vec<String>>,
    #[serde(alias = "line-count")]
    pub line_count: Option<i32>,
    #[serde(alias = "latest-timestamp")]
    pub latest_timestamp: Option<i64>,
}

/// Request history file format (matches Quotio's request-history.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestHistoryFile {
    pub version: i32,
    pub entries: Vec<RequestHistoryEntry>,
}

/// Single request history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestHistoryEntry {
    pub id: String,
    pub timestamp: String,
    pub method: String,
    pub endpoint: String,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    pub status_code: i32,
    pub duration_ms: i64,
    pub request_size: i64,
    pub response_size: i64,
}

/// GitHub release information for updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: i64,
}

/// Model information for a specific AuthFile
/// Mirrors Swift's AuthFileModelInfo struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFileModel {
    pub id: String,
    pub name: Option<String>,
    pub provider: Option<String>,
    #[serde(rename = "owned_by")]
    pub owned_by: Option<String>,
}

/// Response from /auth-files/models endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthFileModelsResponse {
    pub models: Vec<AuthFileModel>,
}
