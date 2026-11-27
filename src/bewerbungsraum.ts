// Daten der echten Oberfläche am lokalen Server: Fichen aus daten/zustand.json in der Form der Tracker-API des Originals
// (/api/tracker), gespeicherte Suchkriterien der Stellensuche und die Kennzeichnung der ausgelieferten Seite.
// Die statische Demo (GitHub Pages) nutzt nichts davon; dort liefert demo.js erfundene Daten im Browser.
import { scoreOffer, type Candidate } from "./kern/core";
import { KEYWORD_CATALOGUES, DEFAULT_KEYWORD_DOMAIN, normalizeKeywordList } from "./kern/catalog";
import { SOURCE_IDS, type PlatformId } from "./kern/platforms";
import { quellenName, type Stelle } from "./beispiele";
import { berlinTag } from "./archiv";

export type Auftrag = {
  city: string;
  radius: number;
  keywordList: string[];
  quellen: PlatformId[];
  breit: boolean;
  keywordDomain?: string;
  // Zeitpunkt, zu dem die Suchbegriffe in der Oberfläche bestätigt wurden (validierte Liste wie im Original).
  bestaetigt?: string;
};

// Ausgangswerte der Stellensuche, solange noch nichts gespeichert ist (wie /offres im Original: Gießen, 50 km).
export const AUFTRAG_VORGABE = { city: "Gießen", radius: 50, breit: true } as const;

const fehler = (nachricht: string, status = 400) => Object.assign(Error(nachricht), { status });

/**
 * Prüft eine Änderung der gespeicherten Suchkriterien. Jede Angabe ist optional; fehlende Felder bleiben, wie sie sind.
 * Ungültige Werte werden abgewiesen, ohne etwas zu speichern.
 */
export function kriterienPruefen(inhalt: Record<string, unknown>) {
  const neu: Partial<Auftrag> = {};
  const bekannt = ["city", "radius", "keywordList", "keywordDomain", "quellen", "breit"];
  const unbekannt = Object.keys(inhalt).filter((k) => !bekannt.includes(k));
  if (unbekannt.length) throw fehler("Unbekannte Angabe: " + unbekannt.join(", ") + ".");
  if (!Object.keys(inhalt).length) throw fehler("Keine Änderung angegeben.");
  if (inhalt.city !== undefined) {
    const ort = typeof inhalt.city === "string" ? inhalt.city.replace(/[\u0000-\u001f\u007f<>]/g, " ").trim() : "";
    if (!ort || ort.length > 100) throw fehler("Der Ort muss 1 bis 100 Zeichen enthalten.");
    neu.city = ort;
  }
  if (inhalt.radius !== undefined) {
    if (!Number.isInteger(inhalt.radius) || Number(inhalt.radius) < 1 || Number(inhalt.radius) > 200)
      throw fehler("Der Umkreis muss eine ganze Zahl von 1 bis 200 Kilometern sein.");
    neu.radius = Number(inhalt.radius);
  }
  if (inhalt.keywordList !== undefined) {
    if (!Array.isArray(inhalt.keywordList)) throw fehler("Suchbegriffe bitte als Liste übergeben.");
    const liste = normalizeKeywordList(inhalt.keywordList);
    if (!liste.length) throw fehler("Mindestens ein Suchbegriff muss ausgewählt bleiben.");
    neu.keywordList = liste;
  }
  if (inhalt.keywordDomain !== undefined) {
    if (typeof inhalt.keywordDomain !== "string" || !KEYWORD_CATALOGUES.some((c) => c.id === inhalt.keywordDomain))
      throw fehler("Unbekanntes Fachgebiet.");
    neu.keywordDomain = inhalt.keywordDomain;
  }
  if (inhalt.quellen !== undefined) {
    if (!Array.isArray(inhalt.quellen) || inhalt.quellen.some((q) => !SOURCE_IDS.includes(q as PlatformId)))
      throw fehler("Unbekannte Plattform.");
    const quellen = SOURCE_IDS.filter((id) => (inhalt.quellen as unknown[]).includes(id));
    if (!quellen.length) throw fehler("Mindestens eine Plattform muss ausgewählt bleiben.");
    neu.quellen = quellen;
  }
  if (inhalt.breit !== undefined) {
    if (typeof inhalt.breit !== "boolean") throw fehler("Die Art der Suche ist ungültig.");
    neu.breit = inhalt.breit;
  }
  return neu;
}

/** Führt geprüfte Änderungen mit den gespeicherten Kriterien zusammen (ohne gespeicherte Kriterien: Ausgangswerte). */
export function kriterienZusammenfuehren(alt: Auftrag | undefined, neu: Partial<Auftrag>, jetzt = new Date()): Auftrag {
  const basis: Auftrag = alt
    ? { ...alt }
    : { ...AUFTRAG_VORGABE, keywordList: [], quellen: [...SOURCE_IDS], keywordDomain: DEFAULT_KEYWORD_DOMAIN };
  const ergebnis = { ...basis, ...neu };
  if (neu.keywordList) ergebnis.bestaetigt = jetzt.toISOString();
  return ergebnis;
}

/** Fiche in der Form, die die Oberfläche von /api/tracker erwartet. Unterlagen erstellt die öffentliche Fassung nicht. */
export function trackerAnsicht(s: Stelle, profil: Candidate) {
  const bewertung = scoreOffer(s, profil);
  return {
    id: s.id,
    status: s.status,
    sentAt: s.sentAt ?? null,
    revision: Number.isInteger(s.revision) ? s.revision : 1,
    updatedAt: s.updatedAt || s.gefundenAm || new Date(0).toISOString(),
    documents: [] as { kind: string; filename: string; contentType: string }[],
    compatibility: {
      score: bewertung.score,
      basis: s.complete ? ("description" as const) : ("limited" as const),
      reasons: bewertung.reasons,
      warnings: bewertung.warnings,
    },
    url: s.url,
    sourceUrl: s.url,
    sourceLabel: quellenName(s.source),
    company: s.company ?? undefined,
    role: s.title,
    location: s.location ?? undefined,
    distanceKm: typeof s.distanceKm === "number" ? s.distanceKm : undefined,
    opportunityType: "open-role",
    addedAt: s.addedAt,
    archiveReasonCode: s.archiveReasonCode,
    archiveReason: s.archiveReason,
    archiveNote: s.archiveNote,
    archiveScope: s.archiveScope,
    archiveAuto: s.archiveAuto,
    archivedAt: s.archivedAt,
    companyExcluded: s.companyExcluded,
  };
}

export function tagesziel(stellen: readonly Stelle[], jetzt = new Date()) {
  const heute = berlinTag(jetzt);
  return { ziel: 3, heute: stellen.filter((s) => s.status === "applied" && s.sentAt === heute).length };
}

// Pfade, unter denen der lokale Server die Oberfläche ausliefert (Stellenübersicht, Antworten, Stellensuche).
export const OBERFLAECHE_PFADE = new Set(["/", "/index.html", "/suivi", "/offres"]);

/**
 * Dieselbe gebaute index.html wie auf GitHub Pages, aber ohne Demo-Daten: demo.js entfällt, und eine Kennzeichnung sagt der
 * Oberfläche, dass sie mit dem lokalen Server spricht. Die Datei auf der Festplatte bleibt unverändert.
 */
export function lokaleSeite(html: string) {
  const ohneDemo = html.replace(/[ \t]*<script src="\.\/assets\/demo\.js"><\/script>\r?\n?/, "");
  if (ohneDemo === html || !ohneDemo.includes("</head>")) throw Error("Die gebaute Oberfläche hat einen unerwarteten Aufbau.");
  return ohneDemo.replaceAll('./assets/','/assets/').replaceAll('./favicon.svg','/favicon.svg').replace('<title>JobPilot · Öffentliche Demo</title>','<title>JobPilot · Lokaler Server</title>').replace("</head>", '<meta name="jobpilot-modus" content="lokal">\n</head>');
}

// Der Posteingang (Gmail-Abgleich) gehört zum persönlichen Original; der lokale Server meldet das ehrlich.
export const POSTEINGANG_FEHLT =
  "Der Posteingang ist nicht Teil der öffentlichen Fassung. Antworten bitte im eigenen Postfach prüfen; es wird nichts gelesen oder gesendet.";
export const leererPosteingang = () => ({
  stand: {
    version: 1 as const,
    uidValidity: "",
    lastUid: 0,
    mailbox: "",
    lastAttempt: null,
    lastSuccess: null,
    error: POSTEINGANG_FEHLT,
    remaining: 0,
    checked: 0,
    antworten: [],
  },
  plan: null,
});
