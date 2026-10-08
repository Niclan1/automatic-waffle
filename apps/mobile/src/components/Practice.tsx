import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { readText, verifiedFile, playback, prepareLesson, audioPreview, type NativeSaved } from '../library';
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
  return <View style={{ gap: 12 }}>{preview && <View accessibilityLabel="Klankgolf" style={{height:44,flexDirection:"row",alignItems:"center",gap:2}}>{preview.waveform.map((peak,i)=><View key={i} style={{flex:1,height:Math.max(2,peak*44),backgroundColor:"#174e43"}}/>)}</View>}<Text style={textStyle}>{Math.floor(status.currentTime)} / {Math.floor(status.duration)} sekondes</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Control title={status.playing ? 'Pouseer' : 'Speel musiek'} onPress={() => command('toggle')}/><Control title="Begin weer" onPress={() => command('restart')}/><Control title={`Spoed ${state.speed}x`} onPress={() => command('nextSpeed')}/><Control title={state.loop ? 'Herhaal: aan' : 'Herhaal: af'} onPress={() => command('loop')}/></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Control title="10 sekondes terug" onPress={() => command('back')}/><Control title="10 sekondes vorentoe" onPress={() => command('forward')}/></View></View>;
}
export function DanceVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  const [state,setState] = useState(() => playback(undefined,'init'));
  const command=(action:string)=>{const next=playback(state,action);player.playbackRate=next.speed;player.loop=next.loop;setState(next);};
  return <View style={{ gap: 12 }}><VideoView style={{ width: '100%', height: 270 }} player={player} fullscreenOptions={{ enable: true }} nativeControls/><View style={{ flexDirection: 'row', gap: 8 }}><Control title={`Spoed ${state.speed}x`} onPress={() => command('nextSpeed')}/><Control title={state.loop ? 'Herhaal: aan' : 'Herhaal: af'} onPress={() => command('loop')}/></View></View>;
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
  const {audio,sheet,video,instructions} = prepareLesson(entry,files);
  const pending = (asset: Asset | undefined, label: string) => <Text style={textStyle}>{asset ? `Laai ${label} hieronder af om dit hier en vanlyn te gebruik.` : `${label} word voorberei. Die bronleer is nog nie gepubliseer nie.`}</Text>;
  return <View style={{ gap: 12, padding: 20, backgroundColor: '#fff', borderRadius: 10 }}><Text style={heading}>Leer hierdie dans</Text><Text style={textStyle}>Lees die bladmusiek terwyl die liedjie speel. Kyk die bewegings en oefen dan die passies.</Text><Text style={heading}>Luister na die liedjie</Text>{audio && loaded[audio.id] ? <SongPlayer key={loaded[audio.id].uri} uri={loaded[audio.id].uri} preview={loaded[audio.id].audio} autoPlay/> : pending(audio, 'Liedjie musiek')}<Text style={heading}>Bladmusiek</Text>{sheet && loaded[sheet.id] ? sheet.mime === 'application/pdf' ? <SheetMusic uri={loaded[sheet.id].uri}/> : <Image source={{ uri: loaded[sheet.id].uri }} style={{ width: '100%', height: 550 }} resizeMode="contain"/> : pending(sheet, 'Bladmusiek')}<Text style={heading}>Kyk en leer die bewegings</Text>{video && loaded[video.id] ? <DanceVideo key={loaded[video.id].uri} uri={loaded[video.id].uri}/> : pending(video, 'Dansvideo')}<Text style={heading}>Passies, grepe en woorde</Text>{instructions.map(a => <View key={a.id}><Text style={heading}>{a.title}</Text>{loaded[a.id] ? a.mime === 'application/pdf' ? <SheetMusic uri={loaded[a.id].uri}/> : <Text style={textStyle}>{loaded[a.id].text}</Text> : pending(a, a.title)}</View>)}{!instructions.length && pending(undefined, 'Passies en liedjie woorde')}</View>;
}
