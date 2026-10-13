import {notationRenderer} from '../generated/notation-renderer';
export function notationHtml(xml:string){
 const renderer=notationRenderer.replace(/<\/script/gi,'<\\/script');
 const data=JSON.stringify(xml).replace(/</g,'\\u003c');
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:"><style>body{margin:0;background:white}#scroll{width:100%;overflow-x:auto}#score{width:100%;min-width:640px}</style></head><body><div id="scroll"><div id="score"></div></div><script>${renderer}</script><script>const score=new opensheetmusicdisplay.OpenSheetMusicDisplay(document.getElementById('score'),{backend:'svg',autoResize:true,drawTitle:false,drawPartNames:false});score.load(${data}).then(()=>{score.render();window.ReactNativeWebView?.postMessage(JSON.stringify({height:document.body.scrollHeight}));}).catch(error=>{document.getElementById('score').textContent=String(error);});</script></body></html>`;
}
