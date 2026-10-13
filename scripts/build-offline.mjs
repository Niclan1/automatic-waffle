// Mechanical cache for the compiled app shell. Content/API requests are always
// handled by the Rust runtime and are never included in this precache.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root='dist';
async function files(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory()){if(!['content','api'].includes(item.name))result.push(...await files(name));}else if(item.name!=='sw.js'&&item.name!=='.nojekyll')result.push(name);}return result;}
const names=await files(root);const hash=createHash('sha256');for(const name of names)hash.update(await readFile(name));
const urls=names.map(name=>'./'+path.relative(root,name).replaceAll('\\','/'));
await writeFile(path.join(root,'sw.js'),`const CACHE='volkspele-shell-${hash.digest('hex').slice(0,16)}';
const URLS=${JSON.stringify(urls)}.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(URLS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('volkspele-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const url=event.request.url;if(event.request.method!=='GET')return;
if(event.request.mode==='navigate'&&url.startsWith(self.registration.scope)){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match(new URL('./index.html',self.registration.scope).href))));return;}
if(URLS.includes(url))event.respondWith(caches.open(CACHE).then(cache=>cache.match(url)).then(cached=>cached||fetch(event.request)));});
`);
