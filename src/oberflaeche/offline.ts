/** Alte lokale Statusänderungen nur nach Benutzeraktion und mit Revision abgleichen. */
type Speicher=Pick<Storage,'getItem'|'setItem'>;
type Ergebnis={status:number;application?:{status:string;sentAt:string|null}};
export async function lokaleAenderungenAbgleichen(speicher:Speicher,speichern:(id:string,wert:unknown)=>Promise<Ergebnis>){
 const schluessel='jobpilot-demo-outbox-v2';
 const lesen=()=>{const wert=JSON.parse(speicher.getItem(schluessel)||'{}');if(!wert||Array.isArray(wert)||typeof wert!=='object')throw Error('Lokale Änderungen haben ein unbekanntes Format. Die Daten bleiben erhalten.');return wert as Record<string,Record<string,unknown>>;};
 const anfang=lesen();let gespeichert=0,konflikte=0;
 for(const [id,wert] of Object.entries(anfang)){
  if(!wert||!['pending','applied','archived','unknown'].includes(String(wert.status))||!Number.isInteger(wert.revision)||Number(wert.revision)<0||(wert.sentAt!==null&&typeof wert.sentAt!=='string')){konflikte++;continue;}
  const antwort=await speichern(id,wert);
  const gleich=antwort.application?.status===wert.status&&antwort.application?.sentAt===wert.sentAt;
  if(!(antwort.status>=200&&antwort.status<300)&&!(antwort.status===409&&gleich)){konflikte++;continue;}
  if(!gleich){konflikte++;continue;}
  const aktuell=lesen();
  if(JSON.stringify(aktuell[id])!==JSON.stringify(wert)){konflikte++;continue;}
  delete aktuell[id];speicher.setItem(schluessel,JSON.stringify(aktuell));gespeichert++;
 }
 return {gespeichert,konflikte};
}
