import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildContent } from '../scripts/build-content.mjs';
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'volkspele-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'content/files'), { recursive: true });
  await writeFile(path.join(root, 'content/app.json'), JSON.stringify({ version: '0.1.0', url: 'https://github.com/Niclan1/automatic-waffle/releases/latest' }));
  return root;
}
function source(assets) { return { schemaVersion: 1, version: '1.0.0', entries: [{ id: 'dance', title: 'Dance', category: 'dance', description: '', assets }] }; }
const asset = { id: 'words', title: 'Words', kind: 'lyrics', mime: 'text/plain', version: '1.0.0', file: 'words.txt' };
test('content generation hashes actual bytes and exposes no source path', async t => {
  const root = await fixture(t); const bytes = Buffer.from('Test words');
  await writeFile(path.join(root, 'content/files/words.txt'), bytes);
  await writeFile(path.join(root, 'content/catalog.source.json'), JSON.stringify(source([asset])));
  const result = await buildContent(root); const file = result.entries[0].assets[0];
  assert.equal(file.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(file.bytes, bytes.length); assert.equal(file.file, undefined);
  assert.deepEqual(await readFile(path.join(root, 'dist', file.path)), bytes);
});
test('source traversal is rejected', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'content/private.txt'), 'secret');
  await writeFile(path.join(root, 'content/catalog.source.json'), JSON.stringify(source([{ ...asset, file: '../private.txt' }])));
  await assert.rejects(buildContent(root), /escapes/);
});
test('duplicate IDs are rejected', async t => {
  const root = await fixture(t); await writeFile(path.join(root, 'content/files/words.txt'), 'text');
  await writeFile(path.join(root, 'content/catalog.source.json'), JSON.stringify(source([asset, asset])));
  await assert.rejects(buildContent(root), /Duplicate/);
});

test('MIDI is published for new clients while the legacy APK catalogue stays compatible',async t=>{
  const root=await fixture(t);
  await writeFile(path.join(root,'content/files/practice.mid'),Buffer.from('MThd'));
  await writeFile(path.join(root,'content/catalog.source.json'),JSON.stringify(source([{id:'midi',title:'MIDI',kind:'audio',mime:'audio/midi',version:'1.0.0',file:'practice.mid'}])));
  await buildContent(root);
  const current=JSON.parse(await readFile(path.join(root,'dist/api/v2/catalog.json'),'utf8'));
  const legacy=JSON.parse(await readFile(path.join(root,'dist/api/v1/catalog.json'),'utf8'));
  assert.equal(current.entries[0].assets[0].mime,'audio/midi');
  assert.equal(legacy.entries[0].assets.length,0);
});

test('published dances are one lyric-MIDI download and references are typed documents',async()=>{
 const catalog=JSON.parse(await readFile('content/catalog.source.json','utf8'));
 for(const entry of catalog.entries){
  if(entry.category==='dance'){assert.equal(entry.assets.length,1);assert.equal(entry.assets[0].mime,'audio/midi');}
  else if(entry.category!=='home'){assert.ok(entry.assets.every(a=>a.mime==='text/plain'));}
 }
});
