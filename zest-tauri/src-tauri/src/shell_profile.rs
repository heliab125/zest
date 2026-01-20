//! Shell Profile Manager
//!
//! Manages shell profile modifications for CLI environment variables.
//! This is a port of ShellProfileManager.swift to Rust.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use thiserror::Error;

/// Supported shell types
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShellType {
    Zsh,
    Bash,
    Fish,
    Powershell,
    Cmd,
}

impl ShellType {
    /// Get the profile path for this shell
    pub fn profile_path(&self) -> PathBuf {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));

        match self {
            ShellType::Zsh => home.join(".zshrc"),
            ShellType::Bash => {
                // Prefer .bash_profile on macOS, .bashrc on Linux
                let bash_profile = home.join(".bash_profile");
                if bash_profile.exists() || cfg!(target_os = "macos") {
                    bash_profile
                } else {
                    home.join(".bashrc")
                }
            }
            ShellType::Fish => home.join(".config").join("fish").join("config.fish"),
            ShellType::Powershell => {
                // Windows PowerShell profile path
                #[cfg(windows)]
                {
                    dirs::document_dir()
                        .unwrap_or_else(|| home.clone())
                        .join("WindowsPowerShell")
                        .join("Microsoft.PowerShell_profile.ps1")
                }
                #[cfg(not(windows))]
                {
                    home.join(".config").join("powershell").join("Microsoft.PowerShell_profile.ps1")
                }
            }
            ShellType::Cmd => {
                // CMD doesn't have a profile, use registry or batch file
                home.join("zest_env.bat")
            }
        }
    }

    /// Get the display name for this shell
    pub fn display_name(&self) -> &'static str {
        match self {
            ShellType::Zsh => "Zsh",
            ShellType::Bash => "Bash",
            ShellType::Fish => "Fish",
            ShellType::Powershell => "PowerShell",
            ShellType::Cmd => "Command Prompt",
        }
    }
}

/// CLI Agent types that can be configured
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CLIAgent {
    ClaudeCode,
    GeminiCLI,
    Codex,
    Qwen,
    Iflow,
    Antigravity,
}

impl CLIAgent {
    pub fn display_name(&self) -> &'static str {
        match self {
            CLIAgent::ClaudeCode => "Claude Code",
            CLIAgent::GeminiCLI => "Gemini CLI",
            CLIAgent::Codex => "Codex",
            CLIAgent::Qwen => "Qwen",
            CLIAgent::Iflow => "iFlow",
            CLIAgent::Antigravity => "Antigravity",
        }
    }

    /// Get the environment variable name for this agent's base URL
    pub fn env_var_name(&self) -> &'static str {
        match self {
            CLIAgent::ClaudeCode => "ANTHROPIC_BASE_URL",
            CLIAgent::GeminiCLI => "GEMINI_API_BASE",
            CLIAgent::Codex => "OPENAI_BASE_URL",
            CLIAgent::Qwen => "QWEN_BASE_URL",
            CLIAgent::Iflow => "IFLOW_BASE_URL",
            CLIAgent::Antigravity => "ANTIGRAVITY_BASE_URL",
        }
    }

    /// Get the API key environment variable name for this agent
    pub fn api_key_env_var(&self) -> Option<&'static str> {
        match self {
            CLIAgent::ClaudeCode => Some("ANTHROPIC_API_KEY"),
            CLIAgent::GeminiCLI => None, // Uses OAuth
            CLIAgent::Codex => Some("OPENAI_API_KEY"),
            CLIAgent::Qwen => Some("QWEN_API_KEY"),
            CLIAgent::Iflow => Some("IFLOW_API_KEY"),
            CLIAgent::Antigravity => Some("ANTIGRAVITY_API_KEY"),
        }
    }

    /// Generate the shell configuration for this agent
    pub fn generate_config(&self, shell: ShellType, port: u16, api_key: Option<&str>) -> String {
        let base_url = format!("http://127.0.0.1:{}/v1", port);

        match shell {
            ShellType::Zsh | ShellType::Bash => {
                let mut config = format!("export {}=\"{}\"\n", self.env_var_name(), base_url);
                if let (Some(key_var), Some(key)) = (self.api_key_env_var(), api_key) {
                    config.push_str(&format!("export {}=\"{}\"\n", key_var, key));
                }
                config
            }
            ShellType::Fish => {
                let mut config = format!("set -gx {} \"{}\"\n", self.env_var_name(), base_url);
                if let (Some(key_var), Some(key)) = (self.api_key_env_var(), api_key) {
                    config.push_str(&format!("set -gx {} \"{}\"\n", key_var, key));
                }
                config
            }
            ShellType::Powershell => {
                let mut config = format!("$env:{} = \"{}\"\n", self.env_var_name(), base_url);
                if let (Some(key_var), Some(key)) = (self.api_key_env_var(), api_key) {
                    config.push_str(&format!("$env:{} = \"{}\"\n", key_var, key));
                }
                config
            }
            ShellType::Cmd => {
                let mut config = format!("set {}={}\n", self.env_var_name(), base_url);
                if let (Some(key_var), Some(key)) = (self.api_key_env_var(), api_key) {
                    config.push_str(&format!("set {}={}\n", key_var, key));
                }
                config
            }
        }
    }
}

#[derive(Error, Debug, Serialize)]
pub enum ShellProfileError {
    #[error("Failed to read profile: {0}")]
    ReadError(String),
    #[error("Failed to write profile: {0}")]
    WriteError(String),
    #[error("Unsupported shell type")]
    UnsupportedShell,
}

/// Detect the current shell type
pub fn detect_shell() -> ShellType {
    #[cfg(windows)]
    {
        // On Windows, check for PowerShell or default to Cmd
        if std::env::var("PSModulePath").is_ok() {
            return ShellType::Powershell;
        }
        return ShellType::Cmd;
    }

    #[cfg(not(windows))]
    {
        if let Ok(shell) = std::env::var("SHELL") {
            if shell.contains("zsh") {
                return ShellType::Zsh;
            }
            if shell.contains("bash") {
                return ShellType::Bash;
            }
            if shell.contains("fish") {
                return ShellType::Fish;
            }
        }
        ShellType::Zsh // Default to Zsh
    }
}

/// Get the profile path for a shell
pub fn get_profile_path(shell: ShellType) -> PathBuf {
    shell.profile_path()
}

/// Check if an agent is configured in the profile
pub fn is_configured_in_profile(shell: ShellType, agent: CLIAgent) -> bool {
    let profile_path = shell.profile_path();
    let marker = format!("# Zest Configuration for {}", agent.display_name());

    match std::fs::read_to_string(&profile_path) {
        Ok(content) => content.contains(&marker),
        Err(_) => false,
    }
}

/// Add configuration to shell profile
pub fn add_to_profile(
    shell: ShellType,
    agent: CLIAgent,
    port: u16,
    api_key: Option<&str>,
) -> Result<(), ShellProfileError> {
    let profile_path = shell.profile_path();
    let marker = format!("# Zest Configuration for {}", agent.display_name());
    let end_marker = format!("# End Zest Configuration for {}", agent.display_name());

    // Ensure parent directory exists
    if let Some(parent) = profile_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;
    }

    // Read existing content
    let mut content = if profile_path.exists() {
        std::fs::read_to_string(&profile_path)
            .map_err(|e| ShellProfileError::ReadError(e.to_string()))?
    } else {
        String::new()
    };

    // Remove existing configuration if present
    if let (Some(start), Some(end)) = (content.find(&marker), content.find(&end_marker)) {
        let end_pos = content[end..].find('\n').map(|p| end + p + 1).unwrap_or(content.len());
        // Also remove leading newline if present
        let start_pos = if start > 0 && content.as_bytes()[start - 1] == b'\n' {
            start - 1
        } else {
            start
        };
        content.replace_range(start_pos..end_pos, "");
    }

    // Generate new configuration
    let config = agent.generate_config(shell, port, api_key);

    // Append new configuration
    let new_config = format!(
        "\n{}\n{}{}\n",
        marker, config, end_marker
    );
    content.push_str(&new_config);

    // Write back
    std::fs::write(&profile_path, content)
        .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;

    Ok(())
}

/// Remove configuration from shell profile
pub fn remove_from_profile(shell: ShellType, agent: CLIAgent) -> Result<(), ShellProfileError> {
    let profile_path = shell.profile_path();
    let marker = format!("# Zest Configuration for {}", agent.display_name());
    let end_marker = format!("# End Zest Configuration for {}", agent.display_name());

    if !profile_path.exists() {
        return Ok(());
    }

    let mut content = std::fs::read_to_string(&profile_path)
        .map_err(|e| ShellProfileError::ReadError(e.to_string()))?;

    if let (Some(start), Some(end)) = (content.find(&marker), content.find(&end_marker)) {
        let end_pos = content[end..].find('\n').map(|p| end + p + 1).unwrap_or(content.len());
        // Also remove leading newline if present
        let start_pos = if start > 0 && content.as_bytes()[start - 1] == b'\n' {
            start - 1
        } else {
            start
        };
        content.replace_range(start_pos..end_pos, "");

        std::fs::write(&profile_path, content)
            .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;
    }

    Ok(())
}

/// Create a backup of the shell profile
pub fn create_backup(shell: ShellType) -> Result<PathBuf, ShellProfileError> {
    let profile_path = shell.profile_path();

    if !profile_path.exists() {
        return Err(ShellProfileError::ReadError("Profile does not exist".to_string()));
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let backup_path = PathBuf::from(format!(
        "{}.backup.{}",
        profile_path.display(),
        timestamp
    ));

    std::fs::copy(&profile_path, &backup_path)
        .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;

    Ok(backup_path)
}

/// Get the environment setup command for display (copy-paste)
pub fn get_env_command(agent: CLIAgent, port: u16, api_key: Option<&str>) -> String {
    let shell = detect_shell();
    let base_url = format!("http://127.0.0.1:{}/v1", port);

    match shell {
        ShellType::Zsh | ShellType::Bash => {
            let mut cmd = format!("export {}=\"{}\"", agent.env_var_name(), base_url);
            if let (Some(key_var), Some(key)) = (agent.api_key_env_var(), api_key) {
                cmd.push_str(&format!(" && export {}=\"{}\"", key_var, key));
            }
            cmd
        }
        ShellType::Fish => {
            let mut cmd = format!("set -gx {} \"{}\"", agent.env_var_name(), base_url);
            if let (Some(key_var), Some(key)) = (agent.api_key_env_var(), api_key) {
                cmd.push_str(&format!("; set -gx {} \"{}\"", key_var, key));
            }
            cmd
        }
        ShellType::Powershell => {
            let mut cmd = format!("$env:{} = \"{}\"", agent.env_var_name(), base_url);
            if let (Some(key_var), Some(key)) = (agent.api_key_env_var(), api_key) {
                cmd.push_str(&format!("; $env:{} = \"{}\"", key_var, key));
            }
            cmd
        }
        ShellType::Cmd => {
            let mut cmd = format!("set {}={}", agent.env_var_name(), base_url);
            if let (Some(key_var), Some(key)) = (agent.api_key_env_var(), api_key) {
                cmd.push_str(&format!(" & set {}={}", key_var, key));
            }
            cmd
        }
    }
}

/// Windows-specific: Set environment variable in user registry
#[cfg(windows)]
pub fn set_windows_env_var(name: &str, value: &str) -> Result<(), ShellProfileError> {
    use std::process::Command;

    let result = Command::new("setx")
        .args([name, value])
        .output()
        .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;

    if !result.status.success() {
        return Err(ShellProfileError::WriteError(
            String::from_utf8_lossy(&result.stderr).to_string()
        ));
    }

    Ok(())
}

/// Windows-specific: Remove environment variable from user registry
#[cfg(windows)]
pub fn remove_windows_env_var(name: &str) -> Result<(), ShellProfileError> {
    use std::process::Command;

    let result = Command::new("reg")
        .args([
            "delete",
            "HKCU\\Environment",
            "/v",
            name,
            "/f",
        ])
        .output()
        .map_err(|e| ShellProfileError::WriteError(e.to_string()))?;

    // Ignore errors if variable doesn't exist
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        if !stderr.contains("unable to find") && !stderr.contains("não foi possível") {
            return Err(ShellProfileError::WriteError(stderr.to_string()));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_shell() {
        let shell = detect_shell();
        // Just ensure it returns something valid
        assert!(matches!(
            shell,
            ShellType::Zsh | ShellType::Bash | ShellType::Fish | ShellType::Powershell | ShellType::Cmd
        ));
    }

    #[test]
    fn test_generate_config_bash() {
        let config = CLIAgent::ClaudeCode.generate_config(ShellType::Bash, 8317, Some("test-key"));
        assert!(config.contains("export ANTHROPIC_BASE_URL=\"http://127.0.0.1:8317/v1\""));
        assert!(config.contains("export ANTHROPIC_API_KEY=\"test-key\""));
    }

    #[test]
    fn test_generate_config_fish() {
        let config = CLIAgent::ClaudeCode.generate_config(ShellType::Fish, 8317, None);
        assert!(config.contains("set -gx ANTHROPIC_BASE_URL"));
    }

    #[test]
    fn test_generate_config_powershell() {
        let config = CLIAgent::ClaudeCode.generate_config(ShellType::Powershell, 8317, None);
        assert!(config.contains("$env:ANTHROPIC_BASE_URL"));
    }
}
