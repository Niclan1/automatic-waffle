import {test,expect} from '@playwright/test';
import {notationHtml} from '../../apps/mobile/src/components/notationHtml';
test('native inline score renderer draws lyric notation with networking disabled',async({page,context})=>{
 await context.setOffline(true);
 await page.setViewportSize({width:390,height:844});
 const xml=`<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Song</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type><lyric><text>Sing</text></lyric></note></measure></part></score-partwise>`;
 await page.setContent(notationHtml(xml));await expect(page.locator('#score svg').first()).toBeVisible();await expect(page.locator('#score')).toContainText('Sing');await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);
});
