import path from 'node:path';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import type {Stelle} from './beispiele';
import {companyKey} from './kern/company-catalogue';
import {dossierBlock,isGeneralDocument,missingDossierParts} from './kern/tracker-attachments';
import {firmenSperre} from './archiv';

type Dokument={kind:'cv'|'letter'|'bundle';name:string;type:'application/pdf';base64:string;sha256:string;isGeneral?:boolean};
type Mappe={dokumente:Dokument[];applicationChannel?:string;letterNotRequired?:boolean;contactPortalUrl?:string};
type Profil={profile:Record<string,string|string[]>;bank:{question:string;answer:string}[]};
const problem=(text:string,status=400)=>Object.assign(Error(text),{status});
const objekt=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw problem('Ungültige Daten.');return v as Record<string,unknown>;};
const profilKeys=new Set('firstName lastName fullName email phone phoneCountryCode city street houseNumber postalCode country state portfolio github linkedin availability startDate weeklyHours annualSalary hourlySalary internship fieldOfInterest university degree salutation employmentType birthDate birthPlace nationality germanLevel englishLevel internshipDuration internshipPeriod locationPreferences'.split(' '));
function profilPruefen(wert:unknown):Profil['profile']{
 const p=objekt(wert),out:Profil['profile']={};
 for(const [k,v] of Object.entries(p))if(profilKeys.has(k)){
  if(k==='locationPreferences'&&Array.isArray(v)&&v.length<=20&&v.every(x=>typeof x==='string'&&x.length<=200))out[k]=v;
  else if(typeof v==='string'&&v.length<=3000)out[k]=v.trim();
  else throw problem('Profilwert ungültig: '+k);
 }
 return out;
}
function bankPruefen(wert:unknown):Profil['bank']{
 if(!Array.isArray(wert)||wert.length>500)throw problem('Antwortbank ungültig.');
 return wert.map(v=>{const e=objekt(v);if(typeof e.question!=='string'||typeof e.answer!=='string'||!e.question.trim()||!e.answer.trim()||e.question.length>600||e.answer.length>4000)throw problem('Antwort fehlt oder ist zu lang.');return {question:e.question.trim(),answer:e.answer.trim()};});
}
function dokumentPruefen(wert:unknown):Dokument{
 const d=objekt(wert);
 if(!['cv','letter','bundle'].includes(String(d.kind))||isGeneralDocument(String(d.kind),d)||d.isGeneral===true)throw problem('Nur gezielte Unterlagen dieser Bewerbung verwenden.');
 if(typeof d.name!=='string'||!d.name.trim()||d.name.length>200||/[\\/\r\n]/.test(d.name)||!d.name.toLowerCase().endsWith('.pdf'))throw problem('PDF-Dateiname ungültig.');
 if(typeof d.base64!=='string'||d.base64.length>4194304||!/^[A-Za-z0-9+/]+={0,2}$/.test(d.base64))throw problem('PDF höchstens 3 MiB.');
 const bytes=Buffer.from(d.base64,'base64');
 if(bytes.length>3*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||bytes.toString('base64')!==d.base64)throw problem('Keine gültige PDF-Datei.');
 return {kind:d.kind as Dokument['kind'],name:d.name,type:'application/pdf',base64:d.base64,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function formularassistent(datenordner:string,stellen:()=>Promise<Stelle[]>){
 const profilDatei=path.join(datenordner,'formularprofil.json'),mappenDatei=path.join(datenordner,'bewerbungsunterlagen.json');
 let warteschlange:Promise<unknown>=Promise.resolve();
 async function lesen<T>(datei:string,leer:T):Promise<T>{try{return JSON.parse(await readFile(datei,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return leer;throw problem('Lokale Assistentdaten nicht lesbar.',500);}}
 async function schreiben(datei:string,wert:unknown){await mkdir(datenordner,{recursive:true});const tmp=datei+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(wert,null,2),{mode:0o600});await rename(tmp,datei);}
 function aendern<T>(fn:()=>Promise<T>):Promise<T>{const lauf=warteschlange.then(fn);warteschlange=lauf.catch(()=>{});return lauf;}
 const profilLesen=()=>lesen<Profil>(profilDatei,{profile:{},bank:[]});
 const mappenLesen=()=>lesen<Record<string,Mappe>>(mappenDatei,{});
 async function bewerbung(id:unknown,schuetzen=false){
  if(typeof id!=='string'||!id||id.length>200)throw problem('Bewerbungs-ID fehlt.');
  const liste=await stellen(),app=liste.find(s=>s.id===id);
  if(!app)throw problem('Bewerbung nicht gefunden.',404);
  if(schuetzen&&(!['pending','unknown'].includes(app.status)||firmenSperre(liste,app.id)))throw problem('Diese Bewerbung oder Firma ist bereits versandt, archiviert oder ausgeschlossen. Keine erneute Befüllung.',409);
  const mappe=(await mappenLesen())[id]||{dokumente:[]};
  const item={...app,...mappe,documents:mappe.dokumente};
  return {app,mappe,item};
 }
 const pdf=(m:Mappe)=>m.dokumente.some(d=>d.kind==='bundle')?[m.dokumente.find(d=>d.kind==='bundle')!]:m.dokumente.filter(d=>['cv','letter'].includes(d.kind)&&!isGeneralDocument(d.kind,d));
 async function profilSpeichern(d:Record<string,unknown>){return aendern(async()=>{const profil={profile:profilPruefen(d.profile),bank:bankPruefen(d.bank??[])};await schreiben(profilDatei,profil);return {gespeichert:true};});}
 async function antwortMerken(d:Record<string,unknown>){const [eintrag]=bankPruefen([{question:d.question,answer:d.answer}]);await aendern(async()=>{const p=await profilLesen();p.bank=[...p.bank.filter(x=>x.question!==eintrag.question),eintrag];if(p.bank.length>500)throw problem('Antwortbank voll.');await schreiben(profilDatei,p);});}
 async function dossierLesen(id:unknown){const {app,mappe,item}=await bewerbung(id);return {app,mappe,fehlt:missingDossierParts(item),block:dossierBlock(item)};}
 async function dossierSpeichern(d:Record<string,unknown>){return aendern(async()=>{
  const {app}=await bewerbung(d.id,true);
  if(!Array.isArray(d.dokumente)||d.dokumente.length>3)throw problem('Unterlagen ungültig.');
  const dokumente=d.dokumente.map(dokumentPruefen);if(new Set(dokumente.map(x=>x.kind)).size!==dokumente.length)throw problem('Dokument doppelt.');
  const mappe:Mappe={dokumente};
  if(d.applicationChannel==='portal-only')mappe.applicationChannel='portal-only';
  if(typeof d.letterNotRequired==='boolean')mappe.letterNotRequired=d.letterNotRequired;
  if(d.contactPortalUrl)mappe.contactPortalUrl=zielUrl(String(d.contactPortalUrl));
  const mappen=await mappenLesen();mappen[app.id]=mappe;await schreiben(mappenDatei,mappen);return {gespeichert:true};
 });}
 async function aktion(d:Record<string,unknown>){
  if(d.aktion==='profil'||d.aktion==='frei-merken'){if(d.aktion==='frei-merken')await antwortMerken(d);return profilLesen();}
  if(!['start','status','fuellen','merken','dateien'].includes(String(d.aktion)))throw problem('Ungültige Aktion.');
  const {app,mappe,item}=await bewerbung(d.id,true),block=dossierBlock(item);
  if(block&&(d.aktion==='start'||d.aktion==='dateien'))throw problem(block,409);
  if(d.aktion==='status')return {firma:app.company||'Bewerbung'};
  if(d.aktion==='start')return {firma:app.company||'Bewerbung',url:zielUrl(mappe.applicationChannel==='portal-only'&&mappe.contactPortalUrl?mappe.contactPortalUrl:app.url)};
  if(d.aktion==='dateien')return {dokumente:pdf(mappe)};
  if(d.aktion==='merken')await antwortMerken(d);
  return {...await profilLesen(),...(!block?{dokumente:pdf(mappe)}:{})};
 }
 async function unterlagenStand(){const mappen=await mappenLesen();return Object.fromEntries((await stellen()).filter(s=>Object.hasOwn(mappen,s.id)).map(s=>[s.id,missingDossierParts({...s,...mappen[s.id],documents:mappen[s.id].dokumente}).map(k=>k==='cv'?'gezielter Lebenslauf':'Anschreiben')]));}
 async function trackerDaten(){const mappen=await mappenLesen();return Object.fromEntries(Object.entries(mappen).map(([id,m])=>[id,{applicationChannel:m.applicationChannel,letterNotRequired:m.letterNotRequired,documents:m.dokumente.map(d=>({kind:d.kind,filename:d.name,contentType:'application/pdf',isGeneral:d.isGeneral===true}))}]));}
 async function dokumentLesen(id:string,kind:string){const {mappe}=await bewerbung(id);const d=mappe.dokumente.find(d=>d.kind===kind);if(!d)throw problem('Dokument nicht gefunden.',404);return d;}
 return {profilLesen,profilSpeichern,dossierLesen,dossierSpeichern,aktion,unterlagenStand,trackerDaten,dokumentLesen};
}
function zielUrl(roh:unknown){try{const u=new URL(String(roh));if(u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return u.href;}catch{}throw problem('Bitte eine gültige öffentliche HTTPS-Arbeitgeberadresse verwenden.');}
