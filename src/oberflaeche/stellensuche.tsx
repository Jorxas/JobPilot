import React,{useEffect,useRef,useState} from 'react';
import {SucheArbeitsraum,type Suchtreffer,type Suchwerte} from './suche-arbeitsraum';
import {JobPilotNavigation} from './navigation';
import {SOURCE_IDS,SOURCE_LABELS,platformSearchUrl,type PlatformId} from '../kern/platforms';
import {platformStates} from '../kern/platform-status';
import {parseKeywordInput,KEYWORD_CATALOGUES,catalogueKeywords} from '../kern/catalog';
import {eligibleRole,textOnly,selectCompanyOptions} from '../kern/core';

type Angebot={id:string;title:string;company?:string;location?:string;description?:string;distanceKm?:number;source:string;url?:string;publishedAt?:string;status:string;score?:number};
type Bericht={source:string;status:string;found:number;inserted:number;message:string;limited?:boolean};
type Stand={modus?:string;stellen:Angebot[];berichte:Bericht[];auftrag?:{keywordList:string[];city:string;radius:number;quellen:PlatformId[];breit:boolean};lauf?:{zustand:string;ende?:string;beginn:string;abgeschlossen:number;durchlaeufe:number}};
const standard:Suchwerte={begriffe:catalogueKeywords(),ort:'Gießen',radius:50};
const schluessel='jobpilot-suchprofil-v1';
async function lesen(pfad:string,init?:RequestInit){const r=await fetch(pfad,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});const daten=await r.json();if(!r.ok)throw Error(daten.fehler||daten.error||'Anfrage nicht bestätigt.');return daten;}

// Die statische Demo benutzt ausschließlich ihren Datenadapter; /offres am lokalen Server benutzt die echte API.
export function Stellensuche(){
 const [werte,setWerte]=useState(standard),[stand,setStand]=useState<Stand>({stellen:[],berichte:[]}),[geladen,setGeladen]=useState(false),[live,setLive]=useState(false),[demo,setDemo]=useState(false),[fehler,setFehler]=useState('');
 const [quellen,setQuellen]=useState<PlatformId[]>([...SOURCE_IDS]),[breit,setBreit]=useState(true),[profiltext,setProfiltext]=useState(standard.begriffe.join('; '));
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),aktiv=useRef(true);
 const uebernehmen=(s:Stand)=>{setStand(s);};
 useEffect(()=>{
  aktiv.current=true;
  void Promise.all([lesen('/api/suche'),lesen('/api/status')]).then(([f,s])=>{
   if(!aktiv.current)return;
   setLive(f.live===true);setDemo(f.demo===true);uebernehmen(s.zustand);setGeladen(true);
   let gespeichert:Record<string,unknown>|undefined;
   try{gespeichert=JSON.parse(localStorage.getItem(schluessel)||'null')||undefined;}catch{}
   const a=s.zustand.auftrag;
   const b=a?.keywordList||gespeichert?.begriffe;
   const neu:Suchwerte={begriffe:Array.isArray(b)&&b.length?parseKeywordInput(b.join(';')):standard.begriffe,ort:a?.city||String(gespeichert?.ort||standard.ort),radius:Number(a?.radius||gespeichert?.radius)||standard.radius};
   setWerte(neu);setProfiltext(neu.begriffe.join('; '));
   if(a?.quellen?.length)setQuellen(a.quellen);else if(Array.isArray(gespeichert?.quellen)){const q=SOURCE_IDS.filter(id=>(gespeichert!.quellen as unknown[]).includes(id));if(q.length)setQuellen(q);}
   if(typeof a?.breit==='boolean')setBreit(a.breit);else if(typeof gespeichert?.breit==='boolean')setBreit(gespeichert.breit);
   if(s.zustand.lauf?.zustand==='laeuft')beobachten();
  }).catch(()=>{if(aktiv.current)setFehler('Suchstand nicht geladen. Es wurde keine Suche gestartet.');});
  return()=>{aktiv.current=false;if(timer.current)clearTimeout(timer.current);};
 },[]);
 async function beobachten(){
  if(!aktiv.current)return;
  try{const s=await lesen('/api/status');if(!aktiv.current)return;uebernehmen(s.zustand);if(s.zustand.lauf?.zustand==='laeuft')timer.current=setTimeout(()=>void beobachten(),2000);}
  catch{if(aktiv.current)setFehler('Der Suchstand ist momentan nicht lesbar. Vor einem neuen Start den Stand erneut prüfen.');}
 }
 const merken=(w:Suchwerte)=>{try{localStorage.setItem(schluessel,JSON.stringify({...w,quellen,breit,platformCoverageVersion:2}));}catch{setFehler('Suchprofil konnte im Browser nicht gespeichert werden.');}};
 const vertreter=selectCompanyOptions(stand.stellen.map(s=>({...s,score:s.score??null})));
 const treffer:Suchtreffer[]=vertreter.filter(s=>s.status==='pending'&&eligibleRole(s.title)).map(s=>({id:s.id,titel:s.title,firma:s.company||'Unternehmen prüfen',ort:s.location||'',quelle:SOURCE_LABELS[s.source as PlatformId]||s.source,beschreibung:textOnly(s.description||''),entfernung:typeof s.distanceKm==='number'?s.distanceKm:undefined,gruende:[],hinweise:[],unterlagen:['gezielter Lebenslauf','Anschreiben'],anzeige:s.url,datum:s.publishedAt}));
 const zustaende=platformStates(quellen,stand.berichte),probleme=zustaende.filter(z=>['blockiert','fehler','nur-link'].includes(z.state));
 return <div className="app jp-shell"><JobPilotNavigation aktiv="/offres" lokaleSuche={!demo}/><div className="arbeitsraum"><header className="kopf"><div>Arbeitsbereich <span className="trenner">/</span> Stellensuche</div><span>{demo?'Öffentliche Demo':'Lokale Stellensuche'}</span></header><div className="jp-seite" data-jobpilot-page="/offres">
  <SucheArbeitsraum werte={werte} treffer={treffer} demo={demo} deaktiviert={!geladen||!live&&!demo||stand.lauf?.zustand==='laeuft'}
   stand={stand.lauf?.ende?'Zuletzt gesucht: '+new Date(stand.lauf.ende).toLocaleString('de-DE'):stand.lauf?.zustand==='laeuft'?'Suche läuft …':undefined}
   einschraenkung={probleme.length?`${probleme.length} Quellen eingeschränkt erreichbar.`:stand.berichte.length?'Die Suche hat einen Teil der Anzeigen erfasst.':undefined}
   suchen={async w=>{
    const begriffe=parseKeywordInput(w.begriffe.join(';'));if(!quellen.length||!begriffe.length)throw Error('Suchprofil unvollständig.');
    const neu={...w,begriffe};setFehler('');merken(neu);
    const r=await lesen('/api/suche',{method:'POST',body:JSON.stringify({live:!demo,hintergrund:true,city:w.ort,radius:w.radius,keywordList:begriffe,keywords:begriffe[0],quellen,breit,indeedProvider:'auto'})});
    setWerte(neu);setProfiltext(begriffe.join('; '));uebernehmen(r.zustand);
    if(r.zustand.lauf?.zustand==='laeuft'){void beobachten();return {meldung:'Suche gestartet. Die Ergebnisse werden laufend ergänzt.',unvollstaendig:true};}
    return {meldung:demo?'Beispielsuchlauf aktualisiert. Keine echten Quellen abgefragt.':'Suche abgeschlossen.',unvollstaendig:true};
   }}
   hinweis={<>{fehler&&<p role="alert" className="jobsuche-meldung jobsuche-fehler">{fehler}</p>}{geladen&&!live&&!demo&&<p className="jobsuche-meldung" role="status">Echte Suche ist ausgeschaltet. Den lokalen Server mit JOBPILOT_LIVE=1 starten, um selbst eine Suche auszulösen.</p>}{stand.lauf?.zustand==='fehlgeschlagen'&&<p className="jobsuche-meldung jobsuche-fehler" role="alert">Die letzte Suche wurde nicht abgeschlossen. Bereits gespeicherte Treffer bleiben erhalten.</p>}</>}
   profil={<><label>Suchbegriffe<input value={profiltext} onChange={e=>setProfiltext(e.target.value)} placeholder="Mit Semikolon trennen" /></label><details><summary>Vorschläge aus dem Informatik-Katalog</summary><div className="jobsuche-filter">{KEYWORD_CATALOGUES[0].areas.flatMap(g=>g.keywords).map(k=><button type="button" key={k} onClick={()=>setProfiltext(parseKeywordInput(profiltext+';'+k).join('; '))}>{k} +</button>)}</div></details><label><input type="checkbox" checked={breit} onChange={e=>setBreit(e.target.checked)}/> Weitere IT-Bereiche berücksichtigen</label><button type="button" onClick={()=>{const b=parseKeywordInput(profiltext);if(!b.length){setFehler('Mindestens einen Suchbegriff auswählen.');return;}const neu={...werte,begriffe:b};setWerte(neu);merken(neu);}}>Suchprofil speichern</button></>}
   quellen={<section><h2>Quellen auswählen</h2><div className="jobsuche-quellen">{SOURCE_IDS.map(id=><label key={id}><input type="checkbox" checked={quellen.includes(id)} onChange={e=>{const neu=e.target.checked?[...quellen,id]:quellen.filter(q=>q!==id);if(!neu.length){setFehler('Mindestens eine Quelle muss ausgewählt bleiben.');return;}setQuellen(neu);}}/>{SOURCE_LABELS[id]} <a href={platformSearchUrl(id,werte.begriffe[0]||'',werte.ort,werte.radius)} target="_blank" rel="noopener noreferrer">Öffnen ↗</a></label>)}</div></section>}
   weitere={<details><summary>Berichte der letzten Suche</summary>{stand.berichte.length?stand.berichte.map((b,i)=><p key={i}>{SOURCE_LABELS[b.source as PlatformId]||b.source}: {b.message}</p>):<p>Noch keine gespeicherten Berichte.</p>}</details>}
  />
 </div></div></div>;
}
