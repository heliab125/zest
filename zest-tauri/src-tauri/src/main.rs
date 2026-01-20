//! Zest - AI Provider Quota Manager
//!
//! This is the main entry point for the Tauri application.
//! Handles system tray, proxy management, and IPC commands.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod proxy;
mod tray;
mod settings;
mod credentials;
mod models;
mod shell_profile;

use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            // Initialize system tray
            tray::setup_tray(app)?;

            // Initialize proxy manager state
            let proxy_state = proxy::ProxyState::new();
            app.manage(proxy_state);

            // Initialize settings
            let settings_state = settings::SettingsState::new();
            app.manage(settings_state);

            log::info!("Zest application started successfully");

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Proxy commands
            commands::start_proxy,
            commands::stop_proxy,
            commands::get_proxy_status,
            commands::install_proxy_binary,
            commands::get_proxy_version,
            commands::get_proxy_api_key,
            commands::get_provider_api_key,
            commands::is_binary_installed,
            commands::get_download_progress,
            commands::is_downloading,

            // Settings commands
            commands::get_settings,
            commands::save_settings,
            commands::get_port,
            commands::set_port,

            // Auth files commands
            commands::get_auth_files,
            commands::delete_auth_file,
            commands::toggle_auth_file,
            commands::fetch_auth_file_models,

            // Quota commands
            commands::fetch_quota,
            commands::fetch_all_quotas,

            // API keys commands
            commands::get_api_keys,
            commands::add_api_key,
            commands::delete_api_key,

            // Logs commands
            commands::fetch_logs,
            commands::clear_logs,
            commands::fetch_usage,
            commands::fetch_request_history,
            commands::clear_request_history,

            // Credentials commands
            commands::store_credential,
            commands::get_credential,
            commands::delete_credential,

            // OAuth commands
            commands::start_oauth_flow,
            commands::check_oauth_status,

            // System commands
            commands::open_config_folder,
            commands::open_logs_folder,
            commands::copy_to_clipboard,

            // Shell Profile commands
            commands::detect_shell,
            commands::get_shell_profile_path,
            commands::is_agent_configured,
            commands::configure_agent,
            commands::unconfigure_agent,
            commands::create_shell_backup,
            commands::get_env_command,
            commands::get_available_shells,
            commands::get_available_agents,

            // Advanced Agent Configuration
            commands::find_agent_binary,
            commands::configure_agent_advanced,
            commands::get_agent_backups,
            commands::restore_agent_backup,

            // Direct Auth File Commands (when proxy is not running)
            commands::scan_auth_files_direct,
            commands::get_auth_dir,
            commands::create_auth_file,
            commands::delete_auth_file_direct,
            commands::toggle_auth_file_direct,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing on close button
                // App stays in system tray
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
