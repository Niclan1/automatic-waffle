import React,{useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {Accordion} from './Practice';
import {readText,previewText,assetState,type NativeSaved} from '../library';
import type {Entry} from '../../../../src/lib/types';
export function Information({entry,files,children,onError}:{entry:Entry;files:NativeSaved[];children:React.ReactNode;onError:(error:string)=>void}){
 return <Accordion title={entry.title}><Content entry={entry} files={files} onError={onError}/>{children}</Accordion>;
}
function Content({entry,files,onError}:{entry:Entry;files:NativeSaved[];onError:(error:string)=>void}){
 const [blocks,setBlocks]=useState<{id:string;text:string}[]>([]);
 useEffect(()=>{let alive=true;void Promise.all(entry.assets.filter(a=>a.mime==='text/plain').map(async asset=>{const record=assetState(asset,files).record;return {id:asset.id,text:record?await readText(record):await previewText(asset)};})).then(result=>{if(alive)setBlocks(result);}).catch(error=>{if(alive)onError(String(error));});return()=>{alive=false;};},[entry,files]);
 return <View><Text>{entry.description}</Text>{blocks.map(block=><Text key={block.id} selectable style={{color:'#526d4a',fontSize:13,lineHeight:23}}>{block.text}</Text>)}{!blocks.length && <Text>Inligting word gelaai...</Text>}</View>;
}
