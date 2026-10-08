import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CircleHelp, Download, Flower2, FolderHeart, Home, History, LoaderCircle, Menu, Music2, Play, RefreshCw, Search, Shirt, Tent, Trash2, Users, WifiOff, X } from 'lucide-react';
import { Practice, PracticeMedia } from '@/components/Practice';
import { SheetMusic } from '@/components/SheetMusic';
import { Button } from '@/components/ui/button';
import { API_BASE, APP_VERSION, checkRelease, catalogView, assetState, exportName, previewAsset, download, exportNative, fileBlob, filePreview, loadCatalog, openOfficial, openRelease, removeFile, savedFiles } from '@/lib/library';
import type { Asset, Catalog, Entry, ReleaseInfo, Saved } from '@/lib/types';
const sections = [
  { id: 'home', label: 'Tuisblad', icon: Home },
  { id: 'dance', label: 'Liedjies & speletjies', icon: Music2 },
  { id: 'history', label: 'Geskiedenis', icon: History },
  { id: 'clothing', label: 'Kleredrag', icon: Shirt },
  { id: 'camp', label: 'Laer inligting', icon: Tent },
  { id: 'contact', label: 'AVVB kontak', icon: Users },
];
const kindLabels: Record<string, string> = { video: 'Video', audio: 'Liedjie musiek', lyrics: 'Liedjie woorde', steps: 'Passies & grepe', document: 'Inligting', image: 'Foto', sheet: 'Bladmusiek' };
const formatBytes = (bytes: number) => bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} KB`;
function CircleArt() { return <div className="circle-art" aria-hidden="true"><div className="orbit orbit-outer"/><div className="orbit orbit-inner"/><Flower2 className="art-flower"/>{Array.from({ length: 8 }, (_, i) => <div className="dancer" style={{ transform: `rotate(${i * 45}deg) translateY(-108px)` }} key={i}><i/><b/></div>)}<span className="art-label">SAAM IN DIE KRING</span></div>; }
export default function App() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [files, setFiles] = useState<Saved[]>([]);
  const [section, setSection] = useState('home');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Entry>();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState('');
  const [release, setRelease] = useState<ReleaseInfo | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const controllers = useRef(new Map<string, AbortController>());
  const [viewer, setViewer] = useState<{ asset: Asset; url: string; text?: string; bytes?:Uint8Array }>();
  const [photoError, setPhotoError] = useState(false);
  const [photoUrl,setPhotoUrl]=useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sync = async () => {
    setBusy(true);
    try { const result = await loadCatalog(); setCatalog(result.catalog); setOffline(result.offline); setNotice(result.offline ? 'Jy is vanlyn. Jou gestoorde biblioteek is beskikbaar.' : 'Jou biblioteek is op datum.'); }
    catch { setNotice('Die biblioteek kon nie laai nie. Kontroleer jou verbinding en probeer weer.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void sync(); savedFiles().then(setFiles).catch(() => setNotice('Plaaslike berging is nie beskikbaar nie.')); checkRelease().then(setRelease).catch(() => {}); return () => controllers.current.forEach(c => c.abort()); }, []);
  useEffect(() => { if (viewer) dialogRef.current?.showModal(); }, [viewer]);
  useEffect(() => () => { if (viewer) URL.revokeObjectURL(viewer.url); }, [viewer]);
  const refreshFiles = async () => setFiles(await savedFiles());
  const save = async (asset: Asset) => {
    if (controllers.current.has(asset.id)) return;
    const controller = new AbortController(); controllers.current.set(asset.id, controller);
    setProgress(p => ({ ...p, [asset.id]: 0 }));
    try { await download(asset, controller.signal, value => setProgress(p => ({ ...p, [asset.id]: value }))); await refreshFiles(); setNotice(`${asset.title} is veilig gestoor vir vanlyn gebruik.`); }
    catch (e) { setNotice(controller.signal.aborted ? 'Aflaai gekanselleer.' : String(e)); }
    finally { controllers.current.delete(asset.id); setProgress(p => { const next = { ...p }; delete next[asset.id]; return next; }); }
  };
  const view = async (record: Saved) => {
    try {
      const {blob,text,bytes}=await filePreview(record);
      setViewer({asset:record.asset,url:URL.createObjectURL(blob),text,bytes});
    } catch (e) { setNotice(String(e)); }
  };
  const remove = async (record: Saved) => { try { await removeFile(record.asset.id); await refreshFiles(); setNotice('Lêer verwyder.'); } catch { setNotice('Lêer kon nie verwyder word nie.'); } };
  const exportFile = async (record: Saved) => {
    try {
      if (await exportNative(record)) return;
      const blob = await fileBlob(record);
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href=url; a.download=exportName(record.asset); a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setNotice(String(e)); }
  };
  const prepared = catalog ? catalogView(catalog,section,query,files) : {assets:[],outdated:[],entries:[],totalBytes:0};
  const {assets:currentAssets,outdated,entries} = prepared;
  const active = selected && catalog?.entries.find(e => e.id === selected.id);
  const heroPhoto = catalog?.entries.find(e => e.id === 'welkom')?.assets.find(a => a.kind === 'image');
  useEffect(() => {const controller=new AbortController();let url:string|undefined;setPhotoUrl(undefined);setPhotoError(false);if(heroPhoto)void previewAsset(heroPhoto,controller.signal).then(blob=>{if(!controller.signal.aborted){url=URL.createObjectURL(blob);setPhotoUrl(url);}}).catch(()=>{if(!controller.signal.aborted)setPhotoError(true);});return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};},[heroPhoto?.sha256]);
  const navigate = (id: string) => { setSection(id); setSelected(undefined); setQuery(''); setMenu(false); };
  const assetRow = (asset: Asset, savedOnly = false) => {
    const {record,updated}=assetState(asset,files);
    const downloading = progress[asset.id] !== undefined;
    return <div className="asset-row" key={asset.id}>
      <span className="asset-icon">{asset.kind === 'video' ? <Play size={19}/> : asset.kind === 'audio' ? <Music2 size={19}/> : <BookOpen size={19}/>}</span>
      <div className="asset-name"><strong>{kindLabels[asset.kind]}</strong><small>{asset.title} · {formatBytes(asset.bytes)}{record ? updated ? ' · Opdatering beskikbaar' : ' · Vanlyn beskikbaar' : ''}</small></div>
      <div className="asset-actions">
        {record && <Button size="sm" variant="outline" onClick={() => void view(record)}>Maak oop</Button>}
        {record && <Button size="icon" variant="ghost" aria-label={`Voer ${asset.title} uit`} onClick={() => void exportFile(record)}><ArrowDownToLine size={17}/></Button>}
        {downloading ? <Button size="sm" variant="outline" onClick={() => controllers.current.get(asset.id)?.abort()}><X size={15}/>{progress[asset.id]}%</Button> : !savedOnly && (!record || updated) ? <Button size="sm" onClick={() => void save(asset)}><Download size={15}/>{updated ? 'Werk by' : 'Laai af'}</Button> : null}
        {record && <Button size="icon" variant="ghost" aria-label={`Verwyder ${asset.title}`} onClick={() => void remove(record)}><Trash2 size={16}/></Button>}
      </div>
    </div>;
  };
  return <div className="app-shell">
    <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('home'); }}><span className="brand-symbol"><Flower2 size={27}/></span><span>Volkspele<small>ONS ERFENIS. ONS RITME.</small></span></a>
      <p className="nav-heading">ONTDEK</p>
      <nav aria-label="Hoofkieslys">{sections.map(s => <button className={section === s.id ? 'nav-link active' : 'nav-link'} key={s.id} onClick={() => navigate(s.id)}><s.icon size={19}/>{s.label}{section === s.id && <span className="nav-dot"/>}</button>)}</nav>
      <p className="nav-heading nav-heading-second">JOU VERSAMELING</p>
      <button className={`nav-link ${section === 'saved' ? 'active' : ''}`} onClick={() => navigate('saved')}><FolderHeart size={19}/>My aflaaie<span className="count">{files.length}</span></button>
      <div className="sidebar-note"><span className="note-icon"><Download size={18}/></span><strong>Neem die tradisie saam.</strong><p>Laai jou gunstelinge af en geniet dit waar jy ook al is.</p><button onClick={() => navigate('saved')}>Bekyk my aflaaie <ArrowRight size={14}/></button></div>
      <div className="sidebar-footer"><span className="status-dot"/>{offline ? 'Vanlyn biblioteek' : 'Gemaak om saam te speel'}<small>Volkspele · v{APP_VERSION}</small></div>
    </aside>
    {menu && <button className="menu-backdrop" aria-label="Sluit kieslys" onClick={() => setMenu(false)}/>}
    <main>
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Maak kieslys oop" onClick={() => setMenu(!menu)}><Menu size={22}/></button><span>Biblioteek</span><span>/</span><strong>{section === 'saved' ? 'My aflaaie' : sections.find(s => s.id === section)?.label}</strong></div><Button variant="ghost" size="sm" onClick={() => { void sync(); checkRelease().then(setRelease).catch(() => setNotice('App-opdaterings kon nie nagegaan word nie.')); }} disabled={busy}><RefreshCw size={15} className={busy ? 'spin' : ''}/>Kyk vir opdaterings</Button></header>
      <div className="main-content">
        {release && <div className="release-banner"><span>Volkspele {release.version} is beskikbaar.</span><Button size="sm" onClick={() => void openRelease(release.url)}>Kry die nuwe weergawe <ArrowRight size={15}/></Button></div>}
        {offline && <div className="offline-banner"><WifiOff size={16}/>Vanlyn · Jou gestoorde lêers is steeds beskikbaar.</div>}
        {section === 'home' && <>
          <section className="hero welcome-hero">
            {photoUrl && !photoError && <img className="welcome-photo" src={photoUrl} alt="Volkspelers wat saam in die kring speel" onError={() => setPhotoError(true)}/>}
            <div className="welcome-shade"/>
            <div className="hero-copy"><span className="eyebrow">DIE AFRIKAANSE VOLKSANG- EN VOLKSPELEBEWEGING</span><h1>Welkom by Volkspele.<br/>Kom speel saam.</h1><p>Saam sing. Saam speel. Saam onthou. Ontdek die liedjies, passies en tradisies wat ons in die kring bymekaarbring.</p><div className="welcome-actions"><Button onClick={() => navigate('dance')}>Ontdek die liedjies <ArrowRight size={16}/></Button><Button variant="outline" onClick={() => void openRelease('https://github.com/Niclan1/automatic-waffle/releases/latest')}>Kry die app <Download size={16}/></Button></div></div>
            {!heroPhoto || photoError ? <CircleArt/> : null}
          </section>
          <div className="welcome-caption">Saamtrekfoto: <button onClick={() => void openOfficial()}>Volkspele webblad ↗</button></div>
          <div className="section-heading"><div><span className="eyebrow">LEER KEN. SPEEL SAAM.</span><h2>Meer oor ons tradisie</h2><p>Daar is ’n plek vir elke geslag in die kring.</p></div></div>
          <div className="welcome-grid">{sections.filter(s => !['home', 'dance'].includes(s.id)).map(item => <button className="welcome-card" key={item.id} onClick={() => navigate(item.id)}><item.icon size={25}/><h3>{item.label}</h3><p>{({ history: 'Ontdek die verhaal agter ons liedjies en speletjies.', clothing: 'Leer meer oor die drag wat deel van ons tradisie is.', camp: 'Vind jou kring en kom speel saam.', contact: 'Vind die regte mense om mee te gesels.' } as Record<string, string>)[item.id]}</p><ArrowRight size={18}/></button>)}</div>
          <section className="welcome-download"><FolderHeart size={30}/><div><h3>Jou gunstelinge, waar jy ook al is.</h3><p>Laai musiek, video’s en passies af. Jou gestoorde biblioteek bly beskikbaar wanneer jy vanlyn is.</p></div><Button variant="outline" onClick={() => navigate('saved')}>My aflaaie <ArrowRight size={16}/></Button></section>
        </>}
        {section === 'dance' && !active && <section className="hero"><div className="hero-copy"><span className="eyebrow"><span/>DIE TRADISIE LEEF VOORT</span><h1>Elke liedjie.<br/>’n Nuwe herinnering.</h1><p>Kom saam in die kring. Ontdek ons liedjies en speletjies, leer die passies en hou die ritme van Volkspele lewendig.</p><div className="hero-bottom"><span><Music2 size={17}/>Liedjies, passies & musiek</span><span className="hero-separator"/><span><Download size={17}/>Ook vanlyn</span></div></div><CircleArt/></section>}
        {section === 'home' ? null : active ? <>
          <button className="back-link" onClick={() => setSelected(undefined)}>← Terug na die biblioteek</button>
          <div className="page-heading"><div><span className="eyebrow">LIEDJIES & SPELETJIES · {String(active.number ?? '').padStart(2, '0')}</span><h1>{active.title}</h1><p>{active.description}</p></div></div>
          <Practice key={active.id} entry={active} files={files} onError={setNotice}/><div className="detail-panel"><h2>Aflaaie vir hierdie dans</h2><p>Laai elke lêer af om dit vanlyn te gebruik.</p>{active.assets.length ? active.assets.map(a => assetRow(a)) : <div className="empty-state"><CircleHelp size={30}/><h3>Inhoud word voorberei</h3><p>Bladmusiek, video, passies & grepe, liedjie woorde en musiek verskyn hier sodra die bronlêers gepubliseer is.</p></div>}</div>
        </> : section === 'saved' ? <>
          <div className="page-heading"><div><span className="eyebrow">JOU VERSAMELING</span><h1>My aflaaie</h1><p>Jou tradisies, saam met jou. Gereed vir vanlyn gebruik.</p></div><span className="pill">{formatBytes(prepared.totalBytes)} gestoor</span></div>
          {outdated.length > 0 && <div className="offline-banner"><RefreshCw size={16}/>{outdated.length} lêeropdatering(s) beskikbaar. Jou huidige aflaaie bly bruikbaar.</div>}
          <div className="detail-panel">{files.length ? files.map(f => assetRow(currentAssets.find(a => a.id === f.asset.id) ?? f.asset, false)) : <div className="empty-state"><FolderHeart size={36}/><h3>Maak plek vir jou gunstelinge</h3><p>Aflaaie verskyn hier. Begin by ’n liedjie en stoor die lêers wat jy wil saamneem.</p><Button onClick={() => navigate('dance')}>Ontdek die biblioteek <ArrowRight size={16}/></Button></div>}</div>
        </> : <>
          <div className="section-heading"><div><span className="eyebrow">{section === 'dance' ? 'VIND JOU RITME' : 'ONS TRADISIE'}</span><h2>{sections.find(s => s.id === section)?.label}</h2><p>{section === 'dance' ? 'Kies ’n liedjie. Leer die passies. Speel saam.' : 'Ontdek meer oor die mense en tradisies van Volkspele.'}</p></div><label className="search-box"><Search size={18}/><input aria-label="Soek in biblioteek" placeholder="Soek in die biblioteek…" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Maak soektog skoon" onClick={() => setQuery('')}><X size={15}/></button>}</label></div>
          <div className="filter-row"><span className="filter-chip">{section === 'dance' ? 'Alle liedjies' : 'Alle inligting'}</span><span>{entries.length} {section === 'dance' ? 'liedjies' : 'inskrywings'}</span><span className="filter-right">{catalog ? `Biblioteek v${catalog.version}` : busy ? 'Besig om te laai…' : 'Biblioteek nie beskikbaar nie'}</span></div>
          <div className="entry-grid">{entries.map((entry, index) => section === 'dance' ? <button className="dance-card" key={entry.id} onClick={() => setSelected(entry)}><div className={`card-art card-art-${index % 2}`}><div className="card-rings"/><Music2 className="card-music" size={48} strokeWidth={1.3}/><span className="card-number">{String(entry.number ?? index + 1).padStart(2, '0')}</span><span className="card-art-word">{index % 2 ? 'SPEEL SAAM' : 'HOU DIE RITME'}</span></div><div className="card-body"><span className="card-category">LIEDJIE & SPELETJIE</span><h3>{entry.title}<ArrowRight size={20}/></h3><p>{entry.description}</p><div className="card-meta"><span><BookOpen size={14}/>Bladmusiek</span><span><Play size={14}/>Video</span><span><BookOpen size={14}/>Passies</span><span><Music2 size={14}/>Musiek</span></div><div className="card-state">{entry.assets.length ? <><span className="status-dot"/>{entry.assets.length} lêers beskikbaar</> : <><span className="pending-dot"/>Inhoud word voorberei</>}</div></div></button> : <article className="info-card" key={entry.id}><BookOpen size={24}/><h3>{entry.title}</h3><p>{entry.description}</p>{entry.assets.length ? entry.assets.map(a => assetRow(a)) : <span className="pill">Inhoud word voorberei</span>}</article>)}</div>
          {!entries.length && <div className="empty-state">{busy ? <LoaderCircle className="spin" size={28}/> : <Search size={28}/>}<h3>{busy ? 'Biblioteek word gelaai' : query ? 'Geen resultate nie' : 'Biblioteek nie beskikbaar nie'}</h3><p>{query ? 'Probeer ’n ander liedjie se naam.' : 'Kyk jou verbinding na en probeer weer.'}</p>{!busy && !query && <Button onClick={() => void sync()}>Probeer weer</Button>}</div>}
          {section === 'dance' && <div className="library-note"><Check size={18}/><p><strong>Jou biblioteek groei saam met jou.</strong> Nuwe inhoud word apart afgelaai — sonder om die app weer te installeer.</p></div>}
        </>}
        <footer className="page-footer"><span>Volkspele. Van geslag tot geslag.</span><span>Leer · Speel · Onthou</span></footer>
      </div>
    </main>
    {notice && <div className="toast" role="status"><span>{notice}</span><button aria-label="Sluit kennisgewing" onClick={() => setNotice('')}><X size={18}/></button></div>}
    <dialog ref={dialogRef} className="viewer" onClose={() => setViewer(undefined)} onCancel={() => setViewer(undefined)}>{viewer && <><div className="viewer-header"><h2>{viewer.asset.title}</h2><Button variant="ghost" size="icon" aria-label="Sluit lêer" onClick={() => dialogRef.current?.close()}><X/></Button></div>{viewer.asset.kind === 'video' ? <PracticeMedia url={viewer.url} kind="video"/> : viewer.asset.kind === 'audio' ? <PracticeMedia url={viewer.url} kind="audio"/> : viewer.asset.kind === 'image' ? <img src={viewer.url} alt={viewer.asset.title} style={{maxWidth:'100%'}}/> : viewer.text !== undefined ? <pre>{viewer.text}</pre> : viewer.asset.mime === 'application/pdf' ? <><SheetMusic data={viewer.bytes} url={viewer.url} title={viewer.asset.title}/></> : <p>Gebruik die uitvoerknoppie by My aflaaie om hierdie lêer te stoor en oop te maak.</p>}</>}</dialog>
  </div>;
}
