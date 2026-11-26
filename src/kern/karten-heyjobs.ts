// Trefferliste von HeyJobs: kein eigener Parser. Jede HTML-Seite (Übersicht wie Stichwort/Ort) antwortet am
// 26. November 2026 mit HTTP 202 und einer AWS-WAF-JavaScript-Prüfung (challenge.js) statt Stellenkarten.
// Diese Prüfung wird bewusst nicht umgangen; ohne echte Trefferliste gibt es nichts zu lesen.
import type { Karte } from "./karten-hilfe";
export function karten(_html: string, _base: string): Karte[] { return []; }
