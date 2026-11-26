import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {erstelleServer} from '../dist/server.mjs';

test('Eigene Profile, Antworten und Bewerbungsmappen: echte lokale API, Schutz und Persistenz',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'jobpilot-formular-api-'));
 const app=(id,company='Beispielbetrieb',status='pending')=>({id,company,status,title:'Werkstudent IT',source:'bundesagentur',externalRef:id,url:'https://arbeitgeber.example.test/formular',score:0});
 const zustand={stellen:[app('a'),app('b','Schon beworben'),app('c','Schon beworben','applied'),app('archiv','Archiviert','archived'),app('leer','Ohne PDF')],modus:'live',runde:0,seiten:{},berichte:[]};
 const datei=path.join(temp,'zustand.json');await writeFile(datei,JSON.stringify(zustand));
 const server=erstelleServer({datenordner:temp,live:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const basis='http://127.0.0.1:'+server.address().port;
 const req=async(p,body,headers={})=>{const r=await fetch(basis+p,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};};
 const ext=(body,headers={})=>req('/api/jobpilot/erweiterung',body,{'X-JobPilot-Erweiterung':'1',...headers});
 try{
  assert.deepEqual((await req('/api/profil')).body,{profile:{},bank:[]},'Kein fremdes Profil oder Beispielprofil');
  assert.equal((await req('/api/profil',{profile:{firstName:'Testa',locationPreferences:['Gießen']},bank:[]})).status,200);
  assert.equal((await req('/api/jobpilot/erweiterung',{aktion:'profil'})).status,403);
  assert.equal((await ext({aktion:'profil'},{Origin:'https://fremd.example.test'})).status,403);
  assert.equal((await ext({aktion:'profil'},{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await req('/api/profil',null)).status,400);
  assert.equal((await ext({aktion:'start',id:'leer'})).status,409,'Keine Bewerbung ohne gezielte PDF');
  assert.equal((await ext({aktion:'dateien',id:'leer'})).status,409);
  assert.equal((await ext({aktion:'fuellen',id:'leer'})).body.dokumente,undefined,'Text ausfüllen ohne PDF bei unvollständiger Mappe');
  const pdf=kind=>({kind,name:kind+'.pdf',base64:Buffer.from('%PDF-1.4\nSynthetischer Test\n%%EOF').toString('base64')});
  const speichern=d=>req('/api/bewerbung',{id:'a',dokumente:[pdf('cv'),pdf('letter')],...d});
  assert.equal((await speichern({dokumente:[{...pdf('cv'),isGeneral:true}]})).status,400);
  assert.equal((await speichern({dokumente:[{...pdf('cv'),base64:Buffer.from('kein PDF').toString('base64')}]})).status,400);
  assert.equal((await speichern({dokumente:[{...pdf('cv'),name:'../falsch.pdf'}]})).status,400);
  assert.equal((await speichern({contactPortalUrl:'http://127.0.0.1/'})).status,400);
  assert.equal((await speichern({})).status,200);
  const start=await ext({aktion:'start',id:'a'});assert.equal(start.status,200);assert.equal(start.body.url,zustand.stellen[0].url);
  const filled=(await ext({aktion:'fuellen',id:'a'})).body;assert.equal(filled.profile.firstName,'Testa');assert.equal(filled.dokumente.length,2);assert.match(filled.dokumente[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal((await ext({aktion:'frei-merken',question:'Lieblingseditor',answer:'Vim'})).status,200);
  const frei=(await ext({aktion:'profil'})).body;assert.equal(frei.bank[0].answer,'Vim');assert.equal(frei.dokumente,undefined,'Freie Seiten haben keine PDF');
  assert.equal((await ext({aktion:'frei-merken',question:'x',answer:'x'.repeat(4001)})).status,400);
  for(const id of ['b','c','archiv'])for(const aktion of ['start','status','fuellen','merken','dateien'])assert.equal((await ext({aktion,id,question:'x',answer:'y'})).status,409,id+' '+aktion);
  assert.equal((await req('/api/bewerbung?id=unbekannt')).status,404);
  assert.equal((await req('/api/bewerbung',{id:'leer',dokumente:[pdf('cv')],applicationChannel:'portal-only'})).status,200);
  assert.equal((await ext({aktion:'start',id:'leer'})).status,409,'Brief nicht still ableiten');
  await req('/api/bewerbung',{id:'leer',dokumente:[pdf('cv')],applicationChannel:'portal-only',letterNotRequired:true});
  assert.equal((await ext({aktion:'start',id:'leer'})).status,200);
  zustand.stellen[0].status='applied';await writeFile(datei,JSON.stringify(zustand));
  assert.equal((await ext({aktion:'fuellen',id:'a'})).status,409,'Stand vor jeder Aktion neu lesen');
  assert.equal(JSON.parse(await readFile(path.join(temp,'formularprofil.json'),'utf8')).bank[0].answer,'Vim');
  for(const route of ['/profile','/dossier/a']){const r=await fetch(basis+route);const html=await r.text();assert.equal(r.status,200);assert(!html.includes('assets/demo.js'));assert(html.includes('src="/assets/app.js"'));}
 }finally{await new Promise(r=>server.close(r));assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'jobpilot-formular-api-'));await rm(temp,{recursive:true,force:true});}
});
