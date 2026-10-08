// Thin browser/Electron storage and platform adapters. Rust owns application decisions.
import { openDB } from 'idb';
import init, { browser_command, domain_command, media_command } from '../../crates/catalog-core/pkg/catalog_core';
import type { Asset, Catalog, Saved, ReleaseInfo, Lesson, CatalogView, Playback, AudioPreview } from './types';
export const APP_VERSION = '0.1.1';
export const API_BASE = import.meta.env.VITE_CONTENT_BASE ?? 'https://niclan1.github.io/automatic-waffle/';
const ready = init();
const db = openDB('volkspele',1,{upgrade(db){db.createObjectStore('meta');db.createObjectStore('files',{keyPath:'asset.id'});}});
const invoke = <T,>(command:string,args:Record<string,unknown>):Promise<T> => window.desktop!.invoke(command,args);
const host = {
  getCatalog: async () => (await db).get('meta','catalog'),
  putCatalog: async (catalog: Catalog) => (await db).put('meta',catalog,'catalog'),
  allFiles: async () => (await db).getAll('files'),
  getFile: async (id:string) => (await db).get('files',id),
  saveFile: async (record:Saved,bytes:Uint8Array<ArrayBuffer>) => {
    if (window.desktop) await invoke('save_content',{hash:record.asset.sha256,bytes:Array.from(bytes)});
    else { await navigator.storage?.persist?.(); record.blob=new Blob([bytes],{type:record.asset.mime}); }
    await (await db).put('files',record);
  },
  readFile: async (record:Saved) => window.desktop ? new Uint8Array(await invoke<number[]>('read_content',{hash:record.asset.sha256})) : new Uint8Array(await record.blob!.arrayBuffer()),
  deleteFile: async (id:string) => (await db).delete('files',id),
  deleteBytes: async (hash:string) => {if(window.desktop) await invoke('delete_content',{hash});}
};
async function call<T>(request:object,signal?:AbortSignal,progress?:(value:number)=>void):Promise<T>{await ready;return browser_command(JSON.stringify({base:API_BASE,...request}),host,signal,progress);}
export const savedFiles = () => call<Saved[]>({op:'files'});
export const loadCatalog = () => call<{catalog:Catalog;offline:boolean}>({op:'catalog'});
export const checkRelease = () => call<ReleaseInfo|null>({op:'release',current:APP_VERSION});
export const download = (asset:Asset,signal:AbortSignal,progress:(value:number)=>void) => call({op:'download',asset},signal,progress);
export const removeFile = (id:string) => call({op:'remove',id});
export const filePreview = (record:Saved) => call<{blob:Blob;bytes:Uint8Array;text?:string;audio?:AudioPreview}>({op:'preview',id:record.asset.id});
export const fileBlob = (record:Saved) => call<Blob>({op:'verify',id:record.asset.id});
export const domain = <T,>(request:object):T => JSON.parse(domain_command(JSON.stringify(request)));
export const prepareLesson = (entry:object,files:Saved[]) => domain<Lesson>({op:'lesson',entry,files});
export const catalogView = (catalog:Catalog,category:string,query:string,files:Saved[]) => domain<CatalogView>({op:'catalogView',catalog,category,query,files});
export const mediaCommand = (media:HTMLMediaElement,state:Playback,action:string,extras:object={}) => JSON.parse(media_command(media,JSON.stringify({state,action,...extras}))) as Playback;
export async function openRelease(url:string){await ready;url=domain<string>({op:'external',url});if(window.desktop) await invoke('open_release',{url});else window.open(url,'_blank','noopener,noreferrer');}
export async function openOfficial(){await ready;const url=domain<string>({op:'external',url:'https://volkspele.co.za/avvb/'});if(window.desktop) await invoke('open_official',{url});else window.open(url,'_blank','noopener,noreferrer');}
export async function exportNative(record:Saved){if(!window.desktop)return false;await invoke('export_content',{asset:record.asset});return true;}

export const assetState = (asset:Asset,files:Saved[]) => domain<{record?:Saved;updated:boolean}>({op:"assetState",asset,files});
export const exportName = (asset:Asset) => domain<string>({op:"exportName",asset});

export const previewAsset = (asset:Asset,signal:AbortSignal) => call<Blob>({op:"remotePreview",asset},signal);
