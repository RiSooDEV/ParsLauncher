//! Minecraft Server List Protocol status ping.
//!
//! Implements the modern (1.7+) status flow: TCP connect → handshake
//! (next_state=1) → status request → JSON response. No legacy Netty
//! pre-1.7 fallback: every server the launcher ships targets modern
//! protocol versions.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

/// Default timeout for the whole status exchange.
const PING_TIMEOUT: Duration = Duration::from_secs(6);

/// Protocol number advertised in the handshake. Status-only; the actual
/// join uses the game client's own protocol. 767 = 1.21.4.
const HANDSHAKE_PROTOCOL: i32 = 767;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    /// Flattened human-readable MOTD (single line, component tree joined).
    pub motd: String,
    /// Raw description JSON (string or component object) for rich rendering.
    pub motd_raw: Option<serde_json::Value>,
    pub players_online: u32,
    pub players_max: u32,
    pub version_name: String,
    pub protocol: i32,
    /// data:image/png;base64,... — present when the server publishes a 64×64 icon.
    pub favicon: Option<String>,
    /// Round-trip latency of the status exchange in milliseconds.
    pub latency_ms: u32,
}

#[derive(Debug)]
pub enum PingError {
    /// TCP connection failed or timed out (server down / unreachable).
    Unreachable(String),
    /// Connected but the response was not a valid status response.
    Protocol(String),
}

impl std::fmt::Display for PingError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PingError::Unreachable(m) => write!(f, "unreachable: {m}"),
            PingError::Protocol(m) => write!(f, "protocol: {m}"),
        }
    }
}

// ---------- VarInt helpers ----------

fn write_varint(buf: &mut Vec<u8>, mut value: u32) {
    loop {
        let mut byte = (value & 0x7F) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        buf.push(byte);
        if value == 0 {
            break;
        }
    }
}

fn write_string(buf: &mut Vec<u8>, s: &str) {
    let bytes = s.as_bytes();
    write_varint(buf, bytes.len() as u32);
    buf.extend_from_slice(bytes);
}

async fn read_varint(stream: &mut TcpStream) -> Result<u32, PingError> {
    let mut value: u32 = 0;
    let mut shift = 0u32;
    for _ in 0..5 {
        let byte = stream
            .read_u8()
            .await
            .map_err(|e| PingError::Protocol(format!("read varint: {e}")))?;
        value |= ((byte & 0x7F) as u32) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
        shift += 7;
    }
    Err(PingError::Protocol("varint too long".to_string()))
}

async fn read_packet(stream: &mut TcpStream) -> Result<Vec<u8>, PingError> {
    let len = read_varint(stream).await? as usize;
    if len > 2_097_151 {
        return Err(PingError::Protocol("packet too large".to_string()));
    }
    let mut buf = vec![0u8; len];
    stream
        .read_exact(&mut buf)
        .await
        .map_err(|e| PingError::Protocol(format!("read packet body: {e}")))?;
    Ok(buf)
}

// ---------- MOTD flattening ----------

/// Recursively flatten a chat component / string into plain text.
fn flatten_component(value: &serde_json::Value, out: &mut String) {
    match value {
        serde_json::Value::String(s) => out.push_str(s),
        serde_json::Value::Object(obj) => {
            if let Some(t) = obj.get("text").and_then(|v| v.as_str()) {
                out.push_str(t);
            }
            if let Some(extra) = obj.get("extra").and_then(|v| v.as_array()) {
                for item in extra {
                    flatten_component(item, out);
                }
            }
        }
        _ => {}
    }
}

fn flatten_motd(description: &serde_json::Value) -> String {
    let mut text = String::new();
    flatten_component(description, &mut text);
    // Collapse control codes and newlines into spaces for the summary line.
    text.chars()
        .map(|c| match c {
            '\u{00A7}' | '\n' | '\r' => ' ',
            other => other,
        })
        .collect::<String>()
        .split(' ')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

// ---------- status exchange ----------

/// Ping a Minecraft server and return its status (MOTD, players, icon).
///
/// `host` must be a bare host or IP (no port suffix); `port` is the TCP port.
pub async fn ping_server(host: &str, port: u16) -> Result<ServerStatus, PingError> {
    let addr = format!("{host}:{port}");
    let started = Instant::now();

    let mut stream = tokio::time::timeout(PING_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| PingError::Unreachable("connect timed out".to_string()))?
        .map_err(|e| PingError::Unreachable(e.to_string()))?;

    // Handshake packet: id 0x00, protocol, host, port, next_state=1.
    let mut hs = Vec::with_capacity(64);
    write_varint(&mut hs, 0x00);
    write_varint(&mut hs, HANDSHAKE_PROTOCOL as u32);
    write_string(&mut hs, host);
    hs.extend_from_slice(&port.to_be_bytes());
    write_varint(&mut hs, 1); // next state: status

    // Status request packet: id 0x00, no payload.
    let mut req = Vec::with_capacity(8);
    write_varint(&mut req, 0x00);

    let mut framed = Vec::with_capacity(hs.len() + req.len() + 10);
    write_varint(&mut framed, hs.len() as u32);
    framed.extend_from_slice(&hs);
    write_varint(&mut framed, req.len() as u32);
    framed.extend_from_slice(&req);

    stream
        .write_all(&framed)
        .await
        .map_err(|e| PingError::Unreachable(format!("write handshake: {e}")))?;

    let packet = tokio::time::timeout(PING_TIMEOUT, read_packet(&mut stream))
        .await
        .map_err(|_| PingError::Protocol("status response timed out".to_string()))??;

    let latency_ms = u32::try_from(started.elapsed().as_millis()).unwrap_or(u32::MAX);

    // Response packet: id (VarInt) + status JSON (VarInt-prefixed string).
    let mut cursor = 0usize;
    let packet_id = {
        let mut v: u32 = 0;
        let mut shift = 0u32;
        loop {
            let byte = *packet
                .get(cursor)
                .ok_or_else(|| PingError::Protocol("empty packet".to_string()))?;
            cursor += 1;
            v |= ((byte & 0x7F) as u32) << shift;
            if byte & 0x80 == 0 {
                break;
            }
            shift += 7;
            if shift > 28 {
                return Err(PingError::Protocol("packet id varint too long".to_string()));
            }
        }
        v
    };
    if packet_id != 0x00 {
        return Err(PingError::Protocol(format!(
            "unexpected packet id 0x{packet_id:02X}"
        )));
    }

    let str_len = {
        let mut v: u32 = 0;
        let mut shift = 0u32;
        loop {
            let byte = *packet
                .get(cursor)
                .ok_or_else(|| PingError::Protocol("truncated string length".to_string()))?;
            cursor += 1;
            v |= ((byte & 0x7F) as u32) << shift;
            if byte & 0x80 == 0 {
                break;
            }
            shift += 7;
            if shift > 28 {
                return Err(PingError::Protocol("string varint too long".to_string()));
            }
        }
        v as usize
    };
    let json_bytes = packet
        .get(cursor..cursor.saturating_add(str_len))
        .ok_or_else(|| PingError::Protocol("truncated status json".to_string()))?;

    let status: serde_json::Value = serde_json::from_slice(json_bytes)
        .map_err(|e| PingError::Protocol(format!("invalid status json: {e}")))?;

    let motd_raw = status.get("description").cloned();
    let motd = motd_raw
        .as_ref()
        .map(flatten_motd)
        .unwrap_or_default();

    let players = status.get("players");
    let players_online = players
        .and_then(|p| p.get("online"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let players_max = players
        .and_then(|p| p.get("max"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    let version_name = status
        .get("version")
        .and_then(|v| v.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let protocol = status
        .get("version")
        .and_then(|v| v.get("protocol"))
        .and_then(|v| v.as_i64())
        .unwrap_or(-1) as i32;

    let favicon = status
        .get("favicon")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Ok(ServerStatus {
        motd,
        motd_raw,
        players_online,
        players_max,
        version_name,
        protocol,
        favicon,
        latency_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn varint_roundtrip_small() {
        let mut buf = Vec::new();
        write_varint(&mut buf, 0);
        assert_eq!(buf, vec![0x00]);
        buf.clear();
        write_varint(&mut buf, 127);
        assert_eq!(buf, vec![0x7F]);
    }

    #[test]
    fn varint_roundtrip_multi() {
        let mut buf = Vec::new();
        write_varint(&mut buf, 2147483647);
        assert_eq!(buf, vec![0xFF, 0xFF, 0xFF, 0xFF, 0x07]);
    }

    #[test]
    fn flatten_plain_text() {
        assert_eq!(
            flatten_motd(&serde_json::json!("hello world")),
            "hello world"
        );
    }

    #[test]
    fn flatten_component_tree() {
        let v = serde_json::json!({
            "text": "Pars ",
            "extra": [
                {"text": "Craft", "color": "red"},
                {"text": "!\nline2"}
            ]
        });
        assert_eq!(flatten_motd(&v), "Pars Craft ! line2");
    }

    #[test]
    fn flatten_strips_color_codes() {
        // §c is a single char (U+00A7) followed by 'c'; split+join collapses empties.
        let v = serde_json::json!("\u{00A7}cred");
        assert_eq!(flatten_motd(&v), "cred");
    }
}
