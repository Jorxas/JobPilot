import React,{useEffect,useState} from 'react';

// Profilbereich für automatisch erstellte Bewerbungsunterlagen (lokaler Server): eigene Lebenslaufdaten, Wahl der
// Grundlage, Anschreibenvorlage und Nachweise. Alles bleibt im eigenen Datenordner; nichts wird versendet.
type Art='enrollment'|'transcript'|'certificates';
const ARTEN:[Art,string,string][]=[['enrollment','Immatrikulationsbescheinigung',"Certificat de scolarité"],['transcript','Leistungsübersicht','Relevé de notes'],['certificates','Zeugnisse','Certificats et attestations']];
type Eintrag=Record<string,string>;
type Daten={grundlage:'jobpilot'|'eigene';brief:'jobpilot'|'eigene';eigenerBrief:string;kurzprofil:string;arbeitsweise:string;weiterbildung:string;sprachen:string;ausbildung:Eintrag[];erfahrung:Eintrag[];projekte:Eintrag[];kenntnisse:Eintrag[]};
type Antwort={profil:{grundlage:Daten['grundlage'];brief:Daten['brief'];eigenerBrief:string;lebenslauf:Record<string,unknown>;nachweise:Partial<Record<Art,{name:string;groesse:number;am:string}>>};profilFehlt:string[];verlangtIn:Record<Art,number>;erstellung:{einstellung:string;kette:string[];laeuft:boolean;wartend:number}};
const FELDER:Record<'ausbildung'|'erfahrung'|'projekte'|'kenntnisse',[string,string,boolean?][]>={
 ausbildung:[['abschluss','Abschluss / Studiengang'],['einrichtung','Hochschule oder Schule'],['ort','Ort'],['zeitraum','Zeitraum (z. B. seit 2024)'],['punkte','Stichpunkte, einer je Zeile',true]],
 erfahrung:[['titel','Tätigkeit'],['firma','Firma'],['ort','Ort'],['zeitraum','Zeitraum'],['punkte','Stichpunkte, einer je Zeile',true]],
 projekte:[['name','Projektname'],['technik','Technik, mit Komma getrennt'],['kontext','Rahmen (z. B. Gruppenprojekt)'],['link','Link (nur hinter dem Namen, nie sichtbar)'],['punkte','Stichpunkte, einer je Zeile',true]],
 kenntnisse:[['kategorie','Kategorie (z. B. Web)'],['eintraege','Einträge, mit Komma getrennt']],
};
const TITEL={ausbildung:'Studium und Ausbildung',erfahrung:'Berufserfahrung',projekte:'Projekte',kenntnisse:'Kenntnisse nach Kategorien'};
const alsText=(v:unknown)=>Array.isArray(v)?v.join(', '):typeof v==='string'?v:'';
function ausAntwort(a:Antwort):Daten{
 const l=a.profil.lebenslauf as Record<string,unknown>,liste=(k:string,zeilen:string[]=[])=>((l[k] as Record<string,unknown>[])||[]).map(e=>Object.fromEntries(Object.entries(e).map(([f,v])=>[f,Array.isArray(v)?v.join(zeilen.includes(f)?'\n':', '):String(v??'')])));
 return {grundlage:a.profil.grundlage,brief:a.profil.brief,eigenerBrief:a.profil.eigenerBrief||'',kurzprofil:String(l.kurzprofil||''),arbeitsweise:String(l.arbeitsweise||''),weiterbildung:String(l.weiterbildung||''),sprachen:alsText(l.sprachen),ausbildung:liste('ausbildung',['punkte']),erfahrung:liste('erfahrung',['punkte']),projekte:liste('projekte',['punkte']),kenntnisse:liste('kenntnisse')};
}
async function api(pfad:string,body?:unknown){const r=await fetch(pfad,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(d.error||d.fehler||'Anfrage nicht bestätigt.');return d;}
async function pdfOeffnen(pfad:string){const r=await fetch(pfad,{credentials:'same-origin',cache:'no-store'});if(!r.ok){const d=await r.json().catch(()=>({}));throw Error(d.error||d.fehler||'Vorschau nicht möglich.');}const u=URL.createObjectURL(await r.blob());window.open(u,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(u),60000);}

export function UnterlagenProfil(){
 const [antwort,setAntwort]=useState<Antwort|null>(null),[d,setD]=useState<Daten|null>(null),[meldung,setMeldung]=useState(''),[fehler,setFehler]=useState(''),[arbeit,setArbeit]=useState(false);
 const laden=async()=>{const a=await api('/api/unterlagen/profil') as Antwort;setAntwort(a);setD(ausAntwort(a));};
 useEffect(()=>{void laden().catch(e=>setFehler(e.message));},[]);
 async function tun(fn:()=>Promise<string>){if(arbeit)return;setArbeit(true);setFehler('');setMeldung('');try{setMeldung(await fn());}catch(e){setFehler(e instanceof Error?e.message:'Nicht abgeschlossen.');}finally{setArbeit(false);}}
 if(!d||!antwort)return <section className="unterlagenprofil" data-unterlagenprofil><h2>Lebenslauf, Anschreiben und Nachweise</h2>{fehler?<p role="alert">{fehler}</p>:<p>Wird geladen …</p>}</section>;
 const setzen=(k:keyof Daten,v:unknown)=>setD({...d,[k]:v} as Daten);
 const liste=(k:'ausbildung'|'erfahrung'|'projekte'|'kenntnisse')=><div className="unterlagenliste" data-liste={k}><h4>{TITEL[k]}</h4>{d[k].map((e,i)=><div className="unterlageneintrag" key={i}>{FELDER[k].map(([f,label,mehrzeilig])=><label key={f}>{label}{mehrzeilig?<textarea name={`${k}.${i}.${f}`} rows={3} value={e[f]||''} onChange={v=>setzen(k,d[k].map((x,j)=>j===i?{...x,[f]:v.target.value}:x))}/>:<input name={`${k}.${i}.${f}`} value={e[f]||''} onChange={v=>setzen(k,d[k].map((x,j)=>j===i?{...x,[f]:v.target.value}:x))}/>}</label>)}<button type="button" className="nebenknopf" onClick={()=>setzen(k,d[k].filter((_,j)=>j!==i))}>Eintrag entfernen</button></div>)}<button type="button" className="nebenknopf" data-hinzufuegen={k} onClick={()=>setzen(k,[...d[k],{}])}>{TITEL[k]}: Eintrag hinzufügen</button></div>;
 async function nachweis(art:Art,file?:File){if(!file)return;await tun(async()=>{if(file.size>5*1024*1024)throw Error('PDF höchstens 5 MiB.');const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Bitte eine PDF-Datei auswählen.');let b='';for(let i=0;i<bytes.length;i+=32768)b+=String.fromCharCode(...bytes.subarray(i,i+32768));await api('/api/unterlagen/nachweis',{art,name:file.name,base64:btoa(b)});await laden();return 'Nachweis gespeichert. Verlangt eine Anzeige ihn ausdrücklich, wird er der Bewerbung beigelegt.';});}
 const speichern=()=>tun(async()=>{
  const body={grundlage:d.grundlage,brief:d.brief,eigenerBrief:d.eigenerBrief,lebenslauf:{kurzprofil:d.kurzprofil,arbeitsweise:d.arbeitsweise,weiterbildung:d.weiterbildung,sprachen:d.sprachen,ausbildung:d.ausbildung,erfahrung:d.erfahrung,projekte:d.projekte,kenntnisse:d.kenntnisse}};
  await api('/api/unterlagen/profil',body);await laden();return 'Lebenslaufdaten gespeichert. Fehlende Unterlagen offener Stellen von heute werden im Hintergrund erstellt. Kein Versand.';
 });
 const n=antwort.profil.nachweise;
 return <section className="unterlagenprofil" data-unterlagenprofil>
  <h2>Lebenslauf, Anschreiben und Nachweise</h2>
  <p>Für jede neue passende Stelle erstellt JobPilot nach der Suche ohne Klick einen gezielten Lebenslauf und ein Anschreiben aus diesen Angaben. Prüfe beides vor dem Absenden; JobPilot versendet nichts und markiert nichts als beworben.</p>
  {antwort.profilFehlt.length>0&&<p className="unterlagenhinweis" data-profil-fehlt>Für die automatische Erstellung fehlen noch: {antwort.profilFehlt.join(', ')}. Name und E-Mail kommen aus „Mein Profil“ oben.</p>}
  <fieldset className="nachweise" data-nachweise><legend>Nachweise · optional, aber empfohlen</legend>
   <p>Viele Anzeigen verlangen eine Immatrikulationsbescheinigung, eine Leistungsübersicht oder Zeugnisse. Lade sie einmal hoch: Verlangt eine Anzeige sie ausdrücklich, legt JobPilot sie der Bewerbung bei. Fehlt eine verlangte Datei, steht das bei der Stelle.</p>
   {ARTEN.map(([art,titel,fr])=><div className="nachweiszeile" key={art} data-nachweis={art}><strong>{titel}</strong> <span className="nebentext">({fr})</span><br/>{n[art]?<><span>Hinterlegt: {n[art]!.name}</span> <a href={`/api/unterlagen/nachweis/${art}`} target="_blank" rel="noreferrer">Ansehen</a> <button type="button" className="nebenknopf" disabled={arbeit} onClick={()=>void tun(async()=>{await api('/api/unterlagen/nachweis',{art,entfernen:true});await laden();return titel+' entfernt.';})}>Entfernen</button></>:<span className="nebentext">Noch keine Datei.</span>}{antwort.verlangtIn[art]>0&&<span className="nebentext"> · in {antwort.verlangtIn[art]} offenen Anzeigen verlangt</span>}<label>{n[art]?'Ersetzen (PDF, höchstens 5 MiB)':'PDF hochladen (höchstens 5 MiB)'}<input type="file" accept="application/pdf,.pdf" disabled={arbeit} onChange={e=>void nachweis(art,e.target.files?.[0])}/></label></div>)}
  </fieldset>
  <form onSubmit={e=>{e.preventDefault();void speichern();}} data-lebenslaufdaten>
   <fieldset><legend>Grundlage des Lebenslaufs</legend>
    <label><input type="radio" name="grundlage" checked={d.grundlage==='jobpilot'} onChange={()=>setzen('grundlage','jobpilot')}/> JobPilot-Struktur mit deinen Angaben: eine Seite, Projekte als kurze Stichpunkte, Kenntnisse nach Kategorien, die zur Anzeige passenden Projekte zuerst.</label>
    <label><input type="radio" name="grundlage" checked={d.grundlage==='eigene'} onChange={()=>setzen('grundlage','eigene')}/> Deine eigenen Angaben in deiner Reihenfolge und schlichter Gestaltung (mit Kurzprofil, alle Projekte, bei Bedarf zwei Seiten).</label>
   </fieldset>
   <fieldset><legend>Anschreiben</legend>
    <label><input type="radio" name="brief" checked={d.brief==='jobpilot'} onChange={()=>setzen('brief','jobpilot')}/> JobPilot-Vorlage mit deinen Angaben: Interesse an Stelle und Firma, Studium mit passenden Kenntnissen und Projekten, Arbeitsweise, Ziel, Verfügbarkeit. Datum, Firma und Stelle werden eingesetzt.</label>
    <label><input type="radio" name="brief" checked={d.brief==='eigene'} onChange={()=>setzen('brief','eigene')}/> Eigener Text mit Platzhaltern {'{Firma}'}, {'{Stelle}'}, {'{Ort}'}, {'{Bereich}'}, {'{Kenntnisse}'}; Absätze durch eine Leerzeile trennen.</label>
    {d.brief==='eigene'&&<label>Eigener Brieftext (ohne Anrede und Grußformel)<textarea name="eigenerBrief" rows={10} value={d.eigenerBrief} onChange={e=>setzen('eigenerBrief',e.target.value)}/></label>}
    <label>Arbeitsweise in eigenen Worten (optional, ersetzt den allgemeinen Absatz der Vorlage)<textarea name="arbeitsweise" rows={3} value={d.arbeitsweise} onChange={e=>setzen('arbeitsweise',e.target.value)}/></label>
   </fieldset>
   <fieldset><legend>Lebenslaufdaten</legend>
    <p className="nebentext">Nur deine eigenen, wahren Angaben. Sie werden ausgewählt und sortiert, aber nie ergänzt. Keine Adressen ausschreiben: ein Projektlink liegt unsichtbar hinter dem Namen.</p>
    {liste('ausbildung')}{liste('erfahrung')}{liste('projekte')}{liste('kenntnisse')}
    <label>Sprachen, mit Komma getrennt<input name="sprachen" value={d.sprachen} onChange={e=>setzen('sprachen',e.target.value)}/></label>
    <label>Weiterbildung (eine Zeile, optional)<input name="weiterbildung" value={d.weiterbildung} onChange={e=>setzen('weiterbildung',e.target.value)}/></label>
    <label>Kurzprofil (nur bei eigener Gestaltung, optional)<textarea name="kurzprofil" rows={3} value={d.kurzprofil} onChange={e=>setzen('kurzprofil',e.target.value)}/></label>
   </fieldset>
   <p className="nebentext" data-erstellung>Erstellung: {antwort.erstellung.kette.join(' → ')}{antwort.erstellung.laeuft||antwort.erstellung.wartend?` · läuft gerade (${antwort.erstellung.wartend} wartend)`:''}. KI-Wege nur nach eigener Freischaltung (JOBPILOT_UNTERLAGEN_ANBIETER, siehe docs/UNTERLAGEN.md).</p>
   <button disabled={arbeit}>Lebenslaufdaten speichern</button>
   <button type="button" className="nebenknopf" disabled={arbeit} onClick={()=>void tun(async()=>{await pdfOeffnen('/api/unterlagen/vorschau/cv');return 'Vorschau mit einer erfundenen Beispielstelle geöffnet (gespeicherter Stand).';})}>Vorschau Lebenslauf</button>
   <button type="button" className="nebenknopf" disabled={arbeit} onClick={()=>void tun(async()=>{await pdfOeffnen('/api/unterlagen/vorschau/letter');return 'Vorschau mit einer erfundenen Beispielstelle geöffnet (gespeicherter Stand).';})}>Vorschau Anschreiben</button>
  </form>
  {fehler&&<p role="alert">{fehler}</p>}{meldung&&<p className="unterlagenmeldung" data-unterlagen-meldung>{meldung}</p>}
 </section>;
}

// Im Dossier: Stand der automatischen Erstellung, ausdrückliches Neuerstellen und die von der Anzeige verlangten Nachweise.
export type Erzeugung={zustand:string;fehlt?:string[];anbieterName?:string;satz?:{am:string;anbieter?:string;grundlage?:string;brief?:string;fehler?:string;versuche?:{schritt:string;fehler:string}[]}};
export type Nachweise={verlangt:string[];beigelegt:string[];fehlen:string[];titel:Record<string,string>;dateien:Record<string,string>};
const berlinTag=(iso:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
const deutsch=(iso:string)=>new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(iso));
export function ErstellungsStand({id,status,erzeugung,nachweise,heute,neu}:{id:string;status:string;erzeugung?:Erzeugung;nachweise?:Nachweise;heute?:string;neu:()=>void}){
 const [arbeit,setArbeit]=useState(false),[fehler,setFehler]=useState('');
 const e=erzeugung,satz=e?.satz;
 const neuErstellen=async()=>{if(arbeit)return;setArbeit(true);setFehler('');try{await api('/api/unterlagen/erstellen',{id});neu();}catch(x){setFehler(x instanceof Error?x.message:'Nicht eingeplant.');}finally{setArbeit(false);}};
 return <section className="erstellungsstand" data-erstellung-stand={e?.zustand||''}>
  <h3>Automatisch erstellte Unterlagen</h3>
  {e?.zustand==='wartet'||e?.zustand==='laeuft'?<p data-erstellung-laeuft>Lebenslauf und Anschreiben für diese Stelle werden gerade erstellt …</p>
  :e?.zustand==='profil-fehlt'?<p>Automatische Erstellung wartet auf dein Profil. Es fehlen: {e.fehlt?.join(', ')}. <a href="/profile">Profil ergänzen</a></p>
  :e?.zustand==='fehler'?<p>Die automatische Erstellung ist gescheitert: {satz?.fehler}</p>
  :satz&&e?.zustand!=='offen'?<p data-erstellt>Erstellt am {deutsch(satz.am)} mit {e?.anbieterName||satz.anbieter} · Lebenslauf: {satz.grundlage==='eigene'?'eigene Gestaltung':'JobPilot-Struktur'} · Anschreiben: {satz.brief==='eigene'?'eigener Text':'JobPilot-Vorlage'}.{satz.versuche?.length?` Nicht genutzt: ${satz.versuche.map(v=>v.schritt+' ('+v.fehler+')').join('; ')}.`:''}</p>
  :e?.zustand==='nicht-noetig'?<p>Für diese Stelle sind bereits eigene gezielte Unterlagen gespeichert.</p>:null}
  {satz?.am&&heute&&berlinTag(satz.am)!==heute&&e?.zustand==='fertig'&&status==='pending'&&<p data-datum-alt>Das Anschreiben trägt das Datum vom {deutsch(satz.am)}. Vor dem Absenden mit dem heutigen Datum neu erstellen.</p>}
  <p className="nebentext">Vor dem Absenden lesen und prüfen. JobPilot versendet nichts und markiert nichts als beworben; der Formularassistent füllt nur nach deinem Klick und sendet nie ab.</p>
  {status==='pending'&&e?.zustand!=='gesperrt'&&<button type="button" className="nebenknopf" disabled={arbeit||e?.zustand==='wartet'||e?.zustand==='laeuft'} onClick={()=>void neuErstellen()} data-neu-erstellen>Mit aktuellem Profil neu erstellen</button>}
  {nachweise&&nachweise.verlangt.length>0&&<div className="nachweisstand" data-nachweis-stand><h4>Von der Anzeige verlangte Nachweise</h4><ul>{nachweise.verlangt.map(a=><li key={a} data-nachweis={a}>{nachweise.beigelegt.includes(a)?<>{nachweise.titel[a]}: beigelegt (<a href={`/api/tracker/${encodeURIComponent(id)}/documents/${a}`} target="_blank" rel="noreferrer">{nachweise.dateien[a]||'Ansehen'}</a>)</>:<strong>{nachweise.titel[a]} verlangt, keine Datei im Profil hinterlegt. <a href="/profile">Im Profil hochladen</a></strong>}</li>)}</ul><p className="nebentext">Der Formularassistent ordnet derzeit Lebenslauf und Anschreiben automatisch zu; beigelegte Nachweise bei Bedarf im Arbeitgeberformular selbst auswählen.</p></div>}
  {fehler&&<p role="alert">{fehler}</p>}
 </section>;
}
