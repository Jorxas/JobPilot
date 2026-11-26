// Rückfrage beim Archivieren, nach src/jobpilot-ui/archiv-dialog.tsx des Originals: genau drei Gründe. Nur „Kein IT-Bezug“
// schließt die Firma dauerhaft aus; die anderen Gründe archivieren nur dieses Angebot.
import React,{useEffect,useRef,useState} from 'react';
import {ARCHIVE_REASONS,type ArchiveReason} from '../kern/company-catalogue';
import {t} from './sprache';
import './archiv-dialog.css';

export const archivGrundText=(grund:string)=>({unavailable:t('Angebot nicht verfügbar','Offre plus disponible'),'not-it':t('Kein IT-Bezug','Aucun lien avec l’informatique'),other:t('Sonstiges','Autre')} as Record<string,string>)[grund]||grund;

export function ArchivDialog({company,busy,fehler,onClose,onSave}:{company:string;busy:boolean;fehler:string;onClose:()=>void;onSave:(reason:ArchiveReason,note:string)=>void}){
 const [grund,setGrund]=useState<ArchiveReason|null>(null),[notiz,setNotiz]=useState('');
 const dialog=useRef<HTMLElement>(null);useEffect(()=>{dialog.current?.focus();const taste=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy){e.stopImmediatePropagation();onClose();}if(e.key==='Tab'){const alle=[...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)')],erste=alle[0],letzte=alle.at(-1);if(e.shiftKey&&document.activeElement===erste){e.preventDefault();letzte?.focus();}else if(!e.shiftKey&&document.activeElement===letzte){e.preventDefault();erste?.focus();}}};window.addEventListener('keydown',taste,true);return()=>window.removeEventListener('keydown',taste,true);},[busy,onClose]);
 return <div className="modalgrund archivgrund" onClick={()=>{if(!busy)onClose();}}><section ref={dialog} tabIndex={-1} className="detail archivdialog" role="dialog" aria-modal="true" aria-labelledby="archivtitel" onClick={e=>e.stopPropagation()}>
  <button className="schliessen" aria-label={t('Archivieren abbrechen',"Annuler l'archivage")} disabled={busy} onClick={onClose}>×</button><h2 id="archivtitel">{t('Warum archivieren?','Pourquoi archiver ?')}</h2><p>{company}</p>
  <form onSubmit={e=>{e.preventDefault();if(grund)onSave(grund,notiz);}}><fieldset disabled={busy}><legend>{t('Grund auswählen','Choisir un motif')}</legend>{(Object.keys(ARCHIVE_REASONS) as ArchiveReason[]).map(wert=><label className="archivwahl" key={wert}><input type="radio" name="archivgrund" value={wert} checked={grund===wert} onChange={()=>setGrund(wert)}/><span>{archivGrundText(wert)}</span></label>)}</fieldset>
   {grund&&<p className="kleinerhinweis" data-archivfolge>{grund==='not-it'?t('Diese Firma wird dauerhaft ausgeschlossen und kommt bei neuen Suchen nicht zurück. Der bisherige Verlauf bleibt erhalten.','Cette entreprise est exclue définitivement et ne revient pas lors des prochaines recherches. L’historique est conservé.'):t('Nur dieses Angebot wird archiviert. Andere Stellen der Firma bleiben möglich.','Seule cette offre est archivée. Les autres offres de l’entreprise restent possibles.')}</p>}
   {grund==='other'&&<label className="archivnotiz">{t('Anmerkung (optional)','Remarque (facultative)')}<textarea value={notiz} maxLength={500} rows={2} onChange={e=>setNotiz(e.target.value)} disabled={busy}/></label>}
   {fehler&&<p className="hinweis fehler" role="alert">{fehler}</p>}<div className="archivaktionen"><button type="button" className="knopf sekundaer" disabled={busy} onClick={onClose}>{t('Abbrechen','Annuler')}</button><button type="submit" className="knopf primaer" disabled={!grund||busy}>{busy?t('Wird gespeichert …','Enregistrement …'):t('Archivieren','Archiver')}</button></div>
  </form>
 </section></div>;
}
