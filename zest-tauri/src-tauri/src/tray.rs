//! System tray management
//!
//! Handles the system tray icon and menu for Zest.

use tauri::{
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

/// Setup the system tray
pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Zest - AI Quota Manager")
        .icon(app.default_window_icon().unwrap().clone())
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // Show or focus the main window on left click
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .show_menu_on_left_click(false)
        .build(app)?;

    log::info!("System tray initialized");

    Ok(())
}

/// Update tray tooltip with current status
pub fn update_tray_tooltip<R: Runtime>(
    app: &tauri::AppHandle<R>,
    running: bool,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let tooltip = if running {
            format!("Zest - Running on port {}", port)
        } else {
            "Zest - Proxy stopped".to_string()
        };
        tray.set_tooltip(Some(&tooltip))?;
    }
    Ok(())
}
