export type Asset = { id: string; title: string; kind: 'video' | 'audio' | 'lyrics' | 'steps' | 'document' | 'image'; path: string; sha256: string; bytes: number; mime: string; version: string };
export type Entry = { id: string; title: string; category: string; number?: number; description: string; assets: Asset[] };
export type Catalog = { schemaVersion: number; version: string; entries: Entry[] };
export type ReleaseInfo = { version: string; url: string };
export type Saved = { asset: Asset; savedAt: string; blob?: Blob };
