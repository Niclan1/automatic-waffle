fn main() -> Result<(), String> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 3 {
        return Err("Usage: score source.json output.mid".into());
    }
    let source: catalog_core::midi::Source =
        serde_json::from_slice(&std::fs::read(&args[1]).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let bytes = catalog_core::midi::encode(&source)?;
    std::fs::write(&args[2], bytes).map_err(|e| e.to_string())
}
