//! Tauri commands for the Servers page: built-in server list and status ping.

use serde::{Deserialize, Serialize};
use tauri::command;

use crate::models::error::AppError;
use crate::services::mc_ping::{ping_server, ServerStatus};

/// A server shown on the Servers page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerEntry {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    /// Persian description shown when the UI locale is fa.
    pub description_fa: String,
    /// English description shown when the UI locale is en.
    pub description_en: String,
    /// Pinned servers (MethoriaCraft) render first with a highlight card.
    pub featured: bool,
    /// Human-readable supported version range, e.g. "1.8.x-1.21.x".
    pub versions: String,
}

/// Built-in list served when no remote list is configured.
///
/// MethoriaCraft is pinned first by design. Other entries use addresses
/// published by their owners (mctracker.ir, cubecraft.net, hypixel.net).
pub fn builtin_servers() -> Vec<ServerEntry> {
    vec![
        ServerEntry {
            id: "methoria".to_string(),
            name: "MethoriaCraft".to_string(),
            host: "Play.MethoriaCraft.ir".to_string(),
            port: 25565,
            description_fa: "سرور رسمی ما! سوراوایول پارس با رویدادهای هفتگی و تیم‌بازی".to_string(),
            description_en: "Our home server! Pars survival with weekly events and team play".to_string(),
            featured: true,
            versions: "1.21.11".to_string(),
        },
        ServerEntry {
            id: "gameup".to_string(),
            name: "GameUP".to_string(),
            host: "MC.GameUP.iR".to_string(),
            port: 25565,
            description_fa: "شلوغ‌ترین سرور جاوا ایرانی — رول‌پلی، مینی‌گیم و سوراوایول".to_string(),
            description_en: "Busiest Iranian Java server — roleplay, minigames and survival".to_string(),
            featured: false,
            versions: "1.8.x-1.21.x".to_string(),
        },
        ServerEntry {
            id: "trexmine".to_string(),
            name: "TrexMine".to_string(),
            host: "Hub.TrexMine.Com".to_string(),
            port: 25565,
            description_fa: "سرور محبوب فارسی‌زبان با حالت‌های متنوع".to_string(),
            description_en: "Popular Persian-language server with varied game modes".to_string(),
            featured: false,
            versions: "1.8.x-1.21.x".to_string(),
        },
        ServerEntry {
            id: "gunmax".to_string(),
            name: "GunMax".to_string(),
            host: "Play.GunMax.Org".to_string(),
            port: 25565,
            description_fa: "متفاوت‌ترین سرور فارسی — تیراندازی و مینی‌گیم شهری".to_string(),
            description_en: "A different Persian server — gunplay and urban minigames".to_string(),
            featured: false,
            versions: "1.8.x-1.21.x".to_string(),
        },
        ServerEntry {
            id: "bigmc".to_string(),
            name: "BighanoonAbad".to_string(),
            host: "mc.bigmc.ir".to_string(),
            port: 25565,
            description_fa: "جاوا و بدراک با هم — سوراوایول ایرانی".to_string(),
            description_en: "Java + Bedrock cross-play Iranian survival".to_string(),
            featured: false,
            versions: "1.8.x-1.21.x".to_string(),
        },
        ServerEntry {
            id: "hypixel".to_string(),
            name: "Hypixel".to_string(),
            host: "mc.hypixel.net".to_string(),
            port: 25565,
            description_fa: "بزرگ‌ترین سرور جهان — BedWars، SkyBlock و ده‌ها مینی‌گیم".to_string(),
            description_en: "World's largest server — BedWars, SkyBlock and dozens of minigames".to_string(),
            featured: false,
            versions: "1.8.x-1.21.x".to_string(),
        },
        ServerEntry {
            id: "cubecraft".to_string(),
            name: "CubeCraft".to_string(),
            host: "play.cubecraft.net".to_string(),
            port: 25565,
            description_fa: "مینی‌گیم‌های حرفه‌ای با آنتی‌چیت قوی".to_string(),
            description_en: "Professional minigames with strong anticheat".to_string(),
            featured: false,
            versions: "1.21.x".to_string(),
        },
    ]
}

/// Return the built-in server list.
#[command]
pub fn servers_builtin_list() -> Vec<ServerEntry> {
    builtin_servers()
}

/// Fetch a server list from a remote JSON endpoint (same shape as
/// [`ServerEntry`]). Lets operators update the list without shipping a
/// launcher update. Falls back to [`AppError`] types the UI already maps.
#[command]
pub async fn servers_fetch_remote(url: String) -> Result<Vec<ServerEntry>, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::UnknownError(format!("http client: {e}")))?;
    let resp = client
        .get(&url)
        .header("User-Agent", "ParsLauncher/1.0")
        .send()
        .await
        .map_err(|e| AppError::UnknownError(format!("fetch server list: {e}")))?;
    if !resp.status().is_success() {
        return Err(AppError::UnknownError(format!(
            "server list endpoint returned {}",
            resp.status()
        )));
    }
    let entries = resp
        .json::<Vec<ServerEntry>>()
        .await
        .map_err(|e| AppError::UnknownError(format!("invalid server list json: {e}")))?;
    Ok(entries)
}

/// Ping one server. Errors are flattened to strings: the page shows a
/// per-card "offline" state instead of a global error toast.
#[command]
pub async fn servers_ping(host: String, port: u16) -> Result<ServerStatus, String> {
    ping_server(&host, port)
        .await
        .map_err(|e| e.to_string())
}
