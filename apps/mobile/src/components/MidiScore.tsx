import React,{useMemo,useState} from 'react';
import {Text,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {notationHtml} from './notationHtml';
import type {MidiNotation} from '../../../../src/lib/types';

export function MidiScore({notation}:{notation:MidiNotation}){
 const [height,setHeight]=useState(600);const html=useMemo(()=>notation.musicXml?notationHtml(notation.musicXml):'', [notation.musicXml]);
 return <View><Text style={{color:'#174e43',marginBottom:8}}>Getikte melodielyn met woorde. Skuif sywaarts om verder te lees.</Text>{html ? <WebView accessibilityLabel="Getikte MIDI bladmusiek" originWhitelist={['*']} source={{html}} style={{height,backgroundColor:'white'}} scrollEnabled={false} onShouldStartLoadWithRequest={request=>request.url==='about:blank'} onMessage={event=>{try{const value=JSON.parse(event.nativeEvent.data);if(Number.isFinite(value.height))setHeight(Math.max(200,Math.min(30000,value.height)));}catch{}}}/> : <Text>Gebruik die klavierrol vir hierdie musiek.</Text>}</View>;
}
