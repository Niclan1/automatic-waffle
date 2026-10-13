import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist');
createServer(async(request,response)=>{try{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json'}[path.extname(file)]||'application/octet-stream';
 response.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});response.end(await readFile(file));
 }catch{response.writeHead(404);response.end();}}).listen(1430,'127.0.0.1');
