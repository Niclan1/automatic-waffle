use std::{collections::HashMap, fs, io::{Read,Write}, path::{Path,PathBuf}, sync::{Arc,Mutex,OnceLock,atomic::{AtomicBool,AtomicU64,Ordering}}, time::{Duration,SystemTime,UNIX_EPOCH}};
use serde_json::{json,Value};
use catalog_core::domain;
type Result<T> = std::result::Result<T,String>;
struct Job {cancel:AtomicBool,progress:AtomicU64}
static JOBS:OnceLock<Mutex<HashMap<String,Arc<Job>>>>=OnceLock::new();
static METADATA:Mutex<()>=Mutex::new(());
fn jobs()->&'static Mutex<HashMap<String,Arc<Job>>>{JOBS.get_or_init(||Mutex::new(HashMap::new()))}
fn err(e:impl ToString)->String{e.to_string()}
fn request(suffix:&str,timeout:u64)->Result<reqwest::blocking::Response>{reqwest::blocking::Client::builder().timeout(Duration::from_secs(timeout)).redirect(reqwest::redirect::Policy::none()).build().map_err(err)?.get(format!("{}{suffix}",domain::BASE)).header("Cache-Control","no-cache").send().map_err(err)?.error_for_status().map_err(err)}
fn api(suffix:&str)->Result<String>{let mut text=String::new();request(suffix,20)?.take(4_000_001).read_to_string(&mut text).map_err(err)?;if text.len()>4_000_000{return Err("API response too large".into());}Ok(text)}
fn now()->u128{SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()}
fn write(path:&Path,bytes:&[u8])->Result<()>{fs::create_dir_all(path.parent().ok_or("Invalid path")?).map_err(err)?;let temporary=path.with_extension(format!("{}.partial",SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos()));fs::write(&temporary,bytes).map_err(err)?;let result=fs::rename(&temporary,path).map_err(err);if result.is_err(){let _=fs::remove_file(temporary);}result}
fn files(root:&Path)->Result<Vec<Value>>{match fs::read(root.join("saved.json")){Ok(bytes)=>serde_json::from_slice(&bytes).map_err(err),Err(e)if e.kind()==std::io::ErrorKind::NotFound=>Ok(vec![]),Err(e)=>Err(err(e))}}
fn saved(root:&Path,id:&str)->Result<Value>{files(root)?.into_iter().find(|f|f["asset"]["id"].as_str()==Some(id)).ok_or("Saved file is missing".into())}
fn path(root:&Path,record:&Value)->Result<PathBuf>{let asset=domain::asset(&record["asset"])?;Ok(root.join("content").join(asset.sha256))}
fn verified(root:&Path,record:&Value)->Result<PathBuf>{let path=path(root,record)?;let asset=domain::asset(&record["asset"])?;let file=fs::File::open(&path).map_err(err)?;if file.metadata().map_err(err)?.len()!=asset.bytes||catalog_core::hash_reader(file)?!=asset.sha256{return Err("Die gestoorde lêer is beskadig. Laai dit weer af.".into());}Ok(path)}
fn uri(path:&Path)->Result<String>{reqwest::Url::from_file_path(path).map(|u|u.to_string()).map_err(|_|"Invalid local path".into())}
struct Guard {id:String,path:PathBuf}
impl Drop for Guard{fn drop(&mut self){if let Ok(mut jobs)=jobs().lock(){jobs.remove(&self.id);}let _=fs::remove_file(&self.path);}}
fn download(root:&Path,asset_value:&Value)->Result<Value>{
 let asset=domain::asset(asset_value)?;let job=Arc::new(Job{cancel:AtomicBool::new(false),progress:AtomicU64::new(0)});
 {let mut jobs=jobs().lock().map_err(err)?;if jobs.contains_key(&asset.id){return Err("Download already running".into());}jobs.insert(asset.id.clone(),job.clone());}
 fs::create_dir_all(root.join("content")).map_err(err)?;let destination=root.join("content").join(&asset.sha256);let temp=destination.with_extension(format!("{}.partial",now()));let _guard=Guard{id:asset.id.clone(),path:temp.clone()};
 let mut response=request(&asset.path,120)?;let mut output=fs::File::create(&temp).map_err(err)?;let mut chunk=[0u8;65536];let mut total=0u64;
 loop{if job.cancel.load(Ordering::Relaxed){return Err("Aflaai gekanselleer".into());}let count=response.read(&mut chunk).map_err(err)?;if count==0{break;}total+=count as u64;if total>asset.bytes{return Err("Lêer is groter as die gepubliseerde grootte.".into());}output.write_all(&chunk[..count]).map_err(err)?;job.progress.store(total*100/asset.bytes,Ordering::Relaxed);}
 output.sync_all().map_err(err)?;drop(output);
 if total!=asset.bytes||catalog_core::hash_reader(fs::File::open(&temp).map_err(err)?)?!=asset.sha256{return Err("Lêer se integriteitskontrole het misluk. Probeer weer.".into());}
 if job.cancel.load(Ordering::Relaxed){return Err("Aflaai gekanselleer".into());}
 let _lock=METADATA.lock().map_err(err)?;let mut records=files(root)?;let old=records.iter().find(|f|f["asset"]["id"].as_str()==Some(&asset.id)).cloned();
 fs::rename(&temp,&destination).map_err(err)?;
 let record=json!({"asset":serde_json::to_value(&asset).map_err(err)?,"uri":uri(&destination)?,"savedAt":now().to_string()});records.retain(|f|f["asset"]["id"].as_str()!=Some(&asset.id));records.push(record.clone());
 if let Err(error)=write(&root.join("saved.json"),&serde_json::to_vec(&records).map_err(err)?){if !files(root)?.iter().any(|f|f["asset"]["sha256"].as_str()==Some(&asset.sha256)){let _=fs::remove_file(destination);}return Err(error);}
 if let Some(old)=old{let old_path=path(root,&old)?;if old_path!=destination&&!records.iter().any(|f|f["asset"]["sha256"]==old["asset"]["sha256"]){let _=fs::remove_file(old_path);}}Ok(record)
}
pub fn command(root:&str,request:&str)->Result<String>{
 let root=Path::new(root);if !root.is_absolute(){return Err("Storage root must be absolute".into());}
 fs::create_dir_all(root).map_err(err)?;let request:Value=serde_json::from_str(request).map_err(err)?;let id=request["id"].as_str().unwrap_or("");
 let result=match request["op"].as_str().unwrap_or(""){
  "catalog"=>{match api("api/v1/catalog.json").and_then(|raw|{let catalog=catalog_core::validate_catalog(&raw)?;write(&root.join("catalog.json"),raw.as_bytes())?;Ok(catalog)}){Ok(catalog)=>json!({"catalog":catalog,"offline":false}),Err(e)=>{let cached=fs::read_to_string(root.join("catalog.json")).map_err(|_|e)?;json!({"catalog":catalog_core::validate_catalog(&cached)?,"offline":true})}}},
  "release"=>domain::release(&api("api/v1/app.json")?,request["current"].as_str().ok_or("Missing current version")?)?,
  "files"=>{let _lock=METADATA.lock().map_err(err)?;json!(files(root)?)},
  "download"=>download(root,&request["asset"] )?,
  "remotePreview"=>{let asset=domain::asset(&request["asset"])?;if asset.kind!="image"||asset.bytes>10_000_000{return Err("Invalid welcome image".into());}let output=root.join("previews").join(&asset.sha256);if !output.exists()||catalog_core::hash_reader(fs::File::open(&output).map_err(err)?)?!=asset.sha256{let mut bytes=Vec::new();self::request(&asset.path,20)?.take(asset.bytes+1).read_to_end(&mut bytes).map_err(err)?;domain::verify(&asset,&bytes)?;write(&output,&bytes)?;}json!(uri(&output)?)},
  "progress"=>json!(jobs().lock().map_err(err)?.get(id).map(|j|j.progress.load(Ordering::Relaxed)).unwrap_or(0)),
  "cancel"=>{if let Some(job)=jobs().lock().map_err(err)?.get(id){job.cancel.store(true,Ordering::Relaxed);}Value::Null},
  "verify"=>json!(uri(&verified(root,&saved(root,id)?)?)?),
  "audioPreview"=>{let record=saved(root,id)?;if record["asset"]["kind"]!="audio"{return Err("Not an audio file".into());}catalog_core::audio::prepare(Box::new(fs::File::open(verified(root,&record)?).map_err(err)?))?},
  "text"=>{let record=saved(root,id)?;if record["asset"]["mime"]!="text/plain"{return Err("Not a text document".into());}json!(fs::read_to_string(verified(root,&record)?).map_err(err)?)},
  "remove"=>{let _lock=METADATA.lock().map_err(err)?;let mut records=files(root)?;let old=records.iter().find(|f|f["asset"]["id"].as_str()==Some(id)).cloned();records.retain(|f|f["asset"]["id"].as_str()!=Some(id));write(&root.join("saved.json"),&serde_json::to_vec(&records).map_err(err)?)?;if let Some(old)=old{if !records.iter().any(|f|f["asset"]["sha256"]==old["asset"]["sha256"]){let _=fs::remove_file(path(root,&old)?);}}Value::Null},
  "export"=>{let record=saved(root,id)?;let source=verified(root,&record)?;let extension=match record["asset"]["mime"].as_str().unwrap_or(""){"application/pdf"=>"pdf","image/jpeg"=>"jpg","image/png"=>"png","image/webp"=>"webp","audio/mpeg"=>"mp3","audio/wav"=>"wav","audio/ogg"=>"ogg","video/mp4"=>"mp4","video/webm"=>"webm","text/plain"=>"txt",_=>"bin"};let output=root.join("exports").join(format!("{}.{}",record["asset"]["sha256"].as_str().ok_or("Missing hash")?,extension));fs::create_dir_all(output.parent().unwrap()).map_err(err)?;fs::copy(source,&output).map_err(err)?;json!({"uri":uri(&output)?,"mime":record["asset"]["mime"],"title":record["asset"]["title"]})},
  _=>domain::command(&request)?
 };Ok(result.to_string())
}
#[cfg(test)]mod tests{use super::*;#[test]fn native_storage_integrity_and_removal(){let root=std::env::temp_dir().join(format!("volkspele-test-{}",now()));fs::create_dir_all(root.join("content")).unwrap();let bytes=b"abc";let hash=catalog_core::hash_bytes(bytes);let asset=json!({"id":"test","title":"Test","kind":"lyrics","mime":"text/plain","bytes":3,"sha256":hash,"path":format!("content/{hash}"),"version":"1.0.0"});let record=json!({"asset":asset,"uri":uri(&root.join("content").join(&hash)).unwrap(),"savedAt":"1"});write(&root.join("saved.json"),&json!([record]).to_string().into_bytes()).unwrap();fs::write(root.join("content").join(&hash),bytes).unwrap();let call=|op|command(root.to_str().unwrap(),&json!({"op":op,"id":"test"}).to_string());assert_eq!(call("text").unwrap(),"\"abc\"");fs::write(root.join("content").join(&hash),b"bad").unwrap();assert!(call("verify").is_err());call("remove").unwrap();assert_eq!(call("files").unwrap(),"[]");fs::remove_dir_all(root).unwrap();}}
