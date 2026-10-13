import React from 'react';
import { jest,test,beforeEach } from '@jest/globals';
import { render,screen,waitFor } from '@testing-library/react-native';
import App from '../../App';
import { checkRelease,loadCatalog,savedFiles } from '../library';
jest.mock('../library',()=>({APP_VERSION:'0.2.0',checkRelease:jest.fn(),loadCatalog:jest.fn(),savedFiles:jest.fn()}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:any)=>children,SafeAreaView:'View'}));
jest.mock('../../modules/rust-logic',()=>({__esModule:true,default:{}}));
jest.mock('expo-audio',()=>({useAudioPlayer:jest.fn(),useAudioPlayerStatus:jest.fn()}));
jest.mock('expo-video',()=>({useVideoPlayer:jest.fn(),VideoView:'View'}));
beforeEach(()=>{jest.clearAllMocks();});
test('native startup checks app releases immediately even while the catalogue is waiting',async()=>{
 jest.mocked(loadCatalog).mockImplementation(()=>new Promise(()=>{}));jest.mocked(savedFiles).mockResolvedValue([]);
 jest.mocked(checkRelease).mockResolvedValue({version:'0.3.0',url:'https://github.com/Niclan1/automatic-waffle/releases/tag/v0.3.0'});
 await render(<App/>);
 await waitFor(()=>expect(checkRelease).toHaveBeenCalledTimes(1));
 expect(loadCatalog).toHaveBeenCalledTimes(1);await waitFor(()=>expect(screen.getByText(/0.3.0 is beskikbaar/)).toBeVisible());
});
