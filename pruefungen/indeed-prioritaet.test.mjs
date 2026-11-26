import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {EventEmitter} from 'node:events';import * as router from '../dist/indeed-connectors.mjs';import * as jobspy from '../dist/indeed-ts-jobspy.mjs';
process.env.JOBPILOT_INDEED_TS_JOBSPY='0';
const worker=fs.readFileSync(new URL('../werkzeuge/indeed-ts-jobspy-worker.cjs',import.meta.url),'utf8');


const angebot = (beschreibung = 'Originaltext '.repeat(20), ort = 'Gießen') => ({ source: 'indeed', externalRef: 'test', title: 'Werkstudent Data', company: 'Beispiel GmbH', location: ort, url: 'https://de.indeed.com/viewjob?jk=synthetisch', description: beschreibung, complete: true });
const ergebnis = (fertig=[], offen=[], offers=[]) => ({offers, completedKeywords:fertig, remainingKeywords:offen, report:{source:'indeed',status:fertig.length||offers.length?'partial':'error',found:offers.length,inserted:0,message:'Synthetische Prüfung'}});
const karte = {title:'Werkstudent Data',company:'Beispiel GmbH',location:'Gießen',url:'https://de.indeed.com/viewjob?jk=synthetisch',description:'Beschreibung '.repeat(20),posted_date:'2026-11-26'};

test('Kostenlos zuerst; bestätigte leere Suche startet keinen Connector',async()=>{
 const aufrufe=[]; const r=await router.scanIndeedViaConnector(['A'],'Gießen',100,'auto',{
 primaer:async b=>{aufrufe.push('frei');return ergebnis(b,[]);},codex:async()=>{aufrufe.push('codex');throw Error();},claude:async()=>{aufrufe.push('claude');throw Error();},claudeAvailable:()=>true});
 assert.deepEqual(aufrufe,['frei']);assert.equal(r.report.found,0);assert.equal(r.completedKeywords.join(','),'A');assert.equal(r.remainingKeywords.length,0);
});
test('Nur unerledigte Begriffe wechseln in der Reihenfolge frei, Codex, Claude; Teilergebnisse bleiben',async()=>{
 const aufrufe=[];
 const r=await router.scanIndeedViaConnector(['A','B','C'],'Gießen',100,'auto',{
 primaer:async b=>{aufrufe.push(['frei',...b]);return ergebnis(['A'],['B','C'],[angebot('kurz','Gießen, HE, DE')]);},
 codex:async b=>{aufrufe.push(['codex',...b]);return ergebnis(['B'],['C'],[angebot()]);},
 claude:async b=>{aufrufe.push(['claude',...b]);return ergebnis(b,[]);},claudeAvailable:()=>true});
 assert.deepEqual(aufrufe,[['frei','A','B','C'],['codex','B','C'],['claude','C']]);
 assert.equal(r.remainingKeywords.length,0);assert.equal(r.offers.length,1);assert.equal(r.offers[0].description,angebot().description);
});
test('Ausnahmen, fehlender Connector und ausdrücklicher Ersatzanbieter liefern einen ehrlichen Stand',async()=>{
 const aufrufe=[];const d={primaer:async()=>{aufrufe.push('frei');throw Error('Zeitlimit');},codex:async()=>{aufrufe.push('codex');return ergebnis([],['A']);},claude:async()=>{aufrufe.push('claude');throw Error('Anmeldung fehlt');},claudeAvailable:()=>true};
 let r=await router.scanIndeedViaConnector(['A'],'Gießen',50,'claude',d);
 assert.deepEqual(aufrufe,['frei','claude','codex']);assert.equal(r.report.status,'error');assert.equal(r.remainingKeywords.join(','),'A');
 aufrufe.length=0;r=await router.scanIndeedViaConnector(['A'],'Gießen',50,'auto',{...d,claudeAvailable:()=>false});
 assert.deepEqual(aufrufe,['frei','codex']);assert.match(r.report.message,/nicht verfügbar/);
 await assert.rejects(router.scanIndeedViaConnector(['A'],'Gießen',50,'unbekannt',d));
});
test('Extraktor: begrenzte Kriterien, fünf einzelne Suchen, echte Leerlisten, Cacheablauf und keine Geheimnisse',async()=>{
 const alt=process.env.JOBPILOT_INDEED_TS_JOBSPY;delete process.env.JOBPILOT_INDEED_TS_JOBSPY;
 try{
 let anzahl=0,zeit=0;const speicher=jobspy.neuerIndeedSpeicher(),lauf=async()=>{anzahl++;return{status:'empty',anfragen:1,jobs:[]};};
 let r=await jobspy.scanIndeedViaJobspy(['A','B','C','D','E','F','A'],'Gießen',50,lauf,speicher,()=>zeit);
 assert.equal(anzahl,5);assert.equal(r.completedKeywords.length,5);assert.equal(r.report.found,0);
 r=await jobspy.scanIndeedViaJobspy(['A'],'Gießen',50,lauf,speicher,()=>zeit);assert.equal(anzahl,5);assert.match(r.report.message,/1 aus dem/);
 zeit=600001;await jobspy.scanIndeedViaJobspy(['A'],'Gießen',50,lauf,speicher,()=>zeit);assert.equal(anzahl,6);
 await jobspy.scanIndeedViaJobspy(['A'],'Gießen',0,lauf,speicher);assert.equal(anzahl,6);
 const env=jobspy.jobspyUmgebung({PATH:'ja',SYSTEMROOT:'ja',DATABASE_URL:'nein',HTTP_PROXY:'nein',HTTPS_PROXY:'nein',NODE_OPTIONS:'nein',OPENAI_API_KEY:'nein'});
 assert.equal(env.PATH,'ja');assert.equal(env.NODE_ENV,'production');assert.equal(Object.keys(env).length,3);
 }finally{if(alt===undefined)delete process.env.JOBPILOT_INDEED_TS_JOBSPY;else process.env.JOBPILOT_INDEED_TS_JOBSPY=alt;}
});
test('Extraktor: Sperre oder kaputte Daten stoppen sofort; Teilkarten bleiben, eine Stunde keine direkte Wiederholung',async()=>{
 const alt=process.env.JOBPILOT_INDEED_TS_JOBSPY;delete process.env.JOBPILOT_INDEED_TS_JOBSPY;
 try{
 let n=0,zeit=0;const speicher=jobspy.neuerIndeedSpeicher();
 const lauf=async()=>{n++;return n===1?{status:'ok',anfragen:1,jobs:[karte]}:{status:'error',anfragen:1,jobs:[]};};
 let r=await jobspy.scanIndeedViaJobspy(['A','B','C'],'Gießen',100,lauf,speicher,()=>zeit);
 assert.equal(n,2);assert.equal(r.offers.length,1);assert.equal(r.completedKeywords.join(','),'A');assert.equal(r.remainingKeywords.join(','),'B,C');
 await jobspy.scanIndeedViaJobspy(['C'],'Gießen',100,lauf,speicher,()=>zeit);assert.equal(n,2);
 zeit=3600001;await jobspy.scanIndeedViaJobspy(['C'],'Gießen',100,lauf,speicher,()=>zeit);assert.equal(n,3);
 for(const roh of [{status:'ok',anfragen:0,jobs:[]},{status:'ok',anfragen:1,jobs:[{}]},{status:'error',anfragen:1,jobs:[]}]){
 r=await jobspy.scanIndeedViaJobspy(['X'],'Gießen',100,async()=>roh,jobspy.neuerIndeedSpeicher());assert.equal(r.report.status,'error');assert.equal(r.completedKeywords.length,0);}
 r=await jobspy.scanIndeedViaJobspy(['X'],'Gießen',100,async()=>({status:'ok',anfragen:1,jobs:[karte,{...karte,company:null}]}),jobspy.neuerIndeedSpeicher());
 assert.equal(r.offers.length,1);assert.equal(r.completedKeywords.join(','),'X','Einzelne unbrauchbare Karten lösen keine Wiederholung aus');
 }finally{if(alt===undefined)delete process.env.JOBPILOT_INDEED_TS_JOBSPY;else process.env.JOBPILOT_INDEED_TS_JOBSPY=alt;}
});
test('Worker erlaubt nur einen HTTPS-POST an Indeed, keine Folgeanfragen oder fremden Hosts',async()=>{
 async function pruefen(zweiterHost){
 const eingang=new EventEmitter(),aus=[];eingang.setEncoding=()=>{};let wirklich=0;
 const https={request(){wirklich++;return{};}},http={request(){throw Error('unerwartet');}};
 vm.runInNewContext(worker,{URL,process:{stdin:eingang,stdout:{write:s=>aus.push(s)},exit:()=>{throw Error('exit');}},require:id=>id==='node:https'?https:id==='node:http'?http:{scrapeJobs:async optionen=>{
 assert.deepEqual([...optionen.sites],['indeed']);assert.equal(optionen.country,'germany');assert.equal(optionen.distance,63);assert.equal(optionen.resultsWanted,20);
 https.request({hostname:'apis.indeed.com',path:'/graphql',method:'POST'});
 if(zweiterHost)https.request({hostname:zweiterHost,path:'/graphql',method:'POST'});
 return{jobs:[],meta:{sites:[{site:'indeed',status:'empty'}]}};
 }}});
 eingang.setEncoding=()=>{};
 // setEncoding wird schon beim Laden gebraucht; siehe EventEmitter-Prototyp im Aufrufer.
 eingang.emit('data',JSON.stringify({begriff:'Werkstudent Data',stadt:'Gießen',radius:100}));eingang.emit('end');
 await new Promise(r=>setImmediate(r));return{wirklich,r:JSON.parse(aus.join(''))};
 }
 let r=await pruefen();assert.equal(r.wirklich,1);assert.equal(r.r.status,'empty');
 for(const host of ['apis.indeed.com','fremd.example']){r=await pruefen(host);assert.equal(r.wirklich,1);assert.equal(r.r.status,'error');}
});
