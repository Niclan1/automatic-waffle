import { useEffect, useRef, useState } from 'react';
import type { Asset, Entry, Saved, Playback, AudioPreview } from '../lib/types';
import { filePreview, prepareLesson, mediaCommand, domain, openVideo } from '../lib/library';
import { MidiScore } from './MidiScore';
import { SheetMusic } from './SheetMusic';
export function Practice({ entry, files, onError }: { entry: Entry; files: Saved[]; onError: (error: string) => void }) {
  const [loaded, setLoaded] = useState<Record<string, { url: string; text?: string; audio?: AudioPreview; bytes?:Uint8Array }>>({});
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    setLoaded({});
    void Promise.all(prepareLesson(entry,files).records.map(async saved => {
      const a=saved.asset;
      const {blob,text,audio,bytes}=await filePreview(saved);
      if (!alive) return;
      const url = URL.createObjectURL(blob); urls.push(url);
      if (alive) setLoaded(previous => ({ ...previous, [a.id]: { url, text, audio, bytes } }));
    })).catch(e => { if (alive) onError(String(e)); });
    return () => { alive = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [entry, files]);
  const { audio, sheet, video, instructions:steps, links } = prepareLesson(entry,files);
  const pending = (asset: Asset | undefined, label: string) => <p className="practice-pending">{asset ? `Laai ${label} hieronder af om dit hier en vanlyn te gebruik.` : `${label} word voorberei. Die bronlêer is nog nie gepubliseer nie.`}</p>;
  const prepared=audio && loaded[audio.id]?.audio;
  const song=prepared?.song;
  return <section className="practice">
    <div className="practice-heading"><span className="eyebrow">LUISTER · LEES · KYK · OEFEN</span><h2>Leer hierdie dans</h2><p>Een liedjie, met sy woorde, bladmusiek en passies saam.</p></div>
    <div className="practice-audio"><h3>Luister na die liedjie</h3>{audio && loaded[audio.id] ? <PracticeMedia key={loaded[audio.id].url} url={loaded[audio.id].url} kind="audio" preview={prepared}/> : pending(audio,'die liedjie')}</div>
    <details className="practice-panel"><summary>Bladmusiek</summary>{prepared?.midi && <MidiScore notation={prepared.midi}/>} {sheet && loaded[sheet.id] && <SheetMusic data={loaded[sheet.id].bytes} url={loaded[sheet.id].url} title={sheet.title}/>} {!prepared?.midi && !loaded[sheet?.id ?? ''] && pending(audio,'die liedjie')}</details>
    <details className="practice-panel"><summary>Liedjie woorde</summary>{song ? <pre>{song.lyrics}</pre> : steps.filter(a=>a.kind==='lyrics').map(a=><pre key={a.id}>{loaded[a.id]?.text}</pre>)}</details>
    <details className="practice-panel"><summary>Passies &amp; grepe</summary>{song ? <pre>{song.steps}</pre> : steps.filter(a=>a.kind==='steps').map(a=><pre key={a.id}>{loaded[a.id]?.text}</pre>)}</details>
    <details className="practice-panel"><summary>Dansdemonstrasie</summary>{video && loaded[video.id] ? <PracticeMedia url={loaded[video.id].url} kind="video"/> : links.map(link=><p key={link.url}><button className="button button-outline" onClick={()=>void openVideo(link.url).catch(e=>onError(String(e)))}>{link.title} ↗</button><small> YouTube · internet nodig.</small></p>)}</details>
    {song && <details className="practice-panel"><summary>Bronne en transkripsie</summary><pre>{song.credits}{'\n\n'}{song.notes}</pre></details>}
  </section>;
}
export function PracticeMedia({ url, kind, autoPlay = false, preview }: { url: string; kind: 'audio' | 'video'; autoPlay?: boolean; preview?:AudioPreview }) {
  const [position,setPosition]=useState(0);
  const media = useRef<HTMLMediaElement | null>(null);
  const [state,setState] = useState<Playback>(()=>domain<Playback>({op:"playback",action:"init"}));
  const command = (action:string,extras:object={}) => {if(media.current)setState(mediaCommand(media.current,state,action,extras));};
  useEffect(() => { const target=media.current; if(autoPlay && target) setState(mediaCommand(target,state,'play')); return () => {if(target)mediaCommand(target,state,'pause');}; }, [url,autoPlay]);
  const lyric=preview?.midi?.lyrics && domain<{text:string}>({op:'lyricAt',lyrics:preview.midi.lyrics,position});
  return <div className="practice-media">{lyric?.text && <p className="sing-along" aria-label="Sing saam">{lyric.text}</p>}{preview && <div className="waveform" aria-label="Klankgolf">{preview.waveform.map((peak,i)=><span key={i} style={{height:`${Math.max(2,peak*100)}%`}}/>)}</div>}{kind === 'audio' ? <audio ref={e => { media.current = e; }} aria-label="Liedjie speler" controls onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} src={url}/> : <video ref={e => { media.current = e; }} aria-label="Dansvideo speler" controls onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} src={url}/>}{preview?.midi && <div className="piano-roll"><svg viewBox={`0 0 1000 ${preview.midi.rollHeight}`} role="img" aria-label="Spelende MIDI klavierrol">{preview.midi.roll.map((n,i)=><rect key={i} x={n.x} y={n.y} width={n.width} height={n.height} rx={2}/>)}<line x1={position/preview.duration*1000} x2={position/preview.duration*1000} y1={0} y2={preview.midi.rollHeight} stroke="#b46d34" strokeWidth={3}/></svg></div>}<div className="practice-controls"><label>Spoed <select aria-label={kind === 'audio' ? 'Liedjie spoed' : 'Dansvideo spoed'} value={state.speed} onChange={e => command('speed',{value:Number(e.target.value)})}>{[0.5, 0.75, 1, 1.25].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label><label><input type="checkbox" checked={state.loop} onChange={e => command('loop',{value:e.target.checked})}/>Herhaal</label><button className="button button-outline" onClick={() => command('restart')}>Begin weer</button></div></div>;
}
