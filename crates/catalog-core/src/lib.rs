use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
pub mod domain;
pub mod audio;
#[cfg(target_arch = "wasm32")] mod browser;
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset { pub id: String, pub title: String, pub kind: String, pub path: String, pub sha256: String, pub bytes: u64, pub mime: String, pub version: String }
#[derive(Deserialize, Serialize)]
pub struct Entry { pub id: String, pub title: String, pub category: String, pub number: Option<u32>, pub description: String, pub assets: Vec<Asset> }
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog { pub schema_version: u32, pub version: String, pub entries: Vec<Entry> }
pub fn hash_bytes(data: &[u8]) -> String { format!("{:x}", Sha256::digest(data)) }
#[cfg(not(target_arch = "wasm32"))]
pub fn hash_reader(mut reader: impl std::io::Read) -> Result<String, String> {
    let mut hash = Sha256::new(); let mut chunk = [0_u8; 65536];
    loop { let count = reader.read(&mut chunk).map_err(|e|e.to_string())?; if count == 0 { break; } hash.update(&chunk[..count]); }
    Ok(format!("{:x}", hash.finalize()))
}
pub fn validate_catalog(text: &str) -> Result<Catalog, String> {
    let c: Catalog = serde_json::from_str(text).map_err(|e| e.to_string())?;
    if c.schema_version != 1 { return Err("Unsupported catalog schema".into()); }
    semver::Version::parse(&c.version).map_err(|e| e.to_string())?;
    let mut ids = std::collections::HashSet::new();
    let mut entries = std::collections::HashSet::new();
    for e in &c.entries {
        if e.id.is_empty() || !entries.insert(&e.id) { return Err("Duplicate/empty entry ID".into()); }
        for a in &e.assets {
            if a.id.is_empty() || !ids.insert(&a.id) { return Err("Duplicate/empty asset ID".into()); }
            if a.sha256.len() != 64 || !a.sha256.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) { return Err("Invalid SHA-256".into()); }
            if a.path != format!("content/{}", a.sha256) { return Err("Asset path must match content hash".into()); }
            if a.bytes == 0 || a.bytes > 250_000_000 { return Err("Invalid file size".into()); }
            if !["video", "audio", "lyrics", "steps", "document", "image", "sheet"].contains(&a.kind.as_str()) { return Err("Unknown asset kind".into()); }
            let allowed = match a.kind.as_str() { "sheet" => ["application/pdf","image/jpeg","image/png","image/webp"].as_slice(), "image" => ["image/jpeg","image/png","image/webp"].as_slice(), "video" => ["video/mp4","video/webm"].as_slice(), "audio" => ["audio/mpeg","audio/ogg","audio/wav"].as_slice(), _ => ["text/plain","application/pdf"].as_slice() };
            if !allowed.contains(&a.mime.as_str()) { return Err("Unsupported asset MIME type".into()); }
            semver::Version::parse(&a.version).map_err(|e| e.to_string())?;
        }
    }
    Ok(c)
}
pub fn newer(current: &str, latest: &str) -> Result<bool, String> {
    let current = semver::Version::parse(current.trim_start_matches('v')).map_err(|e| e.to_string())?;
    let latest = semver::Version::parse(latest.trim_start_matches('v')).map_err(|e| e.to_string())?;
    Ok(latest.pre.is_empty() && latest > current)
}
#[cfg(target_arch = "wasm32")]
mod wasm {
    use super::*;
    use wasm_bindgen::prelude::*;
    use wasm_bindgen_futures::JsFuture;
    fn error(e: impl ToString) -> JsValue { JsValue::from_str(&e.to_string()) }
    #[wasm_bindgen]
    pub fn sha256(data: &[u8]) -> String { hash_bytes(data) }
    #[wasm_bindgen]
    pub fn parse_catalog(text: &str) -> Result<String, JsValue> { serde_json::to_string(&validate_catalog(text).map_err(error)?).map_err(error) }
    #[wasm_bindgen]
    pub fn is_newer(current: &str, latest: &str) -> Result<bool, JsValue> { newer(current, latest).map_err(error) }
    #[wasm_bindgen]
    pub async fn fetch_catalog(url: &str) -> Result<String, JsValue> {
        let init = web_sys::RequestInit::new();
        init.set_cache(web_sys::RequestCache::NoStore);
        let request = web_sys::Request::new_with_str_and_init(url, &init)?;
        let window = web_sys::window().ok_or_else(|| error("Window unavailable"))?;
        let response = JsFuture::from(window.fetch_with_request(&request)).await?.dyn_into::<web_sys::Response>()?;
        if !response.ok() { return Err(error(format!("Catalog HTTP {}", response.status()))); }
        let text = JsFuture::from(response.text()?).await?.as_string().ok_or_else(|| error("Invalid response"))?;
        parse_catalog(&text)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn hash_known_vector() { assert_eq!(hash_bytes(b"abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"); }
    #[test] fn versions_are_semantic() { assert!(newer("1.9.0", "v1.10.0").unwrap()); assert!(!newer("1.0.0", "1.1.0-beta.1").unwrap()); assert!(!newer("2.0.0", "1.0.0").unwrap()); assert!(newer("bad", "1.0.0").is_err()); }
    #[test] fn unsupported_schema_rejected() { assert!(validate_catalog(r#"{"schemaVersion":2,"version":"1.0.0","entries":[]}"#).is_err()); }
    #[test] fn traversal_rejected() {
        let a = serde_json::json!({"schemaVersion":1,"version":"1.0.0","entries":[{"id":"a","title":"a","category":"dance","description":"","assets":[{"id":"x","title":"x","kind":"video","path":"../secret","sha256":"a".repeat(64),"bytes":3,"mime":"video/mp4","version":"1.0.0"}]}]});
        assert!(validate_catalog(&a.to_string()).is_err());
    }
}
