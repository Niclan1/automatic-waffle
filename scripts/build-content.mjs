import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export async function buildContent(root = process.cwd(), output = path.join(root, 'dist')) {
  const source = JSON.parse(await readFile(path.join(root, 'content/catalog.source.json'), 'utf8'));
  if (source.schemaVersion !== 1 || !/^\d+\.\d+\.\d+$/.test(source.version)) throw new Error('Invalid catalog schema/version');
  const assetIds = new Set(), entryIds = new Set();
  const contentRoot = await realpath(path.join(root, 'content/files'));
  await mkdir(path.join(output, 'content'), { recursive: true });
  for (const entry of source.entries) {
    if (!entry.id || entryIds.has(entry.id)) throw new Error('Duplicate/empty entry ID');
    entryIds.add(entry.id);
    for (const asset of entry.assets) {
      if (!asset.id || assetIds.has(asset.id)) throw new Error('Duplicate/empty asset ID');
      assetIds.add(asset.id);
      if (!['video', 'audio', 'lyrics', 'steps', 'document', 'image'].includes(asset.kind)) throw new Error('Unknown asset kind');
      if (!/^\d+\.\d+\.\d+$/.test(asset.version)) throw new Error('Invalid asset version');
      const allowedMime = { video: ['video/mp4', 'video/webm'], audio: ['audio/mpeg', 'audio/ogg', 'audio/wav'], lyrics: ['text/plain', 'application/pdf'], steps: ['text/plain', 'application/pdf'], document: ['text/plain', 'application/pdf'], image: ['image/jpeg', 'image/png', 'image/webp'] };
      if (!allowedMime[asset.kind].includes(asset.mime)) throw new Error('Unsupported MIME type');
      if (typeof asset.file !== 'string' || path.isAbsolute(asset.file)) throw new Error('Invalid source file');
      const file = await realpath(path.resolve(contentRoot, asset.file));
      if (!file.startsWith(contentRoot + path.sep)) throw new Error('Source path escapes content/files');
      const bytes = await readFile(file);
      if (!bytes.length || bytes.length > 250_000_000) throw new Error('Files must be 1 byte–250 MB');
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      asset.sha256 = sha256; asset.bytes = bytes.length; asset.path = `content/${sha256}`;
      delete asset.file;
      await writeFile(path.join(output, asset.path), bytes);
    }
  }
  await mkdir(path.join(output, 'api/v1'), { recursive: true });
  await writeFile(path.join(output, 'api/v1/catalog.json'), JSON.stringify(source, null, 2) + '\n');
  const app = JSON.parse(await readFile(path.join(root, 'content/app.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(app.version) || !/^https:\/\/github\.com\/Niclan1\/automatic-waffle\/releases(?:\/|$)/.test(app.url)) throw new Error('Invalid app release metadata');
  await writeFile(path.join(output, 'api/v1/app.json'), JSON.stringify(app, null, 2) + '\n');
  await writeFile(path.join(output, '.nojekyll'), '');
  return source;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const catalog = await buildContent();
  console.log(`Published catalog ${catalog.version}: ${catalog.entries.length} entries, ${catalog.entries.flatMap(e => e.assets).length} files`);
}
