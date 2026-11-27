import React,{useEffect,useRef,useState} from 'react';
import {SucheArbeitsraum,type Suchtreffer,type Suchwerte} from './suche-arbeitsraum';
import {JobPilotNavigation} from './navigation';
import {SOURCE_IDS,SOURCE_LABELS,platformSearchUrl,type PlatformId} from '../kern/platforms';
import {platformStates} from '../kern/platform-status';
import {parseKeywordInput,KEYWORD_CATALOGUES,catalogueKeywords} from '../kern/catalog';
import {eligibleRole,textOnly,selectCompanyOptions} from '../kern/core';
import {Ergebnis,Stichwoerter,Plattformen} from './suchdetails';
import {t,sprache} from './sprache';
import type {Lauf} from './suchablauf';

type Angebot={id:string;title:string;company?:string;location?:string;description?:string;distanceKm?:number;source:string;url?:string;publishedAt?:string;status:string;score?:number};
type Bericht={source:string;status:string;found:number;inserted:number;message:string;limited?:boolean};
type Stand={modus?:string;stellen:Angebot[];berichte:Bericht[];auftrag?:{keywordList:string[];city:string;radius:number;quellen:PlatformId[];breit:boolean};runde?:number;lauf?:Lauf};
const standard:Suchwerte={begriffe:catalogueKeywords(),ort:'Gießen',radius:50};
const schluessel='jobpilot-suchprofil-v1';
async function lesen(pfad:string,init?:RequestInit){const r=await fetch(pfad,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});const daten=await r.json();if(!r.ok)throw Error(daten.fehler||daten.error||'Anfrage nicht bestätigt.');return daten;}

// Die statische Demo benutzt ausschließlich ihren Datenadapter; /offres am lokalen Server benutzt die echte API.
export function Stellensuche(){
 const [,spracheNeu]=useState(0);useEffect(()=>{const f=()=>spracheNeu(x=>x+1);window.addEventListener('jobpilot-sprache',f);return()=>window.removeEventListener('jobpilot-sprache',f);},[]);
 const [suchAktiv,setSuchAktiv]=useState(false),[frisch,setFrisch]=useState(false);
 const [werte,setWerte]=useState(standard),[stand,setStand]=useState<Stand>({stellen:[],berichte:[]}),[geladen,setGeladen]=useState(false),[live,setLive]=useState(false),[demo,setDemo]=useState(false),[fehler,setFehler]=useState('');
 const [quellen,setQuellen]=useState<PlatformId[]>([...SOURCE_IDS]),[breit,setBreit]=useState(true),[profiltext,setProfiltext]=useState(standard.begriffe.join('; '));
 const [unterlagen,setUnterlagen]=useState<Record<string,string[]>>({});
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),aktiv=useRef(true);
 const uebernehmen=(s:Stand,laeuft=false)=>{setStand(v=>laeuft&&v.lauf?.zustand==='laeuft'&&(!s.lauf||s.lauf.beginn<v.lauf.beginn)?{...s,lauf:v.lauf}:s);};
 useEffect(()=>{
  aktiv.current=true;
  void Promise.all([lesen('/api/suche'),lesen('/api/status')]).then(([f,s])=>{
   if(!aktiv.current)return;
   setLive(f.live===true);setDemo(f.demo===true);uebernehmen(s.zustand,s.suchAktiv===true);setUnterlagen(s.unterlagen||{});setSuchAktiv(s.suchAktiv===true||s.suchAktiv===undefined&&s.zustand.lauf?.zustand==='laeuft');setGeladen(true);
   let gespeichert:Record<string,unknown>|undefined;
   try{gespeichert=JSON.parse(localStorage.getItem(schluessel)||'null')||undefined;}catch{}
   const a=s.zustand.auftrag;
   const b=a?.keywordList||gespeichert?.begriffe;
   const neu:Suchwerte={begriffe:Array.isArray(b)&&b.length?parseKeywordInput(b.join(';')):standard.begriffe,ort:a?.city||String(gespeichert?.ort||standard.ort),radius:Number(a?.radius||gespeichert?.radius)||standard.radius};
   setWerte(neu);setProfiltext(neu.begriffe.join('; '));
   if(a?.quellen?.length)setQuellen(a.quellen);else if(Array.isArray(gespeichert?.quellen)){const q=SOURCE_IDS.filter(id=>(gespeichert!.quellen as unknown[]).includes(id));if(q.length)setQuellen(q);}
   if(typeof a?.breit==='boolean')setBreit(a.breit);else if(typeof gespeichert?.breit==='boolean')setBreit(gespeichert.breit);
   if(s.suchAktiv===true||s.suchAktiv===undefined&&s.zustand.lauf?.zustand==='laeuft')beobachten();
  }).catch(()=>{if(aktiv.current)setFehler('Suchstand nicht geladen. Es wurde keine Suche gestartet.');});
  return()=>{aktiv.current=false;if(timer.current)clearTimeout(timer.current);};
 },[]);
 async function beobachten(){
  if(!aktiv.current)return;
  try{const s=await lesen('/api/status');if(!aktiv.current)return;uebernehmen(s.zustand,s.suchAktiv===true);setUnterlagen(s.unterlagen||{});setSuchAktiv(s.suchAktiv===true||s.suchAktiv===undefined&&s.zustand.lauf?.zustand==='laeuft');if(s.suchAktiv===true||s.suchAktiv===undefined&&s.zustand.lauf?.zustand==='laeuft')timer.current=setTimeout(()=>void beobachten(),2000);}
  catch{if(aktiv.current)setFehler('Der Suchstand ist momentan nicht lesbar. Vor einem neuen Start den Stand erneut prüfen.');}
 }
 const merken=(w:Suchwerte)=>{try{localStorage.setItem(schluessel,JSON.stringify({...w,quellen,breit,platformCoverageVersion:2}));}catch{setFehler('Suchprofil konnte im Browser nicht gespeichert werden.');}};
 async function speichern(a:Record<string,unknown>){
  const neu={...stand.auftrag,city:werte.ort,radius:werte.radius,keywordList:werte.begriffe,quellen,breit,...a};
  if(!demo){const r=await lesen('/api/kriterien',{method:'POST',body:JSON.stringify(a)});setStand(s=>({...s,auftrag:r.auftrag}));}
  if(Array.isArray(neu.keywordList)){const w={begriffe:neu.keywordList as string[],ort:String(neu.city),radius:Number(neu.radius)};setWerte(w);merken(w);}
  if(Array.isArray(neu.quellen))setQuellen(neu.quellen as PlatformId[]);
 }
 const vertreter=selectCompanyOptions(stand.stellen.map(s=>({...s,score:s.score??null})));
 const treffer:Suchtreffer[]=vertreter.filter(s=>s.status==='pending'&&eligibleRole(s.title)).map(s=>({id:s.id,titel:s.title,firma:s.company||'Unternehmen prüfen',ort:s.location||'',quelle:SOURCE_LABELS[s.source as PlatformId]||s.source,beschreibung:textOnly(s.description||''),entfernung:typeof s.distanceKm==='number'?s.distanceKm:undefined,gruende:[],hinweise:[],unterlagen:unterlagen[s.id]||['gezielter Lebenslauf','Anschreiben'],anzeige:s.url,datum:s.publishedAt,dossier:demo?undefined:'/dossier/'+encodeURIComponent(s.id)}));
 const zustaende=platformStates(quellen,stand.berichte),probleme=zustaende.filter(z=>['blockiert','fehler','nur-link'].includes(z.state));
 return <div className="app jp-shell"><JobPilotNavigation aktiv="/offres" lokaleSuche={!demo}/><div className="arbeitsraum"><header className="kopf"><div>Arbeitsbereich <span className="trenner">/</span> Stellensuche</div><span>{demo?'Öffentliche Demo':'Lokale Stellensuche'}</span></header><div className="jp-seite" data-jobpilot-page="/offres">
  <SucheArbeitsraum werte={werte} treffer={treffer} demo={demo} deaktiviert={!geladen||!live&&!demo||suchAktiv}
   stand={stand.lauf?(suchAktiv?t('Suche läuft …','Recherche en cours …'):t('Zuletzt gesucht: ','Dernière recherche : ')+new Date(stand.lauf.ende||stand.lauf.beginn).toLocaleString('de-DE')+` · ${stand.lauf.abgeschlossen} von ${stand.lauf.durchlaeufe} Durchläufen`):undefined}
   einschraenkung={probleme.length?`${probleme.length} Quellen eingeschränkt erreichbar.`:stand.berichte.length?'Die Suche hat einen Teil der Anzeigen erfasst.':undefined}
   suchen={async w=>{
    const begriffe=parseKeywordInput(w.begriffe.join(';'));if(!quellen.length||!begriffe.length)throw Error('Suchprofil unvollständig.');
    const neu={...w,begriffe};setFehler('');merken(neu);setFrisch(true);if(!demo)await speichern({city:w.ort,radius:w.radius,keywordList:begriffe,quellen,breit});
    const r=await lesen('/api/suche',{method:'POST',body:JSON.stringify({live:!demo,hintergrund:true,city:w.ort,radius:w.radius,keywordList:begriffe,keywords:begriffe[0],quellen,breit,indeedProvider:'auto'})});
    setWerte(neu);setProfiltext(begriffe.join('; '));uebernehmen(r.zustand);
    if(r.zustand.lauf?.zustand==='laeuft'){setSuchAktiv(true);void beobachten();return {meldung:'Suche gestartet. Die Ergebnisse werden laufend ergänzt.',unvollstaendig:true};}
    return {meldung:demo?'Beispielsuchlauf aktualisiert. Keine echten Quellen abgefragt.':'Suche abgeschlossen.',unvollstaendig:true};
   }}
   hinweis={<>{fehler&&<p role="alert" className="jobsuche-meldung jobsuche-fehler">{fehler}</p>}{geladen&&!live&&!demo&&<p className="jobsuche-meldung" role="status" data-live-aus>{t('Echte Suche ist ausgeschaltet. Den lokalen Server mit JOBPILOT_LIVE=1 starten.','Recherche réelle désactivée. Relancer le serveur avec JOBPILOT_LIVE=1.')}</p>}{suchAktiv&&stand.lauf&&<p role="status" data-fortschritt>{t(`Suche läuft: ${stand.lauf.abgeschlossen} von ${stand.lauf.durchlaeufe} Durchläufen abgeschlossen.`,`Recherche en cours : ${stand.lauf.abgeschlossen} passages sur ${stand.lauf.durchlaeufe}.`)}</p>}{!suchAktiv&&stand.lauf?.zustand==='laeuft'&&<p role="status" data-unterbrochen>{t('Die vorige Suche wurde unterbrochen. Gespeicherte Treffer bleiben erhalten.','La recherche précédente a été interrompue. Les résultats enregistrés sont conservés.')}</p>}{!suchAktiv&&stand.lauf&&stand.lauf.zustand!=='laeuft'&&<p role="status" className="jobsuche-meldung">{stand.lauf.neu} {t('neue Stellen · Teilabdeckung. Einzelheiten unter Suchdetails.','nouvelles offres · couverture partielle. Détails dans les sources.')}</p>}</>}
   profil={geladen?<><Stichwoerter domain="it" initial={werte.begriffe} saved={stand.auftrag?.keywordList||[]} platforms={quellen.map(id=>({id,label:SOURCE_LABELS[id]}))} wide={breit} startRound={stand.runde||0} speichern={keywordList=>speichern({keywordList,keywordDomain:'it'})} gesperrt={suchAktiv}/><label><input type="checkbox" checked={breit} disabled={suchAktiv} onChange={e=>{setBreit(e.target.checked);void speichern({breit:e.target.checked}).catch(e=>setFehler(e.message));}}/>{t('Weitere IT-Bereiche berücksichtigen','Élargir aux autres domaines IT')}</label></>:<p>Wird geladen …</p>}
   quellen={<Plattformen city={werte.ort} radius={werte.radius} keywords={werte.begriffe[0]||''} enabled={quellen} reports={stand.modus==='live'?stand.berichte:[]} speichern={quellen=>speichern({quellen})} gesperrt={suchAktiv}/>}
   weitere={<>{!suchAktiv&&stand.lauf&&stand.lauf.zustand!=='laeuft'&&<Ergebnis lauf={stand.lauf} berichte={stand.berichte} frisch={frisch}/>}<details><summary>{t('Berichte der letzten Suche','Rapports de la dernière recherche')}</summary>{stand.berichte.length?stand.berichte.map((b,i)=><p key={i}>{SOURCE_LABELS[b.source as PlatformId]||b.source}: {b.message}</p>):<p>{t('Noch keine gespeicherten Berichte.','Aucun rapport enregistré.')}</p>}</details></>}

  />
 </div></div></div>;
}
