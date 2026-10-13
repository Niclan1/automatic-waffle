import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildContent } from '../../scripts/build-content.mjs';
test.beforeAll(async()=>{await buildContent();});
async function library(page:Page){
 const catalog=JSON.parse(await readFile('dist/api/v2/catalog.json','utf8'));
 await page.route('https://niclan1.github.io/automatic-waffle/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname.endsWith('catalog.json'))return route.fulfill({json:catalog});
  if(url.pathname.endsWith('app.json'))return route.fulfill({json:{version:'0.3.0',url:'https://github.com/Niclan1/automatic-waffle/releases/tag/v0.3.0'}});
  const hash=url.pathname.split('/').pop();return route.fulfill({body:await readFile(`dist/content/${hash}`)});
 });
 await page.goto('/');
}
test('supplied history, clothing and dated laer directory open as rendered offline documents',async({page})=>{
 await library(page);
 for(const [section,needle] of [['Geskiedenis','ISBN 0 620 12222 6'],['Kleredrag','Trudie Kestell'],['Laer inligting','DORP | LAERNAAM']]){
  await page.getByRole('button',{name:section,exact:true}).first().click();
  await page.getByRole('button',{name:'Laai af',exact:true}).first().click();
  await page.getByRole('button',{name:'Maak oop',exact:true}).first().click();
  await expect(page.locator('dialog pre')).toContainText(needle);await expect(page.locator('dialog pre')).toBeVisible();
  if(section==='Geskiedenis')await expect(page.locator('dialog pre')).toContainText('Hoërskool Boshoff');
  await page.getByRole('button',{name:'Sluit lêer',exact:true}).click();
 }
 await page.unroute('https://niclan1.github.io/automatic-waffle/**');await page.route('https://niclan1.github.io/automatic-waffle/**',route=>route.abort());
 await page.reload();await page.getByRole('button',{name:/My aflaaie/}).first().click();await expect(page.getByRole('button',{name:'Maak oop',exact:true})).toHaveCount(3);
});
for(const width of [1280,390])test(`MIDI, original score and lyrics render together at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await library(page);await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 for(const title of ['konsep MIDI melodielyn','oorspronklike partituur','liedjie woorde'])await page.locator('.asset-row').filter({hasText:title}).getByRole('button',{name:'Laai af',exact:true}).click();
 await expect(page.locator('.midi-notation svg').first()).toBeVisible();await expect(page.locator('.sheet-scroll img')).toBeVisible();await expect(page.locator('.practice pre')).toContainText('Wieg julle koppe fraai');
 await page.locator('audio').evaluate((audio:HTMLAudioElement)=>{audio.pause();audio.currentTime=0;});
 await page.getByRole('status').getByRole('button',{name:'Sluit kennisgewing'}).click();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
 await expect(page.locator('.practice')).toHaveScreenshot(`practice-${width}.png`,{animations:'disabled',mask:[page.locator('audio'),page.locator('.piano-roll > svg > line')],maxDiffPixelRatio:0.005});
});
test('original score photograph and supplied lyrics render beside the MIDI practice panel',async({page})=>{
 await library(page);await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 for(const title of ['oorspronklike partituur','liedjie woorde']){await page.locator('.asset-row').filter({hasText:title}).getByRole('button',{name:'Laai af',exact:true}).click();}
 await expect.poll(()=>page.locator('.sheet-scroll img').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(800);
 await expect(page.locator('.practice pre')).toContainText('Wieg julle koppe fraai');
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',1280);
});
test('cancelled download leaves no saved record and retry succeeds',async({page})=>{
 const bytes=Buffer.from('Cancellation regression');const hash=createHash('sha256').update(bytes).digest('hex');
 const asset={id:'cancel-test',title:'Kansellasie',kind:'lyrics',mime:'text/plain',version:'1.0.0',bytes:bytes.length,sha256:hash,path:`content/${hash}`};
 let pending=true;let releaseDownload:()=>void=()=>{};const wait=new Promise<void>(resolve=>{releaseDownload=resolve;});
 await page.route('https://niclan1.github.io/automatic-waffle/**',async route=>{
  if(route.request().url().endsWith('catalog.json'))return route.fulfill({json:{schemaVersion:1,version:'1.0.0',entries:[{id:'dance',title:'Dans',category:'dance',description:'',assets:[asset]}]}});
  if(route.request().url().endsWith('app.json'))return route.fulfill({json:{version:'0.2.0',url:'https://github.com/Niclan1/automatic-waffle/releases/latest'}});
  if(pending)await wait;await route.fulfill({body:bytes}).catch(()=>{});
 });
 await page.goto('/');await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Dans/}).click();await page.getByRole('button',{name:'Laai af',exact:true}).click();
 await page.getByRole('button',{name:'0%',exact:true}).click();releaseDownload();
 await expect(page.getByRole('status')).toContainText('gekanselleer');await expect(page.getByRole('button',{name:'Maak oop',exact:true})).toHaveCount(0);
 pending=false;await page.getByRole('button',{name:'Laai af',exact:true}).click();await expect(page.getByRole('button',{name:'Maak oop',exact:true})).toBeVisible();
});
test('release and demonstration buttons open the approved URLs',async({page,context})=>{
 await library(page);await context.route('https://github.com/**',route=>route.fulfill({body:'<p>Release</p>',contentType:'text/html'}));await context.route('https://youtu.be/**',route=>route.fulfill({body:'<p>Video</p>',contentType:'text/html'}));
 const release=page.waitForEvent('popup');await page.getByRole('button',{name:/Kry die nuwe weergawe/}).click();const popup=await release;await popup.waitForLoadState('domcontentloaded').catch(()=>{});expect(popup.url()).toContain('/releases/tag/v0.3.0');await popup.close();
 await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 const video=page.waitForEvent('popup');await page.getByRole('button',{name:/Kyk die dansdemonstrasie/}).click();const movie=await video;await movie.waitForLoadState('domcontentloaded').catch(()=>{});expect(movie.url()).toContain('-lKfaUs5G3Y');await movie.close();
});
for(const width of [1280,390])test(`welcome renders at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await library(page);await expect.poll(()=>page.locator('.welcome-photo').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(800);
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
 await page.getByRole('status').getByRole('button',{name:'Sluit kennisgewing'}).click();
 await expect(page).toHaveScreenshot(`welcome-${width}.png`,{fullPage:true,animations:'disabled',maxDiffPixelRatio:0.005});
});
