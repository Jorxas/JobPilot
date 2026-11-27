// Trefferliste von StepStone: Die Seite wird im Browser gerendert, die Treffer stehen aber vollständig
// im eingebetteten Zustand __PRELOADED_STATE__["app-unifiedResultlist"] (searchResults.items).
// Je Treffer: title, companyName, location (nur Ort, postCode meist leer), url, datePosted.
// textSnippet ist eine kurze Zusammenfassung von StepStone und wird nicht als Beschreibung übernommen,
// damit die Detailseite (JSON-LD) die eigentliche Anzeige liefert.
// Blättern (geprüft am 27. November 2026): searchResults.unifiedPagination nennt page, pageCount und links.next
// (…&action=paging_next&page=2, 25 Treffer je Seite); auf der letzten Seite ist links.next leer und „Nächste“ ein
// deaktivierter Knopf statt eines Links. StepStone füllt die Liste mit „regional“ und „semantic“ ergänzten Treffern
// auf (section je Treffer); selbst ein Unsinnsbegriff liefert so Seiten, eine echte Leerliste ist selten.
import { findObjects, jsonAssignment, str, type Karte } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});
const zustand = (html: string) => o(jsonAssignment(html, '__PRELOADED_STATE__["app-unifiedResultlist"]'));

export function karten(html: string, _base: string): Karte[] {
  const state = jsonAssignment(html, '__PRELOADED_STATE__["app-unifiedResultlist"]');
  if (!state) return [];
  // Nur echte Suchtreffer (section „main“): „regional“ ergänzte Treffer können außerhalb des Umkreises liegen, „semantic“
  // sind ähnliche Stellen zu anderen Begriffen (27. November 2026). Ältere Zustände ohne section gelten als Treffer.
  const items = findObjects(state, o => typeof o.title === "string" && typeof o.url === "string" && "companyName" in o).filter(o => typeof o.section !== "string" || o.section === "main");
  return items.map(o => {
    const city = str(o.location), plz = /^\d{5}$/.test(str(o.postCode)) ? str(o.postCode) : "";
    return {
      title: str(o.title),
      company: o.isAnonymous === true ? null : str(o.companyName) || null,
      location: [plz, city].filter(Boolean).join(" ") || null,
      url: str(o.url),
      publishedAt: str(o.datePosted) || undefined,
    };
  });
}

// Echte Treffer der Suche laut StepStone (meta.counters.main) und ob diese Seite noch welche enthält.
function haupt(html: string) {
  const ergebnis = o(zustand(html).searchResults), items = Array.isArray(ergebnis.items) ? ergebnis.items.map(o) : [];
  const zahl = o(o(ergebnis.meta).counters).main;
  return { gesamt: typeof zahl === "number" ? zahl : undefined, mitSection: items.some(i => typeof i.section === "string"), aufSeite: items.filter(i => typeof i.section !== "string" || i.section === "main").length };
}
export function weiter(html: string, base: string): string | null {
  const seiten = o(o(zustand(html).searchResults).unifiedPagination), seite = seiten.page, letzte = seiten.pageCount;
  // Die echten Treffer sind zu Ende, sobald eine Seite nur noch ergänzte Treffer zeigt oder ihre Zahl erreicht ist.
  const h = haupt(html);
  if (h.mitSection && !h.aufSeite) return null;
  if (h.gesamt !== undefined && typeof seite === "number" && seite * 25 >= h.gesamt) return null;
  if (typeof seite === "number" && typeof letzte === "number") {
    if (seite >= letzte) return null;
    const naechste = str(o(seiten.links).next) || str(seiten.template).replace("{page}", String(seite + 1));
    if (naechste) return new URL(naechste, base).href;
  }
  // Ohne Zustand: der Link „Nächste“ der Seitennavigation; ein deaktivierter Knopf „Nächste“ markiert die letzte Seite.
  const link = html.match(/<a\b[^>]*aria-label=["']Nächste["'][^>]*>/i)?.[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (link) return new URL(link.replace(/&amp;/g, "&"), base).href;
  if (/<button\b[^>]*aria-label=["']Nächste["'][^>]*\bdisabled\b|<button\b[^>]*\bdisabled\b[^>]*aria-label=["']Nächste["']/i.test(html)) return null;
  // Unbekannte Navigation: nächste Seite über page; eine leere Folgeseite beendet die Liste nachweislich.
  const u = new URL(base);
  u.searchParams.set("page", String((Number(u.searchParams.get("page")) || 1) + 1));
  return u.href;
}

// Leer nur, wenn der Zustand ausdrücklich null Treffer meldet (resultFilterInfo.numberOfResults 0, keine Einträge).
// Der Text „Es passt gerade kein Job zu deiner Suche“ steht als Beschriftung auf jeder Seite und zählt nicht.
export function leer(html: string): boolean {
  const ergebnis = o(zustand(html).searchResults), items = ergebnis.items, h = haupt(html);
  // Null echte Treffer (meta.counters.main 0), auch wenn StepStone die Seite mit ähnlichen Stellen auffüllt.
  if (h.gesamt === 0 && !h.aufSeite) return true;
  return Array.isArray(items) && items.length === 0 && o(ergebnis.resultFilterInfo).numberOfResults === 0;
}
