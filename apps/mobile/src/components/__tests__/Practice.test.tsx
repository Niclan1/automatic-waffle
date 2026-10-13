import React from 'react';
import { jest,test,beforeEach } from '@jest/globals';
import { render,screen,fireEvent,waitFor } from '@testing-library/react-native';
import { Practice,SongPlayer } from '../Practice';
import {Information} from '../Information';
import { SheetMusic } from '../SheetMusic';
import { audioPreview,playback,domain,prepareLesson,readText,verifiedFile,openVideo,previewText,assetState } from '../../library';
const mockPlayer={setPlaybackRate:jest.fn(),seekTo:jest.fn(),play:jest.fn(),pause:jest.fn(),loop:false};
jest.mock('expo-audio',()=>({useAudioPlayer:()=>mockPlayer,useAudioPlayerStatus:()=>({isLoaded:true,currentTime:1,duration:10,playing:false})}));
jest.mock('react-native-webview',()=>({WebView:'View'}));
jest.mock('expo-video',()=>({useVideoPlayer:()=>({}),VideoView:'View'}));
jest.mock('../../library',()=>({audioPreview:jest.fn(),playback:jest.fn(),domain:jest.fn(),prepareLesson:jest.fn(),readText:jest.fn(),verifiedFile:jest.fn(),openVideo:jest.fn(),previewText:jest.fn(),assetState:jest.fn()}));
const mockRenderPdf=jest.fn<(...args:any[])=>Promise<any>>();
jest.mock('../../../modules/rust-logic',()=>({__esModule:true,default:{renderPdfPage:(...args:any[])=>mockRenderPdf(...args)}}));
const midi={lyrics:[{text:'Sing',start:0,end:2}],musicXml:'<score-partwise/>',duration:10,rollHeight:24,roll:[{x:0,y:0,width:100,height:10,pitch:60,start:0,end:1}]};
const preview={duration:10,sampleRate:22050,channels:1,waveform:[0.2,0.8],midi};
beforeEach(()=>{jest.clearAllMocks();(domain as jest.Mock).mockReturnValue({text:'Sing'});jest.mocked(openVideo).mockResolvedValue(undefined);(playback as jest.Mock).mockReturnValue({speed:1,loop:false,playing:false,seek:null,transport:null});mockRenderPdf.mockResolvedValue({uri:'file:///page.png',width:600,height:800,pages:2});});
test('native MIDI player renders prepared waveform/roll and applies Rust playback commands',async()=>{
 await render(<SongPlayer uri="file:///prepared.wav" preview={preview}/>);
 expect(screen.getByLabelText('Klankgolf')).toBeVisible();expect(screen.getByLabelText('Spelende MIDI klavierrol')).toBeVisible();
 (playback as jest.Mock).mockReturnValue({speed:0.5,loop:true,playing:true,seek:0,transport:'play'});
 await fireEvent.press(screen.getByRole('button',{name:'Speel musiek'}));
 expect(playback).toHaveBeenLastCalledWith(expect.anything(),'toggle',{position:1,duration:10,playing:false});expect(mockPlayer.play).toHaveBeenCalled();expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(0.5);expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);expect(mockPlayer.loop).toBe(true);
});
test('one native song opens typed score, words and steps in collapsible sections',async()=>{
 const song={id:'song',kind:'audio',mime:'audio/midi'};const records=[{asset:song,savedAt:'1',uri:'file:///source'}];
 (prepareLesson as jest.Mock).mockReturnValue({audio:song,instructions:[],records,links:[{title:'Kyk die dans',url:'https://youtu.be/-lKfaUs5G3Y'}]});
 jest.mocked(verifiedFile).mockResolvedValue('file:///saved');jest.mocked(audioPreview).mockResolvedValue({...preview,song:{lyrics:'All three supplied verses',steps:'Opstelling: Dubbelkring.',credits:'Provided source',notes:'Melody'}});
 await render(<Practice entry={{id:'dance',title:'Dans',category:'dance',description:'',assets:[]} as any} files={records as any} onError={jest.fn()}/>);
 await waitFor(()=>expect(screen.getByLabelText('Spelende MIDI klavierrol')).toBeVisible());expect(screen.getByLabelText('Sing saam')).toHaveTextContent('Sing');
 expect(screen.queryByText('All three supplied verses')).toBeNull();await fireEvent.press(screen.getByRole('button',{name:/Liedjie woorde/}));expect(screen.getByText('All three supplied verses')).toBeVisible();await fireEvent.press(screen.getByRole('button',{name:/Liedjie woorde/}));expect(screen.queryByText('All three supplied verses')).toBeNull();
 await fireEvent.press(screen.getByRole('button',{name:/Passies & grepe/}));expect(screen.getByText('Opstelling: Dubbelkring.')).toBeVisible();
 await fireEvent.press(screen.getByRole('button',{name:/Bladmusiek/}));const renderer=screen.getByLabelText('Getikte MIDI bladmusiek');expect(renderer).toBeVisible();expect(renderer.props.source.html).toContain("default-src 'none'");expect(renderer.props.source.html).toContain('score-partwise');
 await fireEvent.press(screen.getByRole('button',{name:/Dansdemonstrasie/}));await fireEvent.press(screen.getByRole('button',{name:'Kyk die dans ↗'}));expect(openVideo).toHaveBeenCalledWith('https://youtu.be/-lKfaUs5G3Y');expect(verifiedFile).toHaveBeenCalledTimes(1);
});

test('native PDF renders pages, advances and zooms without exceeding its page count',async()=>{
 await render(<SheetMusic uri="file:///score.pdf"/>);await waitFor(()=>expect(screen.getByLabelText('Bladmusiek — bladsy 1')).toBeVisible());
 expect(screen.getByRole('button',{name:'Vorige bladsy'})).toBeDisabled();await fireEvent.press(screen.getByRole('button',{name:'Volgende bladsy'}));await waitFor(()=>expect(screen.getByLabelText('Bladmusiek — bladsy 2')).toBeVisible());expect(screen.getByRole('button',{name:'Volgende bladsy'})).toBeDisabled();
 await fireEvent.press(screen.getByRole('button',{name:'Vergroot 100%'}));expect(screen.getByRole('button',{name:'Vergroot 150%'})).toBeVisible();expect(mockRenderPdf).toHaveBeenCalledWith('file:///score.pdf',1,1600);
});

test('native information accordion previews typed text and reopens saved text offline',async()=>{
 const entry={id:'history',title:'History',category:'history',description:'Source A',assets:[{id:'doc',mime:'text/plain'}]} as any;
 (assetState as jest.Mock).mockReturnValue({});jest.mocked(previewText).mockResolvedValue('Full typed history');
 const view=await render(<Information entry={entry} files={[]} onError={jest.fn()}>{null}</Information>);
 expect(screen.queryByText('Full typed history')).toBeNull();await fireEvent.press(screen.getByRole('button',{name:/History/}));await waitFor(()=>expect(screen.getByText('Full typed history')).toBeVisible());
 await view.unmount();(assetState as jest.Mock).mockReturnValue({record:{id:'saved'}});jest.mocked(readText).mockResolvedValue('Offline typed history');
 await render(<Information entry={entry} files={[]} onError={jest.fn()}>{null}</Information>);await fireEvent.press(screen.getByRole('button',{name:/History/}));await waitFor(()=>expect(screen.getByText('Offline typed history')).toBeVisible());expect(previewText).toHaveBeenCalledTimes(1);
});
