use serde_json::{json, Value};
use crate::{Asset, validate_catalog, hash_bytes};
pub const BASE: &str = "https://niclan1.github.io/automatic-waffle/";
pub fn asset(value: &Value) -> Result<Asset, String> {
    let catalog = json!({"schemaVersion":1,"version":"1.0.0","entries":[{"id":"validation","title":"","category":"dance","description":"","assets":[value]}]}).to_string();
    validate_catalog(&catalog)?.entries.remove(0).assets.pop().ok_or("Missing asset".into())
}
pub fn verify(asset: &Asset, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() as u64 != asset.bytes || hash_bytes(bytes) != asset.sha256 { return Err("Lêer se integriteitskontrole het misluk. Probeer weer.".into()); }
    Ok(())
}
pub fn release_url(url: &str) -> bool { let prefix = "https://github.com/Niclan1/automatic-waffle/releases"; url == prefix || url.starts_with(&format!("{prefix}/")) }
pub fn release(text: &str, current: &str) -> Result<Value,String> {
    let value: Value = serde_json::from_str(text).map_err(|e|e.to_string())?;
    let version = value["version"].as_str().ok_or("Missing release version")?;
    let url = value["url"].as_str().ok_or("Missing release URL")?;
    if !release_url(url) { return Err("Invalid release URL".into()); }
    Ok(if crate::newer(current,version)? { json!({"version":version,"url":url}) } else { Value::Null })
}
pub fn command(request: &Value) -> Result<Value,String> {
    match request["op"].as_str().unwrap_or("") {
        "catalogView" => {
            let catalog = validate_catalog(&request["catalog"].to_string())?;
            let category = request["category"].as_str().unwrap_or("");
            let query = request["query"].as_str().unwrap_or("").to_lowercase();
            let entries: Vec<_> = catalog.entries.iter().filter(|e|e.category == category && format!("{} {}",e.title,e.description).to_lowercase().contains(&query)).collect();
            let assets: Vec<_> = catalog.entries.iter().flat_map(|e|&e.assets).collect();
            let saved = request["files"].as_array().cloned().unwrap_or_default();
            let outdated: Vec<_> = saved.iter().filter(|f|assets.iter().any(|a|Some(a.id.as_str())==f["asset"]["id"].as_str() && Some(a.sha256.as_str())!=f["asset"]["sha256"].as_str())).collect();
            Ok(json!({"entries":entries,"assets":assets,"outdated":outdated,"totalBytes":saved.iter().filter_map(|f|f["asset"]["bytes"].as_u64()).sum::<u64>()}))
        },
        "lesson" => {
            let entry = &request["entry"];
            let assets = entry["assets"].as_array().ok_or("Missing lesson assets")?;
            let files=request["files"].as_array().cloned().unwrap_or_default();
            let records:Vec<_>=files.iter().filter(|f|assets.iter().any(|a|a["id"]==f["asset"]["id"])).collect();
            let pick = |kind: &str|assets.iter().find(|a|a["kind"].as_str()==Some(kind)).cloned().unwrap_or(Value::Null);
            Ok(json!({"audio":pick("audio"),"sheet":pick("sheet"),"video":pick("video"),"records":records,"instructions":assets.iter().filter(|a|matches!(a["kind"].as_str(),Some("steps"|"lyrics"))).collect::<Vec<_>>() }))
        },
        "external" => {
            let url = request["url"].as_str().ok_or("Missing URL")?;
            let allowed=match request["kind"].as_str(){Some("release")=>release_url(url),Some("official")=>url=="https://volkspele.co.za/avvb/",_=>release_url(url)||url=="https://volkspele.co.za/avvb/"};
            if !allowed { return Err("Unapproved external URL".into()); }
            Ok(json!(url))
        },
        "assetState" => {
            let asset=&request["asset"];
            let files=request["files"].as_array().cloned().unwrap_or_default();
            let record=files.iter().find(|f|f["asset"]["id"]==asset["id"]).cloned().unwrap_or(Value::Null);
            Ok(json!({"updated":!record.is_null() && record["asset"]["sha256"]!=asset["sha256"],"record":record}))
        },
        "exportName" => {
            let asset=asset(&request["asset"])?;
            let title:String=asset.title.chars().filter(|c|c.is_alphanumeric() || matches!(c,' '|'_'|'-')).collect();
            let extension=match asset.mime.as_str(){"application/pdf"=>"pdf","image/jpeg"=>"jpg","image/png"=>"png","image/webp"=>"webp","audio/mpeg"=>"mp3","audio/wav"=>"wav","audio/ogg"=>"ogg","video/mp4"=>"mp4","video/webm"=>"webm","text/plain"=>"txt",_=>"bin"};
            Ok(json!(format!("{title}.{extension}")))
        },
        "playback" => {
            let mut speed = request["state"]["speed"].as_f64().unwrap_or(1.0);
            let mut looping = request["state"]["loop"].as_bool().unwrap_or(false);
            let mut playing = request["state"]["playing"].as_bool().unwrap_or(false);
            let position = request["position"].as_f64().unwrap_or(0.0).max(0.0);
            let duration = request["duration"].as_f64().unwrap_or(0.0).max(0.0);
            let mut seek = Value::Null;
            let mut transport = Value::Null;
            match request["action"].as_str().unwrap_or("init") {
                "speed" => speed = request["value"].as_f64().ok_or("Missing speed")?,
                "nextSpeed" => speed = if speed == 0.5 {0.75} else if speed == 0.75 {1.0} else {0.5},
                "loop" => looping = request["value"].as_bool().unwrap_or(!looping),
                "play" => {playing=true;transport=json!("play");},
                "pause" => {playing=false;transport=json!("pause");},
                "toggle" => {playing=!request["playing"].as_bool().unwrap_or(playing);transport=json!(if playing {"play"} else {"pause"});},
                "restart" => seek=json!(0.0),
                "back" => seek=json!((position-10.0).max(0.0)),
                "forward" => seek=json!((position+10.0).min(duration)),
                "init" => (),
                _ => return Err("Unknown playback action".into())
            }
            if ![0.5,0.75,1.0,1.25].contains(&speed) { return Err("Unsupported playback speed".into()); }
            Ok(json!({"speed":speed,"loop":looping,"playing":playing,"seek":seek,"transport":transport}))
        },
        _ => Err("Unknown domain command".into())
    }
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn playback_bounds_and_rate() {assert_eq!(command(&json!({"op":"playback","action":"back","position":4})) .unwrap()["seek"].as_f64(),Some(0.0)); assert!(command(&json!({"op":"playback","action":"speed","value":20})).is_err());}
    #[test] fn release_policy() {assert!(release(r#"{"version":"9.0.0","url":"https://evil.example/"}"#,"1.0.0").is_err()); assert!(release(r#"{"version":"1.0.0","url":"https://github.com/Niclan1/automatic-waffle/releases/latest"}"#,"1.0.0").unwrap().is_null());}
}
