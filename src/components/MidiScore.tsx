import { useEffect, useRef, useState } from 'react';
import type { MidiNotation } from '../lib/types';
export function MidiScore({ notation }: { notation:MidiNotation }) {
  const target=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [zoom,setZoom]=useState(1);
  useEffect(()=>{let alive=true;const element=target.current;if(!element||!notation.musicXml)return;
    void import('opensheetmusicdisplay').then(async ({OpenSheetMusicDisplay})=>{
      if(!alive)return;const score=new OpenSheetMusicDisplay(element,{autoResize:true,backend:'svg',drawTitle:false});
      await score.load(notation.musicXml!);if(alive){score.Zoom=zoom;score.render();}
    }).catch(e=>{if(alive)setError(String(e));});
    return()=>{alive=false;element.replaceChildren();};
  },[notation,zoom]);
  return <section className="midi-score"><h4>Bladmusiek uit MIDI · melodielyn</h4><p>Digitale oefenweergawe. Vergelyk met die oorspronklike bladmusiek hieronder.</p>{notation.musicXml && <><label>Notegrootte <select aria-label="MIDI notegrootte" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={0.8}>Klein</option><option value={1}>Normaal</option><option value={1.3}>Groot</option></select></label><div ref={target} className="midi-notation" aria-label="MIDI bladmusiek"/></>}{error && <p role="status">Notasie kon nie teken nie: {error}</p>}<details><summary>Klavierrol</summary><div className="piano-roll"><svg viewBox={`0 0 1000 ${notation.rollHeight}`} role="img" aria-label="MIDI klavierrol">{notation.roll.map((note,i)=><rect key={i} x={note.x} y={note.y} width={note.width} height={note.height} rx={2}><title>MIDI {note.pitch} · {note.start.toFixed(2)} s</title></rect>)}</svg></div></details></section>;
}
