import React from 'react';

type Dokument={kind:string;isGeneral?:boolean};
export function BewerbungsUnterlagen({id,documents}:{id:string;documents:Dokument[]}){
 const bundle=documents.some(d=>d.kind==='bundle');
 const brief=documents.some(d=>d.kind==='letter');
 const gezielterCV=documents.some(d=>d.kind==='cv'&&!d.isGeneral);
 return <><div className="dokumente">{documents.filter(d=>['cv','letter','bundle'].includes(d.kind)).map(d=><a key={d.kind} href={`/api/tracker/${encodeURIComponent(id)}/documents/${d.kind}`} target="_blank" rel="noreferrer">{d.kind==='bundle'?'Bewerbungsmappe (CV + Anschreiben)':d.kind==='letter'?'Anschreiben':d.isGeneral?'Allgemeiner Lebenslauf':'Lebenslauf'}</a>)}</div>{!bundle&&(!brief||!gezielterCV)&&<div className="detailbox" role="status"><h4>Unterlagen noch nicht vollständig vorbereitet</h4><p>{!brief?'Für diese Bewerbung ist noch kein Anschreiben hinterlegt. ':''}{!gezielterCV?'Der allgemeine Lebenslauf ersetzt keinen passend ausgewählten CV. ':''}Die vorhandenen PDFs kannst du ansehen. Bereite das vollständige Dossier nach Prüfung der Stellenanzeige vor.</p><a href="/offres" className="textlink">Stellenanzeige prüfen und Unterlagen vorbereiten →</a></div>}</>;
}
