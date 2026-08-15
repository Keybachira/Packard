use crate::remote::hub::RemoteHub;
use crate::remote::lanip;
use crate::remote::protocol::{RemoteCommand, RemoteEvent};
use crate::remote::snapshot;
use crate::AppState;
use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{header, StatusCode, Uri};
use axum::response::Response;
use axum::routing::get;
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use rand::Rng;
use std::collections::HashMap;
use std::path::Path as FsPath;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Emitter, Manager};

/// Port range tried (in order) until the first free port wins.
const PORT_START: u16 = 38741;
const PORT_END: u16 = 38751;

/// App state injected into every axum handler.
#[derive(Clone)]
struct ServerState {
    hub: Arc<RemoteHub>,
    app: tauri::AppHandle,
    dist_dir: Option<PathBuf>,
}

/// Result of starting the remote server, enough to render the desktop page.
/// Kept as a return value so `start` can be composed/traced by tests.
#[allow(dead_code)]
pub struct RemoteStart {
    pub lan_ip: Option<String>,
    pub port: u16,
    pub hub: Arc<RemoteHub>,
}

/// Start the HTTP + WebSocket remote server. Binds the first free port in
/// `[PORT_START..=PORT_END]` synchronously (so the QR reflects the real port),
/// then serves under the Tauri runtime.
pub fn start(app: &tauri::AppHandle) -> Result<RemoteStart, String> {
    let state = app.state::<AppState>();
    let hub = Arc::clone(&state.remote);

    let (listener, port) = bind_free()?;
    let dist_dir = resolve_dist_dir(app);

    let server_state = ServerState {
        hub: Arc::clone(&hub),
        app: app.clone(),
        dist_dir,
    };

    tauri::async_runtime::spawn(async move {
        match listener.set_nonblocking(true) {
            Ok(()) => match tokio::net::TcpListener::from_std(listener) {
                Ok(listener) => {
                    let router = build_router(server_state);
                    if let Err(e) = axum::serve(listener, router).await {
                        eprintln!("remote server error: {e}");
                    }
                }
                Err(e) => eprintln!("remote server error: {e}"),
            },
            Err(e) => eprintln!("remote server error: {e}"),
        }
    });

    hub.set_port(Some(port));
    Ok(RemoteStart {
        lan_ip: lanip::lan_ip(),
        port,
        hub,
    })
}

/// Every second, while anything is actually playing, push a `state.playback`
/// patch so the phone's seek bar keeps moving without a full snapshot.
pub fn start_position_ticker(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(std::time::Duration::from_secs(1));
        loop {
            ticker.tick().await;
            let state = app.state::<AppState>();
            let playing = state
                .music
                .lock()
                .map(|m| m.playback.playing)
                .unwrap_or(false);
            if !playing {
                continue;
            }
            let playback = snapshot::playback_remote(&state);
            state
                .remote
                .broadcast(RemoteEvent::StatePlayback { playback });
        }
    });
}

fn bind_free() -> Result<(std::net::TcpListener, u16), String> {
    for port in PORT_START..=PORT_END {
        if let Ok(listener) = std::net::TcpListener::bind(("0.0.0.0", port)) {
            return Ok((listener, port));
        }
    }
    Err(format!("nenhuma porta livre na faixa {PORT_START}-{PORT_END}"))
}

fn build_router(state: ServerState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/ws", get(ws_handler))
        .route("/remote/{*path}", get(remote_page))
        .fallback(remote_fallback)
        .with_state(state)
}

// --- Routes ----------------------------------------------------------------

async fn health() -> Response {
    json_response(
        StatusCode::OK,
        r#"{"ok":true,"name":"Packard SoundCore"}"#,
    )
}

async fn remote_page(
    State(state): State<ServerState>,
    Path(path): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    serve_remote(&state, &path, query.get("t").map(|s| s.as_str()))
}

/// Catches the bare `/remote` path (and rejects anything else unmatched).
async fn remote_fallback(
    State(state): State<ServerState>,
    uri: Uri,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let path = uri.path();
    if path == "/remote" || path == "/" {
        serve_remote(&state, "", query.get("t").map(|s| s.as_str()))
    } else {
        not_found()
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<ServerState>,
    Query(query): Query<HashMap<String, String>>,
) -> Response {
    let token = query.get("t").cloned().unwrap_or_default();
    let session = state.hub.session();
    if !session.is_valid_token(&token) {
        return Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .body(Body::from("sessão inválida ou expirada"))
            .unwrap();
    }
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

// --- Static file serving ----------------------------------------------------

fn serve_remote(state: &ServerState, path: &str, token: Option<&str>) -> Response {
    let Some(dist) = &state.dist_dir else {
        return text_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "remote-app ainda não foi construído",
        );
    };

    let Some(clean) = sanitize_path(path) else {
        return not_found();
    };

    let is_index = clean.is_empty() || clean == "index.html";
    if is_index {
        match token {
            Some(t) if state.hub.session().is_valid_token(t) => {}
            _ => return expired_response(),
        }
    }

    let rel = if clean.is_empty() { "index.html" } else { &clean };
    let full = dist.join(rel);
    match std::fs::read(&full) {
        Ok(bytes) => {
            let ctype = content_type(rel);
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, ctype)
                .header(header::CACHE_CONTROL, "no-cache")
                .body(Body::from(bytes))
                .unwrap()
        }
        Err(_) => not_found(),
    }
}

/// Reject traversal and leading slashes; empty path means "index".
fn sanitize_path(path: &str) -> Option<String> {
    let p = path.trim_start_matches('/');
    if p.split('/').any(|seg| seg == "..") {
        return None;
    }
    Some(p.to_string())
}

fn content_type(path: &str) -> &'static str {
    match FsPath::new(path)
        .extension()
        .and_then(|e| e.to_str())
    {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("ico") => "image/x-icon",
        Some("json") => "application/json",
        Some("webmanifest") => "application/manifest+json",
        Some("woff2") => "font/woff2",
        Some("wasm") => "application/wasm",
        _ => "application/octet-stream",
    }
}

// --- WebSocket ---------------------------------------------------------------

async fn handle_socket(socket: WebSocket, state: ServerState) {
    let (mut sink, mut stream) = socket.split();
    let remote_id: String = random_id();

    if let Err(message) = state.hub.add_client(&remote_id) {
        let _ = send_event(&mut sink, RemoteEvent::Error { message }).await;
        let _ = sink.close().await;
        return;
    }

    let _ = state.app.emit("remote::connected", remote_id.clone());
    let _ = send_event(&mut sink, RemoteEvent::EventPaired { remote_id: remote_id.clone() }).await;

    let app_state = state.app.state::<AppState>();
    let snapshot = snapshot::snapshot_state(&app_state);
    let _ = send_event(&mut sink, RemoteEvent::StateSnapshot { state: snapshot }).await;

    let mut rx = state.hub.subscribe();
    loop {
        tokio::select! {
            incoming = stream.next() => match incoming {
                Some(Ok(msg)) => {
                    let keep = handle_ws_message(&state, msg).await;
                    if !keep {
                        break;
                    }
                }
                Some(Err(_)) | None => break,
            },
            outbound = rx.recv() => match outbound {
                Ok(RemoteEvent::SystemDisconnect) => {
                    let _ = send_event(&mut sink, RemoteEvent::SystemDisconnect).await;
                    let _ = sink.close().await;
                    break;
                }
                Ok(event) => {
                    if send_event(&mut sink, event).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            },
        }
    }

    state.hub.remove_client(&remote_id);
    let _ = state.app.emit("remote::disconnected", remote_id);
}

async fn handle_ws_message(state: &ServerState, msg: Message) -> bool {
    let text = match msg {
        Message::Text(text) => text.to_string(),
        Message::Close(_) => return false,
        Message::Binary(_) | Message::Ping(_) | Message::Pong(_) => return true,
    };

    let command: Result<RemoteCommand, _> = serde_json::from_str(&text);
    let command = match command {
        Ok(c) => c,
        Err(_) => {
            state.hub.broadcast(RemoteEvent::Error {
                message: "comando inválido".into(),
            });
            return true;
        }
    };

    let app_state = state.app.state::<AppState>();
    match command {
        RemoteCommand::VolumeSet { value } => {
            apply_volume(state, |_| value);
        }
        RemoteCommand::VolumeIncrement => apply_volume(state, |cur| cur + 5.0),
        RemoteCommand::VolumeDecrement => apply_volume(state, |cur| cur - 5.0),
        RemoteCommand::VolumeMute => apply_mute(state, true),
        RemoteCommand::VolumeUnmute => apply_mute(state, false),
        RemoteCommand::PlayerPlay => {
            if let Err(e) = crate::player_play_impl(&app_state) {
                state.hub.broadcast(RemoteEvent::Error { message: e });
            }
        }
        RemoteCommand::PlayerPause => {
            if let Err(e) = crate::player_pause_impl(&app_state) {
                state.hub.broadcast(RemoteEvent::Error { message: e });
            }
        }
        RemoteCommand::PlayerNext => {
            if let Err(e) = crate::player_next_impl(&app_state) {
                state.hub.broadcast(RemoteEvent::Error { message: e });
            }
        }
        RemoteCommand::PlayerPrevious => {
            if let Err(e) = crate::player_previous_impl(&app_state) {
                state.hub.broadcast(RemoteEvent::Error { message: e });
            }
        }
        RemoteCommand::SystemPing => {}
        RemoteCommand::StateRequest => {}
        RemoteCommand::SystemDisconnect => return false,
    }

    crate::broadcast_remote(&app_state);
    true
}

fn apply_volume(state: &ServerState, f: impl FnOnce(f32) -> f32) {
    let app_state = state.app.state::<AppState>();
    if let Some(id) = snapshot::active_device_id(&app_state) {
        let current = snapshot::volume_of(&app_state, &id);
        if let Err(e) = crate::set_volume_impl(&app_state, &id, f(current)) {
            state.hub.broadcast(RemoteEvent::Error { message: e });
        }
    }
}

fn apply_mute(state: &ServerState, muted: bool) {
    let app_state = state.app.state::<AppState>();
    if let Some(id) = snapshot::active_device_id(&app_state) {
        if let Err(e) = crate::set_mute_impl(&app_state, &id, muted) {
            state.hub.broadcast(RemoteEvent::Error { message: e });
        }
    }
}

async fn send_event(
    sink: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    event: RemoteEvent,
) -> Result<(), ()> {
    let text = serde_json::to_string(&event).map_err(|_| ())?;
    sink.send(Message::Text(text.into())).await.map_err(|_| ())
}

fn random_id() -> String {
    let bytes: [u8; 6] = rand::thread_rng().gen();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

// --- Helpers ----------------------------------------------------------------

/// Dev: `src-tauri/../remote-app/dist`. Release: bundled resource resolved
/// via `resource_dir()`. Returns the first candidate that has an `index.html`.
fn resolve_dist_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(manifest) = std::env::var("CARGO_MANIFEST_DIR") {
        candidates.push(PathBuf::from(manifest).join("../remote-app/dist"));
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join("remote-app/dist"));
        candidates.push(resources.join("remote-app"));
    }
    candidates
        .into_iter()
        .find(|p| p.join("index.html").is_file())
}

fn json_response(status: StatusCode, body: &'static str) -> Response {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body))
        .unwrap()
}

fn text_response(status: StatusCode, body: &'static str) -> Response {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(Body::from(body))
        .unwrap()
}

fn expired_response() -> Response {
    text_response(
        StatusCode::FORBIDDEN,
        "Sessão expirada. Abra o SoundCore no PC e gere um novo QR Code.",
    )
}

fn not_found() -> Response {
    text_response(StatusCode::NOT_FOUND, "não encontrado")
}
