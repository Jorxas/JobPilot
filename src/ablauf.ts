import {
  eligibleRole,
  offerKey,
  normalize,
  scoreOffer,
  selectCompanyOptions,
  type Candidate,
  type Offer,
} from "./kern/core";
import { excludedCompanyRecord } from "./kern/company-catalogue";
import { berlinTag } from "./archiv";
import type { Stelle } from "./beispiele";
export {
  searchPlan,
  batchPlan,
  TECH_FAMILIES,
  SEARCH_PASSES,
  catalogueKeywords,
  normalizeKeywordList,
  parseKeywordInput,
} from "./kern/catalog";
export { searchUrl } from "./kern/core";
// Import und Synchronisierung in einem Schritt (saveDiscoveredOffer und syncJobToTracker des Originals): nur Informatik,
// keine Dubletten und keine Firma, die mit „Kein IT-Bezug“ archiviert wurde. Bestehende Einträge bleiben unverändert.
export function aufnehmen(
  bestand: Stelle[],
  eingang: Offer[],
  profil: Candidate,
  jetzt = new Date(),
) {
  const stellen = bestand.map((s) => ({ ...s }));
  let doppelt = 0,
    ausgeschlossen = 0,
    neu = 0;
  const firmaGesperrt: string[] = [];
  for (const angebot of eingang) {
    if (
      !angebot.title?.trim() ||
      !angebot.externalRef?.trim() ||
      !eligibleRole(angebot.title)
    ) {
      ausgeschlossen++;
      continue;
    }
    const vorhanden = stellen.find(
      (s) =>
        (s.source === angebot.source &&
          s.externalRef === angebot.externalRef) ||
        (!!angebot.company &&
          offerKey(s) === offerKey(angebot) &&
          (!s.location ||
            !angebot.location ||
            normalize(s.location) === normalize(angebot.location))),
    );
    if (vorhanden) {
      doppelt++;
      continue;
    }
    // Firmenausschluss (companyExcluded) gilt für jede neue Anzeige derselben Firma, auch unter Namensvarianten.
    if (excludedCompanyRecord(stellen, angebot.company, angebot.externalRef)) {
      firmaGesperrt.push(angebot.source + "-" + angebot.externalRef);
      ausgeschlossen++;
      continue;
    }
    stellen.push({
      ...angebot,
      id: angebot.source + "-" + angebot.externalRef,
      status: "pending",
      score: scoreOffer(angebot, profil).score,
      revision: 1,
      addedAt: berlinTag(jetzt),
      gefundenAm: jetzt.toISOString(),
    });
    neu++;
  }
  return { stellen, neu, doppelt, ausgeschlossen, firmaAusgeschlossen: firmaGesperrt.length, firmaGesperrt };
}
export function bewerten(stellen: Stelle[], profil: Candidate) {
  return stellen.map((s) => ({ ...s, ...scoreOffer(s, profil) }));
}
export function firmenansicht<T extends Stelle>(stellen: T[]) {
  return selectCompanyOptions(stellen).sort((a, b) => b.score - a.score);
}
export function pruefeManuellenImport(d: Record<string, unknown>): Offer {
  for (const schluessel of ["title", "company", "description", "url"])
    if (typeof d[schluessel] !== "string" || !String(d[schluessel]).trim())
      throw Error(
        "Titel, Unternehmen, Beschreibung und HTTPS-Link sind erforderlich.",
      );
  const url = new URL(String(d.url));
  if (url.protocol !== "https:" || url.username || url.password)
    throw Error("Bitte einen HTTPS-Link ohne Zugangsdaten verwenden.");
  if (String(d.description).length > 20000)
    throw Error("Die Beschreibung ist zu lang.");
  return {
    title: String(d.title).trim(),
    company: String(d.company).trim(),
    description: String(d.description).trim(),
    url: url.href,
    location: String(d.location || ""),
    externalRef: "manuell-" + url.href,
    source: "bundesagentur",
    complete: String(d.description).trim().length >= 150,
  };
}
