pub mod commands;
pub mod models;
pub mod services;

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, LazyLock, Mutex};

use log::info;
use models::config::Config;
use models::error::AppError;
use models::fabric::{FabricInstaller, FabricLoader, FabricMinecraftVersion};
use models::launch::LaunchResult;
use models::logger::{init_log_bridge, LogLine};
use models::mirror::mojang_mirror;
use models::mods::ModInfo;
use models::versions::MinecraftVersion;
use services::config::load;
use services::directory_manager::{create_necessary_dirs, get_pars_launcher_directory};
use services::download_manager::DownloadManager;
use services::game_launcher::{launch_game, DirectConnectTarget};
use services::version_manager::{download_version_manifest, reload_installed_versions};
use tauri::async_runtime::{block_on, spawn};
use tauri::{command, AppHandle, Manager, State};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use tokio::sync::{self, mpsc, RwLock};

pub struct ParsLauncher {
    pub name: String,
    pub version: String,
}

pub struct AppState {
    pub config: Arc<RwLock<Config>>,
    pub launcher_details: ParsLauncher,
    pub log_tx: mpsc::UnboundedSender<LogLine>,
    pub log_history: Arc<Mutex<VecDeque<LogLine>>>,
    pub downloader: Arc<DownloadManager>,
}

pub struct Global {
    pub forge: Option<HashMap<String, Vec<String>>>,
    pub fabric_loaders: Option<Vec<FabricLoader>>,
    pub fabric_installers: Option<Vec<FabricInstaller>>,
    pub fabric_mc_versions: Option<Vec<FabricMinecraftVersion>>,
    pub versions: Vec<MinecraftVersion>,
}

pub static GLOBAL_CACHE: LazyLock<sync::Mutex<Global>> = LazyLock::new(|| {
    sync::Mutex::new(Global {
        forge: None,
        fabric_loaders: None,
        fabric_installers: None,
        fabric_mc_versions: None,
        versions: Vec::new(),
    })
});

pub const LAUNCHER_NAME: &str = "ParsLauncher";
pub const LAUNCHER_VERSION: &str = "1.0.0";

/// Direct-connect target passed on the command line
/// (`--server <host>[:port]` or `--server <host> --port <port>`).
/// Consumed once by the frontend on startup via [`startup_direct_connect`].
static STARTUP_DIRECT_CONNECT: Mutex<Option<DirectConnectTarget>> = Mutex::new(None);

fn parse_direct_connect_args() -> Option<DirectConnectTarget> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut server: Option<String> = None;
    let mut port: Option<u16> = None;

    let mut i = 0;
    while i < args.len() {
        let arg = &args[i];
        let lower = arg.to_ascii_lowercase();
        if lower == "--server" || lower == "--connect" {
            if let Some(value) = args.get(i + 1) {
                // Accept "host", "host:port" and bare IPv6 in brackets.
                if let Some((host, embedded_port)) = value.rsplit_once(':') {
                    if let Ok(p) = embedded_port.parse::<u16>() {
                        server = Some(host.trim_start_matches('[').trim_end_matches(']').to_string());
                        port = Some(p);
                    }
                } else {
                    server = Some(value.clone());
                }
                i += 1;
            }
        } else if lower == "--port" {
            if let Some(value) = args.get(i + 1) {
                port = value.parse::<u16>().ok();
                i += 1;
            }
        }
        i += 1;
    }

    let host = server?;
    if host.is_empty() {
        return None;
    }
    Some(DirectConnectTarget {
        server: host,
        port: Some(port.unwrap_or(25565)),
    })
}

/// Returns the direct-connect target from the command line (once).
#[command]
async fn startup_direct_connect(
) -> Result<Option<DirectConnectTarget>, AppError> {
    let mut guard = STARTUP_DIRECT_CONNECT
        .lock()
        .map_err(|_| AppError::UnknownError("direct connect lock poisoned".to_string()))?;
    Ok(guard.take())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = dotenvy::dotenv();

    if let Some(target) = parse_direct_connect_args() {
        info!(
            "direct connect requested: {}:{}",
            target.server,
            target.port.unwrap_or(25565)
        );
        if let Ok(mut guard) = STARTUP_DIRECT_CONNECT.lock() {
            *guard = Some(target);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .targets([
                    Target::new(TargetKind::Folder {
                        path: get_pars_launcher_directory(),
                        file_name: Some("latest".to_string()),
                    }),
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Webview),
                ])
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .build(),
        )
        .setup(move |app| {
            info!("Pars Launcher initialization starting...");

            // Log the canonical directory hierarchy at startup so path
            // issues are immediately visible in the log file.
            info!("=== Canonical Directory Hierarchy ===");
            info!("  minecraft_root: {}", crate::services::directory_manager::get_minecraft_directory().display());
            info!("  versions_dir:   {}", crate::services::directory_manager::get_versions_directory().display());
            info!("  libraries_dir:  {}", crate::services::directory_manager::get_libraries_directory().display());
            info!("  assets_dir:     {}", crate::services::directory_manager::get_assets_directory().display());
            info!("  instances_dir:  {}", crate::services::directory_manager::get_instances_directory().display());
            info!("  launcher_dir:   {}", crate::services::directory_manager::get_pars_launcher_directory().display());
            info!("  java_dir:       {}", crate::services::directory_manager::get_launcher_java_directory().display());
            info!("  config_path:    {}", crate::services::directory_manager::get_config_directory().display());
            info!("  manifest_cache: {}", crate::services::directory_manager::version_manifest_directory().display());
            info!("=====================================");

            spawn(async {
                create_necessary_dirs().await;
                let resolved = crate::models::mirror::resolve_effective(&mojang_mirror()).await;
                if let Err(e) = download_version_manifest(&resolved).await {
                    info!("manifest download failed (will use cache if present): {e:?}");
                }
            });

            let app_handle = app.handle().clone();
            let shared_history = Arc::new(Mutex::new(VecDeque::with_capacity(10000)));
            let bridge_history = shared_history.clone();
            let log_tx = init_log_bridge(app_handle, bridge_history);

            let downloader = Arc::new(DownloadManager::new(8));
            app.manage(AppState {
                config: Arc::new(RwLock::new(load())),
                launcher_details: ParsLauncher {
                    name: LAUNCHER_NAME.to_string(),
                    version: LAUNCHER_VERSION.to_string(),
                },
                log_tx,
                log_history: shared_history,
                downloader,
            });

            block_on(async {
                reload_installed_versions().await;
            });
            info!("Installed versions reloaded.");

            let window = app.handle().get_window("main").unwrap();
            fit_window_to_work_area(&window);
            window.center().expect("Failed to center the window");
            window.set_focus().expect("Failed to set window focus");

            #[cfg(any(windows, target_os = "linux"))]
            {
                app.deep_link().register("parsLauncher")?;
                app.deep_link().register_all()?;
            }
            app.deep_link().on_open_url(|event| {
                info!("deep link URLs: {:?}", event.urls());
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            play,
            commands::downloader::get_versions,
            commands::settings::get_maximum_ram_usage,
            commands::settings::get_minimum_ram_usage,
            commands::settings::set_maximum_ram_usage,
            commands::settings::set_minimum_ram_usage,
            commands::settings::set_language,
            commands::settings::get_language,
            commands::settings::set_exit_on_launch,
            commands::settings::should_exit_on_launch,
            commands::settings::save,
            commands::settings::set_config,
            commands::settings::get_selected_profile,
            commands::settings::set_selected_profile,
            commands::settings::get_total_ram,
            commands::mods::toggle_backpack_item,
            commands::mods::delete_backpack_item,
            commands::mods::get_backpack_items,
            commands::mods::get_instance_info,
            commands::mods::import_backpack_item,
            commands::mods::open_backpack_folder,
            commands::modrinth::modrinth_search,
            commands::modrinth::modrinth_get_project_versions,
            commands::modrinth::modrinth_download_item,
            commands::modpacks::search_modpacks,
            commands::modpacks::get_modpack_versions,
            commands::modpacks::install_modpack,
            commands::modpacks::import_modpack,
            commands::instances::list_instances,
            commands::instances::update_instance_settings,
            commands::instances::set_instance_path,
            commands::instances::reset_instance_path,
            commands::instances::clone_instance,
            commands::instances::delete_instance,
            commands::instances::reinstall_instance,
            commands::instances::list_instance_worlds,
            commands::instances::delete_instance_world,
            commands::instances::create_instance_backup,
            commands::instances::list_instance_backups,
            commands::instances::restore_instance_backup,
            commands::instances::delete_instance_backup,
            commands::instances::open_instance_folder,
            commands::downloader::download_version,
            commands::downloader::get_installed_versions,
            commands::downloader::get_non_installed_versions,
            commands::downloader::get_forge_versions,
            commands::downloader::get_fabric_versions,
            commands::downloader::get_optifine_versions,
            commands::downloader::get_vanilla_versions,
            commands::downloader::repair_version,
            commands::downloader::get_active_downloads,
            commands::downloader::pause_download,
            commands::downloader::resume_download,
            commands::downloader::cancel_download,
            commands::downloader::clear_finished_downloads,
            commands::profiles::get_profiles,
            commands::profiles::create_offline_profile,
            commands::profiles::rename_profile,
            commands::profiles::remove_profile,
            commands::logger::get_log_history,
            commands::logger::clear_log_history_channel,
            commands::logger::clear_log_history,
            commands::logger::debug,
            commands::mirrors::get_available_mirrors,
            commands::mirrors::set_mirror,
            commands::mirrors::get_mirror,
            commands::mirrors::import_mirror,
            commands::java::list_detected_javas,
            commands::java::get_selected_java,
            commands::java::set_selected_java,
            commands::servers::servers_builtin_list,
            commands::servers::servers_fetch_remote,
            commands::servers::servers_ping,
            startup_direct_connect,
            commands::pars::pars_get_achievements,
            commands::pars::pars_get_badges,
            commands::pars::pars_set_displayed_badges,
            commands::pars::pars_get_profile,
            commands::pars::pars_save_customization,
            commands::pars::pars_upload_avatar,
            commands::pars::pars_avatar_path,
            commands::pars::pars_avatar_data,
            commands::pars::pars_get_allowed_accents,
            commands::pars::pars_get_journey,
            commands::pars::pars_get_statistics,
            commands::pars::pars_get_recent_activity,
            commands::pars::pars_is_maximized,
            commands::pars::pars_toggle_maximized,
            commands::pars::pars_set_active_skin,
            commands::pars::pars_get_active_skin,
            commands::ai::ai_chat,
            commands::ai::ai_diagnose_log,
            commands::ai::ai_apply_autofix,
            commands::ai::get_system_diagnostics,
            commands::ai::get_ai_usage_status,
            commands::updater::check_launcher_update,
            commands::updater::apply_launcher_update,
            commands::account::pars_account_register,
            commands::account::pars_account_login,
            commands::account::pars_account_logout,
            commands::account::pars_account_get_current,
            commands::account::pars_account_upload_skin,
            commands::account::pars_account_sync_save,
            commands::account::pars_account_sync_load,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Clamp the main window so it never exceeds the primary monitor's work
/// area. On 1080p displays running 125–150% DPI scaling, the logical
/// 1280×800 default is physically larger than the screen — cap it to
/// 92% of the work area (in physical pixels) and lower the minimum size
/// to match.
fn fit_window_to_work_area(window: &tauri::Window) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let scale = monitor.scale_factor();
    let area = monitor.work_area();
    let max_w = (area.size.width as f64 * 0.92).floor();
    let max_h = (area.size.height as f64 * 0.92).floor();
    let want_w = (1280.0 * scale).min(max_w);
    let want_h = (800.0 * scale).min(max_h);
    let _ = window.set_min_size(Some(tauri::PhysicalSize::new(
        (500.0 * scale).floor().min(max_w) as u32,
        (560.0 * scale).floor().min(max_h) as u32,
    )));
    let _ = window.set_size(tauri::PhysicalSize::new(
        want_w.round() as u32,
        want_h.round() as u32,
    ));
}

/// Launch the game. Returns a structured [`LaunchResult`] on success
/// (PID, version, username, start time) so the frontend can render a
/// "game is running" indicator. On failure returns a typed [`AppError`]
/// the UI can map to a user message + recovery action.
#[command]
async fn play(
    app: AppHandle,
    state: State<'_, AppState>,
    selected_version: String,
    direct_connect: Option<crate::services::game_launcher::DirectConnectTarget>,
) -> Result<LaunchResult, AppError> {
    let _ = &state; // AppState is also held by the launcher internally.
    let versions = {
        let global = GLOBAL_CACHE.lock().await;
        global.versions.clone()
    };
    let result =
        launch_game(app.clone(), selected_version.clone(), &versions, direct_connect).await?;
    commands::pars::on_play_session(&app, &selected_version);
    Ok(result)
}
