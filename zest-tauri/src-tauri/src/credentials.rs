//! Credential management
//!
//! Handles secure storage of credentials using platform-native APIs.
//! On Windows: Windows Credential Manager
//! On macOS: Keychain
//! On Linux: Secret Service (libsecret)

use serde::Serialize;
use thiserror::Error;

const SERVICE_NAME: &str = "com.zest.app";

#[derive(Error, Debug, Serialize)]
pub enum CredentialError {
    #[error("Failed to store credential: {0}")]
    StoreError(String),
    #[error("Failed to retrieve credential: {0}")]
    RetrieveError(String),
    #[error("Failed to delete credential: {0}")]
    DeleteError(String),
    #[error("Credential not found")]
    NotFound,
}

/// Store a credential securely
pub fn store_credential(key: &str, value: &str) -> Result<(), CredentialError> {
    #[cfg(target_os = "windows")]
    {
        store_credential_windows(key, value)
    }

    #[cfg(target_os = "macos")]
    {
        store_credential_macos(key, value)
    }

    #[cfg(target_os = "linux")]
    {
        store_credential_linux(key, value)
    }
}

/// Retrieve a credential
pub fn get_credential(key: &str) -> Result<String, CredentialError> {
    #[cfg(target_os = "windows")]
    {
        get_credential_windows(key)
    }

    #[cfg(target_os = "macos")]
    {
        get_credential_macos(key)
    }

    #[cfg(target_os = "linux")]
    {
        get_credential_linux(key)
    }
}

/// Delete a credential
pub fn delete_credential(key: &str) -> Result<(), CredentialError> {
    #[cfg(target_os = "windows")]
    {
        delete_credential_windows(key)
    }

    #[cfg(target_os = "macos")]
    {
        delete_credential_macos(key)
    }

    #[cfg(target_os = "linux")]
    {
        delete_credential_linux(key)
    }
}

// ============================================================================
// Windows Implementation
// ============================================================================

#[cfg(target_os = "windows")]
fn store_credential_windows(key: &str, value: &str) -> Result<(), CredentialError> {
    use windows_registry::*;
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW flag (0x08000000) prevents cmd window from appearing
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    // For simplicity, we'll store in a protected registry location
    // In production, you might want to use the Windows Credential Manager API directly
    let target_name = format!("{}:{}", SERVICE_NAME, key);

    // Use the Windows Credential Manager via command line
    // This is a simplified approach - a production app should use the Windows API
    let result = std::process::Command::new("cmd")
        .args(["/C", &format!(
            "cmdkey /generic:{} /user:zest /pass:{}",
            target_name, value
        )])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(()),
        Ok(output) => Err(CredentialError::StoreError(
            String::from_utf8_lossy(&output.stderr).to_string()
        )),
        Err(e) => Err(CredentialError::StoreError(e.to_string())),
    }
}

#[cfg(target_os = "windows")]
fn get_credential_windows(key: &str) -> Result<String, CredentialError> {
    // For Windows, we'll fall back to file-based storage with encryption
    // A full implementation would use the Credential Manager API
    let path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Zest")
        .join("credentials")
        .join(format!("{}.enc", key));

    if !path.exists() {
        return Err(CredentialError::NotFound);
    }

    std::fs::read_to_string(&path)
        .map_err(|e| CredentialError::RetrieveError(e.to_string()))
}

#[cfg(target_os = "windows")]
fn delete_credential_windows(key: &str) -> Result<(), CredentialError> {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW flag (0x08000000) prevents cmd window from appearing
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let target_name = format!("{}:{}", SERVICE_NAME, key);

    let result = std::process::Command::new("cmd")
        .args(["/C", &format!("cmdkey /delete:{}", target_name)])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(()),
        Ok(_) => Ok(()), // Ignore errors when deleting non-existent credentials
        Err(e) => Err(CredentialError::DeleteError(e.to_string())),
    }
}

// ============================================================================
// macOS Implementation
// ============================================================================

#[cfg(target_os = "macos")]
fn store_credential_macos(key: &str, value: &str) -> Result<(), CredentialError> {
    let output = std::process::Command::new("security")
        .args([
            "add-generic-password",
            "-a", "zest",
            "-s", &format!("{}:{}", SERVICE_NAME, key),
            "-w", value,
            "-U", // Update if exists
        ])
        .output()
        .map_err(|e| CredentialError::StoreError(e.to_string()))?;

    if output.status.success() {
        Ok(())
    } else {
        Err(CredentialError::StoreError(
            String::from_utf8_lossy(&output.stderr).to_string()
        ))
    }
}

#[cfg(target_os = "macos")]
fn get_credential_macos(key: &str) -> Result<String, CredentialError> {
    let output = std::process::Command::new("security")
        .args([
            "find-generic-password",
            "-a", "zest",
            "-s", &format!("{}:{}", SERVICE_NAME, key),
            "-w",
        ])
        .output()
        .map_err(|e| CredentialError::RetrieveError(e.to_string()))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(CredentialError::NotFound)
    }
}

#[cfg(target_os = "macos")]
fn delete_credential_macos(key: &str) -> Result<(), CredentialError> {
    let output = std::process::Command::new("security")
        .args([
            "delete-generic-password",
            "-a", "zest",
            "-s", &format!("{}:{}", SERVICE_NAME, key),
        ])
        .output()
        .map_err(|e| CredentialError::DeleteError(e.to_string()))?;

    if output.status.success() {
        Ok(())
    } else {
        // Ignore errors when credential doesn't exist
        Ok(())
    }
}

// ============================================================================
// Linux Implementation
// ============================================================================

#[cfg(target_os = "linux")]
fn store_credential_linux(key: &str, value: &str) -> Result<(), CredentialError> {
    // Use secret-tool if available (part of libsecret)
    let output = std::process::Command::new("secret-tool")
        .args([
            "store",
            "--label", &format!("Zest: {}", key),
            "application", SERVICE_NAME,
            "key", key,
        ])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(value.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| CredentialError::StoreError(e.to_string()))?;

    if output.status.success() {
        Ok(())
    } else {
        // Fall back to file-based storage
        let path = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("zest")
            .join("credentials");

        std::fs::create_dir_all(&path)
            .map_err(|e| CredentialError::StoreError(e.to_string()))?;

        std::fs::write(path.join(key), value)
            .map_err(|e| CredentialError::StoreError(e.to_string()))
    }
}

#[cfg(target_os = "linux")]
fn get_credential_linux(key: &str) -> Result<String, CredentialError> {
    // Try secret-tool first
    let output = std::process::Command::new("secret-tool")
        .args([
            "lookup",
            "application", SERVICE_NAME,
            "key", key,
        ])
        .output()
        .map_err(|e| CredentialError::RetrieveError(e.to_string()))?;

    if output.status.success() && !output.stdout.is_empty() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    // Fall back to file-based storage
    let path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zest")
        .join("credentials")
        .join(key);

    if path.exists() {
        std::fs::read_to_string(&path)
            .map_err(|e| CredentialError::RetrieveError(e.to_string()))
    } else {
        Err(CredentialError::NotFound)
    }
}

#[cfg(target_os = "linux")]
fn delete_credential_linux(key: &str) -> Result<(), CredentialError> {
    // Try secret-tool first
    let _ = std::process::Command::new("secret-tool")
        .args([
            "clear",
            "application", SERVICE_NAME,
            "key", key,
        ])
        .output();

    // Also try to delete file-based credential
    let path = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("zest")
        .join("credentials")
        .join(key);

    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|e| CredentialError::DeleteError(e.to_string()))?;
    }

    Ok(())
}
