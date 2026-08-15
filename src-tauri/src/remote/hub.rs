use crate::remote::protocol::RemoteEvent;
use crate::remote::session::{Session, MAX_REMOTES};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;

/// Shared state connecting the desktop's mutating commands to every connected
/// mobile remote:
///
/// - `session`: the current pairing token + TTL.
/// - `clients`: ids of connected remotes (capped at `MAX_REMOTES`).
/// - `tx`: a `broadcast` channel the server sends `RemoteEvent`s through.
///
/// Held in `AppState` as `Arc<RemoteHub>` so the Tauri commands and the axum
/// WS tasks write through the exact same path.
pub struct RemoteHub {
    session: Mutex<Session>,
    clients: Mutex<Vec<String>>,
    tx: broadcast::Sender<RemoteEvent>,
    port: Mutex<Option<u16>>,
}

impl RemoteHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            session: Mutex::new(Session::new()),
            clients: Mutex::new(Vec::new()),
            tx: broadcast::channel(1024).0,
            port: Mutex::new(None),
        })
    }

    pub fn session(&self) -> Session {
        self.session
            .lock()
            .map(|s| s.clone())
            .unwrap_or_else(|_| Session::new())
    }

    /// Create a fresh session, disconnect every connected remote (their socket
    /// tasks receive `SystemDisconnect` and close), and clear the client list.
    pub fn regenerate(&self) -> Session {
        let session = Session::new();
        if let Ok(mut s) = self.session.lock() {
            *s = session.clone();
        }
        let _ = self.tx.send(RemoteEvent::SystemDisconnect);
        if let Ok(mut c) = self.clients.lock() {
            c.clear();
        }
        session
    }

    pub fn disconnect_all(&self) {
        let _ = self.regenerate();
    }

    pub fn add_client(&self, id: &str) -> Result<(), String> {
        let mut clients = self
            .clients
            .lock()
            .map_err(|_| "hub state poisoned".to_string())?;
        if clients.len() >= MAX_REMOTES {
            return Err(format!("máximo de {MAX_REMOTES} remotes conectados"));
        }
        clients.push(id.to_string());
        Ok(())
    }

    pub fn remove_client(&self, id: &str) {
        if let Ok(mut clients) = self.clients.lock() {
            clients.retain(|c| c != id);
        }
    }

    pub fn connected_ids(&self) -> Vec<String> {
        self.clients
            .lock()
            .map(|c| c.clone())
            .unwrap_or_default()
    }

    pub fn max_remotes(&self) -> usize {
        MAX_REMOTES
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RemoteEvent> {
        self.tx.subscribe()
    }

    /// Fire an event at every connected remote. Swallows send errors — if no
    /// receiver is left the message simply disappears.
    pub fn broadcast(&self, event: RemoteEvent) {
        let _ = self.tx.send(event);
    }

    pub fn set_port(&self, port: Option<u16>) {
        if let Ok(mut p) = self.port.lock() {
            *p = port;
        }
    }

    pub fn port(&self) -> Option<u16> {
        self.port.lock().ok().and_then(|p| *p)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn broadcast_reaches_subscriber() {
        let hub = RemoteHub::new();
        let mut rx = hub.subscribe();
        hub.broadcast(RemoteEvent::Error { message: "test".into() });
        let received = rx.try_recv().unwrap();
        assert!(matches!(received, RemoteEvent::Error { .. }));
    }

    #[test]
    fn add_client_respects_max_remotes() {
        let hub = RemoteHub::new();
        for i in 0..MAX_REMOTES {
            assert!(hub.add_client(&format!("c{i}")).is_ok());
        }
        assert!(hub.add_client("overflow").is_err());
    }

    #[test]
    fn remove_client_releases_slot() {
        let hub = RemoteHub::new();
        assert!(hub.add_client("c1").is_ok());
        hub.remove_client("c1");
        assert!(hub.add_client("c2").is_ok());
    }

    #[test]
    fn regenerate_clears_clients_and_rotates_token() {
        let hub = RemoteHub::new();
        let old = hub.session().token;
        hub.add_client("c1").unwrap();
        let fresh = hub.regenerate();
        assert_ne!(fresh.token, old);
        assert!(hub.connected_ids().is_empty());
    }
}
