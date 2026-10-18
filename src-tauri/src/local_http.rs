use crate::desktop_log;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::sleep;

async fn fetch_status(path: &str, port: u16) -> Option<(u16, String)> {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).await.ok()?;
    let req = format!(
        "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
    );
    stream.write_all(req.as_bytes()).await.ok()?;
    let mut buf = Vec::new();
    stream.read_to_end(&mut buf).await.ok()?;
    let text = String::from_utf8_lossy(&buf);
    let status = text
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|s| s.parse().ok())?;
    let body = text
        .split_once("\r\n\r\n")
        .map(|(_, b)| b.to_string())
        .unwrap_or_default();
    Some((status, body))
}

/// Block until localhost HTTP serves health + index (WebView2 loads after this).
pub async fn wait_until_http_ready(port: u16) -> Result<(), String> {
    for attempt in 1..=200 {
        let health = fetch_status("/api/health", port).await;
        let root = fetch_status("/", port).await;
        let ready = match (&health, &root) {
            (Some((200, _)), Some((200, body))) => {
                body.contains("Excalidraw")
                    || body.contains("<!DOCTYPE")
                    || body.contains("<html")
            }
            _ => false,
        };
        if ready {
            desktop_log::info(&format!(
                "localhost HTTP ready on port {port} (attempt {attempt})"
            ));
            return Ok(());
        }
        if attempt == 1 || attempt % 20 == 0 {
            let h = health.as_ref().map(|(s, _)| *s);
            let r = root.as_ref().map(|(s, b)| (*s, b.len()));
            desktop_log::warn(&format!(
                "waiting for HTTP on port {port} (attempt {attempt}) health={h:?} root={r:?}"
            ));
        }
        sleep(Duration::from_millis(50)).await;
    }
    Err(format!("timed out waiting for HTTP on port {port}"))
}
