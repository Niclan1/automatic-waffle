import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button } from './ui/button';
GlobalWorkerOptions.workerSrc = workerUrl;
export function SheetMusic({ url, title, data }: { url: string; title: string; data?:Uint8Array }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  useEffect(() => {
    setPdf(undefined); setPage(1); setError('');
    const task = getDocument({ ...(data ? {data:data.slice()} : {url}), useSystemFonts: true });
    let alive = true;
    task.promise.then(value => { if (alive) setPdf(value); }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; void task.destroy(); };
  }, [url,data]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let alive = true;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    const target = canvas.current;
    void pdf.getPage(page).then(p => {
      if (!alive) return;
      const viewport = p.getViewport({ scale: 1.5 * zoom });
      target.width = viewport.width; target.height = viewport.height;
      target.style.width = `${100 * zoom}%`;
      task = p.render({ canvas: target, viewport });
      return task.promise;
    }).catch(e => { if (alive) setError(String(e)); });
    return () => { alive = false; task?.cancel(); };
  }, [pdf, page, zoom]);
  return <div className="sheet-viewer"><div className="practice-controls"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Vorige bladsy</Button><span>Bladsy {page} / {pdf?.numPages ?? '…'}</span><Button variant="outline" disabled={!pdf || page >= pdf.numPages} onClick={() => setPage(p => p + 1)}>Volgende bladsy</Button><label>Vergroot <select aria-label="Vergroot bladmusiek" value={zoom} onChange={e => setZoom(Number(e.target.value))}><option value={1}>100%</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label></div>{error ? <p role="alert">Bladmusiek kon nie vertoon word nie. {error}</p> : <div className="sheet-scroll"><canvas ref={canvas} aria-label={`${title} — bladsy ${page}`} role="img"/></div>}</div>;
}
