// Jobbörse des Studierendenwerks Gießen (/jobboerse-studierende/): alle Angebote stehen als einfaches HTML
// (div.jobanzeige) auf der Seite selbst, nach Regionen gruppiert; kein iframe, kein PDF, keine Detailseiten.
// Öffentlich sichtbar sind Titel, Beschreibung, Branche, Job-Modell und Tätigkeitsort (freier Text, teils mit PLZ).
// Es fehlen der Name der Anbietenden (Kontaktdaten erst nach Anmeldung mit CAPTCHA) und ein eigener Anzeigenlink
// oder eine Kennung je Angebot. Ohne Firma und eigenen Link entsteht keine prüfbare Karte; die Quelle bleibt ein
// Browserlink (KEIN_ABRUF in platforms.ts). Stand: 26. November 2026.
import type { Karte } from "./karten-hilfe";
export function karten(_html: string, _base: string): Karte[] { return []; }
