import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import Rust from '../modules/rust-logic';
import type { Asset, Catalog, ReleaseInfo } from '../../../src/lib/types';
export const APP_VERSION = '0.1.0';
const BASE = 'https://niclan1.github.io/automatic-waffle/';
const directory = FileSystem.documentDirectory + 'content/';
export type NativeSaved = { asset: Asset; savedAt: string; uri: string };
export async function savedFiles(): Promise<NativeSaved[]> { return JSON.parse(await AsyncStorage.getItem('files') ?? '[]'); }
export async function loadCatalog(): Promise<{ catalog: Catalog; offline: boolean }> {
  try {
    const text = await Rust.fetchCatalog(BASE + 'api/v1/catalog.json');
    const catalog = JSON.parse(text);
    await AsyncStorage.setItem('catalog', text);
    return { catalog, offline: false };
  } catch (error) {
    const cached = await AsyncStorage.getItem('catalog');
    if (!cached) throw error;
    return { catalog: JSON.parse(Rust.parseCatalog(cached)), offline: true };
  }
}
export async function checkRelease(): Promise<ReleaseInfo | null> {
  const response = await fetch(BASE + 'api/v1/app.json', { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Update check failed');
  const info: ReleaseInfo = await response.json();
  if (!/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(info.url)) throw new Error('Invalid release URL');
  return Rust.isNewer(APP_VERSION, info.version) ? info : null;
}
const jobs = new Map<string, FileSystem.DownloadResumable>();
let metadataQueue: Promise<void> = Promise.resolve();
async function mutateFiles(fn: (files: NativeSaved[]) => Promise<void>) {
  const next = metadataQueue.then(async () => fn(await savedFiles()));
  metadataQueue = next.catch(() => {});
  return next;
}
export async function cancelDownload(id: string) { await jobs.get(id)?.cancelAsync(); }
export async function download(asset: Asset, progress: (value: number) => void): Promise<void> {
  if (jobs.has(asset.id)) return;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const final = directory + asset.sha256;
  const temp = final + '.' + Date.now() + '.partial';
  const job = FileSystem.createDownloadResumable(BASE + asset.path, temp, {}, event => progress(Math.min(99, Math.round(event.totalBytesWritten / asset.bytes * 100))));
  jobs.set(asset.id, job);
  try {
    const response = await job.downloadAsync();
    if (!response || response.status !== 200) throw new Error('Aflaai gekanselleer of onsuksesvol.');
    const info = await FileSystem.getInfoAsync(temp);
    if (!info.exists || info.size !== asset.bytes || await Rust.sha256File(temp) !== asset.sha256) throw new Error('Integriteitskontrole het misluk. Jou vorige lêer bly behoue.');
    await mutateFiles(async files => {
      const old = files.find(f => f.asset.id === asset.id);
      const exists = await FileSystem.getInfoAsync(final);
      if (!exists.exists) await FileSystem.moveAsync({ from: temp, to: final });
      else {
        const hash = await Rust.sha256File(final);
        if (hash !== asset.sha256) { await FileSystem.deleteAsync(final, { idempotent: true }); await FileSystem.moveAsync({ from: temp, to: final }); }
      }
      const updated = files.filter(f => f.asset.id !== asset.id).concat({ asset, uri: final, savedAt: new Date().toISOString() });
      await AsyncStorage.setItem('files', JSON.stringify(updated));
      if (old && old.uri !== final && !updated.some(f => f.uri === old.uri)) await FileSystem.deleteAsync(old.uri, { idempotent: true });
    });
    progress(100);
  } finally { jobs.delete(asset.id); await FileSystem.deleteAsync(temp, { idempotent: true }); }
}
export async function verifiedFile(record: NativeSaved) {
  if (await Rust.sha256File(record.uri) !== record.asset.sha256) throw new Error('Gestoorde lêer is beskadig. Laai dit weer af.');
  return record.uri;
}
export async function readText(record: NativeSaved) { return FileSystem.readAsStringAsync(await verifiedFile(record)); }
export async function removeFile(id: string) {
  await mutateFiles(async files => {
    const old = files.find(f => f.asset.id === id), updated = files.filter(f => f.asset.id !== id);
    await AsyncStorage.setItem('files', JSON.stringify(updated));
    if (old && !updated.some(f => f.uri === old.uri)) await FileSystem.deleteAsync(old.uri, { idempotent: true });
  });
}
export async function shareFile(record: NativeSaved) {
  await verifiedFile(record);
  if (!await Sharing.isAvailableAsync()) throw new Error('Lêerdeling is nie beskikbaar op hierdie toestel nie.');
  // A temporary named copy lets recipient apps infer the file format.
  const extension = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'application/pdf': 'pdf', 'text/plain': 'txt' }[record.asset.mime] ?? 'bin';
  const uri = FileSystem.cacheDirectory + record.asset.id.replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + extension;
  await FileSystem.copyAsync({ from: record.uri, to: uri });
  await Sharing.shareAsync(uri, { mimeType: record.asset.mime, dialogTitle: record.asset.title });
}
export async function openRelease(url: string) {
  if (!/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(url)) throw new Error('Invalid release URL');
  await Linking.openURL(url);
}
