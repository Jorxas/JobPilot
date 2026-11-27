// Automatische Bewerbungsunterlagen der öffentlichen Fassung (27. November 2026): gezielter Lebenslauf und Anschreiben
// je Stelle aus dem eigenen Profil und dem Anzeigentext. Ohne Schlüssel und ohne Netz arbeitet eine feste Vorlage
// (Aufbau wie im persönlichen Original, Formulierungen neu und allgemein, keine Daten des Projektinhabers). Optional
// liefern eigene KI-Zugänge Projektauswahl und Absätze (unterlagen-ki.ts); ihre Antworten werden streng geprüft und
// dürfen nur auswählen und formulieren, nie Tatsachen hinzufügen. Schreibregeln: echte Umlaute, keine Gedankenstriche
// als Satzverbindung, keine sichtbaren Adressen (Projektnamen dürfen Verweise sein), eine Seite, heutiges Datum.
import { createHash } from "node:crypto";
import { Setzer, sichererVerweis, type Farbe, type Lauf } from "./unterlagen-pdf";
import { kette, kiVorschlag, KiFehler, type KiOptionen, type Schritt } from "./unterlagen-ki";
import { verlangteNachweise, NACHWEIS_TITEL, type NachweisArt } from "./kern/nachweise";
import { classifyContract, normalize } from "./kern/company-catalogue";
import { textOnly } from "./kern/core";

export { pdfTextLesen } from "./unterlagen-pdf";
export { kette, einstellungAus, kiVorschlag, kiAuftrag, programmStarten, SCHRITT_NAME, VORSCHLAG_SCHEMA, SCHREIBREGELN, type KiOptionen, type Schritt } from "./unterlagen-ki";
export { verlangteNachweise, NACHWEIS_TITEL, type NachweisArt };

export const NACHWEIS_ARTEN: readonly NachweisArt[] = ["enrollment", "transcript", "certificates"];
export type Ausbildung = { abschluss: string; einrichtung: string; ort: string; zeitraum: string; punkte: string[] };
export type Erfahrung = { titel: string; firma: string; ort: string; zeitraum: string; punkte: string[] };
export type Projekt = { name: string; technik: string; kontext: string; link: string; punkte: string[] };
export type Kenntnisgruppe = { kategorie: string; eintraege: string[] };
export type Lebenslaufdaten = { kurzprofil: string; ausbildung: Ausbildung[]; erfahrung: Erfahrung[]; projekte: Projekt[]; kenntnisse: Kenntnisgruppe[]; sprachen: string[]; weiterbildung: string; arbeitsweise: string };
export type Grundlage = "jobpilot" | "eigene";
export type Briefvorlage = "jobpilot" | "eigene";
export type NachweisInfo = { name: string; groesse: number; sha256: string; am: string };
export type Unterlagenprofil = { version: 1; grundlage: Grundlage; brief: Briefvorlage; eigenerBrief: string; lebenslauf: Lebenslaufdaten; nachweise: Partial<Record<NachweisArt, NachweisInfo>>; geaendert?: string };
export const leeresProfil = (): Unterlagenprofil => ({ version: 1, grundlage: "jobpilot", brief: "jobpilot", eigenerBrief: "", lebenslauf: { kurzprofil: "", ausbildung: [], erfahrung: [], projekte: [], kenntnisse: [], sprachen: [], weiterbildung: "", arbeitsweise: "" }, nachweise: {} });

const problem = (text: string, status = 400) => Object.assign(Error(text), { status });
function text(v: unknown, max: number, feld: string): string {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw problem("Ungültiger Wert: " + feld + ".");
  const t = v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").trim();
  if (t.length > max) throw problem(`${feld}: höchstens ${max} Zeichen.`);
  return t;
}
const einzeilig = (v: unknown, max: number, feld: string) => text(v, max, feld).replace(/\s*\n\s*/g, " ");
function punkteAus(v: unknown, feld: string): string[] {
  const roh = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\r?\n/) : v === undefined || v === null ? [] : null;
  if (!roh) throw problem("Ungültige Stichpunkte: " + feld + ".");
  const punkte = roh.map((p, i) => einzeilig(p, 300, `${feld}, Punkt ${i + 1}`).replace(/^[-•*·–]\s*/, "")).filter(Boolean);
  if (punkte.length > 6) throw problem(`${feld}: höchstens 6 Stichpunkte.`);
  return punkte;
}
function liste<T>(v: unknown, max: number, feld: string, eintrag: (e: Record<string, unknown>, i: number) => T): T[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.length > max) throw problem(`${feld}: höchstens ${max} Einträge.`);
  return v.map((e, i) => { if (!e || typeof e !== "object" || Array.isArray(e)) throw problem(`${feld}: Eintrag ${i + 1} ungültig.`); return eintrag(e as Record<string, unknown>, i); });
}
const kommaListe = (v: unknown, max: number, feld: string) => {
  const roh = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[,;\n]/) : [];
  const werte = roh.map((x, i) => einzeilig(x, 80, `${feld} ${i + 1}`)).filter(Boolean);
  if (werte.length > max) throw problem(`${feld}: höchstens ${max} Einträge.`);
  return [...new Set(werte)];
};

/** Prüft die eigenen Lebenslaufdaten und Vorlagenwahl. Nachweise werden nur über die eigene Route geändert. */
export function unterlagenprofilPruefen(roh: unknown, alt: Unterlagenprofil = leeresProfil()): Unterlagenprofil {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) throw problem("Ungültige Daten.");
  const d = roh as Record<string, unknown>, l = (d.lebenslauf && typeof d.lebenslauf === "object" ? d.lebenslauf : {}) as Record<string, unknown>;
  const grundlage = d.grundlage === "eigene" ? "eigene" : d.grundlage === undefined || d.grundlage === "jobpilot" ? "jobpilot" : null;
  const brief = d.brief === "eigene" ? "eigene" : d.brief === undefined || d.brief === "jobpilot" ? "jobpilot" : null;
  if (!grundlage || !brief) throw problem("Unbekannte Vorlage.");
  const eigenerBrief = text(d.eigenerBrief, 4000, "Eigenes Anschreiben");
  if (brief === "eigene" && eigenerBrief.length < 200) throw problem("Für das eigene Anschreiben mindestens 200 Zeichen Text hinterlegen.");
  const verweis = (v: unknown, feld: string) => { const t = einzeilig(v, 300, feld); if (!t) return ""; const u = sichererVerweis(t); if (!u || !/^https?:/.test(u)) throw problem(feld + ": bitte eine gültige Internetadresse."); return u; };
  return {
    version: 1, grundlage, brief, eigenerBrief,
    lebenslauf: {
      kurzprofil: text(l.kurzprofil, 700, "Kurzprofil"),
      arbeitsweise: text(l.arbeitsweise, 700, "Arbeitsweise"),
      weiterbildung: einzeilig(l.weiterbildung, 300, "Weiterbildung"),
      sprachen: kommaListe(l.sprachen, 10, "Sprachen"),
      ausbildung: liste(l.ausbildung, 8, "Ausbildung", (e, i) => ({ abschluss: einzeilig(e.abschluss, 140, `Ausbildung ${i + 1}, Abschluss`), einrichtung: einzeilig(e.einrichtung, 140, `Ausbildung ${i + 1}, Einrichtung`), ort: einzeilig(e.ort, 80, "Ort"), zeitraum: einzeilig(e.zeitraum, 60, "Zeitraum"), punkte: punkteAus(e.punkte, `Ausbildung ${i + 1}`) })).filter(e => e.abschluss || e.einrichtung),
      erfahrung: liste(l.erfahrung, 10, "Erfahrung", (e, i) => ({ titel: einzeilig(e.titel, 140, `Erfahrung ${i + 1}, Tätigkeit`), firma: einzeilig(e.firma, 140, `Erfahrung ${i + 1}, Firma`), ort: einzeilig(e.ort, 80, "Ort"), zeitraum: einzeilig(e.zeitraum, 60, "Zeitraum"), punkte: punkteAus(e.punkte, `Erfahrung ${i + 1}`) })).filter(e => e.titel || e.firma),
      projekte: liste(l.projekte, 12, "Projekte", (e, i) => ({ name: einzeilig(e.name, 100, `Projekt ${i + 1}, Name`), technik: einzeilig(e.technik, 200, `Projekt ${i + 1}, Technik`), kontext: einzeilig(e.kontext, 60, `Projekt ${i + 1}, Rahmen`), link: verweis(e.link, `Projekt ${i + 1}, Link`), punkte: punkteAus(e.punkte, `Projekt ${i + 1}`) })).filter(e => e.name),
      kenntnisse: liste(l.kenntnisse, 10, "Kenntnisse", (e, i) => ({ kategorie: einzeilig(e.kategorie, 60, `Kenntnisse ${i + 1}, Kategorie`), eintraege: kommaListe(e.eintraege, 30, `Kenntnisse ${i + 1}`) })).filter(g => g.kategorie && g.eintraege.length),
    },
    nachweise: alt.nachweise || {},
  };
}

export type Kontakt = { vorname: string; nachname: string; name: string; email: string; telefon: string; ort: string; bundesland: string; strasse: string; plz: string; portfolio: string; github: string; linkedin: string; studium: string; hochschule: string; beginn: string; stunden: string; interesse: string };
/** Kontaktangaben aus dem eigenen Formularprofil (/profile). */
export function kontaktAus(profile: Record<string, unknown> = {}): Kontakt {
  const s = (k: string) => (typeof profile[k] === "string" ? String(profile[k]).trim() : "");
  const vorname = s("firstName"), nachname = s("lastName"), name = s("fullName") || [vorname, nachname].filter(Boolean).join(" ");
  const tel = s("phone"), vorwahl = s("phoneCountryCode");
  return {
    vorname, nachname, name, email: s("email"), telefon: tel && vorwahl && !tel.startsWith("+") ? `${vorwahl} ${tel.replace(/^0/, "")}` : tel,
    ort: s("city"), bundesland: s("state"), strasse: [s("street"), s("houseNumber")].filter(Boolean).join(" "), plz: s("postalCode"),
    portfolio: s("portfolio"), github: s("github"), linkedin: s("linkedin"), studium: s("degree"), hochschule: s("university"),
    beginn: s("startDate"), stunden: s("weeklyHours"), interesse: s("fieldOfInterest"),
  };
}
const istStudium = (a: Pick<Ausbildung, "abschluss" | "einrichtung">) => /bachelor|master|b\.\s?sc|m\.\s?sc|b\.\s?a\b|m\.\s?a\b|studium|hochschul|universit|\btu\b|\bth\b|\bfh\b|university|college|diplom/i.test(a.abschluss + " " + a.einrichtung);
function ausbildungen(k: Kontakt, l: Lebenslaufdaten): Ausbildung[] {
  if (l.ausbildung.length) return l.ausbildung;
  return k.studium || k.hochschule ? [{ abschluss: k.studium, einrichtung: k.hochschule, ort: "", zeitraum: "", punkte: [] }] : [];
}
/** Was für eine automatische Erstellung noch fehlt (leer: alles da). */
export function fehlendeAngaben(k: Kontakt, l: Lebenslaufdaten): string[] {
  const fehlt: string[] = [];
  if (!k.name) fehlt.push("Vor- und Nachname");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(k.email)) fehlt.push("E-Mail");
  if (!ausbildungen(k, l).length && !l.erfahrung.length && !l.projekte.length) fehlt.push("Ausbildung, Erfahrung oder Projekte");
  return fehlt;
}
export function profilStand(k: Kontakt, p: Unterlagenprofil) {
  return createHash("sha256").update(JSON.stringify([k, p.lebenslauf, p.grundlage, p.brief, p.eigenerBrief])).digest("hex").slice(0, 16);
}

export type Stelleneingabe = { id: string; title: string; company?: string | null; location?: string | null; description?: string | null; opportunityType?: string };
const norm = (s: string) => normalize(s || "");
const maskiert = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Begriff kommt als eigenes Wort im Text vor (Java nicht in JavaScript, SQL nicht in MySQL). */
export function erwaehnt(textNorm: string, begriff: string) {
  const b = norm(begriff).trim();
  if (b.length < 1 || (b.length < 2 && !/[a-z]/.test(b))) return false;
  return new RegExp("(?:^|[^a-z0-9])" + maskiert(b) + "(?![a-z0-9])").test(textNorm);
}
const BEREICHE: [RegExp, string][] = [
  [/security|sicherheit|cyber|pentest/, "IT-Sicherheit"],
  [/\bdata\b|daten|analytics|\bbi\b|power bi|machine learning|\bki\b|\bai\b|data science|statistik/, "Daten und KI"],
  [/cloud|devops|kubernetes|platform engineer|infrastruktur/, "Cloud und DevOps"],
  [/\bsap\b|\berp\b|\bcrm\b/, "Unternehmenssoftware"],
  [/support|helpdesk|service desk|administrat|netzwerk|systembetreu|client/, "IT-Support und Systembetreuung"],
  [/test|qualitatssicherung|quality/, "Softwaretest und Qualitätssicherung"],
  [/redaktion|content|website|webseite|\bcms\b|typo3|wordpress/, "Webinhalte und Content-Management"],
  [/frontend|webentwickl|web develop|\bweb\b|javascript|typescript|react|angular|vue/, "Webentwicklung"],
  [/software|entwickl|develop|programmier|backend|full.?stack|engineer|\bapp\b|mobile/, "Softwareentwicklung"],
];
const deutscheListe = (w: string[]) => (w.length <= 1 ? w.join("") : w.slice(0, -1).join(", ") + " und " + w[w.length - 1]);
const satz = (s: string) => { const t = s.trim(); return !t ? "" : /[.!?]$/.test(t) ? t : t + "."; };

type Analyse = { titel: string; firma: string; firmaBekannt: boolean; textNorm: string; initiativ: boolean; vertrag: string; bereich: string; treffer: string[]; projekte: Projekt[]; kenntnisse: Kenntnisgruppe[]; anrede: string; beschreibung: string };
export function analysieren(stelle: Stelleneingabe, l: Lebenslaufdaten): Analyse {
  const beschreibung = textOnly(stelle.description || ""), titel = stelle.title.trim(), firmaRoh = (stelle.company || "").trim();
  const firmaBekannt = !!firmaRoh && !/^(unternehmen pr[uü]fen|unbekannt|unknown|employeur a verifier)$/i.test(firmaRoh);
  const titelNorm = norm(titel), textNorm = norm(titel + "\n" + beschreibung);
  const vertragsart = classifyContract(titel);
  const initiativ = stelle.opportunityType === "initiative" || vertragsart === "initiative";
  const bereich = BEREICHE.find(([m]) => m.test(titelNorm))?.[1] || BEREICHE.find(([m]) => m.test(textNorm))?.[1] || "Informatik";
  const vertrag = vertragsart === "werkstudent" ? "Für die Werkstudententätigkeit" : vertragsart === "praktikum" || vertragsart === "pflichtpraktikum" ? "Für das Praktikum" : vertragsart === "studentische-hilfskraft" ? "Für die Tätigkeit als studentische Hilfskraft" : "Für die Tätigkeit";
  const alleKenntnisse = l.kenntnisse.flatMap(g => g.eintraege);
  const treffer = alleKenntnisse.filter(k => erwaehnt(textNorm, k));
  // Projekte nach Bezug zur Anzeige: Titeltreffer zählen vierfach; ohne Treffer bleibt die eigene Reihenfolge.
  const begriffe = (p: Projekt) => [...p.technik.split(/[,;/|]+/), p.name].map(s => s.replace(/\(.*?\)/g, "").trim()).filter(s => s.length > 1);
  const gewicht = (p: Projekt) => begriffe(p).reduce((s, b) => s + (erwaehnt(titelNorm, b) ? 4 : 0) + (erwaehnt(textNorm, b) ? 1 : 0), 0);
  const projekte = l.projekte.map((p, i) => ({ p, i, g: gewicht(p) })).sort((a, b) => b.g - a.g || a.i - b.i).map(x => x.p);
  // Kenntnisse: alle bleiben; je Gruppe zuerst, was die Anzeige nennt.
  const kenntnisse = l.kenntnisse.map(g => ({ kategorie: g.kategorie, eintraege: [...g.eintraege.filter(e => erwaehnt(textNorm, e)), ...g.eintraege.filter(e => !erwaehnt(textNorm, e))] }));
  return { titel, firma: firmaBekannt ? firmaRoh : "", firmaBekannt, textNorm, initiativ, vertrag, bereich, treffer, projekte, kenntnisse, anrede: anredeAus(beschreibung), beschreibung };
}
/** „Sehr geehrte Frau Name,“ nur bei ausdrücklich genannter Ansprechperson, sonst die allgemeine Anrede. */
export function anredeAus(beschreibung: string) {
  const allgemein = "Sehr geehrte Damen und Herren,";
  const hinweis = /(?:ansprechpartner(?:in)?|ansprechperson|kontaktperson|kontakt|wende dich an|wenden sie sich an|bewerbung an)\s*(?:ist|:)?\s*/i.exec(beschreibung);
  if (!hinweis) return allgemein;
  // Groß- und Kleinschreibung zählt hier: „Frau Anna Schmidt“, „Herr Dr. Weber“; „Frau Schmidt freut sich“ ergibt Schmidt.
  const rest = beschreibung.slice(hinweis.index + hinweis[0].length, hinweis.index + hinweis[0].length + 80);
  const m = /^(Frau|Herr)\s+((?:Dr\.\s*|Prof\.\s*)*)([A-ZÄÖÜ][a-zäöüß'-]+)(?:\s+([A-ZÄÖÜ][a-zäöüß'-]+)(?=\s*(?:[,.;:()\n]|$|Tel|E-Mail|unter\b|per\b)))?/.exec(rest);
  if (!m) return allgemein;
  return `${m[1] === "Frau" ? "Sehr geehrte Frau" : "Sehr geehrter Herr"} ${m[2].replace(/\s+/g, " ")}${m[4] || m[3]},`.replace(/\s+/g, " ");
}

function beginnText(beginn: string, heute: Date) {
  const b = beginn.trim(), iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(b), de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(b);
  const [j, m, t] = iso ? [iso[1], iso[2], iso[3]] : de ? [de[3], de[2], de[1]] : [];
  if (j && m && t) {
    const tag = new Date(`${j}-${m.padStart(2, "0")}-${t.padStart(2, "0")}T12:00:00Z`);
    if (!Number.isFinite(tag.getTime())) return "";
    return tag.getTime() <= heute.getTime() ? "ab sofort" : "ab dem " + deutschesDatum(tag);
  }
  return /^(ab )?sofort$/i.test(b) ? "ab sofort" : "";
}
export const deutschesDatum = (d: Date) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(d);

export type Briefdaten = { kontakt: Kontakt; ortDatum: string; betreff: string; anrede: string; absaetze: Lauf[][] };
/** Absätze der JobPilot-Vorlage: Interesse, Studium und Projekte, Arbeitsweise, Ziel, Verfügbarkeit. */
export function vorlagenAbsaetze(k: Kontakt, l: Lebenslaufdaten, a: Analyse, heute: Date): Lauf[][] {
  const beiFirma = a.firma ? `bei ${a.firma}` : "bei Ihnen";
  const eins = a.initiativ
    ? `mit dieser Initiativbewerbung stelle ich mich Ihnen vor, weil mich die Arbeit von ${a.firma || "Ihrem Unternehmen"} im Bereich ${a.bereich} anspricht. Ich suche eine Aufgabe, in der ich praktisch mitarbeiten, Verantwortung für eigene Teilaufgaben übernehmen und dabei viel dazulernen kann.`
    : `Ihre Stellenanzeige „${a.titel}“ hat mich sofort angesprochen. ${a.firma ? `Bei ${a.firma}` : "Bei Ihnen"} möchte ich praktische Aufgaben im Bereich ${a.bereich} übernehmen, Verantwortung für eigene Teilaufgaben tragen und mein Wissen aus Studium und Projekten in einem professionellen Umfeld einsetzen.`;
  const zwei: string[] = [];
  const studium = ausbildungen(k, l).find(istStudium) || ausbildungen(k, l)[0];
  if (studium) {
    const wo = [studium.einrichtung, studium.ort].filter(Boolean).join(", ");
    const laufend = !studium.zeitraum || /laufend|seit|heute|aktuell|derzeit|now|present/i.test(studium.zeitraum);
    if (istStudium(studium) && laufend) zwei.push(`Zurzeit studiere ich ${studium.abschluss || "an der Hochschule"}${wo && studium.abschluss ? ` (${wo})` : ""}.`);
    else zwei.push(`Mein Abschluss: ${[studium.abschluss, wo].filter(Boolean).join(", ")}.`);
  }
  if (a.treffer.length) zwei.push(`Für die Aufgaben in Ihrer Anzeige bringe ich insbesondere Kenntnisse in ${deutscheListe(a.treffer.slice(0, 5))} mit.`);
  else { const k3 = l.kenntnisse.flatMap(g => g.eintraege).slice(0, 4); if (k3.length) zwei.push(`Zu meinen Kenntnissen gehören ${deutscheListe(k3)}.`); }
  const [p1, p2] = a.projekte;
  if (p1) zwei.push(p1.punkte[0] ? `Ein Beispiel ist das Projekt ${p1.name}: ${satz(p1.punkte[0])}` : `Ein Beispiel ist das Projekt ${p1.name}${p1.technik ? ` mit ${deutscheListe(p1.technik.split(/\s*[,;/|]\s*/).filter(Boolean).slice(0, 4))}` : ""}.`);
  const technik = (p: Projekt) => deutscheListe(p.technik.split(/\s*[,;/|]\s*/).filter(Boolean).slice(0, 4));
  if (p2) zwei.push(p2.technik ? `Außerdem habe ich im Projekt ${p2.name} mit ${technik(p2)} gearbeitet.` : `Außerdem habe ich am Projekt ${p2.name} mitgewirkt.`);
  if (!p1 && l.erfahrung[0]) { const e = l.erfahrung[0]; zwei.push(`Praktische Erfahrung habe ich als ${e.titel}${e.firma ? ` bei ${e.firma}` : ""} gesammelt.`); }
  const zweiLaeufe: Lauf[] = [{ text: zwei.join(" ") }];
  if (k.portfolio && sichererVerweis(k.portfolio)) zweiLaeufe.push({ text: " Weitere Projekte zeige ich in meinem " }, { text: "Portfolio", link: k.portfolio }, { text: "." });
  const drei = l.arbeitsweise || "Mir ist eine sorgfältige und nachvollziehbare Arbeitsweise wichtig. In Projekten stimme ich Aufgaben klar ab, halte Vereinbarungen ein und dokumentiere meine Ergebnisse so, dass andere gut daran anknüpfen können. In neue Themen arbeite ich mich zügig ein und frage nach, wenn etwas unklar ist.";
  const ziel = k.interesse ? `im Bereich ${k.interesse} praktisch zu arbeiten` : "mein Wissen aus dem Studium praktisch anzuwenden";
  const vier = `${a.initiativ ? "Eine" : "Die"} Mitarbeit ${beiFirma} passt gut zu meinem Ziel, ${ziel} und mich in einem erfahrenen Team weiterzuentwickeln. Gern bringe ich meine bisherigen Erfahrungen ein und übernehme Aufgaben zuverlässig.`;
  const ab = beginnText(k.beginn, heute), stunden = /\d/.test(k.stunden) ? ` mit bis zu ${k.stunden.replace(/[^\d,.]/g, "")} Stunden pro Woche` : "";
  const student = !!studium && istStudium(studium);
  const fuenf = (ab ? `${a.vertrag} stehe ich ${ab}${stunden} zur Verfügung${student ? " und stimme meine Zeiten flexibel mit dem Studium ab" : ""}.` : student ? "Meine Arbeitszeiten stimme ich flexibel mit dem Studium ab." : "Meine Arbeitszeiten gestalte ich flexibel.")
    + " Über eine Rückmeldung und die Einladung zu einem persönlichen Gespräch freue ich mich sehr.";
  return [[{ text: eins }], zweiLaeufe, [{ text: drei }], [{ text: vier }], [{ text: fuenf }]];
}
/** Eigener Brieftext mit Platzhaltern {Firma}, {Stelle}, {Ort}, {Bereich}, {Kenntnisse}; Absätze durch Leerzeilen. */
export function eigeneAbsaetze(vorlage: string, stelle: Stelleneingabe, a: Analyse, l: Lebenslaufdaten): Lauf[][] {
  const kenntnisse = a.treffer.length ? a.treffer.slice(0, 5) : l.kenntnisse.flatMap(g => g.eintraege).slice(0, 4);
  const werte: Record<string, string> = { firma: a.firma || "Ihrem Unternehmen", stelle: a.titel, ort: (stelle.location || "").trim() || "Ihrem Standort", bereich: a.bereich, kenntnisse: deutscheListe(kenntnisse) };
  return vorlage.split(/\n\s*\n/).map(p => p.replace(/\s*\n\s*/g, " ").replace(/\{(\w+)\}/g, (ganz, n: string) => werte[n.toLowerCase()] ?? ganz).trim()).filter(Boolean).map(p => [{ text: p }]);
}

// Prüfung eines KI-Vorschlags: nur Projekte und Kenntnisse aus dem Profil, Absätze nach den Schreibregeln.
const UMLAUTERSATZ = /\b(?:fuer|ueber\w*|moechte\w*|koenn\w*|waere\w*|wuerde\w*|gruess\w*|naechst\w*|spaeter\w*|persoenlich\w*|gespraech\w*|moeglich\w*|taetig\w*|erfuell\w*|unterstuetz\w*|zuverlaessig\w*|faehig\w*|praesent\w*|schliesslich|heisst|muess\w*|gefoerdert|foerder\w*)\b/i;
export type Vorschlag = { projekte: Projekt[]; kenntnisse: Kenntnisgruppe[]; anrede: string; absaetze: string[] };
export function vorschlagPruefen(roh: unknown, l: Lebenslaufdaten, a: Analyse): Vorschlag {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) throw new KiFehler("Antwort ist kein Objekt.");
  const d = roh as Record<string, unknown>;
  const namen = Array.isArray(d.projekte) ? d.projekte : [];
  const projekte: Projekt[] = [];
  for (const n of namen) {
    const p = typeof n === "string" ? l.projekte.find(x => norm(x.name) === norm(n)) : undefined;
    if (!p) throw new KiFehler("Vorgeschlagenes Projekt steht nicht im Profil.");
    if (!projekte.includes(p)) projekte.push(p);
  }
  const gruppen: Kenntnisgruppe[] = [];
  for (const g of Array.isArray(d.kenntnisse) ? d.kenntnisse : []) {
    const e = g as { kategorie?: unknown; eintraege?: unknown }, original = l.kenntnisse.find(x => typeof e.kategorie === "string" && norm(x.kategorie) === norm(e.kategorie));
    if (!original || !Array.isArray(e.eintraege)) throw new KiFehler("Vorgeschlagene Kenntnis steht nicht im Profil.");
    const zuerst = e.eintraege.map(x => original.eintraege.find(o => typeof x === "string" && norm(o) === norm(x)));
    if (zuerst.some(x => !x)) throw new KiFehler("Vorgeschlagene Kenntnis steht nicht im Profil.");
    if (!gruppen.some(x => x.kategorie === original.kategorie)) gruppen.push({ kategorie: original.kategorie, eintraege: [...new Set([...(zuerst as string[]), ...original.eintraege])] });
  }
  for (const g of a.kenntnisse) if (!gruppen.some(x => x.kategorie === g.kategorie)) gruppen.push(g);
  const anredeRoh = typeof d.anrede === "string" ? d.anrede.trim() : "";
  const person = /^Sehr geehrte(?:r Herr| Frau) (?:(?:Dr|Prof)\. )*([\p{Lu}][\p{L}'-]+),$/u.exec(anredeRoh);
  const anrede = anredeRoh === "Sehr geehrte Damen und Herren," || (person && erwaehnt(norm(a.beschreibung), person[1])) ? anredeRoh : a.anrede;
  if (!Array.isArray(d.absaetze)) throw new KiFehler("Absätze fehlen.");
  const absaetze = d.absaetze.filter((p): p is string => typeof p === "string")
    .map(p => p.replace(/\s+/g, " ").replace(/\s*[–—]\s*/g, ", ").replace(/\s+-\s+/g, ", ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/,\s*\./g, ".").trim())
    .filter(p => p && !/^(sehr geehrte|mit freundlichen|viele grüße|beste grüße|freundliche grüße|hallo)/i.test(p));
  const alles = absaetze.join(" ");
  if (absaetze.length < 3 || absaetze.length > 6) throw new KiFehler("Anzahl der Absätze passt nicht.");
  if (alles.length < 400 || alles.length > 2600 || absaetze.some(p => p.length > 1100)) throw new KiFehler("Länge des Anschreibens passt nicht auf eine Seite.");
  if (/\b(?:https?:\/\/|www\.)|\b[\w-]+\.(?:de|com|org|net|io|dev|app|eu)\b|@/i.test(alles)) throw new KiFehler("Sichtbare Adresse im Anschreiben.");
  if (/[[\]{}<>]/.test(alles)) throw new KiFehler("Platzhalter im Anschreiben.");
  if (UMLAUTERSATZ.test(alles)) throw new KiFehler("Umlaute als ae, oe oder ue geschrieben.");
  if (a.firmaBekannt && !erwaehnt(norm(alles), a.firma.replace(/\b(gmbh|ag|kg|se|ug|mbh|co\.?|e\.v\.)\b/gi, "").trim() || a.firma)) throw new KiFehler("Firma im Anschreiben nicht genannt.");
  // Vorgeschlagene Reihenfolge zuerst, übrige eigene Projekte danach (die Stufen für eine Seite kürzen bei Bedarf).
  return { projekte: [...projekte.slice(0, 4), ...a.projekte.filter(p => !projekte.includes(p))], kenntnisse: gruppen, anrede, absaetze };
}

// Gestaltung: Akzentfarbe und Abstände wie die Vorlagen des Originals (Helvetica, blaue Überschriften mit Linie).
const AKZENT: Farbe = [28 / 255, 79 / 255, 130 / 255], GRAU: Farbe = [0.392, 0.455, 0.545], DUNKEL: Farbe = [0.118, 0.161, 0.231], HELLGRAU: Farbe = [0.75, 0.78, 0.82];
const trenner = (laeufe: Lauf[][], farbe: Farbe = GRAU): Lauf[] => laeufe.filter(l => l.length).flatMap((l, i) => (i ? [{ text: " | ", farbe }, ...l] : l));
function kontaktzeile(k: Kontakt): Lauf[] {
  const teile: Lauf[][] = [];
  if (k.ort) teile.push([{ text: [k.ort, k.bundesland].filter(Boolean).join(", "), farbe: GRAU }]);
  if (k.telefon) teile.push([{ text: k.telefon, farbe: GRAU }]);
  if (k.email) teile.push([{ text: k.email, farbe: GRAU, link: "mailto:" + k.email }]);
  for (const [name, wert] of [["Portfolio", k.portfolio], ["GitHub", k.github], ["LinkedIn", k.linkedin]] as const)
    if (wert && sichererVerweis(wert)) teile.push([{ text: name, farbe: AKZENT, link: wert }]);
  return trenner(teile);
}
export type Lebenslaufinhalt = { kontakt: Kontakt; lebenslauf: Lebenslaufdaten; projekte: Projekt[]; kenntnisse: Kenntnisgruppe[]; ausbildung: Ausbildung[] };
type Stufe = { groesse: number; projekte: number; punkte: number; kenntnisse: number };
const STUFEN_JOBPILOT: Stufe[] = [{ groesse: 10, projekte: 4, punkte: 3, kenntnisse: 30 }, { groesse: 10, projekte: 4, punkte: 2, kenntnisse: 30 }, { groesse: 9.5, projekte: 3, punkte: 2, kenntnisse: 30 }, { groesse: 9, projekte: 3, punkte: 2, kenntnisse: 12 }, { groesse: 9, projekte: 2, punkte: 2, kenntnisse: 10 }];
const STUFEN_EIGENE: Stufe[] = [{ groesse: 10, projekte: 12, punkte: 6, kenntnisse: 30 }, { groesse: 9.5, projekte: 12, punkte: 6, kenntnisse: 30 }];

function lebenslaufSetzen(c: Lebenslaufinhalt, grundlage: Grundlage, s: Stufe): Setzer {
  const jp = grundlage === "jobpilot", rand = 53.9, g = s.groesse;
  const setzer = new Setzer({ links: rand, rechts: rand, oben: rand, unten: rand }, DUNKEL);
  setzer.absatz([{ text: c.kontakt.name, fett: true }], { groesse: 20, zeilenfaktor: 1.15, nach: 1 });
  const kz = kontaktzeile(c.kontakt);
  if (kz.length) setzer.absatz(kz, { groesse: g - 1, nach: 2 });
  const abschnitt = (titel: string) => {
    setzer.platz(g * 4);
    setzer.abstand(g * 0.8);
    if (jp) { setzer.absatz([{ text: titel.toUpperCase(), fett: true, farbe: AKZENT }], { groesse: g + 0.5, zeilenfaktor: 1.2 }); setzer.linie({ farbe: AKZENT, dicke: 1.1, vor: 1, nach: 4 }); }
    else { setzer.absatz([{ text: titel, fett: true }], { groesse: g + 1, zeilenfaktor: 1.2 }); setzer.linie({ farbe: HELLGRAU, dicke: 0.5, vor: 1, nach: 4 }); }
  };
  const punkte = (liste: string[], max: number) => { for (const p of liste.slice(0, max)) setzer.punkt([{ text: p }], { groesse: g }); };
  if (!jp && c.lebenslauf.kurzprofil) { abschnitt("Kurzprofil"); setzer.absatz([{ text: c.lebenslauf.kurzprofil }], { groesse: g, nach: 2 }); }
  const bildung = () => {
    if (!c.ausbildung.length) return;
    abschnitt(c.ausbildung.every(istStudium) ? "Studium" : "Ausbildung");
    for (const e of c.ausbildung) {
      setzer.linksRechts([{ text: e.abschluss || e.einrichtung, fett: true }], e.zeitraum ? [{ text: e.zeitraum, farbe: GRAU }] : [], { groesse: g });
      const wo = [e.abschluss ? e.einrichtung : "", e.ort].filter(Boolean).join(", ");
      if (wo) setzer.absatz([{ text: wo }], { groesse: g });
      punkte(e.punkte, jp ? Math.max(2, s.punkte) : 6);
      setzer.abstand(g * 0.35);
    }
  };
  const erfahrung = () => {
    if (!c.lebenslauf.erfahrung.length) return;
    abschnitt("Berufserfahrung");
    for (const e of c.lebenslauf.erfahrung) {
      setzer.linksRechts([{ text: [e.titel, e.firma].filter(Boolean).join(", "), fett: true }], e.zeitraum ? [{ text: e.zeitraum, farbe: GRAU }] : [], { groesse: g });
      if (e.ort && !jp) setzer.absatz([{ text: e.ort }], { groesse: g });
      punkte(e.punkte, jp ? s.punkte : 6);
      setzer.abstand(g * 0.35);
    }
  };
  if (jp) { bildung(); erfahrung(); } else { erfahrung(); bildung(); }
  if (c.projekte.length) {
    abschnitt("Projekte");
    for (const p of c.projekte.slice(0, s.projekte)) {
      const links: Lauf[] = [{ text: p.name, fett: true, ...(p.link && jp ? { farbe: AKZENT } : {}), link: p.link || undefined }];
      if (p.technik) links.push({ text: " | " + p.technik, farbe: GRAU });
      setzer.linksRechts(links, p.kontext ? [{ text: p.kontext, farbe: GRAU }] : [], { groesse: g });
      punkte(p.punkte, s.punkte);
      setzer.abstand(g * 0.35);
    }
  }
  if (c.kenntnisse.length || c.lebenslauf.sprachen.length) {
    abschnitt(jp ? "Kompetenzen" : "Kenntnisse");
    for (const gr of c.kenntnisse) setzer.absatz([{ text: gr.kategorie + ": ", fett: true }, { text: gr.eintraege.slice(0, s.kenntnisse).join(", ") }], { groesse: g, nach: 1 });
    if (c.lebenslauf.sprachen.length) setzer.absatz([{ text: "Sprachen: ", fett: true }, { text: c.lebenslauf.sprachen.join(", ") }], { groesse: g, nach: 1 });
  }
  if (c.lebenslauf.weiterbildung) { abschnitt("Weiterbildung"); setzer.absatz([{ text: c.lebenslauf.weiterbildung }], { groesse: g }); }
  return setzer;
}
export function lebenslaufPdf(c: Lebenslaufinhalt, grundlage: Grundlage, datum: Date) {
  const stufen = grundlage === "jobpilot" ? STUFEN_JOBPILOT : STUFEN_EIGENE;
  let setzer = lebenslaufSetzen(c, grundlage, stufen[0]);
  for (const s of stufen.slice(1)) { if (setzer.seiten.length <= 1) break; setzer = lebenslaufSetzen(c, grundlage, s); }
  return { pdf: setzer.pdf({ titel: "Lebenslauf " + c.kontakt.name, autor: c.kontakt.name, datum }), seiten: setzer.seiten.length };
}
function anschreibenSetzen(b: Briefdaten, g: number): Setzer {
  const s = new Setzer({ links: 68, rechts: 56.7, oben: 62.4, unten: 56.7 }, DUNKEL), k = b.kontakt;
  const absender: Lauf[][] = [[{ text: k.name, fett: true }]];
  if (k.strasse) absender.push([{ text: k.strasse, farbe: GRAU }]);
  if (k.plz || k.ort) absender.push([{ text: [k.plz, k.ort].filter(Boolean).join(" "), farbe: GRAU }]);
  if (k.email) absender.push([{ text: k.email, farbe: GRAU, link: "mailto:" + k.email }]);
  if (k.telefon) absender.push([{ text: k.telefon, farbe: GRAU }]);
  const verweise = ([["Portfolio", k.portfolio], ["GitHub", k.github], ["LinkedIn", k.linkedin]] as const).filter(([, w]) => w && sichererVerweis(w)).map(([n, w]) => [{ text: n, farbe: AKZENT, link: w }]);
  if (verweise.length) absender.push(trenner(verweise));
  for (const zeile of absender) s.absatz(zeile, { groesse: 9.5, zeilenfaktor: 1.35, ausrichtung: "rechts" });
  s.abstand(g * 2.4);
  s.absatz([{ text: b.ortDatum }], { groesse: g, nach: g * 1.6 });
  s.absatz([{ text: b.betreff, fett: true }], { groesse: g + 0.5, nach: g * 0.9 });
  s.absatz([{ text: b.anrede }], { groesse: g, zeilenfaktor: 1.4, nach: g * 0.6 });
  for (const absatz of b.absaetze) s.absatz(absatz, { groesse: g, zeilenfaktor: 1.4, nach: g * 0.6 });
  s.abstand(g * 0.4);
  s.absatz([{ text: "Mit freundlichen Grüßen" }], { groesse: g, nach: g * 2.2 });
  s.absatz([{ text: k.name }], { groesse: g });
  return s;
}
export function anschreibenPdf(b: Briefdaten, datum: Date) {
  let s = anschreibenSetzen(b, 10.5);
  for (const g of [10, 9.5]) { if (s.seiten.length <= 1) break; s = anschreibenSetzen(b, g); }
  return { pdf: s.pdf({ titel: "Anschreiben " + b.kontakt.name, autor: b.kontakt.name, datum }), seiten: s.seiten.length };
}

export type Erzeugungseingabe = { kontakt: Kontakt; profil: Unterlagenprofil; stelle: Stelleneingabe; heute: Date };
export type ErzeugtesDokument = { kind: "cv" | "letter"; name: string; type: "application/pdf"; base64: string; sha256: string };
export type Erzeugung = { dokumente: ErzeugtesDokument[]; anbieter: Schritt | "vorlage"; versuche: { schritt: Schritt; fehler: string }[]; grundlage: Grundlage; brief: Briefvorlage; seiten: { cv: number; letter: number } };
const dateiname = (n: string) => n.normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "Bewerbung";
function dokument(kind: "cv" | "letter", name: string, pdf: Buffer): ErzeugtesDokument {
  return { kind, name, type: "application/pdf", base64: pdf.toString("base64"), sha256: createHash("sha256").update(pdf).digest("hex") };
}
function kiDaten(e: Erzeugungseingabe, a: Analyse) {
  const l = e.profil.lebenslauf;
  return {
    stelle: { titel: a.titel, firma: a.firma || "nicht genannt", ort: (e.stelle.location || "").trim(), art: a.initiativ ? "Initiativbewerbung" : "Stellenanzeige", beschreibung: a.beschreibung.slice(0, 6000) },
    // Kein Name, keine Kontaktdaten: für Auswahl und Formulierung nicht nötig.
    profil: { ausbildung: ausbildungen(e.kontakt, l), erfahrung: l.erfahrung, projekte: l.projekte.map(p => ({ name: p.name, technik: p.technik, rahmen: p.kontext, punkte: p.punkte })), kenntnisse: l.kenntnisse, sprachen: l.sprachen, weiterbildung: l.weiterbildung, arbeitsweise: l.arbeitsweise, berufswunsch: e.kontakt.interesse, beginn: e.kontakt.beginn, wochenstunden: e.kontakt.stunden, portfolioVorhanden: !!e.kontakt.portfolio },
  };
}
/** KI-Absätze als Läufe; das Wort „Portfolio“ verweist auf das eigene Portfolio, eine Adresse erscheint nie. */
function alsLaeufe(absatz: string, portfolio: string): Lauf[] {
  const i = portfolio && sichererVerweis(portfolio) ? absatz.indexOf("Portfolio") : -1;
  return i < 0 ? [{ text: absatz }] : [{ text: absatz.slice(0, i) }, { text: "Portfolio", link: portfolio }, { text: absatz.slice(i + 9) }];
}

/**
 * Erstellt gezielten Lebenslauf und Anschreiben für eine Stelle. Ohne KI-Optionen oder ohne freigeschalteten Weg gilt
 * die Vorlage; ein gescheiterter KI-Weg führt immer zur Vorlage, nie zu einem Abbruch.
 */
export async function unterlagenErzeugen(e: Erzeugungseingabe, ki?: { optionen: KiOptionen; gesperrt?: Set<Schritt>; erlaubt?: boolean }): Promise<Erzeugung> {
  const fehlt = fehlendeAngaben(e.kontakt, e.profil.lebenslauf);
  if (fehlt.length) throw problem("Im Profil fehlen: " + fehlt.join(", ") + ".", 409);
  const l = e.profil.lebenslauf, a = analysieren(e.stelle, l);
  let anbieter: Erzeugung["anbieter"] = "vorlage", versuche: Erzeugung["versuche"] = [];
  let projekte = a.projekte, kenntnisse = a.kenntnisse, anrede = a.anrede;
  let absaetze = e.profil.brief === "eigene" ? eigeneAbsaetze(e.profil.eigenerBrief, e.stelle, a, l) : vorlagenAbsaetze(e.kontakt, l, a, e.heute);
  // Eigener Brieftext wird nie umgeschrieben; KI nur für die JobPilot-Vorlage.
  if (ki && ki.erlaubt !== false && e.profil.brief === "jobpilot" && kette(ki.optionen).length) {
    const r = await kiVorschlag(kiDaten(e, a), ki.optionen, roh => vorschlagPruefen(roh, l, a), ki.gesperrt);
    versuche = r.versuche;
    if (r.vorschlag && r.schritt) {
      anbieter = r.schritt;
      projekte = r.vorschlag.projekte;
      kenntnisse = r.vorschlag.kenntnisse;
      anrede = r.vorschlag.anrede;
      absaetze = r.vorschlag.absaetze.map(p => alsLaeufe(p, e.kontakt.portfolio));
    }
  }
  // Eigene Struktur: alle eigenen Projekte, nur nach Bezug sortiert.
  const cv = lebenslaufPdf({ kontakt: e.kontakt, lebenslauf: l, projekte, kenntnisse, ausbildung: ausbildungen(e.kontakt, l) }, e.profil.grundlage, e.heute);
  const betreff = a.initiativ ? `Initiativbewerbung${a.firma ? " bei " + a.firma : ""}` : `Bewerbung als ${a.titel}`;
  const brief = anschreibenPdf({ kontakt: e.kontakt, ortDatum: (e.kontakt.ort ? e.kontakt.ort + ", den " : "") + deutschesDatum(e.heute), betreff, anrede, absaetze }, e.heute);
  const name = dateiname(e.kontakt.name);
  return { dokumente: [dokument("cv", `Lebenslauf_${name}.pdf`, cv.pdf), dokument("letter", `Anschreiben_${name}.pdf`, brief.pdf)], anbieter, versuche, grundlage: e.profil.grundlage, brief: e.profil.brief, seiten: { cv: cv.seiten, letter: brief.seiten } };
}

/** Von der Anzeige verlangte Nachweise, davon im Profil vorhanden (beigelegt) und fehlend. */
export function nachweisStand(beschreibung: string | null | undefined, vorhanden: Partial<Record<NachweisArt, unknown>>) {
  const verlangt = verlangteNachweise(textOnly(beschreibung || ""));
  return { verlangt, beigelegt: verlangt.filter(a => !!vorhanden[a]), fehlen: verlangt.filter(a => !vorhanden[a]) };
}
export const nachweisFehltText = (art: NachweisArt) => `${NACHWEIS_TITEL[art]} verlangt, keine Datei im Profil hinterlegt`;

/** Erfundene Beispielstelle für die Vorschau im Profil (nur Vorlage, keine Anfrage). */
export const VORSCHAU_STELLE: Stelleneingabe = {
  id: "__vorschau__", title: "Werkstudent Softwareentwicklung (m/w/d)", company: "Beispiel Software GmbH", location: "Musterstadt",
  description: "Beispielanzeige für die Vorschau. Du entwickelst Webanwendungen mit TypeScript, React, Python und SQL, arbeitest mit Git und Docker im Team und dokumentierst deine Ergebnisse.",
};
