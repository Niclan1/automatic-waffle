//! MIDI is the portable practice source. Parsing, timing, synthesis and notation
//! preparation stay in Rust; platform players only output the prepared WAV.
use midly::{MetaMessage, MidiMessage, Smf, Timing, TrackEventKind};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
const RATE: u32 = 22050;
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub pitch: u8,
    pub velocity: u8,
    pub tick: u64,
    pub ticks: u64,
    pub start: f64,
    pub end: f64,
    pub track: usize,
}
pub struct Prepared {
    pub wav: Vec<u8>,
    pub audio: Value,
    pub notation: Value,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Lyric {
    pub tick: u64,
    pub text: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Song {
    pub lyrics: String,
    pub steps: String,
    pub credits: String,
    pub notes: String,
}
const SONG_PREFIX: &str = "VOLKSPELE_SONG_V1:";
fn escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
fn seconds(tick: u64, tempos: &[(u64, u32)], division: u16) -> f64 {
    let mut previous = 0;
    let mut tempo = 500_000;
    let mut result = 0.0;
    for &(at, value) in tempos {
        if at > tick {
            break;
        }
        result += (at - previous) as f64 * tempo as f64 / 1e6 / division as f64;
        previous = at;
        tempo = value;
    }
    result + (tick - previous) as f64 * tempo as f64 / 1e6 / division as f64
}
fn pitch_xml(p: u8, flats: bool) -> String {
    let names = if flats {
        [
            ("C", 0),
            ("D", -1),
            ("D", 0),
            ("E", -1),
            ("E", 0),
            ("F", 0),
            ("G", -1),
            ("G", 0),
            ("A", -1),
            ("A", 0),
            ("B", -1),
            ("B", 0),
        ]
    } else {
        [
            ("C", 0),
            ("C", 1),
            ("D", 0),
            ("D", 1),
            ("E", 0),
            ("F", 0),
            ("F", 1),
            ("G", 0),
            ("G", 1),
            ("A", 0),
            ("A", 1),
            ("B", 0),
        ]
    };
    let (step, alter) = names[p as usize % 12];
    format!(
        "<pitch><step>{step}</step><alter>{alter}</alter><octave>{}</octave></pitch>",
        p as i16 / 12 - 1
    )
}
fn xml_note(
    pitch: Option<u8>,
    ticks: u64,
    division: u16,
    flats: bool,
    tie_start: bool,
    tie_stop: bool,
) -> String {
    let ratio = ticks as f64 / division as f64;
    let (kind, dot) = if ratio >= 4.0 {
        ("whole", false)
    } else if ratio >= 3.0 {
        ("half", true)
    } else if ratio >= 2.0 {
        ("half", false)
    } else if ratio >= 1.5 {
        ("quarter", true)
    } else if ratio >= 1.0 {
        ("quarter", false)
    } else if ratio >= 0.75 {
        ("eighth", true)
    } else if ratio >= 0.5 {
        ("eighth", false)
    } else {
        ("16th", false)
    };
    let body = pitch
        .map(|p| pitch_xml(p, flats))
        .unwrap_or("<rest/>".into());
    format!("<note>{body}<duration>{ticks}</duration>{}{}<type>{kind}</type>{}<notations>{}{}</notations></note>",if tie_stop{"<tie type=\"stop\"/>"}else{""},if tie_start{"<tie type=\"start\"/>"}else{""},if dot{"<dot/>"}else{""},if tie_stop{"<tied type=\"stop\"/>"}else{""},if tie_start{"<tied type=\"start\"/>"}else{""})
}
fn music_xml(
    notes: &[Note],
    division: u16,
    beats: u8,
    denominator: u8,
    key: i8,
    title: &str,
    lyrics: &[Lyric],
) -> Option<String> {
    // Notation reconstruction is intentionally limited to monophonic MIDI. The
    // piano roll remains available for arbitrary overlapping/polyphonic notes.
    let mut ordered = notes.to_vec();
    ordered.sort_by_key(|n| n.tick);
    if ordered
        .windows(2)
        .any(|n| n[0].tick + n[0].ticks > n[1].tick)
    {
        return None;
    }
    let bar = division as u64 * 4 * beats as u64 / denominator as u64;
    if bar == 0 {
        return None;
    }
    let end = ordered.last().map(|n| n.tick + n.ticks).unwrap_or(0);
    let count = end.div_ceil(bar);
    let mut xml=format!("<?xml version=\"1.0\" encoding=\"UTF-8\"?><score-partwise version=\"4.0\"><work><work-title>{}</work-title></work><part-list><score-part id=\"P1\"><part-name>Oefenmelodie</part-name></score-part></part-list><part id=\"P1\">",escape(title));
    for index in 0..count {
        xml.push_str(&format!("<measure number=\"{}\">", index + 1));
        if index == 0 {
            xml.push_str(&format!("<attributes><divisions>{division}</divisions><key><fifths>{key}</fifths></key><time><beats>{beats}</beats><beat-type>{denominator}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>"));
        }
        let start = index * bar;
        let stop = start + bar;
        let mut at = start;
        for n in ordered
            .iter()
            .filter(|n| n.tick < stop && n.tick + n.ticks > start)
        {
            let begin = n.tick.max(start);
            let finish = (n.tick + n.ticks).min(stop);
            if begin > at {
                xml.push_str(&xml_note(None, begin - at, division, key < 0, false, false));
            }
            let mut note = xml_note(
                Some(n.pitch),
                finish - begin,
                division,
                key < 0,
                n.tick + n.ticks > stop,
                n.tick < start,
            );
            if begin == n.tick {
                if let Some(lyric) = lyrics.iter().find(|l| l.tick == n.tick) {
                    note = note.replace("</note>", &format!("<lyric><text>{}</text></lyric></note>", escape(&lyric.text)));
                }
            }
            xml.push_str(&note);
            at = finish;
        }
        if at < stop {
            xml.push_str(&xml_note(None, stop - at, division, key < 0, false, false));
        }
        xml.push_str("</measure>");
    }
    xml.push_str("</part></score-partwise>");
    Some(xml)
}
pub fn prepare(bytes: &[u8], title: &str) -> Result<Prepared, String> {
    if bytes.len() > 4_000_000 {
        return Err("MIDI is too large".into());
    }
    let smf = Smf::parse(bytes).map_err(|e| e.to_string())?;
    if smf.header.format == midly::Format::Sequential {
        return Err("Sequential MIDI tracks are unsupported".into());
    }
    let division = match smf.header.timing {
        Timing::Metrical(value) if value.as_int() > 0 => value.as_int(),
        _ => return Err("MIDI needs musical tick timing".into()),
    };
    if smf.tracks.len() > 64 {
        return Err("Too many MIDI tracks".into());
    }
    let mut tempos = vec![(0, 500_000)];
    let mut beats = 4;
    let mut denominator = 4;
    let mut key = 0;
    let mut raw = Vec::new();
    let mut lyrics = Vec::new();
    let mut song: Option<Song> = None;
    for (track, events) in smf.tracks.iter().enumerate() {
        let mut tick = 0u64;
        let mut open = HashMap::new();
        for event in events {
            tick = tick
                .checked_add(event.delta.as_int() as u64)
                .ok_or("MIDI tick overflow")?;
            match event.kind {
                TrackEventKind::Meta(MetaMessage::Lyric(text)) => {
                    let text = std::str::from_utf8(text).map_err(|_| "Invalid lyric encoding")?;
                    if text.len() > 512 || lyrics.len() >= 20_000 { return Err("MIDI lyrics are too large".into()); }
                    lyrics.push(Lyric { tick, text: text.into() });
                }
                TrackEventKind::Meta(MetaMessage::Text(text)) if text.starts_with(SONG_PREFIX.as_bytes()) => {
                    if song.is_some() || text.len() > 100_000 { return Err("Invalid song metadata".into()); }
                    song = Some(serde_json::from_slice(&text[SONG_PREFIX.len()..]).map_err(|e|e.to_string())?);
                }
                TrackEventKind::Meta(MetaMessage::Tempo(value)) => {
                    if value.as_int() == 0 {
                        return Err("Invalid MIDI tempo".into());
                    }
                    tempos.push((tick, value.as_int()));
                }
                TrackEventKind::Meta(MetaMessage::TimeSignature(n, d, _, _)) if tick == 0 => {
                    if n == 0 || n > 16 || d > 4 {
                        return Err("Unsupported MIDI time signature".into());
                    }
                    beats = n;
                    denominator = 1u8 << d;
                }
                TrackEventKind::Meta(MetaMessage::KeySignature(k, _)) if tick == 0 => {
                    if !(-7..=7).contains(&k) {
                        return Err("Invalid MIDI key".into());
                    }
                    key = k;
                }
                TrackEventKind::Midi { channel, message } => {
                    let channel = channel.as_int();
                    match message {
                        MidiMessage::NoteOn { key, vel } if vel.as_int() > 0 => {
                            if open
                                .insert((channel, key.as_int()), (tick, vel.as_int()))
                                .is_some()
                            {
                                return Err("Overlapping repeated MIDI key".into());
                            }
                        }
                        MidiMessage::NoteOff { key, .. } | MidiMessage::NoteOn { key, .. } => {
                            if let Some((begin, velocity)) = open.remove(&(channel, key.as_int())) {
                                if tick > begin {
                                    raw.push((key.as_int(), velocity, begin, tick, track));
                                    if raw.len() > 20_000 {
                                        return Err("Too many MIDI notes".into());
                                    }
                                }
                            }
                        }
                        _ => (),
                    }
                }
                _ => (),
            }
        }
        if !open.is_empty() {
            return Err("MIDI contains unfinished notes".into());
        }
    }
    if raw.is_empty() {
        return Err("MIDI has no notes".into());
    }
    tempos.sort_by_key(|t| t.0);
    let notes: Vec<Note> = raw
        .into_iter()
        .map(|(pitch, velocity, tick, end, track)| Note {
            pitch,
            velocity,
            tick,
            ticks: end - tick,
            start: seconds(tick, &tempos, division),
            end: seconds(end, &tempos, division),
            track,
        })
        .collect();
    let duration = notes.iter().map(|n| n.end).fold(0.0, f64::max) + 0.15;
    if !duration.is_finite() || duration > 300.0 {
        return Err("MIDI practice supports up to five minutes".into());
    }
    let mut samples = vec![0.0f32; (duration * RATE as f64).ceil() as usize];
    let mut work = 0u64;
    for n in &notes {
        let begin = (n.start * RATE as f64) as usize;
        let stop = (n.end * RATE as f64) as usize;
        work += (stop - begin) as u64;
        if work > 80_000_000 {
            return Err("MIDI is too dense".into());
        }
        let frequency = 440.0 * 2f64.powf((n.pitch as f64 - 69.0) / 12.0);
        let length = n.end - n.start;
        for (i, sample) in samples.iter_mut().enumerate().take(stop).skip(begin) {
            let t = (i - begin) as f64 / RATE as f64;
            let attack = (t / 0.008).min(1.0);
            let release = ((length - t) / 0.06).clamp(0.0, 1.0);
            let decay = (-2.2 * t).exp();
            let phase = 2.0 * std::f64::consts::PI * frequency * t;
            let tone = phase.sin() + 0.28 * (2.0 * phase).sin() + 0.1 * (3.0 * phase).sin();
            *sample += (tone * attack * release * decay * n.velocity as f64 / 127.0 * 0.3) as f32;
        }
    }
    let peak = samples.iter().map(|s| s.abs()).fold(1.0f32, f32::max);
    let waveform: Vec<f32> = samples
        .chunks(samples.len().div_ceil(96))
        .map(|c| c.iter().map(|s| s.abs() / peak).fold(0.0, f32::max))
        .collect();
    let size = (samples.len() * 2) as u32;
    let mut wav = Vec::with_capacity(size as usize + 44);
    wav.extend(b"RIFF");
    wav.extend((size + 36).to_le_bytes());
    wav.extend(b"WAVEfmt ");
    wav.extend(16u32.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(RATE.to_le_bytes());
    wav.extend((RATE * 2).to_le_bytes());
    wav.extend(2u16.to_le_bytes());
    wav.extend(16u16.to_le_bytes());
    wav.extend(b"data");
    wav.extend(size.to_le_bytes());
    for s in samples {
        wav.extend((((s / peak).clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
    }
    let low = notes.iter().map(|n| n.pitch).min().unwrap();
    let high = notes.iter().map(|n| n.pitch).max().unwrap();
    let roll:Vec<Value>=notes.iter().map(|n|json!({"x":n.start/duration*1000.0,"y":(high-n.pitch)as f64*12.0,"width":(n.end-n.start)/duration*1000.0,"height":10,"pitch":n.pitch,"start":n.start,"end":n.end})).collect();
    lyrics.sort_by_key(|l|l.tick);
    let timed_lyrics: Vec<_> = lyrics.iter().enumerate().map(|(i,l)|json!({"text":l.text,"start":seconds(l.tick,&tempos,division),"end":lyrics.get(i+1).map(|next|seconds(next.tick,&tempos,division)).unwrap_or(duration)})).collect();
    let notation = json!({"musicXml":music_xml(&notes,division,beats,denominator,key,title,&lyrics),"notes":notes,"roll":roll,"rollHeight":(high-low+1)as u32*12,"duration":duration,"lyrics":timed_lyrics});
    Ok(Prepared {
        wav,
        audio: json!({"duration":duration,"sampleRate":RATE,"channels":1,"waveform":waveform,"song":song}),
        notation,
    })
}
#[derive(Deserialize)]
pub struct Source {
    pub title: String,
    pub tempo: u32,
    pub key: i8,
    pub beats: u8,
    pub measures: Vec<Vec<(u8, u32)>>,
    #[serde(default)]
    pub lyrics: Vec<Lyric>,
    #[serde(default)]
    pub song: Option<Song>,
}
/// Publishing helper: curated melody transcription -> standard MIDI, then the
/// same production parser validates timing before anything is published.
pub fn encode(source: &Source) -> Result<Vec<u8>, String> {
    use midly::{
        num::{u15, u24, u28, u4, u7},
        Format, Header, TrackEvent,
    };
    if source.tempo < 30
        || source.tempo > 240
        || !(-7..=7).contains(&source.key)
        || source.beats == 0
        || source.beats > 16
    {
        return Err("Invalid score metadata".into());
    }
    let mut events = vec![
        TrackEvent {
            delta: 0.into(),
            kind: TrackEventKind::Meta(MetaMessage::TrackName(source.title.as_bytes())),
        },
        TrackEvent {
            delta: 0.into(),
            kind: TrackEventKind::Meta(MetaMessage::Tempo(u24::new(60_000_000 / source.tempo))),
        },
        TrackEvent {
            delta: 0.into(),
            kind: TrackEventKind::Meta(MetaMessage::TimeSignature(source.beats, 2, 24, 8)),
        },
        TrackEvent {
            delta: 0.into(),
            kind: TrackEventKind::Meta(MetaMessage::KeySignature(source.key, false)),
        },
    ];
    let mut rest = 0;
    for measure in &source.measures {
        if measure.iter().map(|n| n.1).sum::<u32>() != source.beats as u32 * 480 {
            return Err("Score measure has wrong duration".into());
        }
        for &(pitch, ticks) in measure {
            if ticks == 0 || pitch > 127 {
                return Err("Invalid score note".into());
            }
            if pitch == 0 {
                rest += ticks;
                continue;
            }
            events.push(TrackEvent {
                delta: u28::new(rest),
                kind: TrackEventKind::Midi {
                    channel: u4::new(0),
                    message: MidiMessage::NoteOn {
                        key: u7::new(pitch),
                        vel: u7::new(90),
                    },
                },
            });
            events.push(TrackEvent {
                delta: u28::new(ticks),
                kind: TrackEventKind::Midi {
                    channel: u4::new(0),
                    message: MidiMessage::NoteOff {
                        key: u7::new(pitch),
                        vel: u7::new(0),
                    },
                },
            });
            rest = 0;
        }
    }
    events.push(TrackEvent {
        delta: u28::new(rest),
        kind: TrackEventKind::Meta(MetaMessage::EndOfTrack),
    });
    // Merge standard MIDI lyric events with note events using absolute ticks.
    // Typed reference material travels inside this one downloadable MIDI file.
    let metadata = source.song.as_ref().map(|song| format!("{SONG_PREFIX}{}", serde_json::to_string(song).unwrap()));
    let mut tick = 0u64;
    let mut absolute: Vec<_> = events.into_iter().map(|e| {tick += e.delta.as_int() as u64;(tick,e.kind)}).collect();
    let end = tick;
    for lyric in &source.lyrics {
        if lyric.tick >= end || lyric.text.len() > 512 { return Err("Invalid source lyric timing".into()); }
        absolute.push((lyric.tick,TrackEventKind::Meta(MetaMessage::Lyric(lyric.text.as_bytes()))));
    }
    if let Some(text) = &metadata { absolute.push((0,TrackEventKind::Meta(MetaMessage::Text(text.as_bytes())))); }
    absolute.sort_by_key(|e|e.0);
    let mut previous = 0;
    let events = absolute.into_iter().map(|(at,kind)| {let delta = at-previous; previous=at; TrackEvent {delta:u28::new(delta as u32),kind}}).collect();
    let smf = Smf {
        header: Header {
            format: Format::SingleTrack,
            timing: Timing::Metrical(u15::new(480)),
        },
        tracks: vec![events],
    };
    let mut bytes = vec![];
    smf.write_std(&mut bytes).map_err(|e| e.to_string())?;
    prepare(&bytes, &source.title)?;
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(events: &[(u32, TrackEventKind<'static>)]) -> Vec<u8> {
        let smf = Smf {
            header: midly::Header {
                format: midly::Format::SingleTrack,
                timing: Timing::Metrical(480.into()),
            },
            tracks: vec![events.iter().map(|(delta, kind)| midly::TrackEvent {
                delta: (*delta).into(), kind: *kind,
            }).collect()],
        };
        let mut bytes = vec![];
        smf.write_std(&mut bytes).unwrap();
        bytes
    }
    fn note(pitch: u8, velocity: u8) -> TrackEventKind<'static> {
        TrackEventKind::Midi { channel: 0.into(), message: MidiMessage::NoteOn {
            key: pitch.into(), vel: velocity.into(),
        }}
    }
    #[test]
    fn tempo_change_inside_note_controls_audio_and_roll_timing() {
        let bytes = fixture(&[
            (0, note(60, 90)),
            (480, TrackEventKind::Meta(MetaMessage::Tempo(1_000_000.into()))),
            (480, note(60, 0)),
            (0, TrackEventKind::Meta(MetaMessage::EndOfTrack)),
        ]);
        let prepared = prepare(&bytes, "Tempo").unwrap();
        assert_eq!(prepared.notation["notes"][0]["start"], 0.0);
        assert_eq!(prepared.notation["notes"][0]["end"], 1.5);
        assert_eq!(prepared.notation["roll"][0]["end"], 1.5);
        assert!(prepared.audio["duration"].as_f64().unwrap() >= 1.5);
    }
    #[test]
    fn chords_play_and_render_roll_without_inventing_monophonic_notation() {
        let bytes = fixture(&[(0,note(60,90)),(0,note(64,90)),(480,note(60,0)),(0,note(64,0))]);
        let prepared = prepare(&bytes, "Chord").unwrap();
        assert_eq!(prepared.notation["notes"].as_array().unwrap().len(),2);
        assert_eq!(prepared.notation["roll"].as_array().unwrap().len(),2);
        assert!(prepared.notation["musicXml"].is_null());
        assert!(prepared.wav[44..].iter().any(|b| *b != 0));
    }
    #[test]
    fn unfinished_repeated_and_oversized_midi_are_rejected() {
        assert!(prepare(&fixture(&[(0,note(60,90))]), "Unfinished").is_err());
        assert!(prepare(&fixture(&[(0,note(60,90)),(10,note(60,90)),(480,note(60,0))]), "Overlap").is_err());
        assert!(prepare(&vec![0;4*1024*1024+1], "Too large").is_err());
    }
    #[test]
    fn midi_synthesis_and_notation() {
        let source = Source {
            title: "A & B".into(),
            tempo: 120,
            key: 2,
            beats: 4,
            measures: vec![vec![(60, 480), (62, 240), (64, 240), (65, 960)]],
            lyrics: vec![], song: None,
        };
        let bytes = encode(&source).unwrap();
        let prepared = prepare(&bytes, &source.title).unwrap();
        assert!(prepared.wav.starts_with(b"RIFF"));
        assert_eq!(prepared.notation["notes"].as_array().unwrap().len(), 4);
        assert!(prepared.notation["musicXml"]
            .as_str()
            .unwrap()
            .contains("A &amp; B"));
        assert!(prepared.wav[44..].iter().any(|b| *b != 0));
        assert!(prepare(b"bad", "Bad").is_err());
    }
    #[test]
    fn wrong_measure_rejected() {
        assert!(encode(&Source {
            title: "Bad".into(),
            tempo: 100,
            key: 0,
            beats: 4,
            measures: vec![vec![(60, 120)]]
            ,lyrics: vec![], song: None
        })
        .is_err());
    }
    #[test]
    fn lyric_midi_is_one_package_with_typed_content_and_notation() {
        let source = Source { title: "Song".into(), tempo:120,key:0,beats:4,
            measures:vec![vec![(60,480),(62,1440)]],
            lyrics:vec![Lyric{tick:0,text:"Sing & lees".into()},Lyric{tick:480,text:"saam".into()}],
            song:Some(Song{lyrics:"All supplied verses".into(),steps:"Dubbelkring".into(),credits:"Source".into(),notes:"Melody".into()}) };
        let bytes=encode(&source).unwrap();
        let prepared=prepare(&bytes,"Song").unwrap();
        assert_eq!(prepared.audio["song"]["steps"],"Dubbelkring");
        assert_eq!(prepared.notation["lyrics"][1]["start"],0.5);
        assert!(prepared.notation["musicXml"].as_str().unwrap().contains("<lyric><text>Sing &amp; lees</text></lyric>"));
        let smf=Smf::parse(&bytes).unwrap();
        assert_eq!(smf.tracks[0].iter().filter(|e|matches!(e.kind,TrackEventKind::Meta(MetaMessage::Lyric(_)))).count(),2);
    }
    #[test]
    fn published_transcriptions_are_reproducible() {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../content");
        for name in ["aanstap-rooies", "blinkvosperd"] {
            let source: Source = serde_json::from_slice(
                &std::fs::read(root.join(format!("scores/{name}.json"))).unwrap(),
            )
            .unwrap();
            assert_eq!(
                encode(&source).unwrap(),
                std::fs::read(root.join(format!("files/{name}/melody.mid"))).unwrap()
            );
        }
    }
}
