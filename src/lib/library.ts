import { openDB } from 'idb';
import init, { fetch_catalog, parse_catalog, sha256, is_newer } from '../../crates/catalog-core/pkg/catalog_core';
import type { Asset, Catalog, Saved, ReleaseInfo } from './types';
export const APP_VERSION = '0.1.0';
export const API_BASE = import.meta.env.VITE_CONTENT_BASE ?? 'https://niclan1.github.io/automatic-waffle/';
const db = openDB('volkspele', 1, { upgrade(db) { db.createObjectStore('meta'); db.createObjectStore('files', { keyPath: 'asset.id' }); } });
const ready = init();
const native = () => window.desktop !== undefined;
const invoke = <T,>(command: string, args: Record<string, unknown>): Promise<T> => window.desktop!.invoke(command, args);
export async function savedFiles(): Promise<Saved[]> { return (await db).getAll('files'); }
export async function loadCatalog(): Promise<{ catalog: Catalog; offline: boolean }> {
  await ready;
  const cache = await db;
  try {
    const catalog: Catalog = JSON.parse(await fetch_catalog(new URL('api/v1/catalog.json', API_BASE).href));
    await cache.put('meta', catalog, 'catalog');
    return { catalog, offline: false };
  } catch (error) {
    const cached = await cache.get('meta', 'catalog');
    if (!cached) throw error;
    return { catalog: JSON.parse(parse_catalog(JSON.stringify(cached))), offline: true };
  }
}
export async function checkRelease(): Promise<ReleaseInfo | null> {
  await ready;
  const response = await fetch(new URL('api/v1/app.json', API_BASE), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('App update check unavailable');
  const info: ReleaseInfo = await response.json();
  if (!/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(info.url)) throw new Error('Invalid release URL');
  return is_newer(APP_VERSION, info.version) ? info : null;
}
export async function download(asset: Asset, signal: AbortSignal, progress: (value: number) => void): Promise<void> {
  await ready;
  // Content IDs and paths were validated in Rust when loading the catalog.
  const response = await fetch(new URL(asset.path, API_BASE), { signal });
  if (!response.ok) throw new Error(`Aflaai het misluk (${response.status}).`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Aflaai word nie ondersteun nie.');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > asset.bytes) throw new Error('Lêer is groter as die gepubliseerde grootte.');
      chunks.push(value);
      progress(Math.round(total / asset.bytes * 100));
    }
  } catch (e) { await reader.cancel(); throw e; }
  const bytes = new Uint8Array(total);
  let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  if (total !== asset.bytes || sha256(bytes) !== asset.sha256) throw new Error('Lêer se integriteitskontrole het misluk. Probeer weer.');
  signal.throwIfAborted();
  const cache = await db;
  const old: Saved | undefined = await cache.get('files', asset.id);
  const record: Saved = { asset, savedAt: new Date().toISOString() };
  if (native()) {
    await invoke('save_content', { hash: asset.sha256, bytes: Array.from(bytes) });
  } else {
    await navigator.storage?.persist?.();
    record.blob = new Blob([bytes], { type: asset.mime });
  }
  try { await cache.put('files', record); }
  catch (e) {
    if (native() && old?.asset.sha256 !== asset.sha256) await invoke('delete_content', { hash: asset.sha256 }).catch(() => {});
    throw e;
  }
  if (native() && old && old.asset.sha256 !== asset.sha256) await collectNativeFile(old.asset.sha256);
}
async function collectNativeFile(hash: string) {
  const files = await savedFiles();
  if (!files.some(f => f.asset.sha256 === hash)) await invoke('delete_content', { hash });
}
export async function removeFile(id: string) {
  const cache = await db;
  const record: Saved | undefined = await cache.get('files', id);
  await cache.delete('files', id);
  if (record && native()) await collectNativeFile(record.asset.sha256);
}
export async function fileBlob(record: Saved): Promise<Blob> {
  await ready;
  const blob = record.blob ?? new Blob([new Uint8Array(await invoke<number[]>('read_content', { hash: record.asset.sha256 }))], { type: record.asset.mime });
  if (sha256(new Uint8Array(await blob.arrayBuffer())) !== record.asset.sha256) throw new Error('Die gestoorde lêer is beskadig. Laai dit weer af.');
  return blob;
}
export async function openRelease(url: string) {
  if (!/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(url)) throw new Error('Invalid release URL');
  if (native()) await invoke('open_release', { url }); else window.open(url, '_blank', 'noopener,noreferrer');
}
export async function exportNative(record: Saved): Promise<boolean> {
  if (!native()) return false;
  await invoke('export_content', { hash: record.asset.sha256, title: record.asset.title, mime: record.asset.mime });
  return true;
}
export async function openOfficial() {
  const url = 'https://volkspele.co.za/avvb/';
  if (native()) await invoke('open_official', { url }); else window.open(url, '_blank', 'noopener,noreferrer');
}
