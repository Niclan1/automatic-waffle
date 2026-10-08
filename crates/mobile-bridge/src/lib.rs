use base64::Engine;
mod runtime;
use std::ffi::{CStr, CString, c_char};
fn envelope(result: Result<String, String>) -> String {
    match result { Ok(value) => serde_json::json!({"ok":true,"value":value}), Err(error) => serde_json::json!({"ok":false,"error":error}) }.to_string()
}
fn parse(text: &str) -> Result<String, String> {
    serde_json::to_string(&catalog_core::validate_catalog(text)?).map_err(|e|e.to_string())
}
fn sha(text: &str) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(text).map_err(|e|e.to_string())?;
    Ok(catalog_core::hash_bytes(&bytes))
}
fn sha_file(uri: &str) -> Result<String, String> {
    let url = reqwest::Url::parse(uri).map_err(|e|e.to_string())?;
    let path = url.to_file_path().map_err(|_|"Expected a local file URI".to_string())?;
    let file = std::fs::File::open(path).map_err(|e|e.to_string())?;
    catalog_core::hash_reader(file)
}
fn fetch(url: &str) -> Result<String, String> {
    if url != "https://niclan1.github.io/automatic-waffle/api/v1/catalog.json" { return Err("Unapproved catalog endpoint".into()); }
    let client = reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(20)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|e.to_string())?;
    let response = client.get(url).header("Cache-Control", "no-cache").send().map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?;
    use std::io::Read;
    let mut text = String::new(); response.take(4_000_001).read_to_string(&mut text).map_err(|e|e.to_string())?;
    if text.len() > 4_000_000 { return Err("Catalog too large".into()); }
    parse(&text)
}
fn version(current: &str, latest: &str) -> Result<String, String> { Ok(catalog_core::newer(current, latest)?.to_string()) }
fn c_output(result: Result<String, String>) -> *mut c_char { CString::new(envelope(result)).expect("JSON contains no null bytes").into_raw() }
unsafe fn c_input<'a>(input: *const c_char) -> Result<&'a str, String> { if input.is_null() { return Err("Null argument".into()); } CStr::from_ptr(input).to_str().map_err(|e|e.to_string()) }
#[no_mangle] pub unsafe extern "C" fn rust_parse_catalog(input: *const c_char) -> *mut c_char { c_output(c_input(input).and_then(parse)) }
#[no_mangle] pub unsafe extern "C" fn rust_sha256_base64(input: *const c_char) -> *mut c_char { c_output(c_input(input).and_then(sha)) }
#[no_mangle] pub unsafe extern "C" fn rust_sha256_file(input: *const c_char) -> *mut c_char { c_output(c_input(input).and_then(sha_file)) }
#[no_mangle] pub unsafe extern "C" fn rust_fetch_catalog(input: *const c_char) -> *mut c_char { c_output(c_input(input).and_then(fetch)) }
#[no_mangle] pub unsafe extern "C" fn rust_is_newer(current: *const c_char, latest: *const c_char) -> *mut c_char { c_output(c_input(current).and_then(|c| c_input(latest).and_then(|l|version(c,l)))) }
#[no_mangle] pub unsafe extern "C" fn rust_free_string(output: *mut c_char) { if !output.is_null() { drop(CString::from_raw(output)); } }
#[no_mangle] pub unsafe extern "C" fn rust_command(root: *const c_char, request: *const c_char) -> *mut c_char { c_output(c_input(root).and_then(|root|c_input(request).and_then(|request|runtime::command(root,request)))) }
#[no_mangle] pub unsafe extern "C" fn rust_domain(request: *const c_char) -> *mut c_char { c_output(c_input(request).and_then(|r|serde_json::from_str(r).map_err(|e|e.to_string())).and_then(|r|catalog_core::domain::command(&r).map(|v|v.to_string()))) }
#[cfg(target_os = "android")]
mod android {
    use super::*;
    use jni::{JNIEnv, objects::{JObject,JString}, sys::jstring};
    fn input(env: &mut JNIEnv, s: &JString) -> Result<String,String> { env.get_string(s).map(|s|s.into()).map_err(|e|e.to_string()) }
    fn output(env: &mut JNIEnv, result: Result<String,String>) -> jstring { env.new_string(envelope(result)).map(|s|s.into_raw()).unwrap_or(std::ptr::null_mut()) }
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_command(mut env: JNIEnv, _: JObject, root: JString, request: JString) -> jstring {let result=input(&mut env,&root).and_then(|root|input(&mut env,&request).and_then(|request|runtime::command(&root,&request)));output(&mut env,result)}
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_domain(mut env: JNIEnv, _: JObject, request: JString) -> jstring {let result=input(&mut env,&request).and_then(|request|serde_json::from_str(&request).map_err(|e|e.to_string())).and_then(|request|catalog_core::domain::command(&request).map(|v|v.to_string()));output(&mut env,result)}
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_fetchCatalog(mut env: JNIEnv, _: JObject, s: JString) -> jstring { let result=input(&mut env,&s).and_then(|s|fetch(&s)); output(&mut env,result) }
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_parseCatalog(mut env: JNIEnv, _: JObject, s: JString) -> jstring { let result=input(&mut env,&s).and_then(|s|parse(&s)); output(&mut env,result) }
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_sha256Base64(mut env: JNIEnv, _: JObject, s: JString) -> jstring { let result=input(&mut env,&s).and_then(|s|sha(&s)); output(&mut env,result) }
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_sha256File(mut env: JNIEnv, _: JObject, s: JString) -> jstring { let result=input(&mut env,&s).and_then(|s|sha_file(&s)); output(&mut env,result) }
    #[no_mangle] pub extern "system" fn Java_expo_modules_rustlogic_NativeLogic_isNewer(mut env: JNIEnv, _: JObject, c: JString, l: JString) -> jstring { let result=input(&mut env,&c).and_then(|c|input(&mut env,&l).and_then(|l|version(&c,&l))); output(&mut env,result) }
}
#[cfg(test)] mod tests {
  use super::*;
  #[test] fn bridge_hash_matches_core() { assert_eq!(sha("YWJj").unwrap(),catalog_core::hash_bytes(b"abc")); }
  #[test] fn invalid_base64_is_error_envelope() { let s=envelope(sha("bad!")); assert!(s.contains("\"ok\":false")); }
  #[test] fn endpoint_is_restricted() { assert!(fetch("https://example.com/private").is_err()); }
}
