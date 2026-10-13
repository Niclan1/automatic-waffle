import {useEffect,useState} from 'react';
import {filePreview,previewText,assetState} from '../lib/library';
import type {Entry,Saved} from '../lib/types';
export function Information({entry,files,children,onError}:{entry:Entry;files:Saved[];children:React.ReactNode;onError:(error:string)=>void}){
 const [open,setOpen]=useState(false);const [blocks,setBlocks]=useState<{id:string;text:string}[]>([]);
 useEffect(()=>{if(!open)return;const controller=new AbortController();void Promise.all(entry.assets.filter(a=>a.mime==='text/plain').map(async asset=>{const record=assetState(asset,files).record;const text=record?(await filePreview(record)).text:await previewText(asset,controller.signal);return {id:asset.id,text:text??''};})).then(result=>{if(!controller.signal.aborted)setBlocks(result);}).catch(error=>{if(!controller.signal.aborted)onError(String(error));});return()=>controller.abort();},[open,entry,files]);
 return <details className="info-card" onToggle={e=>setOpen(e.currentTarget.open)}><summary><h3>{entry.title}</h3></summary><p>{entry.description}</p>{blocks.map(block=><pre key={block.id}>{block.text}</pre>)}{open && !blocks.length && <p>Inligting word gelaai...</p>}{children}</details>;
}
