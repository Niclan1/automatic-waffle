// Bundle a visual renderer for native offline sheet display. No song media ships.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const source=await readFile('node_modules/opensheetmusicdisplay/build/opensheetmusicdisplay.min.js','utf8');
await mkdir('apps/mobile/src/generated',{recursive:true});
await writeFile('apps/mobile/src/generated/notation-renderer.ts','export const notationRenderer = '+JSON.stringify(source)+';\n');
