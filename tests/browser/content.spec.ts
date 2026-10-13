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
  if(url.pathname.endsWith('app.json'))return route.fulfill({json:{version:'0.4.0',url:'https://github.com/Niclan1/automatic-waffle/releases/tag/v0.4.0'}});
  const hash=url.pathname.split('/').pop();return route.fulfill({body:await readFile(`dist/content/${hash}`)});
 });
 await page.goto('/');
}
test('supplied history, clothing and laer directory expand as typed offline documents',async({page})=>{
 await library(page);
 for(const [section,needle] of [['Geskiedenis','ISBN 0 620 12222 6'],['Kleredrag','Trudie Kestell'],['Laer inligting','DORP | LAERNAAM']]){
  await page.getByRole('button',{name:section,exact:true}).first().click();
  await page.locator('.info-card > summary').first().click();
  await expect(page.locator('.info-card pre')).toContainText(needle);
  await page.getByRole('button',{name:'Laai af',exact:true}).first().click();
  await page.getByRole('button',{name:'Maak oop',exact:true}).first().click();
  await expect(page.locator('dialog pre')).toContainText(needle);
  await page.getByRole('button',{name:'Sluit lêer',exact:true}).click();
 }
 await page.unroute('https://niclan1.github.io/automatic-waffle/**');await page.route('https://niclan1.github.io/automatic-waffle/**',route=>route.abort());
 await page.reload();await page.getByRole('button',{name:/My aflaaie/}).first().click();await expect(page.getByRole('button',{name:'Maak oop',exact:true})).toHaveCount(3);
 await page.getByRole('button',{name:'Geskiedenis',exact:true}).first().click();await page.locator('.info-card > summary').first().click();await expect(page.locator('.info-card pre')).toContainText('ISBN 0 620 12222 6');
});
for(const width of [1280,390])test(`one lyric MIDI and accordion score render at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await library(page);await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 await expect(page.getByRole('button',{name:'Laai af',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Laai af',exact:true}).click();
 await expect(page.locator('.midi-notation')).not.toBeVisible();
 await page.locator('.practice > details > summary').getByText('Bladmusiek',{exact:true}).click();
 await expect(page.locator('.midi-notation svg').first()).toBeVisible();await expect(page.locator('.practice .sheet-scroll img')).toHaveCount(0);
 await page.locator('audio').evaluate((audio:HTMLAudioElement)=>{audio.pause();audio.currentTime=0;});
 await page.getByRole('status').getByRole('button',{name:'Sluit kennisgewing'}).click();
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
 await expect(page.locator('.practice')).toHaveScreenshot(`practice-${width}.png`,{animations:'disabled',mask:[page.locator('audio'),page.locator('.piano-roll > svg > line')],maxDiffPixelRatio:0.005});
});
test('both single song downloads contain all supplied verses and typed opening instructions',async({page})=>{
 await library(page);await page.getByRole('button',{name:'Ontdek die liedjies'}).click();
 for(const [name,verse] of [['Aanstap Rooies','Pak hom, twaalftal'],['Blinkvosperd',"twaalf groot seuns"]]){
  await page.getByRole('button',{name:new RegExp(name)}).click();
  await expect(page.getByRole('button',{name:'Laai af',exact:true})).toHaveCount(1);await page.getByRole('button',{name:'Laai af',exact:true}).click();
  await page.locator('.practice > details > summary').getByText('Liedjie woorde',{exact:true}).click();await expect(page.locator('.practice pre').first()).toContainText(verse);
  await page.locator('.practice > details > summary').getByText('Passies & grepe',{exact:true}).click();await expect(page.locator('.practice pre').last()).not.toBeEmpty();
  await expect(page.locator('.practice .sheet-scroll img')).toHaveCount(0);await page.getByRole('button',{name:/Terug na die biblioteek/}).click();
 }
 await page.getByRole('button',{name:/My aflaaie/}).first().click();await expect(page.getByRole('button',{name:'Maak oop',exact:true})).toHaveCount(2);
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
 const release=page.waitForEvent('popup');await page.getByRole('button',{name:/Kry die nuwe weergawe/}).click();const popup=await release;await popup.waitForLoadState('domcontentloaded').catch(()=>{});expect(popup.url()).toContain('/releases/tag/v0.4.0');await popup.close();
 await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 await page.locator('.practice > details > summary').getByText('Dansdemonstrasie',{exact:true}).click();const video=page.waitForEvent('popup');await page.getByRole('button',{name:/Kyk die dansdemonstrasie/}).click();const movie=await video;await movie.waitForLoadState('domcontentloaded').catch(()=>{});expect(movie.url()).toContain('-lKfaUs5G3Y');await movie.close();
});
for(const width of [1280,390])test(`welcome renders at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await library(page);await expect.poll(()=>page.locator('.welcome-photo').evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBeGreaterThan(800);
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',width);
 await page.getByRole('status').getByRole('button',{name:'Sluit kennisgewing'}).click();
 await expect(page).toHaveScreenshot(`welcome-${width}.png`,{fullPage:true,animations:'disabled',maxDiffPixelRatio:0.005});
});
