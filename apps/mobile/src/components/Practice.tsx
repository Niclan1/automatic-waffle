import {MidiScore} from './MidiScore';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { readText, verifiedFile, playback, domain,prepareLesson, audioPreview, openVideo, type NativeSaved } from '../library';
import type { Asset, Entry, AudioPreview } from '../../../../src/lib/types';
import { SheetMusic } from './SheetMusic';
const textStyle = { color: '#526d4a', fontSize: 13, lineHeight: 23 };
const heading = { color: '#283f30', fontSize: 24, marginVertical: 12 };
function Control({ title, onPress }: { title: string; onPress: () => void }) { return <Pressable accessibilityRole="button" onPress={onPress} style={{ padding: 11, backgroundColor: '#eef2e9', borderRadius: 6 }}><Text style={textStyle}>{title}</Text></Pressable>; }
export function SongPlayer({ uri, autoPlay = false, preview }: { uri: string; autoPlay?: boolean; preview?:AudioPreview }) {
  const player = useAudioPlayer(uri), status = useAudioPlayerStatus(player);
  const [state,setState] = useState(() => playback(undefined,'init'));
  const command=(action:string)=>{const next=playback(state,action,{position:status.currentTime,duration:status.duration,playing:status.playing});player.setPlaybackRate(next.speed);player.loop=next.loop;if(next.seek!==null)void player.seekTo(next.seek);if(next.transport)player[next.transport]();setState(next);};
  useEffect(() => {if(autoPlay && status.isLoaded)command('play');},[player,autoPlay,status.isLoaded]);
  const lyric=preview?.midi?.lyrics && domain<{text:string}>({op:'lyricAt',lyrics:preview.midi.lyrics,position:status.currentTime});
  return <View style={{ gap: 12 }}>{lyric?.text && <Text accessibilityLabel="Sing saam" style={heading}>{lyric.text}</Text>}{preview && <View accessibilityLabel="Klankgolf" style={{height:44,flexDirection:"row",alignItems:"center",gap:2}}>{preview.waveform.map((peak,i)=><View key={i} style={{flex:1,height:Math.max(2,peak*44),backgroundColor:"#174e43"}}/>)}</View>}{preview?.midi && <View accessibilityLabel="Spelende MIDI klavierrol" style={{height:preview.midi.rollHeight,backgroundColor:"#e8ede3",overflow:"hidden"}}>{preview.midi.roll.map((note,i)=><View key={i} style={{position:"absolute",left:`${note.x/10}%`,top:note.y,width:`${note.width/10}%`,height:note.height,backgroundColor:"#174e43",borderRadius:2}}/>)}<View style={{position:"absolute",left:`${status.currentTime/preview.duration*100}%`,top:0,bottom:0,width:2,backgroundColor:"#b46d34"}}/></View>}<Text style={textStyle}>{Math.floor(status.currentTime)} / {Math.floor(status.duration)} sekondes</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Control title={status.playing ? 'Pouseer' : 'Speel musiek'} onPress={() => command('toggle')}/><Control title="Begin weer" onPress={() => command('restart')}/><Control title={`Spoed ${state.speed}x`} onPress={() => command('nextSpeed')}/><Control title={state.loop ? 'Herhaal: aan' : 'Herhaal: af'} onPress={() => command('loop')}/></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Control title="10 sekondes terug" onPress={() => command('back')}/><Control title="10 sekondes vorentoe" onPress={() => command('forward')}/></View></View>;
}
export function DanceVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  const [state,setState] = useState(() => playback(undefined,'init'));
  const command=(action:string)=>{const next=playback(state,action);player.playbackRate=next.speed;player.loop=next.loop;setState(next);};
  return <View style={{ gap: 12 }}><VideoView style={{ width: '100%', height: 270 }} player={player} fullscreenOptions={{ enable: true }} nativeControls/><View style={{ flexDirection: 'row', gap: 8 }}><Control title={`Spoed ${state.speed}x`} onPress={() => command('nextSpeed')}/><Control title={state.loop ? 'Herhaal: aan' : 'Herhaal: af'} onPress={() => command('loop')}/></View></View>;
}
export function Accordion({title,children}:{title:string;children:React.ReactNode}){
 const [open,setOpen]=useState(false);
 return <View style={{padding:16,borderWidth:1,borderColor:'#e2e7df',borderRadius:10}}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)}><Text style={heading}>{title} {open?'−':'+'}</Text></Pressable>{open && <View style={{marginTop:14,gap:12}}>{children}</View>}</View>;
}
export function Practice({ entry, files, onError }: { entry: Entry; files: NativeSaved[]; onError: (error: string) => void }) {
  const [loaded, setLoaded] = useState<Record<string, { uri: string; text?: string; audio?: AudioPreview }>>({});
  useEffect(() => {
    let alive = true; setLoaded({});
    void Promise.all(prepareLesson(entry,files).records.map(async record => {
      const a=record.asset;
      const uri = await verifiedFile(record);
      const audio=a.kind==='audio'?await audioPreview(record):undefined;
      const text = a.mime === 'text/plain' ? await readText(record) : undefined;
      if (alive) setLoaded(p => ({ ...p, [a.id]: { uri, text, audio } }));
    })).catch(e => { if (alive) onError(String(e)); });
    return () => { alive = false; };
  }, [entry, files]);
  const {audio,sheet,video,instructions,links} = prepareLesson(entry,files);
  const pending = (asset: Asset | undefined, label: string) => <Text style={textStyle}>{asset ? `Laai ${label} hieronder af om dit hier en vanlyn te gebruik.` : `${label} word voorberei. Die bronleer is nog nie gepubliseer nie.`}</Text>;
  const prepared=audio && loaded[audio.id]?.audio;const song=prepared?.song;
  return <View style={{gap:12,padding:20,backgroundColor:'#fff',borderRadius:10}}><Text style={heading}>Leer hierdie dans</Text><Text style={textStyle}>Een liedjie, met sy woorde, bladmusiek en passies saam.</Text><Text style={heading}>Luister na die liedjie</Text>{audio && loaded[audio.id] ? <SongPlayer uri={loaded[audio.id].uri} preview={prepared}/> : pending(audio,'die liedjie')}
  <Accordion title="Bladmusiek">{prepared?.midi && <MidiScore notation={prepared.midi}/>}{sheet && loaded[sheet.id] && <SheetMusic uri={loaded[sheet.id].uri}/>}</Accordion>
  <Accordion title="Liedjie woorde">{song ? <Text style={textStyle}>{song.lyrics}</Text> : instructions.filter(a=>a.kind==='lyrics').map(a=><Text key={a.id} style={textStyle}>{loaded[a.id]?.text}</Text>)}</Accordion>
  <Accordion title="Passies & grepe">{song ? <Text style={textStyle}>{song.steps}</Text> : instructions.filter(a=>a.kind==='steps').map(a=><Text key={a.id} style={textStyle}>{loaded[a.id]?.text}</Text>)}</Accordion>
  <Accordion title="Dansdemonstrasie">{video && loaded[video.id] ? <DanceVideo uri={loaded[video.id].uri}/> : links.map(link=><View key={link.url}><Control title={link.title+' ↗'} onPress={()=>void openVideo(link.url).catch(e=>onError(String(e)))}/><Text style={textStyle}>YouTube · internet nodig.</Text></View>)}</Accordion>
  {song && <Accordion title="Bronne en transkripsie"><Text style={textStyle}>{song.credits}{'\n\n'}{song.notes}</Text></Accordion>}
  </View>;
}
