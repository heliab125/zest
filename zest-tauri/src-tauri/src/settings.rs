//! Settings management
//!
//! Handles application settings persistence.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// Proxy port
    pub port: u16,
    /// Allow network access (bind to 0.0.0.0)
    pub allow_network_access: bool,
    /// Use bridge mode for connections
    pub use_bridge_mode: bool,
    /// Enable file logging
    pub logging_to_file: bool,
    /// Routing strategy
    pub routing_strategy: String,
    /// Launch at login
    pub launch_at_login: bool,
    /// Show in menu bar / system tray
    pub show_in_tray: bool,
    /// Selected menu bar icon provider
    pub menu_bar_provider: Option<String>,
    /// Theme (light, dark, system)
    pub theme: String,
    /// Language
    pub language: String,
    /// Proxy URL for outgoing connections
    pub proxy_url: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            port: 8317,
            allow_network_access: false,
            use_bridge_mode: true,
            logging_to_file: false,
            routing_strategy: "round-robin".to_string(),
            launch_at_login: false,
            show_in_tray: true,
            menu_bar_provider: None,
            theme: "system".to_string(),
            language: "en".to_string(),
            proxy_url: String::new(),
        }
    }
}

/// Settings state managed by Tauri
pub struct SettingsState {
    pub inner: Arc<Mutex<AppSettings>>,
}

impl SettingsState {
    pub fn new() -> Self {
        let settings = load_settings().unwrap_or_default();
        Self {
            inner: Arc::new(Mutex::new(settings)),
        }
    }
}

impl Default for SettingsState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get the settings file path
fn settings_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Zest")
        .join("settings.json")
}

/// Load settings from disk
pub fn load_settings() -> Result<AppSettings, Box<dyn std::error::Error>> {
    let path = settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = std::fs::read_to_string(&path)?;
    let settings: AppSettings = serde_json::from_str(&content)?;
    Ok(settings)
}

/// Save settings to disk
pub fn save_settings(settings: &AppSettings) -> Result<(), Box<dyn std::error::Error>> {
    let path = settings_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let content = serde_json::to_string_pretty(settings)?;
    std::fs::write(&path, content)?;

    Ok(())
}

/// Get a specific setting value
pub async fn get_setting<T: serde::de::DeserializeOwned>(
    state: &Arc<Mutex<AppSettings>>,
    key: &str,
) -> Option<T> {
    let settings = state.lock().await;
    let value = serde_json::to_value(&*settings).ok()?;
    let field = value.get(key)?;
    serde_json::from_value(field.clone()).ok()
}

/// Update a specific setting value
pub async fn update_setting(
    state: &Arc<Mutex<AppSettings>>,
    key: &str,
    value: serde_json::Value,
) -> Result<(), String> {
    let mut settings = state.lock().await;
    let mut settings_value = serde_json::to_value(&*settings).map_err(|e| e.to_string())?;

    if let Some(obj) = settings_value.as_object_mut() {
        obj.insert(key.to_string(), value);
    }

    *settings = serde_json::from_value(settings_value).map_err(|e| e.to_string())?;
    save_settings(&settings).map_err(|e| e.to_string())?;

    Ok(())
}
