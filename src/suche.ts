// Lokaler Suchablauf der öffentlichen Fassung, nachgebildet nach runMultiSourceSearch des privaten Originals
// (src/lib/discovery/search.ts): ein Suchstart = fünf Durchläufe; jede gewählte Plattform erhält je Durchlauf genau
// eine Anfrage (Spurplan batchPlan), eine blockierte Quelle wird im selben Suchstart nicht erneut gefragt, und jeder
// begrenzte Abruf bleibt als Teilabdeckung ausgewiesen. Statt PostgreSQL speichert der Server eine JSON-Datei.
import { searchJobs, getJobDetails, jobPageUrl } from "./kern/bundesagentur";
import { type Candidate, type Offer, type SourceReport, cleanOfferTitle, searchUrl, textOnly } from "./kern/core";
import { scanPublicSource } from "./kern/public";
import { batchPlan, SEARCH_PASSES } from "./kern/catalog";
import { publicOfferScope } from "./kern/scope";
import type { PlatformId } from "./kern/platforms";
import { arbeitgeberLesen, type Arbeitgeber } from "./arbeitgeber";
import { aufnehmen } from "./ablauf";
import { ohneUnterlagen } from "./kern/company-catalogue";
import type { Geokodierer } from "./geokodierung";
import type { Stelle } from "./beispiele";

export type Lauf = {
  zustand: "laeuft" | "fertig" | "fehlgeschlagen";
  beginn: string;
  ende?: string;
  durchlaeufe: number;
  abgeschlossen: number;
  gefunden: number;
  neu: number;
  // Neue Stellen dieses Suchstarts ohne vollständige Unterlagen (ohneUnterlagen des Originals); öffentlich sind das alle
  // neuen offenen Stellen, deren Firma nicht ausgeschlossen oder schon beworben ist.
  vorzubereiten?: number;
  // Anzeigen von Firmen, die mit „Kein IT-Bezug“ archiviert wurden: nicht übernommen.
  firmaAusgeschlossen?: number;
  meldung?: string;
};
export type Suchstand = { stellen: Stelle[]; runde: number; seiten: Record<string, number>; berichte: SourceReport[]; lauf?: Lauf };
export type Suchauftrag = {
  stadt: string;
  radius: number;
  begriffe: string[];
  breit: boolean;
  quellen: PlatformId[];
  arbeitgeber: Arbeitgeber[];
};
export type Suchhilfen = {
  speichern: () => Promise<void>;
  erneuern: () => Promise<void>;
  geo: Geokodierer;
  profil: Candidate;
  // Nur bei einem ausdrücklichen manuellen Suchstart mit Connector-Wahl gesetzt (ChatGPT/Codex oder Claude, je Start
  // genau einer); Aufrufe ohne diese Wahl starten keinen Connector.
  indeedConnector?: (begriffe: string[], stadt: string, radius: number) => Promise<{ offers: Offer[]; report: SourceReport }>;
};

// Bundesagentur: zwei Seiten je Anfrage ab dem gespeicherten Stand dieses Suchbegriffs.
export async function scanBundesagentur(keywords: string, city: string, radiusKm: number, firstPage = 1) {
  const url = searchUrl("bundesagentur", keywords, city, radiusKm), offers: Offer[] = [];
  let pages = 0, exhausted = false;
  try {
    // Alle Seiten des Suchbegriffs (seit 27. November 2026); 40 Seiten zu 25 Treffern schützen nur vor einer Endlosschleife.
    for (let page = firstPage; page < firstPage + 40; page++) {
      const results = await searchJobs({ keywords, city, radiusKm, size: 25, page });
      pages++;
      for (const result of results) {
        if (typeof result.title !== "string" || !result.title.trim() || typeof result.refnr !== "string" || !result.refnr.trim()) continue;
        offers.push({ source: "bundesagentur", externalRef: result.refnr, title: result.title, company: result.company, location: result.location, url: result.externalUrl || jobPageUrl(result.refnr), description: "", complete: false, distanceKm: result.distanceKm, publishedAt: result.publishedAt });
      }
      if (results.length < 25) { exhausted = true; break; }
    }
    const report: SourceReport = { source: "bundesagentur", status: "ok", found: offers.length, inserted: 0, keywords, pages, limited: !exhausted, message: exhausted ? "Verfügbare Seiten dieses Suchbegriffs gelesen. Beschreibungen werden schrittweise ergänzt." : "Zwei Seiten gelesen; die folgenden Seiten folgen beim nächsten Durchlauf mit diesem Suchbegriff.", searchUrl: url };
    return { offers, nextPage: exhausted ? 1 : firstPage + pages, report };
  } catch {
    const report: SourceReport = { source: "bundesagentur", status: "error", found: offers.length, inserted: 0, keywords, pages, limited: true, message: "Quelle nicht erreichbar; bereits gelesene Ergebnisse und Seitennummer bleiben erhalten.", searchUrl: url };
    return { offers, nextPage: firstPage + pages, report };
  }
}

// In diesem Suchstart neu aufgenommene, offene Stellen ohne vollständige Unterlagen. Die öffentliche Fassung erstellt keine
// Unterlagen; gezählt wird, damit keine neue Stelle als bewerbungsbereit erscheint.
export function neueOhneUnterlagen(stellen: Stelle[], beginn: string) {
  const zeile = (s: Stelle) => ({ id: s.id, status: s.status, metadata: { company: s.company, companyExcluded: s.companyExcluded }, documents: [] });
  return ohneUnterlagen(stellen.filter((s) => typeof s.gefundenAm === "string" && s.gefundenAm >= beginn).map(zeile), stellen.map(zeile)).length;
}

// Diese Quellen filtern den Umkreis selbst (Arbeitgeberseiten sind ausdrücklich konfiguriert); alle anderen werden geprüft.
const UMKREIS_DURCH_QUELLE = new Set(["bundesagentur", "linkedin", "stepstone", "arbeitgeber"]);

export async function liveSuche(z: Suchstand, a: Suchauftrag, h: Suchhilfen) {
  const berichte: SourceReport[] = [], blockiert = new Map<string, string>();
  const lauf: Lauf = { zustand: "laeuft", beginn: new Date().toISOString(), durchlaeufe: SEARCH_PASSES, abgeschlossen: 0, gefunden: 0, neu: 0, firmaAusgeschlossen: 0 };
  z.lauf = lauf;
  z.berichte = berichte;
  let doppelt = 0, ausgeschlossen = 0;
  // Dieselbe Anzeige kann in mehreren Durchläufen erscheinen; gezählt wird jede ausgeschlossene Anzeige einmal.
  const firmaGesperrt = new Set<string>();
  const sichern = async () => { await h.erneuern(); await h.speichern(); };
  const sammeln = async (r: { offers: Offer[]; report: SourceReport }) => {
    lauf.gefunden += r.offers.length;
    const gueltig = r.offers.filter(o => typeof o.title === "string" && o.title.trim() && typeof o.externalRef === "string" && o.externalRef.trim()).map(o => ({ ...o, title: cleanOfferTitle(o.title) }));
    // Orte nur für fachlich passende Treffer auflösen; der Umkreis wird nie geraten.
    const pruefen = gueltig.filter(o => !UMKREIS_DURCH_QUELLE.has(o.source) && publicOfferScope(o, a.stadt, a.radius, {}) !== "role");
    if (pruefen.length) await h.geo.aufloesen([a.stadt, ...pruefen.map(o => o.location)]);
    let unbekannt = 0;
    const angenommen = gueltig.filter(o => {
      if (UMKREIS_DURCH_QUELLE.has(o.source)) return true;
      const s = publicOfferScope(o, a.stadt, a.radius, h.geo.cache);
      if (s === "unknown") unbekannt++;
      return s === "ok";
    });
    const e = aufnehmen(z.stellen, angenommen, h.profil);
    z.stellen = e.stellen;
    r.report.inserted += e.neu;
    lauf.neu += e.neu;
    doppelt += e.doppelt;
    ausgeschlossen += e.ausgeschlossen + gueltig.length - angenommen.length;
    for (const ref of e.firmaGesperrt) firmaGesperrt.add(ref);
    lauf.firmaAusgeschlossen = firmaGesperrt.size;
    if (unbekannt) r.report.message += ` ${unbekannt} Treffer mit ungeklärter Entfernung nicht übernommen; bitte im Browser prüfen.`;
    if (e.firmaAusgeschlossen) r.report.message += ` ${e.firmaAusgeschlossen} Treffer dauerhaft ausgeschlossener Firmen nicht übernommen.`;
  };
  await sichern();
  const plan = batchPlan(a.begriffe, a.breit, z.runde, a.quellen.length);
  try {
    for (const eintrag of a.arbeitgeber.slice(0, 5)) {
      if (typeof eintrag?.name !== "string" || typeof eintrag?.url !== "string") continue;
      await h.erneuern();
      const r = await arbeitgeberLesen(eintrag);
      await sammeln(r);
      berichte.push(r.report);
      await sichern();
    }
    const indeedConnector = !!h.indeedConnector && a.quellen.includes("indeed"), indeedBegriffe: string[] = [];
    for (let pass = 1; pass <= SEARCH_PASSES; pass++) {
      for (const [spur, quelle] of a.quellen.entries()) {
        const anfrage = plan[pass - 1].lanes[spur];
        if (!anfrage) continue;
        // Indeed: kein direkter Abruf; die fünf Begriffe dieser Spur gehen gesammelt an einen einzigen Connector-Lauf.
        if (quelle === "indeed" && indeedConnector) { indeedBegriffe.push(anfrage.keywords); continue; }
        await h.erneuern();
        if (quelle === "bundesagentur") {
          const r = await scanBundesagentur(anfrage.keywords, a.stadt, a.radius, 1);
          r.report.family = anfrage.family;
          r.report.pass = pass;
          await sammeln(r);
          z.seiten[anfrage.keywords] = r.nextPage;
          berichte.push(r.report);
          await sichern();
          continue;
        }
        if (blockiert.has(quelle)) {
          berichte.push({ source: quelle, keywords: anfrage.keywords, family: anfrage.family, pass, status: "blocked", skipped: true, found: 0, inserted: 0, message: "Quelle in diesem Suchstart bereits blockiert; keine weitere Anfrage gesendet. " + blockiert.get(quelle), searchUrl: searchUrl(quelle, anfrage.keywords, a.stadt, a.radius) });
          await sichern();
          continue;
        }
        const r = await scanPublicSource(quelle, anfrage.keywords, a.stadt, a.radius);
        r.report = { ...r.report, keywords: anfrage.keywords, family: anfrage.family, pass };
        await sammeln(r);
        berichte.push(r.report);
        if (r.report.status === "blocked") blockiert.set(quelle, r.report.message);
        await sichern();
      }
      z.runde++;
      lauf.abgeschlossen++;
      await sichern();
    }
    if (indeedConnector) {
      await h.erneuern();
      // Der genaue Umkreis gilt auch für Connector-Treffer (ChatGPT meldet Meilen, Claude keinen Umkreis): sammeln prüft ihn.
      const r = await h.indeedConnector!(indeedBegriffe, a.stadt, a.radius);
      await sammeln(r);
      berichte.push(r.report);
      await sichern();
    }
    // Unvollständige Bundesagentur-Beschreibungen begrenzt und nach Unterbrechungen erneut anreichern.
    const offen = z.stellen.filter(s => s.source === "bundesagentur" && !s.complete && (!s.nachladeVersuch || Date.now() - s.nachladeVersuch >= 6 * 3600000)).slice(0, 12);
    for (const s of offen) {
      await h.erneuern();
      s.nachladeVersuch = Date.now();
      try {
        const d = await getJobDetails(s.externalRef), beschreibung = textOnly(d.descriptionText || "");
        if (beschreibung.length >= 150) { s.description = beschreibung; s.complete = true; }
      } catch { /* Fehlender Detailabruf bleibt ausdrücklich unvollständig. */ }
    }
    lauf.vorzubereiten = neueOhneUnterlagen(z.stellen, lauf.beginn);
    lauf.zustand = "fertig";
    lauf.ende = new Date().toISOString();
    lauf.meldung = h.geo.meldung();
    await h.speichern();
    return {
      neu: lauf.neu, doppelt, ausgeschlossen, gefunden: lauf.gefunden,
      plan: plan.map(p => ({ durchlauf: p.pass, anfragen: a.quellen.flatMap((quelle, i) => p.lanes[i] ? [{ quelle, ...p.lanes[i]! }] : []) })),
    };
  } catch (e) {
    lauf.zustand = "fehlgeschlagen";
    lauf.ende = new Date().toISOString();
    lauf.meldung = e instanceof Error ? e.message : "Suche abgebrochen.";
    await h.speichern().catch(() => {});
    throw e;
  }
}
