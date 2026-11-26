// Stellensuche am lokalen Server, nach /offres des Originals (src/app/offres/suche-inhalt.tsx, search-trigger.tsx,
// components/keyword-picker.tsx, platform-coverage.tsx und platform-chips.tsx): oben Knopf und Stand, dann Suchbegriffe,
// dann die kompakte Plattformübersicht, alles Weitere eingeklappt. Statt Server-Actions und Datenbank spricht die Seite mit
// der lokalen API (GET /api/suche, GET /api/status, POST /api/kriterien, POST /api/suche). Die statische Demo zeigt diese
// Seite nicht; dort bleibt die Suche ein Hinweis.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {t,sprache,ortsformat} from './sprache';
import {PLATFORMS,SOURCE_IDS,SOURCE_LABELS,platformSearchUrl,type PlatformId} from '../kern/platforms';
import {platformStates,PROBLEM_STATES,STATE_LABEL,STATE_NOTE,type PlatformState} from '../kern/platform-status';
import {KEYWORD_LIMIT,SEARCH_PASSES,batchPlan,initialKeywordList,keywordCatalogue,normalizeKeywordList,parseKeywordInput,DEFAULT_KEYWORD_DOMAIN} from '../kern/catalog';
import {istNeueStelle,ohneUnterlagen} from '../kern/company-catalogue';
import {ergebnisDaten,sucheLaeuft,sucheUnterbrochen,suchsteuerung,type Auftrag,type Bericht,type Stand} from './suchablauf';
import './suche.css';

type Faehigkeit={live:boolean;indeedConnectoren?:{codex:boolean;claude:boolean};plattformen?:string[]};
const VORGABE={city:'Gießen',radius:50,breit:true};
async function api<T>(pfad:string,inhalt?:unknown):Promise<T>{const r=await fetch(pfad,{credentials:'same-origin',cache:'no-store',...(inhalt===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(inhalt)})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||d.fehler||t(`Anfrage nicht abgeschlossen (${r.status}).`,`Requête non aboutie (${r.status}).`));return d as T;}
const zeit=(v:string)=>new Intl.DateTimeFormat(ortsformat(),{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const stellenWort=(n:number)=>t(`${n} neue ${n===1?'Stelle':'Stellen'}`,`${n} nouvelle${n===1?'':'s'} offre${n===1?'':'s'}`);

const FR_ZUSTAND:Record<PlatformState,string>={gelesen:'lu',teilweise:'partiel',blockiert:'bloqué','nur-link':'lien seulement',fehler:'échec de lecture',offen:'non interrogé',aus:'désactivé'};
const FR_HINWEIS:Partial<Record<PlatformState,string>>={blockiert:'La plateforme n’autorise pas la lecture automatique. Chercher dans le navigateur et ajouter les offres trouvées via l’import manuel du serveur local.','nur-link':'La liste de résultats ne se lit pas automatiquement. Seul le lien de recherche est utilisable ; vérifier les offres dans le navigateur.',fehler:'La lecture a échoué. Elle ne sera retentée qu’à la prochaine recherche ; d’ici là, chercher dans le navigateur.'};
const zustandText=(s:PlatformState)=>sprache()==='fr'?FR_ZUSTAND[s]:STATE_LABEL[s];
const zustandHinweis=(s:PlatformState)=>sprache()==='fr'?FR_HINWEIS[s]:STATE_NOTE[s];
const GRUND:Record<string,[string,string]>={blocked:['blockiert','bloquée'],error:['nicht erreichbar','injoignable'],partial:['nur teilweise erreichbar','partiellement accessible']};
const FR_BEREICH:Record<string,string>={allgemein:'Informatique générale',entwicklung:'Développement logiciel',web:'Web, frontend et applis',daten:'Données et IA',cloud:'Cloud et DevOps',support:'Support, systèmes et réseau',sicherheit:'Sécurité',test:'Tests et qualité',embedded:'Embarqué et technique',business:'ERP et informatique de gestion'};
const bereichName=(id:string,de:string)=>sprache()==='fr'?FR_BEREICH[id]||de:de;
const gleich=(a:string,b:string)=>a.toLocaleLowerCase('de-DE')===b.toLocaleLowerCase('de-DE');

export function Stellensuche(){
 const [faehigkeit,setFaehigkeit]=useState<Faehigkeit|null>(null),[stand,setStand]=useState<Stand|null>(null),[ladefehler,setLadefehler]=useState('');
 const [startet,setStartet]=useState(false),[belegt,setBelegt]=useState(false),[startfehler,setStartfehler]=useState(''),[gestartet,setGestartet]=useState(false);
 const steuerung=useMemo(()=>suchsteuerung((pfad,optionen)=>fetch(pfad,{credentials:'same-origin',...optionen})),[]);
 const verfolgt=useRef('');
 const laden=useCallback(async()=>{try{const [f,s]=await Promise.all([api<Faehigkeit>('/api/suche'),api<Stand>('/api/status')]);setFaehigkeit(f);setStand(s);setLadefehler('');return s;}catch(e){setLadefehler(e instanceof Error?e.message:t('Daten nicht geladen.','Données non chargées.'));return null;}},[]);
 // Eine bereits laufende Suche (zum Beispiel aus einem Gespräch gestartet) wird nur verfolgt, nie ein zweites Mal gestartet.
 const folgen=useCallback(async(s:Stand)=>{const beginn=s.zustand.lauf?.beginn;if(!beginn||verfolgt.current===beginn||!sucheLaeuft(s))return;verfolgt.current=beginn;try{setStand(await steuerung.verfolgen(beginn,setStand));}catch{setStartfehler(t('Der Server antwortet nicht mehr; das Ergebnis ist unbestätigt. Seite später neu laden. Keine automatische Wiederholung.','Le serveur ne répond plus ; le résultat n’est pas confirmé. Recharger la page plus tard. Aucune relance automatique.'));}finally{verfolgt.current='';}},[steuerung]);
 useEffect(()=>{void laden().then(s=>{if(s)void folgen(s);});},[laden,folgen]);
 const z=stand?.zustand,live=faehigkeit?.live===true&&stand?.live===true;
 const gespeichert:Auftrag|undefined=z?.auftrag&&Array.isArray(z.auftrag.keywordList)&&z.auftrag.keywordList.length?z.auftrag:undefined;
 const auftrag={city:z?.auftrag?.city||VORGABE.city,radius:z?.auftrag?.radius||VORGABE.radius,breit:z?.auftrag?.breit??VORGABE.breit,quellen:(z?.auftrag?.quellen?.length?z.auftrag.quellen:[...SOURCE_IDS]) as string[],keywordList:gespeichert?.keywordList||[],keywordDomain:z?.auftrag?.keywordDomain||DEFAULT_KEYWORD_DOMAIN};
 const laeuft=sucheLaeuft(stand),unterbrochen=sucheUnterbrochen(stand);
 // Plattformzustände nur aus echten Suchberichten; simulierte Berichte des Beispielmodus zählen nicht.
 const berichte:Bericht[]=z?.modus==='live'?(z?.berichte||[]):[];
 const heute=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const zeilen=(z?.stellen||[]).map(s=>({id:s.id,status:s.status,metadata:{company:s.company,companyExcluded:s.companyExcluded},documents:[]}));
 const neueStellen=(z?.stellen||[]).filter(s=>istNeueStelle(s,heute)).map(s=>zeilen.find(r=>r.id===s.id)!);
 const neu=neueStellen.length,neuVorzubereiten=ohneUnterlagen(neueStellen,zeilen).length;
 const kriterienSpeichern=async(aenderung:Partial<Auftrag>)=>{const d=await api<{auftrag:Auftrag}>('/api/kriterien',aenderung);setStand(s=>s?{...s,zustand:{...s.zustand,auftrag:d.auftrag}}:s);return d.auftrag;};
 const starten=async()=>{if(startet||laeuft||!gespeichert)return;setStartet(true);setBelegt(false);setStartfehler('');setGestartet(false);
  try{const e=await steuerung.starten(gespeichert,setStand);
   if(e.art==='belegt'){setBelegt(true);if(e.stand)setStand(e.stand);else await laden();}
   else if(e.art==='aus')setStartfehler(t('Live-Suche ist an diesem Server nicht freigeschaltet. Keine Suche gestartet.','La recherche en direct n’est pas activée sur ce serveur. Aucune recherche lancée.'));
   else if(e.art==='fehler')setStartfehler(t(`Suchstart nicht bestätigt: ${e.meldung} Keine automatische Wiederholung.`,`Lancement non confirmé : ${e.meldung} Aucune relance automatique.`));
   else{setGestartet(true);setStand(e.stand);}}
  catch{setStartfehler(t('Suchstart nicht bestätigt: keine Antwort des Servers. Vor einem neuen Versuch die Seite neu laden. Keine automatische Wiederholung.','Lancement non confirmé : pas de réponse du serveur. Recharger la page avant un nouvel essai. Aucune relance automatique.'));}
  finally{setStartet(false);}};
 const lauf=z?.lauf;
 const standZeile=laeuft&&lauf?t(`Suche läuft seit ${zeit(lauf.beginn)}`,`Recherche en cours depuis ${zeit(lauf.beginn)}`):lauf?t(`Zuletzt gesucht: ${zeit(lauf.ende||lauf.beginn)} · ${lauf.abgeschlossen} von ${lauf.durchlaeufe} Durchläufen`,`Dernière recherche : ${zeit(lauf.ende||lauf.beginn)} · ${lauf.abgeschlossen} passages sur ${lauf.durchlaeufe}`):t('Noch keine Suche durchgeführt.','Aucune recherche effectuée pour l’instant.');
 const plattformen=auftrag.quellen.map(id=>({id,label:SOURCE_LABELS[id]||id}));
 if(!faehigkeit||!stand)return <><h1>{t('Stellensuche',"Recherche d'emploi")}</h1>{ladefehler?<p role="alert" className="suche-hinweis">{ladefehler}</p>:<p className="suche-kurz">{t('Wird geladen …','Chargement …')}</p>}</>;
 return <>
  <h1>{t('Stellensuche',"Recherche d'emploi")}</h1>
  <section className="suche-karte suche-hero" aria-label={t('Suche starten','Lancer la recherche')}>
   <div className="suche-hero-text">
    <p className="suche-stand-zeile" data-stand>{standZeile}</p>
    <ul className="suche-fakten" aria-label={t('Aktuelle Suche','Recherche actuelle')}>
     <li>{auftrag.city}, {auftrag.radius} km</li>
     <li>{gespeichert?<a href="#suchbegriffe">{t(`${gespeichert.keywordList.length} Suchbegriffe`,`${gespeichert.keywordList.length} mots-clés`)}</a>:<a href="#suchbegriffe" className="offen">{t('Suchbegriffe bestätigen','Confirmer les mots-clés')}</a>}</li>
     <li data-plattformzahl>{t(`${auftrag.quellen.length} von ${PLATFORMS.length} Plattformen`,`${auftrag.quellen.length} plateformes sur ${PLATFORMS.length}`)}</li>
     <li>{t('Nur Informatik','Informatique uniquement')}</li>
     <li className="suche-fakt-link"><a href="/suivi">{t('Zur Stellenübersicht',"Vers l'aperçu des offres")}{neu?t(` · ${neu} neu`,` · ${neu} nouvelle${neu===1?'':'s'}`):''} →</a></li>
     {neuVorzubereiten>0&&<li data-neu-vorzubereiten><a href="/suivi" className="offen">{t(`${neuVorzubereiten} neue ${neuVorzubereiten===1?'Stelle':'Stellen'} noch vorzubereiten →`,`${neuVorzubereiten} nouvelle${neuVorzubereiten===1?'':'s'} offre${neuVorzubereiten===1?'':'s'} à préparer →`)}</a></li>}
    </ul>
   </div>
   <div className="suche-ausloeser">
    <form className="knopf-gross" onSubmit={e=>{e.preventDefault();void starten();}}><button type="submit" disabled={!live||!gespeichert||laeuft||startet} aria-busy={laeuft||startet}>{laeuft||startet?t('Suche läuft, das dauert einen Moment …','Recherche en cours, cela prend un moment …'):t('Neue Stellen suchen','Rechercher de nouvelles offres')}</button></form>
    {laeuft&&lauf&&<p role="status" className="suche-hinweis" data-fortschritt>{t(`Suche läuft: ${lauf.abgeschlossen} von ${lauf.durchlaeufe} Durchläufen abgeschlossen, bisher ${stellenWort(lauf.neu)} aus ${lauf.gefunden} gelesenen Treffern.`,`Recherche en cours : ${lauf.abgeschlossen} passages sur ${lauf.durchlaeufe} terminés, ${stellenWort(lauf.neu)} jusqu'ici sur ${lauf.gefunden} résultats lus.`)}</p>}
    {belegt&&<p role="status" className="suche-hinweis" data-belegt>{t('Es läuft bereits eine Suche, zum Beispiel aus einem Gespräch oder dem Terminal gestartet. Eine zweite Suche wird nicht gestartet; ihr Ergebnis erscheint hier.','Une recherche est déjà en cours, lancée par exemple depuis une conversation ou le terminal. Aucune seconde recherche n’est lancée ; son résultat apparaît ici.')}</p>}
    {startfehler&&<p role="alert" className="suche-hinweis">{startfehler}</p>}
    {!laeuft&&lauf&&lauf.zustand!=='laeuft'&&<Ergebnis lauf={lauf} berichte={berichte} frisch={gestartet}/>}
   </div>
   {!live&&<p className="suche-hinweis suche-hero-voll" data-live-aus>{t('Live-Suche ist an diesem Server ausgeschaltet: Es wird keine Plattform abgefragt und kein Ergebnis vorgetäuscht. Zum Einschalten den Server beenden und neu starten, in PowerShell mit ',"La recherche en direct est désactivée sur ce serveur : aucune plateforme n'est interrogée et aucun résultat n'est simulé. Pour l'activer, arrêter le serveur et le relancer, dans PowerShell avec ")}<code>$env:JOBPILOT_LIVE = '1'</code>{t(' und ',' puis ')}<code>npm start</code>{t(', unter macOS oder Linux mit ',', sous macOS ou Linux avec ')}<code>JOBPILOT_LIVE=1 npm start</code>{t('. Danach diese Seite neu laden.','. Recharger ensuite cette page.')}</p>}
   {live&&!gespeichert&&<p className="suche-hinweis suche-hero-voll" data-kriterien-fehlen>{t('Lege zuerst Suchbegriffe, Ort und Umkreis fest: Suchbegriffe unten bestätigen und speichern.','Définis d’abord les mots-clés, le lieu et le rayon : confirme et enregistre les mots-clés ci-dessous.')}</p>}
   {unterbrochen&&<p role="status" className="suche-hinweis suche-hero-voll" data-unterbrochen>{t('Eine Suche wurde unterbrochen. Bereits gelesene Stellen bleiben gespeichert; ein neuer Start setzt die Rotation fort.','Une recherche a été interrompue. Les offres déjà lues restent enregistrées ; un nouveau lancement poursuit la rotation.')}</p>}
  </section>
  <section className="suche-karte" id="suchbegriffe" aria-labelledby="suchbegriffe-titel">
   <Stichwoerter domain={auftrag.keywordDomain} initial={gespeichert?gespeichert.keywordList:initialKeywordList(null,auftrag.keywordDomain)} saved={gespeichert?.keywordList||[]} platforms={plattformen} wide={auftrag.breit} startRound={z?.runde||0} speichern={liste=>kriterienSpeichern({keywordList:liste,keywordDomain:auftrag.keywordDomain})} gesperrt={laeuft}/>
  </section>
  <Plattformen city={auftrag.city} radius={auftrag.radius} keywords={auftrag.keywordList[0]||'Werkstudent IT'} enabled={auftrag.quellen} reports={berichte} speichern={quellen=>kriterienSpeichern({quellen})} gesperrt={laeuft}/>
  <section className="suche-karte suche-weiteres" aria-label={t('Weitere Einstellungen','Autres réglages')}>
   <details className="suche-zeile" data-bereich="einstellungen"><summary>{t('Ort, Umkreis und Art der Suche','Lieu, rayon et type de recherche')}</summary><Einstellungen city={auftrag.city} radius={auftrag.radius} breit={auftrag.breit} gesperrt={laeuft} speichern={kriterienSpeichern}/></details>
   <details className="suche-zeile" data-bereich="details">
    <summary>{t('Suchdetails','Détails de la recherche')}</summary>
    <p className="suche-kurz">{t('Eine Suche besteht aus fünf Durchläufen mit je einem Begriff pro Plattform. Sie garantiert nicht, dass alle Anzeigen gefunden wurden.','Une recherche comprend cinq passages avec un mot-clé par plateforme. Elle ne garantit pas que toutes les annonces ont été trouvées.')}</p>
    {!!berichte.length&&<details className="suche-unter"><summary>{t(`Letzte Suche je Anfrage (${berichte.length})`,`Dernière recherche par requête (${berichte.length})`)}</summary>
     <p>{lauf&&zeit(lauf.beginn)} · {t('Fahrzeiten bitte selbst prüfen.','Vérifier soi-même les temps de trajet.')}</p>
     <ul className="suche-liste">{berichte.map((r,i)=><li key={r.source+i}><strong>{r.source==='arbeitgeber'?t('Arbeitgeberseite','Site employeur'):SOURCE_LABELS[r.source]||r.source}</strong>{r.pass?t(` · Durchlauf ${r.pass}`,` · passage ${r.pass}`):''} · {r.keywords} · {t(`${r.found||0} gefunden, ${r.inserted||0} aufgenommen`,`${r.found||0} trouvées, ${r.inserted||0} ajoutées`)}{r.status!=='ok'?t(' · nur teilweise erreichbar',' · partiellement accessible'):''}{r.limited?t(' · weitere Seiten folgen',' · pages suivantes plus tard'):''}{r.searchUrl&&<> · <a href={r.searchUrl} target="_blank" rel="noopener noreferrer">{t('öffnen','ouvrir')}</a></>}</li>)}</ul>
    </details>}
    {!berichte.length&&<p className="suche-kurz">{t('Noch keine Einzelheiten vorhanden.','Aucun détail pour l’instant.')}</p>}
   </details>
  </section>
 </>;
}

function Ergebnis({lauf,berichte,frisch}:{lauf:NonNullable<Stand['zustand']['lauf']>;berichte:Bericht[];frisch:boolean}){
 const e=ergebnisDaten(lauf,berichte);
 const name=(q:string)=>q==='arbeitgeber'?t('Arbeitgeberseiten','Sites employeurs'):SOURCE_LABELS[q]||q;
 if(e.fehlgeschlagen)return <div role="status" className="suche-ergebnis" data-suchergebnis><p className="suche-hinweis">{t(`Suchstart abgebrochen: ${e.meldung||'unbekannter Fehler'}. Bereits gelesene Stellen bleiben gespeichert. Keine automatische Wiederholung.`,`Recherche interrompue : ${e.meldung||'erreur inconnue'}. Les offres déjà lues restent enregistrées. Aucune relance automatique.`)}</p></div>;
 return <div role="status" className="suche-ergebnis" data-suchergebnis data-frisch={frisch||undefined}>
  <p className={e.neu>0?'suche-ok':'suche-hinweis'}>
   {e.neu>0
    ?<><strong>{stellenWort(e.neu)}</strong>{t(` aufgenommen (${e.gefunden} Anzeigen gefunden, ${e.abgeschlossen} von ${e.durchlaeufe} Durchläufen). `,` ajoutée${e.neu===1?'':'s'} (${e.gefunden} annonces trouvées, ${e.abgeschlossen} passages sur ${e.durchlaeufe}). `)}<a href="/suivi">{t('In der Stellenübersicht ansehen',"Voir dans l'aperçu des offres")}</a></>
    :<><strong>{t('Keine neuen Stellen.','Aucune nouvelle offre.')}</strong> {e.gefunden>0?t(`${e.gefunden} Anzeigen gefunden, aber alle waren schon bekannt, ausgeschlossen oder passen nicht zu Informatik.`,`${e.gefunden} annonces trouvées, mais toutes étaient déjà connues, exclues ou sans lien avec l'informatique.`):t('Es wurden keine passenden Anzeigen gefunden.','Aucune annonce correspondante trouvée.')} {t(`${e.abgeschlossen} von ${e.durchlaeufe} Durchläufen.`,`${e.abgeschlossen} passages sur ${e.durchlaeufe}.`)}</>}
   {e.vorzubereiten>0&&<> <strong data-vorzubereiten>{t(`${e.vorzubereiten} davon noch vorzubereiten`,`dont ${e.vorzubereiten} à préparer`)}</strong>{t(' (ohne vollständige Unterlagen, noch nicht bewerbungsbereit).',' (sans dossier complet, pas encore prêtes pour candidater).')}</>}
   {e.firmaAusgeschlossen>0&&<> <span data-firma-ausgeschlossen>{t(`${e.firmaAusgeschlossen} Treffer dauerhaft ausgeschlossener Firmen nicht übernommen.`,`${e.firmaAusgeschlossen} résultats d'entreprises exclues définitivement non repris.`)}</span></>}
   {e.unvollstaendig&&<> <strong>{t('Nicht alles abgedeckt:','Couverture incomplète :')}</strong>{e.teilweise.length>0&&<>{t(' eingeschränkt ',' limitée pour ')}{e.teilweise.map(x=>`${name(x.quelle)} (${t(...(GRUND[x.status]||[x.status,x.status]) as [string,string])})`).join(', ')}.</>}{e.weitere.length>0&&<>{t(' weitere Seiten folgen bei ',' pages suivantes plus tard pour ')}{e.weitere.map(name).join(', ')}.</>}{e.unterbrochen&&t(' Ein neuer Start setzt die Suche fort.',' Un nouveau lancement poursuit la recherche.')}{t(' Einzelheiten unter „Suchdetails“.',' Détails sous « Détails de la recherche ».')}</>}
   {' '}<span data-teilabdeckung>{t('Teilabdeckung, keine vollständige Marktabdeckung.','Couverture partielle, pas une couverture complète du marché.')}</span>
   {e.meldung&&<> {e.meldung}</>}
  </p>
 </div>;
}

// Block „Suchbegriffe“ (KeywordPicker des Originals): Fachgebiet, eigene Begriffe, Vorschläge als Pastillen mit Kreuz, Suchplan.
function Stichwoerter({domain,initial,saved,platforms,wide,startRound,speichern,gesperrt}:{domain:string;initial:string[];saved:string[];platforms:{id:string;label:string}[];wide:boolean;startRound:number;speichern:(liste:string[])=>Promise<unknown>;gesperrt:boolean}){
 const catalogue=keywordCatalogue(domain);
 const [list,setList]=useState<string[]>(()=>normalizeKeywordList(initial)),[baseline,setBaseline]=useState<string[]>(saved),[text,setText]=useState(''),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 const inList=(k:string)=>list.some(x=>gleich(x,k));
 const catalogueAll=catalogue.areas.flatMap(a=>[...a.keywords]);
 const groups=catalogue.areas.map(a=>({id:a.id,label:bereichName(a.id,a.label),chips:a.keywords.filter(inList)})).filter(g=>g.chips.length);
 const own=list.filter(k=>!catalogueAll.some(c=>gleich(c,k)));
 const removed=catalogueAll.filter(k=>!inList(k));
 const dirty=list.length!==baseline.length||list.some((k,i)=>k!==baseline[i]);
 const neverSaved=baseline.length===0;
 function add(values:string[]){const fresh=values.filter(v=>!inList(v));if(!values.length)return;if(!fresh.length){setMessage(t('Dieser Begriff steht schon in der Liste.','Ce mot-clé figure déjà dans la liste.'));return;}const next=normalizeKeywordList([...list,...fresh]);setList(next);setMessage(next.length-list.length<fresh.length?t(`Es sind höchstens ${KEYWORD_LIMIT} Suchbegriffe möglich.`,`${KEYWORD_LIMIT} mots-clés au maximum.`):'');}
 function remove(keyword:string){if(list.length<=1){setMessage(t('Mindestens ein Suchbegriff muss bleiben.','Il faut garder au moins un mot-clé.'));return;}setList(list.filter(k=>!gleich(k,keyword)));setMessage('');}
 function onType(value:string){if(/[,;\n\r]/.test(value)){const parts=value.split(/[,;\n\r]/),rest=parts.pop()||'';add(parseKeywordInput(parts.join(',')));setText(rest.trimStart());}else setText(value);}
 function commit(){const values=parseKeywordInput(text);if(values.length){add(values);setText('');}}
 async function save(){setPending(true);try{await speichern(list);setBaseline(list);setMessage(t('Gespeichert. Die Auswahl gilt ab der nächsten Suche.','Enregistré. Le choix s’applique dès la prochaine recherche.'));}catch(e){setMessage(e instanceof Error?e.message:t('Die Suchbegriffe konnten nicht gespeichert werden.','Les mots-clés n’ont pas pu être enregistrés.'));}finally{setPending(false);}}
 const plan=useMemo(()=>batchPlan(list,wide,startRound,Math.max(1,platforms.length)),[list,wide,startRound,platforms.length]);
 const runs=Math.max(1,Math.ceil(list.length/SEARCH_PASSES));
 return <div className="stichwoerter" data-domain={domain}>
  <div className="stichwoerter-kopf"><h2 id="suchbegriffe-titel">{t('Suchbegriffe','Mots-clés')}</h2><span className="stichwoerter-gebiet" data-gebiet={domain}>{t('Fachgebiet: ','Domaine : ')}{sprache()==='fr'&&catalogue.id==='it'?'Informatique':catalogue.label}</span></div>
  <div className="stichwoerter-eingabe">
   <label htmlFor="suchbegriff-neu" className="stichwoerter-label">{t('Eigenen Suchbegriff hinzufügen','Ajouter un mot-clé')}</label>
   <div className="stichwoerter-zeile"><input id="suchbegriff-neu" type="text" value={text} autoComplete="off" maxLength={400} placeholder={t('zum Beispiel Werkstudent Python, mit Enter oder Komma bestätigen','par exemple Werkstudent Python, valider avec Entrée ou une virgule')} onChange={e=>onType(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}}}/><button type="button" className="stichwoerter-plus" onClick={commit} disabled={!text.trim()}>{t('Hinzufügen','Ajouter')}</button></div>
   <p className="stichwoerter-tipp">{t('Tipp: Beschreibe deinem KI-Agenten, welche Stelle du suchst, und lass dir die Suchbegriffe nennen, die in deinem Fachgebiet funktionieren. Füge die Liste dann hier ein, getrennt durch Kommas.','Astuce : décris à ton agent IA le poste que tu cherches et demande-lui les mots-clés qui fonctionnent dans ton domaine. Colle ensuite la liste ici, séparée par des virgules.')}</p>
  </div>
  <p className="stichwoerter-zaehler" role="status" aria-live="polite" data-anzahl={list.length}><strong>{t(`${list.length} Suchbegriffe`,`${list.length} mots-clés`)}</strong>{t(`: Jede Plattform erhält pro Suche fünf davon, beim nächsten Mal die nächsten fünf. Nach ${runs} ${runs===1?'Suche':'Suchen'} war jeder einmal dran. Mit × entfernst du einen Begriff.`,` : chaque plateforme en reçoit cinq par recherche, la fois suivante les cinq suivants. Après ${runs} recherche${runs===1?'':'s'}, chacun a été utilisé une fois. × retire un mot-clé.`)}</p>
  {groups.map(g=><section key={g.id} className="stichwoerter-gruppe" aria-label={g.label}><h3>{g.label}</h3><ul className="stichwoerter-chips">{g.chips.map(k=><Chip key={k} keyword={k} onRemove={remove}/>)}</ul></section>)}
  {!!own.length&&<section className="stichwoerter-gruppe" aria-label={t('Eigene Suchbegriffe','Mots-clés personnels')} data-eigene><h3>{t('Eigene','Personnels')}</h3><ul className="stichwoerter-chips">{own.map(k=><Chip key={k} keyword={k} onRemove={remove}/>)}</ul></section>}
  {!!removed.length&&<details className="stichwoerter-entfernt"><summary>{t(`Entfernte Vorschläge (${removed.length})`,`Suggestions retirées (${removed.length})`)}</summary><ul className="stichwoerter-chips">{removed.map(k=><li key={k}><button type="button" className="stichwoerter-zurueck" data-zurueck={k} onClick={()=>add([k])}><span aria-hidden="true">+</span> {k}</button></li>)}</ul><button type="button" className="stichwoerter-textknopf" onClick={()=>add(removed)}>{t('Alle Vorschläge wiederherstellen','Rétablir toutes les suggestions')}</button></details>}
  {(neverSaved||dirty)&&<p className="stichwoerter-hinweis" data-ungespeichert>{neverSaved?t('Noch nicht bestätigt: Bis du speicherst, startet der Knopf keine Suche.','Pas encore confirmé : tant que tu n’enregistres pas, le bouton ne lance aucune recherche.'):t('Ungespeicherte Änderungen.','Modifications non enregistrées.')}</p>}
  <div className="stichwoerter-speichern"><button type="button" className="knopf primaer" data-aktion="stichwoerter-speichern" onClick={()=>void save()} disabled={pending||gesperrt||(!dirty&&!neverSaved)}>{pending?t('Wird gespeichert …','Enregistrement …'):neverSaved?t('Auswahl bestätigen und speichern','Confirmer et enregistrer la sélection'):t('Suchbegriffe speichern','Enregistrer les mots-clés')}</button></div>
  <p className="stichwoerter-meldung" role="status" aria-live="polite">{message}</p>
  <details className="stichwoerter-plan"><summary>{t('Suchplan anzeigen','Afficher le plan de recherche')}</summary>
   <p>{t(`So verteilt der nächste Suchlauf die Begriffe: je Durchlauf bekommt jede Plattform genau einen anderen Begriff, benachbarte Plattformen erhalten versetzte Begriffe, damit zusammen möglichst viele abgedeckt sind. Bei weniger als fünf Begriffen ergänzt die Suche Vertragsvarianten${wide?' und IT-Bereiche':''}.`,`Répartition des mots-clés au prochain lancement : à chaque passage, chaque plateforme reçoit exactement un autre mot-clé, les plateformes voisines des mots-clés décalés, pour en couvrir le plus possible ensemble. Avec moins de cinq mots-clés, la recherche complète par des variantes de contrat${wide?' et des domaines IT':''}.`)}</p>
   <ol className="stichwoerter-plan-liste">{plan.map(p=>{const gruppen=new Map<string,string[]>();p.lanes.forEach((q,lane)=>{if(q)gruppen.set(q.keywords,[...(gruppen.get(q.keywords)||[]),platforms[lane]?.label||t('Plattform','Plateforme')]);});return <li key={p.pass} data-durchlauf={p.pass}><strong>{t(`Durchlauf ${p.pass}`,`Passage ${p.pass}`)}</strong><ul>{[...gruppen].map(([keyword,labels])=><li key={keyword}><span className="plan-begriff">{keyword}</span> <span className="plan-quellen">{labels.length>3?t(`${labels.slice(0,3).join(', ')} und ${labels.length-3} weitere`,`${labels.slice(0,3).join(', ')} et ${labels.length-3} autres`):labels.join(', ')}</span></li>)}</ul></li>;})}</ol>
  </details>
 </div>;
}
function Chip({keyword,onRemove}:{keyword:string;onRemove:(k:string)=>void}){return <li className="stichwoerter-chip" data-chip={keyword}><span>{keyword}</span><button type="button" aria-label={t(`${keyword} entfernen`,`Retirer ${keyword}`)} onClick={()=>onRemove(keyword)}><span aria-hidden="true">×</span></button></li>;}

// Kompakte Quellenübersicht (PlatformCoverage und PlatformChips des Originals): Zusammenfassung, nur Problemquellen hervorgehoben,
// einklappbare Chips mit Zustandspastille; ein Klick wählt eine Plattform ab oder wieder an und speichert sofort.
function Plattformen({city,radius,keywords,enabled,reports,speichern,gesperrt}:{city:string;radius:number;keywords:string;enabled:string[];reports:Bericht[];speichern:(quellen:PlatformId[])=>Promise<unknown>;gesperrt:boolean}){
 const [on,setOn]=useState<Set<string>>(()=>new Set(enabled)),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
 useEffect(()=>{setOn(new Set(enabled));},[enabled.join(',')]);// eslint-disable-line react-hooks/exhaustive-deps
 const states=platformStates([...on],reports);
 const link=(id:string)=>platformSearchUrl(id as PlatformId,keywords,city,radius);
 const problems=states.filter(s=>PROBLEM_STATES.includes(s.state));
 const counts=(['gelesen','teilweise','blockiert','nur-link','fehler','offen'] as PlatformState[]).map(state=>[state,states.filter(s=>s.state===state).length] as const).filter(([,n])=>n);
 const inRun=states.some(s=>s.origin==='suche');
 async function toggle(id:string,checked:boolean){const before=new Set(on),next=new Set(on);if(checked)next.add(id);else next.delete(id);if(!next.size){setMessage(t('Mindestens eine Plattform muss ausgewählt bleiben.','Au moins une plateforme doit rester sélectionnée.'));return;}setOn(next);setMessage('');setPending(true);try{await speichern(SOURCE_IDS.filter(q=>next.has(q)));setMessage(t('Auswahl gespeichert. Sie gilt ab der nächsten Suche.','Sélection enregistrée. Elle s’applique dès la prochaine recherche.'));}catch(e){setOn(before);setMessage(e instanceof Error?e.message:t('Die Auswahl konnte nicht gespeichert werden.','La sélection n’a pas pu être enregistrée.'));}finally{setPending(false);}}
 return <section className="suche-karte plattformen" aria-labelledby="plattformen-titel">
  <span className="bewerbung-kicker">{t('QUELLENABDECKUNG','COUVERTURE DES SOURCES')}</span>
  <h2 id="plattformen-titel" data-zusammenfassung>{t(`${on.size} von ${PLATFORMS.length} Plattformen bei jeder Suche abgefragt`,`${on.size} plateformes sur ${PLATFORMS.length} interrogées à chaque recherche`)}</h2>
  <p className="plattformen-kurz">{t('Öffentliche Treffer werden gelesen, soweit die Plattform es zulässt. Das ist keine vollständige Marktabdeckung.','Les résultats publics sont lus dans la mesure où la plateforme le permet. Ce n’est pas une couverture complète du marché.')} <span className="plattformen-suchwerte">{keywords} · {city} · {radius} km</span></p>
  {!!problems.length&&<div className="plattform-achtung" role="group" aria-labelledby="plattform-achtung-titel">
   <h3 id="plattform-achtung-titel">{problems.length===1?t('Eine Plattform braucht den Browser','Une plateforme a besoin du navigateur'):t(`${problems.length} Plattformen brauchen den Browser`,`${problems.length} plateformes ont besoin du navigateur`)}</h3>
   <ul>{problems.map(p=><li key={p.id} data-problem={p.id}><div><strong>{p.label}</strong> <span className="chip-status" data-state={p.state}><i aria-hidden="true"/>{zustandText(p.state)}</span><small>{zustandHinweis(p.state)}</small></div><a href={link(p.id)} target="_blank" rel="noopener noreferrer" aria-label={t(`${p.label} im Browser öffnen`,`Ouvrir ${p.label} dans le navigateur`)}>{t('Öffnen ↗','Ouvrir ↗')}</a></li>)}</ul>
  </div>}
  <details className="plattform-auswahl">
   <summary>{t('Plattformen anzeigen oder abwählen','Afficher ou désélectionner des plateformes')}<span className="plattform-zaehler">{counts.map(([state,n])=>`${n} ${zustandText(state)}`).join(' · ')}</span></summary>
   <div className="plattform-chipbereich">
    <ul className="plattform-chips">{states.map(item=>{const active=on.has(item.id),state:PlatformState=active?item.state:'aus';return <li key={item.id}><label className="plattform-chip" data-platform={item.id} data-aktiv={active}><input type="checkbox" name={'source-'+item.id} checked={active} disabled={pending||gesperrt} onChange={e=>void toggle(item.id,e.target.checked)}/><span className="chip-haken" aria-hidden="true"/><span className="chip-name">{item.label}</span><span className="chip-status" data-state={state}><i aria-hidden="true"/>{zustandText(state)}</span></label></li>;})}</ul>
    <p className="plattform-meldung" role="status" aria-live="polite">{message}</p>
   </div>
   <p className="plattform-legende">{inRun?t('Zustand der letzten Suche.','État de la dernière recherche.'):t('Noch keine Live-Suche gespeichert; alle Plattformen gelten als nicht abgefragt.','Aucune recherche en direct enregistrée ; toutes les plateformes sont considérées comme non interrogées.')} {t('Ein Klick wählt eine Plattform ab oder wieder an.','Un clic désélectionne ou resélectionne une plateforme.')}</p>
  </details>
  <details className="plattform-links"><summary>{t('Suchlinks im Browser öffnen','Ouvrir les liens de recherche dans le navigateur')}</summary>
   <p>{t('Filter, Ort und Vertragsart dort selbst kontrollieren. Ein Abruf versendet keine Bewerbung.','Y vérifier soi-même les filtres, le lieu et le type de contrat. Une consultation n’envoie aucune candidature.')}</p>
   <ul>{PLATFORMS.map(p=><li key={p.id}><a href={link(p.id)} target="_blank" rel="noopener noreferrer" aria-label={t(`${p.label} im Browser öffnen`,`Ouvrir ${p.label} dans le navigateur`)}>{p.label} ↗</a></li>)}</ul>
  </details>
 </section>;
}

// Ort, Umkreis und Art der Suche (Ausschnitt der Einstellungen des Originals).
function Einstellungen({city,radius,breit,gesperrt,speichern}:{city:string;radius:number;breit:boolean;gesperrt:boolean;speichern:(a:Partial<Auftrag>)=>Promise<unknown>}){
 const [ort,setOrt]=useState(city),[umkreis,setUmkreis]=useState(String(radius)),[weit,setWeit]=useState(breit),[meldung,setMeldung]=useState(''),[pending,setPending]=useState(false);
 async function absenden(e:React.FormEvent){e.preventDefault();setPending(true);setMeldung('');try{await speichern({city:ort.trim(),radius:Number(umkreis),breit:weit});setMeldung(t('Gespeichert. Ein anderer Ort oder Umkreis beginnt die Rotation neu; Stellen und Historie bleiben.','Enregistré. Un autre lieu ou rayon recommence la rotation ; les offres et l’historique restent.'));}catch(err){setMeldung(err instanceof Error?err.message:t('Nicht gespeichert.','Non enregistré.'));}finally{setPending(false);}}
 return <form className="suche-formular" onSubmit={e=>void absenden(e)} data-einstellungen>
  <div className="suche-spalten"><label>{t('Ort','Lieu')}<input name="city" value={ort} maxLength={100} required onChange={e=>setOrt(e.target.value)}/></label><label>{t('Umkreis in Kilometern','Rayon en kilomètres')}<input name="radius" type="number" min={1} max={200} step={1} required value={umkreis} onChange={e=>setUmkreis(e.target.value)}/></label></div>
  <label className="suche-wahl"><input type="checkbox" checked={weit} onChange={e=>setWeit(e.target.checked)}/><span>{t('Breite Suche über IT-Bereiche','Recherche élargie aux domaines IT')}<small>{t('Bei weniger als fünf Suchbegriffen ergänzt die Suche IT-Themen und Vertragsvarianten.','Avec moins de cinq mots-clés, la recherche ajoute des thèmes IT et des variantes de contrat.')}</small></span></label>
  <div><button type="submit" disabled={pending||gesperrt}>{pending?t('Wird gespeichert …','Enregistrement …'):t('Speichern','Enregistrer')}</button></div>
  <p className="suche-kurz" role="status">{meldung}</p>
 </form>;
}
