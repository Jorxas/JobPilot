import {test} from 'node:test';
import assert from 'node:assert/strict';
import {berlinerSuchtag,amSuchtagGefunden} from '../dist/suchtag.mjs';
test('Tagesfunde: Berliner Mitternacht im Winter und Sommer; frühere Tage bleiben gespeichert',()=>{
 for(const [utc,tag] of [['2026-11-27T22:59:59Z','2026-11-27'],['2026-11-27T23:00:00Z','2026-11-28'],['2026-07-10T21:59:59Z','2026-07-10'],['2026-07-10T22:00:00Z','2026-07-11']])assert.equal(berlinerSuchtag(new Date(utc)),tag);
 const alle=[{addedAt:'2026-11-26'},{addedAt:'2026-11-27'},{addedAt:'2026-11-28'},{}, {addedAt:'2026-11-27T10:00:00Z'}];
 assert.equal(alle.filter(s=>amSuchtagGefunden(s.addedAt,'2026-11-27')).length,1);assert.equal(alle.length,5);
});
