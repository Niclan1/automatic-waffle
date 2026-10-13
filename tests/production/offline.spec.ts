import { test,expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('cached Pages interface and downloaded MIDI reopen when the whole browser goes offline',async({page,context})=>{
 const catalog=JSON.parse(await readFile('dist/api/v2/catalog.json','utf8'));
 await page.route('https://niclan1.github.io/automatic-waffle/**',async route=>{
  const url=route.request().url();if(url.endsWith('catalog.json'))return route.fulfill({json:catalog});
  if(url.endsWith('app.json'))return route.fulfill({json:{version:'0.2.0',url:'https://github.com/Niclan1/automatic-waffle/releases/tag/v0.2.0'}});
  return route.fulfill({body:await readFile('dist/content/'+url.split('/').pop())});
 });
 await page.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));});
 await page.getByRole('button',{name:'Ontdek die liedjies'}).click();await page.getByRole('button',{name:/Aanstap Rooies/}).click();
 await page.locator('.asset-row').filter({hasText:'liedjie met woorde en passies'}).getByRole('button',{name:'Laai af',exact:true}).click();
 await page.locator('.practice > details > summary').getByText('Bladmusiek',{exact:true}).click();
 await expect(page.locator('.midi-notation svg').first()).toBeVisible();
 const cached=await page.evaluate(async()=>{const keys=await caches.keys();return (await caches.open(keys.find(k=>k.startsWith('volkspele-shell-'))!)).keys().then(requests=>requests.map(r=>r.url));});
 expect(cached.some(url=>url.includes('.wasm'))).toBe(true);expect(cached.some(url=>url.includes('opensheetmusicdisplay'))).toBe(true);expect(cached.some(url=>url.includes('/content/')||url.includes('/api/'))).toBe(false);
 await page.unroute('https://niclan1.github.io/automatic-waffle/**');await context.setOffline(true);await page.reload();
 await expect(page.getByText('Vanlyn · Jou gestoorde lêers is steeds beskikbaar.')).toBeVisible();
 await page.getByRole('button',{name:/My aflaaie/}).first().click();await page.getByRole('button',{name:'Maak oop',exact:true}).click();
 await page.locator('dialog > details > summary').getByText('Bladmusiek',{exact:true}).click();
 await expect(page.locator('dialog .midi-notation svg').first()).toBeVisible();await expect.poll(()=>page.locator('dialog audio').evaluate((a:HTMLAudioElement)=>a.duration)).toBeGreaterThan(15);
});
