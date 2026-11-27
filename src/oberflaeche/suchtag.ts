// Datum der Aufnahme, nicht Veröffentlichungsdatum oder letzte Bearbeitung. Keine Änderung gespeicherter Fiches.
const berlin = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
export const berlinerSuchtag = (jetzt = new Date()) => berlin.format(jetzt);
export function aufnahmeSuchtag(aufgenommen: unknown, entdeckt?: Date) {
 if(entdeckt && Number.isFinite(entdeckt.getTime()))return berlinerSuchtag(entdeckt);
 return typeof aufgenommen==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(aufgenommen)?aufgenommen:undefined;
}
export function amSuchtagGefunden(aufgenommen: unknown, tag: string) {
 return typeof aufgenommen === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aufgenommen) && aufgenommen === tag;
}
