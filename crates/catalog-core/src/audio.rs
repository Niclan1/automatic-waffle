//! Decode and prepare audio in Rust; platform players are output adapters.
use symphonia::core::{audio::SampleBuffer, codecs::DecoderOptions, errors::Error, formats::FormatOptions, io::{MediaSource, MediaSourceStream}, meta::MetadataOptions, probe::Hint};
use serde_json::{json,Value};
pub fn prepare(source:Box<dyn MediaSource>)->Result<Value,String>{
 let stream=MediaSourceStream::new(source,Default::default());
 let mut format=symphonia::default::get_probe().format(&Hint::new(),stream,&FormatOptions::default(),&MetadataOptions::default()).map_err(|e|e.to_string())?.format;
 let track=format.default_track().ok_or("No audio track")?;
 let id=track.id;
 let mut decoder=symphonia::default::get_codecs().make(&track.codec_params,&DecoderOptions::default()).map_err(|e|e.to_string())?;
 let mut rate=0;let mut channels=0;let mut total=0usize;let mut bucket=0usize;let mut peak=0f32;let mut peaks=Vec::<f32>::new();
 loop {
  let packet=match format.next_packet(){Ok(packet)=>packet,Err(Error::IoError(e))if e.kind()==std::io::ErrorKind::UnexpectedEof=>break,Err(e)=>return Err(e.to_string())};
  if packet.track_id()!=id{continue;}
  let decoded=decoder.decode(&packet).map_err(|e|e.to_string())?;let spec=*decoded.spec();
  if rate!=0&&(rate!=spec.rate||channels!=spec.channels.count()){return Err("Audio format changes are unsupported".into());}
  rate=spec.rate;channels=spec.channels.count();if channels==0||rate==0{return Err("Invalid audio format".into());}
  let mut buffer=SampleBuffer::<f32>::new(decoded.capacity()as u64,spec);buffer.copy_interleaved_ref(decoded);
  for frame in buffer.samples().chunks(channels){for sample in frame{peak=peak.max(sample.abs().min(1.0));}total+=1;bucket+=1;if bucket>=rate as usize/10{peaks.push(peak);peak=0.0;bucket=0;}}
  if total>rate as usize*60*30{return Err("Audio preview supports songs up to 30 minutes".into());}
 }
 if bucket>0{peaks.push(peak);}if total==0||rate==0{return Err("Empty audio".into());}
 let step=peaks.len().div_ceil(96).max(1);let waveform:Vec<f32>=peaks.chunks(step).map(|p|p.iter().copied().fold(0.0,f32::max)).collect();
 Ok(json!({"duration":total as f64/rate as f64,"sampleRate":rate,"channels":channels,"waveform":waveform}))
}
#[cfg(test)]mod tests{use super::*;#[test]fn rust_decodes_wav(){let mut wav=vec![0u8;44+160];wav[0..4].copy_from_slice(b"RIFF");wav[4..8].copy_from_slice(&196u32.to_le_bytes());wav[8..16].copy_from_slice(b"WAVEfmt ");wav[16..20].copy_from_slice(&16u32.to_le_bytes());wav[20..22].copy_from_slice(&1u16.to_le_bytes());wav[22..24].copy_from_slice(&1u16.to_le_bytes());wav[24..28].copy_from_slice(&8000u32.to_le_bytes());wav[28..32].copy_from_slice(&16000u32.to_le_bytes());wav[32..34].copy_from_slice(&2u16.to_le_bytes());wav[34..36].copy_from_slice(&16u16.to_le_bytes());wav[36..40].copy_from_slice(b"data");wav[40..44].copy_from_slice(&160u32.to_le_bytes());let result=prepare(Box::new(std::io::Cursor::new(wav))).unwrap();assert_eq!(result["sampleRate"],8000);assert_eq!(result["duration"].as_f64(),Some(0.01));assert!(prepare(Box::new(std::io::Cursor::new(b"bad".to_vec()))).is_err());}}
