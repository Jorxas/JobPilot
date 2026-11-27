"use client";

import React, {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import './suche-arbeitsraum.css';
import {berlinerSuchtag,amSuchtagGefunden} from './suchtag';

export type Suchwerte = {begriffe: string[]; ort: string; radius: number};
export type Suchtreffer = {
 id: string; titel: string; firma: string; ort: string; quelle: string; beschreibung: string;
 entfernung?: number; gruende: string[]; hinweise: string[]; unterlagen: string[];
 anzeige?: string; dossier?: string; datum?: string; passung?: string;
};
export type SuchRueckmeldung = {meldung: string; unvollstaendig?: boolean};
type Eigenschaften = {
 werte: Suchwerte; treffer: Suchtreffer[]; suchen: (werte: Suchwerte) => Promise<SuchRueckmeldung>;
 stand?: string; einschraenkung?: string; profil?: ReactNode; quellen?: ReactNode; weitere?: ReactNode;
 hinweis?: ReactNode; demo?: boolean; deaktiviert?: boolean; tagesansicht?: boolean;
};
const sichererLink = (wert?: string) => {
 if (!wert) return undefined;
 if (wert.startsWith('/') && !wert.startsWith('//')) return wert;
 try {const u=new URL(wert);return u.protocol==='https:'&&!u.username&&!u.password?wert:undefined;} catch {return undefined;}
};

// Gemeinsame Darstellung; gespeichert und gesucht wird ausschließlich durch den jeweiligen Anwendungsadapter.
export function SucheArbeitsraum({werte,treffer,suchen,stand,einschraenkung,profil,quellen,weitere,hinweis,demo=false,deaktiviert=false,tagesansicht=false}:Eigenschaften) {
 const [suchtag,setSuchtag]=useState(()=>berlinerSuchtag());
 useEffect(()=>{if(!tagesansicht)return;const aktualisieren=()=>setSuchtag(berlinerSuchtag());aktualisieren();const uhr=setInterval(aktualisieren,1000);window.addEventListener('focus',aktualisieren);document.addEventListener('visibilitychange',aktualisieren);return()=>{clearInterval(uhr);window.removeEventListener('focus',aktualisieren);document.removeEventListener('visibilitychange',aktualisieren);};},[tagesansicht]);
 const [text,setText]=useState(werte.begriffe.join('; ')),[ort,setOrt]=useState(werte.ort),[radius,setRadius]=useState(werte.radius);
 const [art,setArt]=useState('alle'),[sortierung,setSortierung]=useState('passung'),[auswahl,setAuswahl]=useState<string|null>(null),[mobilDetail,setMobilDetail]=useState(false);
 const [laeuft,setLaeuft]=useState(false),[meldung,setMeldung]=useState(''),[fehler,setFehler]=useState(''),[teilweise,setTeilweise]=useState(false);
 const [sichtbar,setSichtbar]=useState(12);
 const laufend=useRef(false),detailFenster=useRef<HTMLElement>(null),letzteAuswahl=useRef<HTMLButtonElement|null>(null);
 const schluessel=JSON.stringify(werte);
 useEffect(()=>{setText(werte.begriffe.join('; '));setOrt(werte.ort);setRadius(werte.radius);},[schluessel]);
 const liste=useMemo(()=>{
  const gefiltert=treffer.filter(t=>(!tagesansicht||amSuchtagGefunden(t.datum,suchtag))&&(art==='alle'||(art==='praktikum'?/praktik|internship/i.test(t.titel):/werkstudent|working student|studentische/i.test(t.titel))));
  if(sortierung==='naehe')gefiltert.sort((a,b)=>(a.entfernung??Infinity)-(b.entfernung??Infinity));
  if(sortierung==='neu')gefiltert.sort((a,b)=>(b.datum||'').localeCompare(a.datum||''));
  return gefiltert;
 },[treffer,art,sortierung,tagesansicht,suchtag]);
 const detail=liste.find(t=>t.id===auswahl)||liste[0];
 useEffect(()=>{if(!liste.length)setMobilDetail(false);},[liste.length]);
 useEffect(()=>{if(mobilDetail&&window.matchMedia('(max-width:800px)').matches)detailFenster.current?.focus();},[mobilDetail,detail?.id]);
 async function starten(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(laufend.current||deaktiviert)return;
  const begriffe=[...new Set(text.split(/[,;\n\r]+/).map(s=>s.trim()).filter(Boolean))];
  if(!begriffe.length||!ort.trim()){setFehler('Bitte Suchbegriffe und Ort angeben.');return;}
  laufend.current=true;setLaeuft(true);setFehler('');setMeldung('');
  try{const r=await suchen({begriffe,ort:ort.trim(),radius});setMeldung(r.meldung);setTeilweise(!!r.unvollstaendig);}
  catch{setFehler('Die Suche konnte nicht bestätigt werden. Gespeicherte Treffer bleiben erhalten. Prüfe den Suchstand vor einem neuen Start.');}
  finally{laufend.current=false;setLaeuft(false);}
 }
 return <main className="suche-seite jobsuche" data-mobil-detail={mobilDetail}>
  <header className="jobsuche-kopf"><h1>Jobs finden</h1><p>Studentische Stellen in der Informatik.</p>{demo&&<span className="jobsuche-demo">Demo · erfundene Angebote</span>}</header>
  {hinweis}
  <form className="jobsuche-leiste" onSubmit={starten} aria-label="Stellen suchen">
   <label>Beruf oder Fähigkeit<input name="suchbegriffe" value={text} onChange={e=>setText(e.target.value)} required maxLength={12000} placeholder="Zum Beispiel Werkstudent Python" /></label>
   <label>Ort<input name="suchort" value={ort} onChange={e=>setOrt(e.target.value)} required maxLength={100}/></label>
   <label>Umkreis<select name="suchradius" value={radius} onChange={e=>setRadius(Number(e.target.value))}>{[...new Set([10,25,50,75,100,150,200,werte.radius])].sort((a,b)=>a-b).map(r=><option key={r} value={r}>{r} km</option>)}</select></label>
   <button type="submit" className="jobsuche-suchen" disabled={laeuft||deaktiviert}>{laeuft?'Suche läuft …':'Suchen'}</button>
  </form>
  <div className="jobsuche-profilzeile"><span>Suchprofil · Informatik · Studium</span>{profil&&<details className="jobsuche-einstellungen" id="suchprofil" data-suchprofil><summary>Suchprofil bearbeiten</summary><div className="jobsuche-einstellungen-inhalt">{profil}</div></details>}</div>
  {fehler&&<p className="jobsuche-meldung jobsuche-fehler" role="alert">{fehler}</p>}
  {(laeuft||meldung)&&<p className="jobsuche-meldung" role="status">{laeuft?'Die ausgewählten Quellen werden durchsucht. Bereits gespeicherte Treffer bleiben sichtbar.':meldung}{!laeuft&&teilweise&&' Teilabdeckung; Einzelheiten unter Suchdetails.'}</p>}
  <section className="jobsuche-ergebnisse" aria-label="Gespeicherte Stellen">
   <div className="jobsuche-listenkopf"><div><h2>{liste.length} {tagesansicht?(liste.length===1?'heute gefundene Stelle':'heute gefundene Stellen'):(liste.length===1?'offene Stelle':'offene Stellen')}</h2><p className="jobsuche-stand" data-stand>{stand||'Noch keine gespeicherte Suche.'}</p>{tagesansicht&&<p className="jobsuche-stand" data-tagesansicht>Hier stehen die Funde von heute. Alle bisherigen Stellen bleiben in der <a href="/suivi">Stellenübersicht</a>.</p>}</div><label className="jobsuche-sortierung">Sortieren<select value={sortierung} onChange={e=>setSortierung(e.target.value)}><option value="passung">Passend zuerst</option><option value="naehe">Entfernung</option><option value="neu">Neueste zuerst</option></select></label></div>
   {einschraenkung&&<p className="jobsuche-luecke"><span aria-hidden="true">●</span> {einschraenkung} <a href="#suchdetails" onClick={()=>{const d=document.getElementById('suchdetails');if(d instanceof HTMLDetailsElement)d.open=true;}}>Details ansehen</a></p>}
   <div className="jobsuche-filter" role="group" aria-label="Vertragsart filtern">{[['alle','Alle'],['werkstudent','Werkstudent'],['praktikum','Praktikum']].map(([id,label])=><button key={id} type="button" aria-pressed={art===id} onClick={()=>{setArt(id);setMobilDetail(false);}}>{label}</button>)}</div>
   <div className="jobsuche-geteilt">
    <div className="jobsuche-liste" aria-label="Offene Stellen">{liste.slice(0,sichtbar).map(t=><article className="jobsuche-treffer" key={t.id} data-gewaehlt={detail?.id===t.id}><button className="jobsuche-auswahl" type="button" aria-pressed={detail?.id===t.id} onClick={e=>{letzteAuswahl.current=e.currentTarget;setAuswahl(t.id);setMobilDetail(true);}}>
     <span className="jobsuche-titel">{t.titel}</span><span className="jobsuche-firma"><span className="jobsuche-logo" aria-hidden="true">{t.firma.replace(/[^A-Za-zÄÖÜäöü]/g,'').slice(0,2).toUpperCase()||'JP'}</span>{t.firma}</span><span className="jobsuche-ort">{t.ort||'Ort nicht hinterlegt'}{typeof t.entfernung==='number'?` · ${t.entfernung} km`:''}</span><span className="jobsuche-quelle">{t.quelle}</span>{t.gruende[0]&&<span className="jobsuche-passgrund">{t.gruende[0]}</span>}
    </button></article>)}{liste.length>sichtbar&&<button type="button" className="jobsuche-mehr" onClick={()=>setSichtbar(n=>n+12)}>Weitere Stellen anzeigen</button>}{!liste.length&&<div className="jobsuche-leer"><h3>{tagesansicht?'Heute keine passenden neuen Stellen':'Noch keine passenden gespeicherten Stellen'}</h3><p>Starte eine Suche oder passe die Filter an.{tagesansicht&&<> Bisherige Funde findest du in der <a href="/suivi">Stellenübersicht</a>.</>}</p></div>}</div>
    {detail&&<section className="jobsuche-detail" ref={detailFenster} aria-label="Stelle im Detail" tabIndex={-1}>
     <button type="button" className="jobsuche-zurueck" onClick={()=>{setMobilDetail(false);requestAnimationFrame(()=>letzteAuswahl.current?.focus());}}>← Zur Ergebnisliste</button>
     <p className="jobsuche-detail-firma">{detail.firma}</p><h2>{detail.titel}</h2><p className="jobsuche-detail-ort">{detail.ort||'Ort nicht hinterlegt'}{typeof detail.entfernung==='number'?` · ${detail.entfernung} km`:''}</p><p className="jobsuche-quelle">Quelle: {detail.quelle}</p>
     {(detail.passung||detail.hinweise.length>0)&&<div className="jobsuche-vorbehalt"><strong>{detail.passung}</strong>{detail.hinweise.length>0&&<ul>{detail.hinweise.map((g,i)=><li key={i}>{g}</li>)}</ul>}</div>}
     <section className="jobsuche-abschnitt"><h3>Unterlagen</h3><p>{detail.unterlagen.length?'Noch erforderlich: '+detail.unterlagen.join(' und '):'Gezielte Unterlagen vorhanden. Bitte vor einer Bewerbung prüfen.'}</p><div className="jobsuche-aktionen">{sichererLink(detail.dossier)&&<a className="jobsuche-hauptaktion" href={sichererLink(detail.dossier)}>{detail.unterlagen.length?'Unterlagen vorbereiten':'Dossier prüfen'}</a>}{sichererLink(detail.anzeige)&&<a className="jobsuche-original" href={sichererLink(detail.anzeige)} target="_blank" rel="noopener noreferrer">Originalanzeige öffnen ↗</a>}</div></section>
     {detail.gruende.length>0&&<section className="jobsuche-abschnitt"><h3>Warum diese Stelle?</h3><ul>{detail.gruende.map((g,i)=><li key={i}>{g}</li>)}</ul></section>}
     <section className="jobsuche-abschnitt"><h3>Die Stelle</h3>{detail.beschreibung?<><p className="jobsuche-beschreibung">{detail.beschreibung.slice(0,1800)}{detail.beschreibung.length>1800?' …':''}</p>{detail.beschreibung.length>1800&&<details key={detail.id}><summary>Vollständige Beschreibung lesen</summary><p className="jobsuche-beschreibung">{detail.beschreibung}</p></details>}</>:<p>Die vollständige Beschreibung ist noch nicht gespeichert. Bitte die Originalanzeige prüfen.</p>}</section>
    </section>}
   </div>
  </section>
  <details className="jobsuche-technik" id="suchdetails"><summary>Suchdetails und Quellen</summary><p>Die Suche erfasst einen Teil der verfügbaren Anzeigen. Der Zustand stammt aus dem letzten Suchlauf beziehungsweise der Leseprüfung.</p>{quellen}{weitere}</details>
 </main>;
}
