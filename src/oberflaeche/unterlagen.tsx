import React from 'react';
import {t} from './sprache';
import {missingDossierParts} from '../kern/company-catalogue';

type Dokument={kind:string;isGeneral?:boolean};
// Dieselbe Regel wie im Original (missingDossierParts): Mappe oder gezielter Lebenslauf plus Anschreiben.
export function BewerbungsUnterlagen({id,documents,applicationChannel,letterNotRequired}:{id:string;documents:Dokument[];applicationChannel?:unknown;letterNotRequired?:unknown}){
 const fehlt=missingDossierParts({documents,applicationChannel,letterNotRequired});
 const bundle=documents.some(d=>d.kind==='bundle');
 const brief=!fehlt.includes('letter');
 const gezielterCV=!fehlt.includes('cv');
 return <><div className="dokumente">{documents.filter(d=>['cv','letter','bundle'].includes(d.kind)).map(d=><a key={d.kind} href={`/api/tracker/${encodeURIComponent(id)}/documents/${d.kind}?ansehen=1`} target="_blank" rel="noreferrer" title={t('Ansehen, ohne herunterzuladen','Afficher sans télécharger')}>{d.kind==='bundle'?t('Bewerbungsmappe (CV + Anschreiben)','Dossier de candidature (CV + lettre)'):d.kind==='letter'?t('Anschreiben','Lettre de motivation'):d.isGeneral?t('Allgemeiner Lebenslauf','CV général'):t('Lebenslauf','CV')}</a>)}</div>{!bundle&&(!brief||!gezielterCV)&&<div className="detailbox" role="status"><h4>{t('Unterlagen noch nicht vollständig vorbereitet','Documents pas encore complets')}</h4><p>{!brief?t('Für diese Bewerbung ist noch kein Anschreiben hinterlegt. ',"Aucune lettre de motivation n'est encore enregistrée pour cette candidature. "):''}{!gezielterCV?t('Der allgemeine Lebenslauf ersetzt keinen passend ausgewählten CV. ','Le CV général ne remplace pas un CV choisi pour cette offre. '):''}{t('Die vorhandenen PDFs kannst du ansehen. Bereite das vollständige Dossier nach Prüfung der Stellenanzeige vor.',"Tu peux consulter les PDF existants. Prépare le dossier complet après avoir vérifié l'annonce.")}</p><a href="/offres" className="textlink">{t('Stellenanzeige prüfen und Unterlagen vorbereiten →',"Vérifier l'annonce et préparer les documents →")}</a></div>}</>;
}
