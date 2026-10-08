// Platform adapters only. HTTP, metadata, integrity, updates and preparation live in Rust.
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import Rust from '../modules/rust-logic';
import type { Asset, Catalog, ReleaseInfo, Lesson, CatalogView, Playback, AudioPreview } from '../../../src/lib/types';
export const APP_VERSION = '0.1.0';
export type NativeSaved = {asset: Asset; savedAt: string; uri: string};
const call = async <T,>(request: object): Promise<T> => JSON.parse(await Rust.command(JSON.stringify(request)));
export const domain = <T,>(request: object): T => JSON.parse(Rust.domain(JSON.stringify(request)));
export const savedFiles = () => call<NativeSaved[]>({op:'files'});
export const loadCatalog = () => call<{catalog: Catalog; offline: boolean}>({op:'catalog'});
export const checkRelease = () => call<ReleaseInfo | null>({op:'release',current:APP_VERSION});
export async function download(asset: Asset, progress: (value:number) => void) { const timer = setInterval(() => progress(Rust.progress(asset.id)),200); try {await call({op:'download',asset});} finally {clearInterval(timer);} }
export const cancelDownload = (id:string) => Rust.cancelDownload(id);
export const verifiedFile = (record: NativeSaved) => call<string>({op:'verify',id:record.asset.id});
export const readText = (record: NativeSaved) => call<string>({op:'text',id:record.asset.id});
export const removeFile = (id:string) => call({op:'remove',id});
export async function shareFile(record: NativeSaved) {const output = await call<{uri:string;mime:string;title:string}>({op:'export',id:record.asset.id}); await Sharing.shareAsync(output.uri,{mimeType:output.mime,dialogTitle:output.title});}
export const openRelease = (url:string) => Linking.openURL(domain<string>({op:'external',url}));
export const prepareLesson = (entry: object,files:NativeSaved[]) => domain<Omit<Lesson,'records'> & {records:NativeSaved[]}>({op:'lesson',entry,files});
export const catalogView = (catalog: Catalog, category:string, query:string, files:NativeSaved[]) => domain<CatalogView>({op:'catalogView',catalog,category,query,files});
export const playback = (state: Playback | undefined, action:string, extras:object = {}) => domain<Playback>({op:'playback',state,action,...extras});

export const assetState = (asset:Asset,files:NativeSaved[]) => domain<{record?:NativeSaved;updated:boolean}>({op:"assetState",asset,files});
export const audioPreview = (record:NativeSaved) => call<AudioPreview>({op:"audioPreview",id:record.asset.id});

export const previewAsset = (asset:Asset) => call<string>({op:"remotePreview",asset});
