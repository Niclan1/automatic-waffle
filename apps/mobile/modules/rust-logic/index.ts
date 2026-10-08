import { requireNativeModule } from 'expo-modules-core';
const Native = requireNativeModule<{ fetchCatalog(url: string): Promise<string>; parseCatalog(text: string): string; sha256Base64(text: string): Promise<string>; sha256File(uri: string): Promise<string>; isNewer(current: string, latest: string): boolean }>('RustLogic');
export default Native;
