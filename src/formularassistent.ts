import path from 'node:path';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import type {Stelle} from './beispiele';
import {companyKey,eligibleRole,ohneUnterlagen,selectCompanyOptions} from './kern/company-catalogue';
import {dossierBlock,isGeneralDocument,missingDossierParts} from './kern/tracker-attachments';
import {firmenSperre,berlinTag} from './archiv';
import {NACHWEIS_ARTEN,NACHWEIS_TITEL,VORSCHAU_STELLE,fehlendeAngaben,kontaktAus,leeresProfil,nachweisStand,profilStand,unterlagenErzeugen,unterlagenprofilPruefen,type NachweisArt,type Unterlagenprofil} from './unterlagen-erzeugen';
import {kette,SCHRITT_NAME,type KiOptionen,type Schritt} from './unterlagen-ki';

// Automatisch erstellte Dokumente tragen `erzeugt` (Zeitpunkt und Anbieter); sie zählen als gezielte Unterlagen dieser Stelle.
type Dokument={kind:'cv'|'letter'|'bundle';name:string;type:'application/pdf';base64:string;sha256:string;isGeneral?:boolean;erzeugt?:{am:string;anbieter:string}};
// Protokoll der automatischen Erstellung je Bewerbung (daten/unterlagen-erzeugt.json); verhindert erneutes Erstellen bei jedem Laden.
type Datensatz={zustand:'fertig'|'fehler';am:string;anbieter?:string;grundlage?:string;brief?:string;versuche?:{schritt:string;fehler:string}[];fehler?:string;profilStand:string;arten?:string[];seiten?:{cv:number;letter:number}};
export type FormularOptionen={
 // Freigeschaltete KI-Wege (JOBPILOT_UNTERLAGEN_ANBIETER); ohne Angabe nur die Vorlage.
 ki?:KiOptionen;
 jetzt?:()=>Date;
 // Nach einem Durchgang mit neu erstellten Unterlagen (der Server aktualisiert damit die Zahl der noch vorzubereitenden Stellen).
 nachErstellung?:()=>Promise<void>;
 // Höchstens so viele KI-Erstellungen je Durchgang, danach die Vorlage (Kosten und Laufzeit begrenzen).
 kiHoechstens?:number;
};
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
export function formularassistent(datenordner:string,stellen:()=>Promise<Stelle[]>,optionen:FormularOptionen={}){
 const profilDatei=path.join(datenordner,'formularprofil.json'),mappenDatei=path.join(datenordner,'bewerbungsunterlagen.json');
 const unterlagenDatei=path.join(datenordner,'unterlagenprofil.json'),erzeugtDatei=path.join(datenordner,'unterlagen-erzeugt.json'),nachweisOrdner=path.join(datenordner,'nachweise');
 const jetzt=optionen.jetzt||(()=>new Date());
 let warteschlange:Promise<unknown>=Promise.resolve();
 async function lesen<T>(datei:string,leer:T):Promise<T>{try{return JSON.parse(await readFile(datei,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return leer;throw problem('Lokale Assistentdaten nicht lesbar.',500);}}
 async function schreiben(datei:string,wert:unknown){await mkdir(datenordner,{recursive:true});const tmp=datei+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(wert,null,2),{mode:0o600});await rename(tmp,datei);}
 function aendern<T>(fn:()=>Promise<T>):Promise<T>{const lauf=warteschlange.then(fn);warteschlange=lauf.catch(()=>{});return lauf;}
 const profilLesen=()=>lesen<Profil>(profilDatei,{profile:{},bank:[]});
 const mappenLesen=()=>lesen<Record<string,Mappe>>(mappenDatei,{});
 async function unterlagenLesen():Promise<Unterlagenprofil>{const leer=leeresProfil(),p=await lesen<Partial<Unterlagenprofil>|null>(unterlagenDatei,null);return p?{...leer,...p,lebenslauf:{...leer.lebenslauf,...p.lebenslauf},nachweise:p.nachweise||{}}:leer;}
 const saetzeLesen=()=>lesen<Record<string,Datensatz>>(erzeugtDatei,{});
 const nachweisPfad=(art:NachweisArt)=>path.join(nachweisOrdner,art+'.pdf');
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

 // ---- Nachweise im eigenen Profil (Immatrikulationsbescheinigung, Leistungsübersicht, Zeugnisse) ----
 async function nachweisSpeichern(d:Record<string,unknown>){
  const art=d.art as NachweisArt;
  if(!NACHWEIS_ARTEN.includes(art))throw problem('Unbekannter Nachweis.');
  return aendern(async()=>{
   const p=await unterlagenLesen();
   if(d.entfernen===true){delete p.nachweise[art];await unlink(nachweisPfad(art)).catch(e=>{if(e.code!=='ENOENT')throw e;});}
   else{
    if(typeof d.name!=='string'||!d.name.trim()||d.name.length>200||/[\\/\r\n]/.test(d.name)||!d.name.toLowerCase().endsWith('.pdf'))throw problem('PDF-Dateiname ungültig.');
    if(typeof d.base64!=='string'||d.base64.length>7*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(d.base64))throw problem('PDF höchstens 5 MiB.');
    const bytes=Buffer.from(d.base64,'base64');
    if(bytes.length>5*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||bytes.toString('base64')!==d.base64)throw problem('Keine gültige PDF-Datei.');
    await mkdir(nachweisOrdner,{recursive:true});const tmp=nachweisPfad(art)+'.'+randomUUID()+'.tmp';await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,nachweisPfad(art));
    p.nachweise[art]={name:d.name.trim(),groesse:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),am:jetzt().toISOString()};
   }
   p.geaendert=jetzt().toISOString();await schreiben(unterlagenDatei,p);return {gespeichert:true,nachweise:p.nachweise};
  });
 }
 async function nachweisDatei(art:NachweisArt){const p=await unterlagenLesen(),info=p.nachweise[art];if(!info)throw problem('Nachweis nicht hinterlegt.',404);try{return {name:info.name,bytes:await readFile(nachweisPfad(art))};}catch{throw problem('Nachweis nicht lesbar.',404);}}
 // Von der Anzeige verlangte und im Profil vorhandene Nachweise sind dieser Bewerbung beigelegt (ohne Klick).
 async function beilagen(app:Stelle,profil?:Unterlagenprofil){const p=profil||await unterlagenLesen(),stand=nachweisStand(app.description,p.nachweise);const out:{kind:NachweisArt;name:string;type:'application/pdf';base64:string;sha256:string}[]=[];for(const art of stand.beigelegt){try{const d=await nachweisDatei(art);out.push({kind:art,name:d.name,type:'application/pdf',base64:d.bytes.toString('base64'),sha256:p.nachweise[art]!.sha256});}catch{/* fehlende Datei: nicht beilegen */}}return out;}
 async function beilageLesen(id:string,art:NachweisArt){const {app}=await bewerbung(id),p=await unterlagenLesen();if(!nachweisStand(app.description,p.nachweise).beigelegt.includes(art))throw problem('Dieser Nachweis ist der Bewerbung nicht beigelegt.',404);return nachweisDatei(art);}

 // ---- Automatische Erstellung: eine Stelle nach der anderen im Hintergrund, nie Versand oder Statusänderung ----
 const erstellListe:{id:string;erzwingen:boolean}[]=[];
 let inArbeit:string|null=null,durchgang:Promise<void>|null=null,gesperrt=new Set<Schritt>(),kiGenutzt=0,neuErstellt=0;
 function anstossen(ids:string[],o:{vorn?:boolean;erzwingen?:boolean}={}){
  for(const id of ids){if(id===inArbeit&&!o.erzwingen)continue;const i=erstellListe.findIndex(e=>e.id===id);if(i>=0){if(!o.erzwingen&&!o.vorn)continue;erstellListe.splice(i,1);}const e={id,erzwingen:!!o.erzwingen};if(o.vorn)erstellListe.unshift(e);else erstellListe.push(e);}
  if(!durchgang&&erstellListe.length)durchgang=abarbeiten().finally(()=>{durchgang=null;if(erstellListe.length)anstossen([]);});
 }
 async function abarbeiten(){
  try{while(erstellListe.length){const e=erstellListe.shift()!;inArbeit=e.id;try{if(await einzelnErstellen(e.id,e.erzwingen))neuErstellt++;}catch{/* je Stelle im Protokoll vermerkt */}finally{inArbeit=null;}}}
  finally{gesperrt=new Set();kiGenutzt=0;const n=neuErstellt;neuErstellt=0;if(n&&optionen.nachErstellung)await optionen.nachErstellung().catch(()=>{});}
 }
 const satzSchreiben=(id:string,satz:Datensatz)=>aendern(async()=>{const s=await saetzeLesen();s[id]=satz;await schreiben(erzeugtDatei,s);});
 async function einzelnErstellen(id:string,erzwingen:boolean){
  const liste=await stellen(),app=liste.find(s=>s.id===id);
  if(!app||!['pending','unknown'].includes(app.status)||firmenSperre(liste,id))return false;
  const [formular,profil,mappen,saetze]=await Promise.all([profilLesen(),unterlagenLesen(),mappenLesen(),saetzeLesen()]);
  const kontakt=kontaktAus(formular.profile),stand=profilStand(kontakt,profil);
  if(fehlendeAngaben(kontakt,profil.lebenslauf).length)return false;
  const vorher=mappen[id]||{dokumente:[]},satz=saetze[id];
  if(!erzwingen&&(!missingDossierParts({...vorher,documents:vorher.dokumente}).length||satz&&(satz.zustand==='fertig'||satz.profilStand===stand)))return false;
  const ki=optionen.ki&&kette(optionen.ki).length?{optionen:optionen.ki,gesperrt,erlaubt:kiGenutzt<(optionen.kiHoechstens??20)}:undefined;
  let erzeugung;
  try{erzeugung=await unterlagenErzeugen({kontakt,profil,stelle:app,heute:jetzt()},ki);}
  catch(e){await satzSchreiben(id,{zustand:'fehler',am:jetzt().toISOString(),fehler:e instanceof Error?e.message.slice(0,300):'Erstellung fehlgeschlagen.',profilStand:stand});return false;}
  if(erzeugung.anbieter!=='vorlage')kiGenutzt++;
  const am=jetzt().toISOString();
  const arten=await aendern(async()=>{
   // Vor dem Speichern erneut prüfen: inzwischen versandt, archiviert, gesperrt oder selbst hochgeladen?
   const aktuell=(await stellen()).find(s=>s.id===id);if(!aktuell||!['pending','unknown'].includes(aktuell.status)||firmenSperre(await stellen(),id))return [] as string[];
   const alle=await mappenLesen(),m:Mappe=alle[id]||{dokumente:[]};
   if(m.dokumente.some(d=>d.kind==='bundle'))return [] as string[];
   // Eigene Uploads bleiben immer erhalten; nur fehlende Teile oder (auf Wunsch) frühere automatische Dokumente werden ersetzt.
   const ersetzbar=(d:Dokument)=>erzwingen&&!!d.erzeugt;
   const fehlt=missingDossierParts({...m,documents:m.dokumente.filter(d=>!ersetzbar(d))});
   const neu=erzeugung.dokumente.filter(d=>(fehlt as string[]).includes(d.kind));
   if(!neu.length)return [] as string[];
   m.dokumente=[...m.dokumente.filter(d=>!(ersetzbar(d)&&neu.some(n=>n.kind===d.kind))),...neu.map(d=>({...d,erzeugt:{am,anbieter:erzeugung.anbieter}}))];
   alle[id]=m;await schreiben(mappenDatei,alle);return neu.map(d=>d.kind as string);
  });
  await satzSchreiben(id,{zustand:'fertig',am,anbieter:erzeugung.anbieter,grundlage:erzeugung.grundlage,brief:erzeugung.brief,versuche:erzeugung.versuche,profilStand:stand,arten,seiten:erzeugung.seiten});
  return arten.length>0;
 }
 type Stand={zustand:'fertig'|'wartet'|'laeuft'|'profil-fehlt'|'fehler'|'nicht-noetig'|'gesperrt'|'offen';fehlt?:string[];satz?:Datensatz};
 function erzeugungsstand(app:Stelle,liste:Stelle[],mappe:Mappe|undefined,satz:Datensatz|undefined,profilFehlt:string[],stand:string):Stand{
  if(inArbeit===app.id)return {zustand:'laeuft',satz};
  if(erstellListe.some(e=>e.id===app.id))return {zustand:'wartet',satz};
  if(!['pending','unknown'].includes(app.status)||firmenSperre(liste,app.id))return {zustand:satz?.zustand==='fertig'?'fertig':'gesperrt',satz};
  if(satz?.zustand==='fertig')return {zustand:'fertig',satz};
  if(mappe&&!missingDossierParts({...mappe,documents:mappe.dokumente}).length)return {zustand:'nicht-noetig',satz};
  if(profilFehlt.length)return {zustand:'profil-fehlt',fehlt:profilFehlt,satz};
  if(satz?.zustand==='fehler'&&satz.profilStand===stand)return {zustand:'fehler',satz};
  return {zustand:'offen',satz};
 }
 async function kontext(){const [liste,formular,profil,mappen,saetze]=await Promise.all([stellen(),profilLesen(),unterlagenLesen(),mappenLesen(),saetzeLesen()]);const kontakt=kontaktAus(formular.profile);return {liste,profil,mappen,saetze,profilFehlt:fehlendeAngaben(kontakt,profil.lebenslauf),stand:profilStand(kontakt,profil)};}
 /** Nach einem Suchlauf: neue, geeignete Stellen ohne Unterlagen einplanen (eine je Firma wie in der Übersicht). */
 async function nachSuche(beginn:string){
  const k=await kontext();if(k.profilFehlt.length)return 0;
  const bereit=(s:Stelle)=>{const m=k.mappen[s.id];return !!m&&!missingDossierParts({...m,documents:m.dokumente}).length;};
  const vertreter=selectCompanyOptions(k.liste.map(s=>({...s,score:s.score??null,arrived:s.addedAt,dossierReady:bereit(s)})));
  const ids=vertreter.filter(s=>s.status==='pending'&&eligibleRole(s.title)&&typeof s.gefundenAm==='string'&&s.gefundenAm>=beginn&&!s.dossierReady&&!k.saetze[s.id]&&!firmenSperre(k.liste,s.id)).map(s=>s.id);
  anstossen(ids);return ids.length;
 }
 /** Nach einer Profiländerung: gescheiterte Versuche und heutige Funde ohne Unterlagen erneut einplanen. */
 async function profilGeaendert(){
  const k=await kontext();if(k.profilFehlt.length)return;const heute=berlinTag(jetzt());
  const vertreter=new Set(selectCompanyOptions(k.liste.map(s=>({...s,score:s.score??null,arrived:s.addedAt}))).map(s=>s.id));
  anstossen(k.liste.filter(s=>{const st=erzeugungsstand(s,k.liste,k.mappen[s.id],k.saetze[s.id],k.profilFehlt,k.stand);return st.zustand==='fehler'||st.zustand==='offen'&&s.addedAt===heute&&vertreter.has(s.id)&&eligibleRole(s.title)&&!k.saetze[s.id];}).map(s=>s.id));
 }
 /** Ausdrücklich neu erstellen (Knopf im Dossier): ersetzt nur frühere automatische Dokumente, nie eigene Uploads. */
 async function neuErstellen(id:unknown){const {app}=await bewerbung(id,true);const k=await kontext();if(k.profilFehlt.length)throw problem('Im Profil fehlen: '+k.profilFehlt.join(', ')+'.',409);anstossen([app.id],{vorn:true,erzwingen:true});return {eingeplant:true};}
 async function unterlagenprofil(){
  const [p,liste]=await Promise.all([unterlagenLesen(),stellen()]),k=await kontext();
  const offen=liste.filter(s=>['pending','unknown'].includes(s.status));
  const verlangtIn=Object.fromEntries(NACHWEIS_ARTEN.map(art=>[art,offen.filter(s=>nachweisStand(s.description,{}).verlangt.includes(art)).length]));
  const schritte=optionen.ki?kette(optionen.ki):[];
  return {profil:p,profilFehlt:k.profilFehlt,verlangtIn,erstellung:{einstellung:optionen.ki?.einstellung||'vorlage',kette:[...schritte.map(s=>SCHRITT_NAME[s]),SCHRITT_NAME.vorlage],laeuft:!!inArbeit,wartend:erstellListe.length}};
 }
 async function unterlagenprofilSpeichern(d:Record<string,unknown>){const p=await aendern(async()=>{const neu=unterlagenprofilPruefen(d,await unterlagenLesen());neu.geaendert=jetzt().toISOString();await schreiben(unterlagenDatei,neu);return neu;});void profilGeaendert().catch(()=>{});return {gespeichert:true,profil:p};}
 /** Vorschau mit einer erfundenen Stelle, nur mit der Vorlage (keine KI, keine Anfrage). */
 async function vorschau(kind:'cv'|'letter'){const [formular,profil]=await Promise.all([profilLesen(),unterlagenLesen()]);const e=await unterlagenErzeugen({kontakt:kontaktAus(formular.profile),profil,stelle:VORSCHAU_STELLE,heute:jetzt()});const d=e.dokumente.find(x=>x.kind===kind)!;return {name:'Vorschau_'+d.name,bytes:Buffer.from(d.base64,'base64')};}
 const erzeugungWarten=async()=>{while(durchgang)await durchgang;};
 /** Neue Stellen seit `beginn` ohne vollständige Unterlagen, mit den tatsächlich gespeicherten Dokumenten (ohneUnterlagen des Kerns). */
 async function vorzubereiten(beginn:string){
  const k=await kontext();
  const zeile=(s:Stelle)=>{const m=k.mappen[s.id];return {id:s.id,status:s.status,metadata:{company:s.company,companyExcluded:s.companyExcluded,applicationChannel:m?.applicationChannel,letterNotRequired:m?.letterNotRequired},documents:(m?.dokumente||[]).map(d=>({kind:d.kind,isGeneral:d.isGeneral}))};};
  return ohneUnterlagen(k.liste.filter(s=>typeof s.gefundenAm==='string'&&s.gefundenAm>=beginn).map(zeile),k.liste.map(zeile)).length;
 }
 async function profilSpeichern(d:Record<string,unknown>){const r=await aendern(async()=>{const profil={profile:profilPruefen(d.profile),bank:bankPruefen(d.bank??[])};await schreiben(profilDatei,profil);return {gespeichert:true};});void profilGeaendert().catch(()=>{});return r;}
 async function antwortMerken(d:Record<string,unknown>){const [eintrag]=bankPruefen([{question:d.question,answer:d.answer}]);await aendern(async()=>{const p=await profilLesen();p.bank=[...p.bank.filter(x=>x.question!==eintrag.question),eintrag];if(p.bank.length>500)throw problem('Antwortbank voll.');await schreiben(profilDatei,p);});}
 async function dossierLesen(id:unknown){
  const {app,mappe,item}=await bewerbung(id),k=await kontext();
  // Beim Öffnen ohne Unterlagen: im Hintergrund erstellen (vorn in der Warteschlange); die Seite fragt den Stand erneut ab.
  let st=erzeugungsstand(app,k.liste,k.mappen[app.id],k.saetze[app.id],k.profilFehlt,k.stand);
  if(st.zustand==='offen'){anstossen([app.id],{vorn:true});st=erzeugungsstand(app,k.liste,k.mappen[app.id],k.saetze[app.id],k.profilFehlt,k.stand);}
  const n=nachweisStand(app.description,k.profil.nachweise);
  return {app,mappe,fehlt:missingDossierParts(item),block:dossierBlock(item),erzeugung:{...st,anbieterName:st.satz?.anbieter?SCHRITT_NAME[st.satz.anbieter as Schritt|'vorlage']||st.satz.anbieter:undefined},nachweise:{...n,titel:NACHWEIS_TITEL,dateien:Object.fromEntries(n.beigelegt.map(a=>[a,k.profil.nachweise[a]!.name]))},heute:berlinTag(jetzt())};
 }
 async function dossierSpeichern(d:Record<string,unknown>){return aendern(async()=>{
  const {app}=await bewerbung(d.id,true);
  if(!Array.isArray(d.dokumente)||d.dokumente.length>3)throw problem('Unterlagen ungültig.');
  const mappen=await mappenLesen(),vorher=mappen[app.id]?.dokumente||[];
  // Unverändert zurückgesendete automatische Dokumente behalten ihre Kennzeichnung (gleiche Prüfsumme).
  const dokumente:Dokument[]=d.dokumente.map(dokumentPruefen).map(x=>{const alt=vorher.find(v=>v.kind===x.kind&&v.sha256===x.sha256&&v.erzeugt);return alt?{...x,erzeugt:alt.erzeugt}:x;});if(new Set(dokumente.map(x=>x.kind)).size!==dokumente.length)throw problem('Dokument doppelt.');
  const mappe:Mappe={dokumente};
  if(d.applicationChannel==='portal-only')mappe.applicationChannel='portal-only';
  if(typeof d.letterNotRequired==='boolean')mappe.letterNotRequired=d.letterNotRequired;
  if(d.contactPortalUrl)mappe.contactPortalUrl=zielUrl(String(d.contactPortalUrl));
  mappen[app.id]=mappe;await schreiben(mappenDatei,mappen);return {gespeichert:true};
 });}
 async function aktion(d:Record<string,unknown>){
  if(d.aktion==='profil'||d.aktion==='frei-merken'){if(d.aktion==='frei-merken')await antwortMerken(d);return profilLesen();}
  if(!['start','status','fuellen','merken','dateien'].includes(String(d.aktion)))throw problem('Ungültige Aktion.');
  const {app,mappe,item}=await bewerbung(d.id,true),block=dossierBlock(item);
  if(block&&(d.aktion==='start'||d.aktion==='dateien'))throw problem(block,409);
  if(d.aktion==='status')return {firma:app.company||'Bewerbung'};
  if(d.aktion==='start')return {firma:app.company||'Bewerbung',url:zielUrl(mappe.applicationChannel==='portal-only'&&mappe.contactPortalUrl?mappe.contactPortalUrl:app.url)};
  // Verlangte Nachweise aus dem eigenen Profil gehen mit; der gemeinsame Feldmotor ordnet derzeit nur CV, Brief und Mappe zu.
  if(d.aktion==='dateien')return {dokumente:[...pdf(mappe),...await beilagen(app)]};
  if(d.aktion==='merken')await antwortMerken(d);
  return {...await profilLesen(),...(!block?{dokumente:[...pdf(mappe),...await beilagen(app)]}:{})};
 }
 // Für die Stellensuche (/offres): je Stelle, was noch fehlt, als lesbare Teile („Noch erforderlich: …“).
 async function unterlagenStand(){
  const k=await kontext();
  return Object.fromEntries(k.liste.filter(s=>Object.hasOwn(k.mappen,s.id)||['pending','unknown'].includes(s.status)).map(s=>{
   const m=k.mappen[s.id],teile:string[]=(m?missingDossierParts({...s,...m,documents:m.dokumente}):['cv','letter']).map(x=>x==='cv'?'gezielter Lebenslauf':'Anschreiben');
   if(teile.length&&['pending','unknown'].includes(s.status)){
    const st=erzeugungsstand(s,k.liste,m,k.saetze[s.id],k.profilFehlt,k.stand),letzt=teile.length-1;
    if(st.zustand==='wartet'||st.zustand==='laeuft')teile[letzt]+=' (werden gerade automatisch erstellt)';
    else if(st.zustand==='profil-fehlt')teile[letzt]+=` (automatisch, sobald im Profil ${st.fehlt!.join(', ')} hinterlegt sind)`;
    else if(st.zustand==='fehler')teile[letzt]+=' (automatische Erstellung gescheitert, im Dossier erneut versuchen)';
   }
   if(['pending','unknown'].includes(s.status))for(const art of nachweisStand(s.description,k.profil.nachweise).fehlen)teile.push(`${NACHWEIS_TITEL[art]} (in der Anzeige verlangt, keine Datei im Profil hinterlegt)`);
   return [s.id,teile];
  }));
 }
 // Für die Übersicht (/suivi): Dokumente, beigelegte Nachweise samt Flags aus der Anzeige und das Erstellungsprotokoll.
 async function trackerDaten(){
  const k=await kontext();
  return Object.fromEntries(k.liste.map(s=>{
   const m=k.mappen[s.id],n=nachweisStand(s.description,k.profil.nachweise),satz=k.saetze[s.id];
   const documents=[...(m?.dokumente||[]).map(d=>({kind:d.kind,filename:d.name,contentType:'application/pdf',isGeneral:d.isGeneral===true,...(d.erzeugt?{erzeugt:d.erzeugt}:{})})),...n.beigelegt.map(art=>({kind:art,filename:k.profil.nachweise[art]!.name,contentType:'application/pdf',isShared:true}))];
   return [s.id,{applicationChannel:m?.applicationChannel,letterNotRequired:m?.letterNotRequired,documents,...Object.fromEntries(n.verlangt.map(art=>[art,true])),nachweise:n,...(satz?.zustand==='fertig'?{unterlagenErzeugt:{am:satz.am,anbieter:satz.anbieter,grundlage:satz.grundlage,brief:satz.brief}}:{})}];
  }));
 }
 async function dokumentLesen(id:string,kind:string){
  if((NACHWEIS_ARTEN as readonly string[]).includes(kind)){const d=await beilageLesen(id,kind as NachweisArt);return {name:d.name,base64:d.bytes.toString('base64')};}
  const {mappe}=await bewerbung(id);const d=mappe.dokumente.find(d=>d.kind===kind);if(!d)throw problem('Dokument nicht gefunden.',404);return d;
 }
 return {profilLesen,profilSpeichern,dossierLesen,dossierSpeichern,aktion,unterlagenStand,trackerDaten,dokumentLesen,unterlagenprofil,unterlagenprofilSpeichern,nachweisSpeichern,nachweisDatei,nachSuche,neuErstellen,vorschau,erzeugungWarten,vorzubereiten};
}
function zielUrl(roh:unknown){try{const u=new URL(String(roh));if(u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return u.href;}catch{}throw problem('Bitte eine gültige öffentliche HTTPS-Arbeitgeberadresse verwenden.');}
