import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const stage = path.resolve(root, 'desktop-stage');
await mkdir(path.join(root,'electron/logic'),{recursive:true});
await cp(path.join(root,'crates/catalog-core/pkg/catalog_core.js'),path.join(root,'electron/logic/catalog_core.mjs'));
await cp(path.join(root,'crates/catalog-core/pkg/catalog_core_bg.wasm'),path.join(root,'electron/logic/catalog_core_bg.wasm'));
if (stage !== path.join(root, 'desktop-stage')) throw new Error('Invalid staging path');
await mkdir(stage, { recursive: true });
for (const directory of ['dist', 'electron']) {
  await rm(path.join(stage, directory), { recursive: true, force: true });
  await cp(path.join(root, directory), path.join(stage, directory), { recursive: true });
}
await mkdir(path.join(stage, 'build'), { recursive: true });
await cp(path.join(root, 'build/icon.png'), path.join(stage, 'build/icon.png'));
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: pkg.name, version: pkg.version, main: 'electron/main.cjs', description: 'Volkspele songs, steps and traditions', author: 'Niclan1', private: true }, null, 2));
// All renderer dependencies are bundled by Vite. No mobile or build tool dependencies ship.
