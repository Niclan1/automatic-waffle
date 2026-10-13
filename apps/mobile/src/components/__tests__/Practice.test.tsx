import React from 'react';
import { jest,test,beforeEach } from '@jest/globals';
import { render,screen,fireEvent,waitFor } from '@testing-library/react-native';
import { Practice,SongPlayer } from '../Practice';
import { SheetMusic } from '../SheetMusic';
import { audioPreview,playback,prepareLesson,readText,verifiedFile,openVideo } from '../../library';
const mockPlayer={setPlaybackRate:jest.fn(),seekTo:jest.fn(),play:jest.fn(),pause:jest.fn(),loop:false};
jest.mock('expo-audio',()=>({useAudioPlayer:()=>mockPlayer,useAudioPlayerStatus:()=>({isLoaded:true,currentTime:1,duration:10,playing:false})}));
jest.mock('expo-video',()=>({useVideoPlayer:()=>({}),VideoView:'View'}));
jest.mock('../../library',()=>({audioPreview:jest.fn(),playback:jest.fn(),prepareLesson:jest.fn(),readText:jest.fn(),verifiedFile:jest.fn(),openVideo:jest.fn()}));
const mockRenderPdf=jest.fn<(...args:any[])=>Promise<any>>();
jest.mock('../../../modules/rust-logic',()=>({__esModule:true,default:{renderPdfPage:(...args:any[])=>mockRenderPdf(...args)}}));
const midi={musicXml:'<score-partwise/>',duration:10,rollHeight:24,roll:[{x:0,y:0,width:100,height:10,pitch:60,start:0,end:1}]};
const preview={duration:10,sampleRate:22050,channels:1,waveform:[0.2,0.8],midi};
beforeEach(()=>{jest.clearAllMocks();jest.mocked(openVideo).mockResolvedValue(undefined);(playback as jest.Mock).mockReturnValue({speed:1,loop:false,playing:false,seek:null,transport:null});mockRenderPdf.mockResolvedValue({uri:'file:///page.png',width:600,height:800,pages:2});});
test('native MIDI player renders prepared waveform/roll and applies Rust playback commands',async()=>{
 await render(<SongPlayer uri="file:///prepared.wav" preview={preview}/>);
 expect(screen.getByLabelText('Klankgolf')).toBeVisible();expect(screen.getByLabelText('Spelende MIDI klavierrol')).toBeVisible();
 (playback as jest.Mock).mockReturnValue({speed:0.5,loop:true,playing:true,seek:0,transport:'play'});
 await fireEvent.press(screen.getByRole('button',{name:'Speel musiek'}));
 expect(playback).toHaveBeenLastCalledWith(expect.anything(),'toggle',{position:1,duration:10,playing:false});expect(mockPlayer.play).toHaveBeenCalled();expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(0.5);expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);expect(mockPlayer.loop).toBe(true);
});
test('native lesson renders saved score, lyrics and an online demonstration link',async()=>{
 const song={id:'song',kind:'audio',mime:'audio/midi'},sheet={id:'sheet',kind:'sheet',mime:'image/jpeg',title:'Original score'},lyrics={id:'lyrics',kind:'lyrics',mime:'text/plain',title:'Woorde'};
 const records=[song,sheet,lyrics].map(asset=>({asset,savedAt:'1',uri:'file:///source'}));
 (prepareLesson as jest.Mock).mockReturnValue({audio:song,sheet,instructions:[lyrics],records,links:[{title:'Kyk die dans',url:'https://youtu.be/-lKfaUs5G3Y'}]});
 jest.mocked(verifiedFile).mockResolvedValue('file:///saved');jest.mocked(audioPreview).mockResolvedValue(preview);jest.mocked(readText).mockResolvedValue('Aanstap rooies die pad is lank en swaar');
 await render(<Practice entry={{id:'dance',title:'Dans',category:'dance',description:'',assets:[]} as any} files={records as any} onError={jest.fn()}/>);
 await waitFor(()=>expect(screen.getByText('Aanstap rooies die pad is lank en swaar')).toBeVisible());expect(screen.getByText('Bladmusiek')).toBeVisible();expect(screen.getByLabelText('Original score')).toBeVisible();expect(screen.getByLabelText('Spelende MIDI klavierrol')).toBeVisible();
 await fireEvent.press(screen.getByRole('button',{name:'Kyk die dans ↗'}));expect(openVideo).toHaveBeenCalledWith('https://youtu.be/-lKfaUs5G3Y');
});
test('native PDF renders pages, advances and zooms without exceeding its page count',async()=>{
 await render(<SheetMusic uri="file:///score.pdf"/>);await waitFor(()=>expect(screen.getByLabelText('Bladmusiek — bladsy 1')).toBeVisible());
 expect(screen.getByRole('button',{name:'Vorige bladsy'})).toBeDisabled();await fireEvent.press(screen.getByRole('button',{name:'Volgende bladsy'}));await waitFor(()=>expect(screen.getByLabelText('Bladmusiek — bladsy 2')).toBeVisible());expect(screen.getByRole('button',{name:'Volgende bladsy'})).toBeDisabled();
 await fireEvent.press(screen.getByRole('button',{name:'Vergroot 100%'}));expect(screen.getByRole('button',{name:'Vergroot 150%'})).toBeVisible();expect(mockRenderPdf).toHaveBeenCalledWith('file:///score.pdf',1,1600);
});
