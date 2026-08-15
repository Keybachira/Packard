/// Best-effort LAN IP discovery for the pairing QR.
pub fn lan_ip() -> Option<String> {
    local_ip_address::local_ip()
        .ok()
        .map(|ip| ip.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lan_ip_parses_as_ip() {
        if let Some(ip) = lan_ip() {
            assert!(ip.parse::<std::net::IpAddr>().is_ok());
        }
    }
}
