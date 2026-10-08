import { requireNativeModule } from 'expo-modules-core';
export default requireNativeModule<{ command(request: string): Promise<string>; domain(request: string): string; progress(id: string): number; cancelDownload(id: string): string; renderPdfPage(uri: string, page: number, width: number): Promise<{uri: string; width: number; height: number; pages: number}> }>('RustLogic');
