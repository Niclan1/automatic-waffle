use wasm_bindgen::{prelude::*, JsCast};
use wasm_bindgen_futures::JsFuture;
use js_sys::{Array, Function, Promise, Reflect, Uint8Array};
use serde_json::{json, Value};
use crate::domain;
fn error(e: impl ToString) -> JsValue {JsValue::from_str(&e.to_string())}
fn js(value: &Value) -> Result<JsValue,JsValue> {js_sys::JSON::parse(&value.to_string())}
fn value(v: &JsValue) -> Result<Value,JsValue> {serde_json::from_str(&js_sys::JSON::stringify(v)?.as_string().ok_or_else(||error("Invalid JSON"))?).map_err(error)}
async fn host_call(host: &JsValue, name: &str, args: &[JsValue]) -> Result<JsValue,JsValue> {
    let function: Function = Reflect::get(host,&name.into())?.dyn_into()?;
    let array=Array::new();for arg in args {array.push(arg);}
    JsFuture::from(Promise::resolve(&function.apply(host,&array)?)).await
}
async fn response(url: &str, signal: Option<&web_sys::AbortSignal>) -> Result<web_sys::Response,JsValue> {
    let init=web_sys::RequestInit::new();init.set_cache(web_sys::RequestCache::NoStore);init.set_signal(signal);
    let request=web_sys::Request::new_with_str_and_init(url,&init)?;
    let result: web_sys::Response=JsFuture::from(web_sys::window().ok_or_else(||error("No browser window"))?.fetch_with_request(&request)).await?.dyn_into()?;
    if !result.ok() {return Err(error(format!("HTTP {}",result.status())));}
    Ok(result)
}
async fn text(url: &str) -> Result<String,JsValue> {
    let class=Reflect::get(&js_sys::global(),&"AbortSignal".into())?;
    let timeout:Function=Reflect::get(&class,&"timeout".into())?.dyn_into()?;
    let signal:web_sys::AbortSignal=timeout.call1(&class,&15000.into())?.dyn_into()?;
    let result=JsFuture::from(response(url,Some(&signal)).await?.text()?).await?.as_string().ok_or_else(||error("Invalid response"))?;
    if result.len()>4_000_000 {return Err(error("API response too large"));}Ok(result)
}
fn endpoint(base: &str, suffix: &str) -> Result<String,JsValue> {
    if !base.ends_with('/') || !(base.starts_with("https://") || base.starts_with("http://127.0.0.1:") || base.starts_with("http://localhost:")) {return Err(error("Invalid content base"));}
    Ok(format!("{base}{suffix}"))
}
#[wasm_bindgen]
pub fn domain_command(request: &str) -> Result<String,JsValue> {
    let request=serde_json::from_str(request).map_err(error)?;
    domain::command(&request).map(|v|v.to_string()).map_err(error)
}
#[wasm_bindgen]
pub fn media_command(media: &web_sys::HtmlMediaElement, request: &str) -> Result<String,JsValue> {
    let mut request:Value=serde_json::from_str(request).map_err(error)?;
    request["op"]=json!("playback");request["position"]=json!(media.current_time());request["duration"]=json!(if media.duration().is_finite(){media.duration()}else{0.0});request["playing"]=json!(!media.paused());
    let state=domain::command(&request).map_err(error)?;
    media.set_playback_rate(state["speed"].as_f64().unwrap());media.set_loop(state["loop"].as_bool().unwrap());
    if let Some(time)=state["seek"].as_f64(){media.set_current_time(time);}
    match state["transport"].as_str(){Some("play")=>{let _=media.play()?;},Some("pause")=>media.pause()?,_=>()}
    Ok(state.to_string())
}
#[wasm_bindgen]
pub async fn browser_command(request: &str, host: JsValue, signal: JsValue, progress: Option<Function>) -> Result<JsValue,JsValue> {
    let request:Value=serde_json::from_str(request).map_err(error)?;
    match request["op"].as_str().unwrap_or("") {
        "catalog"=>{
            let base=request["base"].as_str().ok_or_else(||error("Missing base"))?;
            let fresh=async {let raw=text(&endpoint(base,"api/v1/catalog.json")?).await?; let catalog=crate::validate_catalog(&raw).map_err(error)?; let catalog=js(&serde_json::to_value(catalog).map_err(error)?)?;host_call(&host,"putCatalog",&[catalog.clone()]).await?;Ok::<_,JsValue>(catalog)}.await;
            match fresh {Ok(catalog)=>{let result=js(&json!({"offline":false}))?;Reflect::set(&result,&"catalog".into(),&catalog)?;Ok(result)},Err(failure)=>{let cached=host_call(&host,"getCatalog",&[]).await?;if cached.is_undefined()||cached.is_null(){return Err(failure);}crate::validate_catalog(&value(&cached)?.to_string()).map_err(error)?;let result=js(&json!({"offline":true}))?;Reflect::set(&result,&"catalog".into(),&cached)?;Ok(result)}}
        },
        "release"=>js(&domain::release(&text(&endpoint(request["base"].as_str().ok_or_else(||error("Missing base"))?,"api/v1/app.json")?).await?,request["current"].as_str().ok_or_else(||error("Missing version"))?).map_err(error)?),
        "files"=>host_call(&host,"allFiles",&[]).await,
        "download"|"remotePreview"=>{
            let asset=domain::asset(&request["asset"]).map_err(error)?;
            let response=response(&endpoint(request["base"].as_str().ok_or_else(||error("Missing base"))?,&asset.path)?,signal.dyn_ref()).await?;
            let reader:web_sys::ReadableStreamDefaultReader=response.body().ok_or_else(||error("No response stream"))?.get_reader().dyn_into()?;
            let mut bytes=Vec::new();
            let read=async {loop {let chunk=JsFuture::from(reader.read()).await?;if Reflect::get(&chunk,&"done".into())?.as_bool()==Some(true){break;}let data=Uint8Array::new(&Reflect::get(&chunk,&"value".into())?);if bytes.len()as u64+data.length()as u64>asset.bytes{return Err(error("Lêer is groter as die gepubliseerde grootte."));}bytes.extend(data.to_vec());if let Some(callback)=&progress{let _=callback.call1(&JsValue::NULL,&((bytes.len()as f64/asset.bytes as f64*100.0).round()).into());}}Ok::<_,JsValue>(())}.await;
            if let Err(e)=read{let _=JsFuture::from(reader.cancel()).await;return Err(e);}
            domain::verify(&asset,&bytes).map_err(error)?;
            if signal.dyn_ref::<web_sys::AbortSignal>().is_some_and(|s|s.aborted()){return Err(error("Aflaai gekanselleer"));}
            if request["op"]=="remotePreview" {let parts=Array::new();parts.push(&Uint8Array::from(bytes.as_slice()));let options=web_sys::BlobPropertyBag::new();options.set_type(&asset.mime);return Ok(web_sys::Blob::new_with_u8_array_sequence_and_options(&parts,&options)?.into());}
            let old=host_call(&host,"getFile",&[asset.id.clone().into()]).await?;
            let saved=js(&json!({"asset":serde_json::to_value(&asset).map_err(error)?,"savedAt":js_sys::Date::new_0().to_iso_string().as_string()}))?;
            if let Err(failure)=host_call(&host,"saveFile",&[saved.clone(),Uint8Array::from(bytes.as_slice()).into()]).await{let _=collect(&host,&asset.sha256).await;return Err(failure);}
            if !old.is_undefined()&&!old.is_null(){let old=value(&old)?;let hash=old["asset"]["sha256"].as_str().unwrap_or("");if hash!=asset.sha256{collect(&host,hash).await?;}}
            Ok(saved)
        },
        "verify"|"preview"=>{
            let record=host_call(&host,"getFile",&[request["id"].as_str().ok_or_else(||error("Missing file ID"))?.into()]).await?;
            if record.is_undefined(){return Err(error("Saved file is missing"));}
            let asset=domain::asset(&value(&record)?["asset"]).map_err(error)?;
            let bytes=Uint8Array::new(&host_call(&host,"readFile",&[record]).await?).to_vec();domain::verify(&asset,&bytes).map_err(error)?;
            let parts=Array::new();parts.push(&Uint8Array::from(bytes.as_slice()));let options=web_sys::BlobPropertyBag::new();options.set_type(&asset.mime);
            let blob:JsValue=web_sys::Blob::new_with_u8_array_sequence_and_options(&parts,&options)?.into();
            if request["op"]=="preview" {let audio=if asset.kind=="audio"{crate::audio::prepare(Box::new(std::io::Cursor::new(bytes.clone()))).map_err(error)?}else{Value::Null};let result=js(&json!({"audio":audio}))?;Reflect::set(&result,&"bytes".into(),&Uint8Array::from(bytes.as_slice()))?;if asset.mime=="text/plain"{Reflect::set(&result,&"text".into(),&String::from_utf8(bytes).map_err(error)?.into())?;}Reflect::set(&result,&"blob".into(),&blob)?;Ok(result)}else{Ok(blob)}
        },
        "remove"=>{
            let id=request["id"].as_str().ok_or_else(||error("Missing file ID"))?;let old=host_call(&host,"getFile",&[id.into()]).await?;host_call(&host,"deleteFile",&[id.into()]).await?;if !old.is_undefined(){let old=value(&old)?;collect(&host,old["asset"]["sha256"].as_str().ok_or_else(||error("Missing hash"))?).await?;}Ok(JsValue::UNDEFINED)
        },
        _=>Err(error("Unknown browser operation"))
    }
}
async fn collect(host:&JsValue,hash:&str)->Result<(),JsValue>{let saved=value(&host_call(host,"allFiles",&[]).await?)?;if !saved.as_array().ok_or_else(||error("Invalid saved files"))?.iter().any(|s|s["asset"]["sha256"].as_str()==Some(hash)){host_call(host,"deleteBytes",&[hash.into()]).await?;}Ok(())}
