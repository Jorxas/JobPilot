// Trefferliste von StepStone: Die Seite wird im Browser gerendert, die Treffer stehen aber vollständig
// im eingebetteten Zustand __PRELOADED_STATE__["app-unifiedResultlist"] (searchResults.items).
// Je Treffer: title, companyName, location (nur Ort, postCode meist leer), url, datePosted.
// textSnippet ist eine kurze Zusammenfassung von StepStone und wird nicht als Beschreibung übernommen,
// damit die Detailseite (JSON-LD) die eigentliche Anzeige liefert.
import { findObjects, jsonAssignment, str, type Karte } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  const state = jsonAssignment(html, '__PRELOADED_STATE__["app-unifiedResultlist"]');
  if (!state) return [];
  const items = findObjects(state, o => typeof o.title === "string" && typeof o.url === "string" && "companyName" in o);
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
