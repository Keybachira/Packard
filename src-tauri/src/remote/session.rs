use rand::Rng;
use std::time::{Duration, SystemTime};

/// How long a pairing session stays valid before the QR dies.
pub const SESSION_TTL: Duration = Duration::from_secs(10 * 60);

/// Hard cap on simultaneously connected remotes (MVP).
pub const MAX_REMOTES: usize = 3;

/// A pairing session: a 32-hex token plus its lifetime window.
#[derive(Debug, Clone)]
pub struct Session {
    pub token: String,
    pub expires_at: SystemTime,
}

impl Session {
    pub fn new() -> Self {
        let token = random_token();
        let now = SystemTime::now();
        Self {
            token,
            expires_at: now + SESSION_TTL,
        }
    }

    /// Constant-time-ish validity check: token must match exactly and not be
    /// expired.
    pub fn is_valid_token(&self, candidate: &str) -> bool {
        let expired = SystemTime::now() >= self.expires_at;
        !expired && self.token == candidate
    }

    pub fn time_remaining(&self) -> Duration {
        self.expires_at
            .duration_since(SystemTime::now())
            .unwrap_or(Duration::ZERO)
    }
}

impl Default for Session {
    fn default() -> Self {
        Self::new()
    }
}

/// 32 lowercase hex chars from a CSPRNG.
fn random_token() -> String {
    let bytes: [u8; 16] = rand::thread_rng().gen();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Render the pairing URL as an emerald SVG QR (MVP look).
pub fn qr_svg(url: &str) -> String {
    use qrcode::render::svg;
    use qrcode::QrCode;
    match QrCode::new(url.as_bytes()) {
        Ok(code) => code
            .render::<svg::Color>()
            .min_dimensions(256, 256)
            .dark_color(svg::Color("#10b981"))
            .light_color(svg::Color("#00000000"))
            .build(),
        Err(_) => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_32_hex_chars() {
        let s = Session::new();
        assert_eq!(s.token.len(), 32);
        assert!(s.token.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn tokens_are_unique() {
        let a = Session::new();
        let b = Session::new();
        assert_ne!(a.token, b.token);
    }

    #[test]
    fn fresh_session_validates() {
        let s = Session::new();
        assert!(s.is_valid_token(&s.token));
        assert!(!s.is_valid_token("ffffffffffffffffffffffffffffffff"));
    }

    #[test]
    fn expired_session_is_invalid() {
        let mut s = Session::new();
        s.expires_at = SystemTime::now() - Duration::from_secs(1);
        assert!(!s.is_valid_token(&s.token));
    }

    #[test]
    fn time_remaining_is_non_negative() {
        let mut s = Session::new();
        s.expires_at = SystemTime::now() - Duration::from_secs(5);
        assert_eq!(s.time_remaining(), Duration::ZERO);
    }

    #[test]
    fn qr_svg_renders() {
        let svg = qr_svg("http://192.168.0.10:38741/remote?t=abc");
        assert!(svg.contains("<svg"));
        assert!(svg.contains("#10b981"));
    }

    #[test]
    fn max_remotes_constant() {
        assert_eq!(MAX_REMOTES, 3);
    }
}
