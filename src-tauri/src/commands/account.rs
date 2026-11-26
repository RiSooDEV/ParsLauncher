use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{command, State};

use crate::models::error::AppError;
use crate::services::directory_manager::get_pars_launcher_directory;
use crate::AppState;

/// Local (offline) account storage. Pars Launcher does not depend on any
/// remote identity server: registration and login are handled on the user's
/// own machine, and the created account is linked to a local offline profile.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ParsUser {
    pub id: String,
    pub username: String,
    pub email: String,
    pub role: String,
    pub badge: String,
    pub skin_data: Option<String>,
    pub skin_model: String,
    pub cape_data: Option<String>,
    pub created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ParsAuthResponse {
    pub success: bool,
    pub token: Option<String>,
    pub user: Option<ParsUser>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct StoredAccount {
    username: String,
    password_hash: String,
    user: ParsUser,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SavedSession {
    token: String,
    user: ParsUser,
    saved_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
struct SyncData {
    settings_json: Option<String>,
    instances_json: Option<String>,
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{:02x}", byte));
    }
    out
}

fn get_accounts_file_path() -> PathBuf {
    get_pars_launcher_directory().join("pars_accounts.json")
}

fn get_session_file_path() -> PathBuf {
    get_pars_launcher_directory().join("pars_account_session.json")
}

fn get_sync_file_path() -> PathBuf {
    get_pars_launcher_directory().join("pars_sync.json")
}

fn load_accounts() -> HashMap<String, StoredAccount> {
    let path = get_accounts_file_path();
    std::fs::read_to_string(path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default()
}

fn save_accounts(accounts: &HashMap<String, StoredAccount>) -> Result<(), AppError> {
    let path = get_accounts_file_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::UnknownError(format!("could not create account storage: {}", e)))?;
    }
    let json = serde_json::to_string_pretty(accounts)
        .map_err(|e| AppError::UnknownError(format!("could not serialize accounts: {}", e)))?;
    std::fs::write(path, json)
        .map_err(|e| AppError::UnknownError(format!("could not write accounts: {}", e)))
}

fn load_saved_session() -> Option<SavedSession> {
    let path = get_session_file_path();
    if !path.exists() {
        return None;
    }
    let data = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_session(token: &str, user: &ParsUser) {
    let path = get_session_file_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let sess = SavedSession {
        token: token.to_string(),
        user: user.clone(),
        saved_at: now_millis(),
    };
    if let Ok(json) = serde_json::to_string_pretty(&sess) {
        let _ = std::fs::write(path, json);
    }
}

fn clear_session() {
    let path = get_session_file_path();
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
}

fn is_valid_username(username: &str) -> bool {
    let len = username.chars().count();
    (3..=16).contains(&len)
        && username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Creates the matching local offline profile and selects it, so the
/// account username is immediately usable in-game.
async fn sync_with_launcher_profile(state: &State<'_, AppState>, username: &str) {
    if let Ok(profile) = crate::models::profiles::create_new_profile(username.to_string(), false) {
        let mut cfg = state.config.write().await;
        cfg.launch_options.selected_profile = profile.uuid;
        let _ = cfg.write_to_file();
    }
}

#[command]
pub async fn pars_account_register(
    state: State<'_, AppState>,
    username: String,
    email: String,
    password: String,
) -> Result<ParsAuthResponse, AppError> {
    let username = username.trim().to_string();
    let email = email.trim().to_string();

    if !is_valid_username(&username) {
        return Ok(ParsAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some(
                "نام کاربری باید ۳ تا ۱۶ حرف و فقط شامل حروف انگلیسی، اعداد یا زیرخط باشد."
                    .to_string(),
            ),
        });
    }

    if password.chars().count() < 6 {
        return Ok(ParsAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some("رمز عبور باید حداقل ۶ کاراکتر باشد.".to_string()),
        });
    }

    let mut accounts = load_accounts();
    let key = username.to_lowercase();
    if accounts.contains_key(&key) {
        return Ok(ParsAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some("این نام کاربری قبلاً روی این سیستم ثبت شده است.".to_string()),
        });
    }

    let user = ParsUser {
        id: uuid::Uuid::new_v4().to_string(),
        username: username.clone(),
        email,
        role: "player".to_string(),
        badge: "methoria".to_string(),
        skin_data: None,
        skin_model: "classic".to_string(),
        cape_data: None,
        created_at: now_millis(),
    };

    accounts.insert(
        key,
        StoredAccount {
            username: username.clone(),
            password_hash: sha256_hex(&password),
            user: user.clone(),
        },
    );
    save_accounts(&accounts)?;

    let token = uuid::Uuid::new_v4().to_string();
    save_session(&token, &user);
    sync_with_launcher_profile(&state, &user.username).await;

    Ok(ParsAuthResponse {
        success: true,
        token: Some(token),
        user: Some(user),
        error: None,
    })
}

#[command]
pub async fn pars_account_login(
    state: State<'_, AppState>,
    login: String,
    password: String,
) -> Result<ParsAuthResponse, AppError> {
    let key = login.trim().to_lowercase();
    let accounts = load_accounts();

    let Some(account) = accounts.get(&key) else {
        return Ok(ParsAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some("حسابی با این نام کاربری روی این سیستم پیدا نشد؛ ابتدا ثبت‌نام کنید.".to_string()),
        });
    };

    if account.password_hash != sha256_hex(&password) {
        return Ok(ParsAuthResponse {
            success: false,
            token: None,
            user: None,
            error: Some("رمز عبور اشتباه است.".to_string()),
        });
    }

    let user = account.user.clone();
    let token = uuid::Uuid::new_v4().to_string();
    save_session(&token, &user);
    sync_with_launcher_profile(&state, &user.username).await;

    Ok(ParsAuthResponse {
        success: true,
        token: Some(token),
        user: Some(user),
        error: None,
    })
}

#[command]
pub async fn pars_account_logout() -> Result<(), AppError> {
    clear_session();
    Ok(())
}

#[command]
pub async fn pars_account_get_current() -> Result<Option<ParsUser>, AppError> {
    Ok(load_saved_session().map(|s| s.user))
}

#[command]
pub async fn pars_account_upload_skin(
    skin_data: String,
    model: String,
    cape_data: Option<String>,
) -> Result<(), AppError> {
    let saved = load_saved_session().ok_or_else(|| {
        AppError::UnknownError("لطفاً ابتدا وارد حساب کاربری شوید".to_string())
    })?;

    let mut accounts = load_accounts();
    let key = saved.user.username.to_lowercase();
    let Some(account) = accounts.get_mut(&key) else {
        return Err(AppError::UnknownError(
            "حساب کاربری روی این سیستم یافت نشد".to_string(),
        ));
    };

    account.user.skin_data = Some(skin_data);
    account.user.skin_model = model;
    account.user.cape_data = cape_data;
    let updated_user = account.user.clone();
    save_accounts(&accounts)?;

    save_session(&saved.token, &updated_user);
    Ok(())
}

#[command]
pub async fn pars_account_sync_save(
    settings_json: Option<String>,
    instances_json: Option<String>,
) -> Result<(), AppError> {
    let Some(saved) = load_saved_session() else {
        return Ok(());
    };

    let path = get_sync_file_path();
    let mut store: HashMap<String, SyncData> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default();

    store.insert(
        saved.user.username.to_lowercase(),
        SyncData {
            settings_json,
            instances_json,
        },
    );

    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&store) {
        let _ = std::fs::write(path, json);
    }
    Ok(())
}

#[command]
pub async fn pars_account_sync_load() -> Result<(Option<String>, Option<String>), AppError> {
    let Some(saved) = load_saved_session() else {
        return Ok((None, None));
    };

    let path = get_sync_file_path();
    let store: HashMap<String, SyncData> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|data| serde_json::from_str(&data).ok())
        .unwrap_or_default();

    if let Some(data) = store.get(&saved.user.username.to_lowercase()) {
        return Ok((data.settings_json.clone(), data.instances_json.clone()));
    }

    Ok((None, None))
}
