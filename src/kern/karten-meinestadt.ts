// Trefferliste von jobs.meinestadt.de: serverseitig gerenderte Einträge
// <li class="m-resultListEntryJobScan" data-component="resultListEntry-jobScan"> mit Klickfläche (href, title),
// Firma, Ort (nur Ortsname, keine Postleitzahl) und Datum (TT.MM.JJJJ).
// Partnerangebote über www.meinestadt.de/.../redirect/ (laut robots.txt gesperrt) werden ausgelassen.
import { attr, byClass, cards, text, type Karte } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const card of cards(html, /<li\b[^>]*data-component=["']resultListEntry[^"']*["']/i)) {
    const area = card.match(/<a\b[^>]*class=["'][^"']*__clickArea[^"']*["'][^>]*>/i)?.[0] || "";
    const url = attr(area, "href");
    if (!url || /\/redirect\//i.test(url)) continue;
    const date = byClass(card, "m-resultListEntryJobScan__date", "div").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    out.push({
      title: attr(area, "title") || text(card.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]),
      company: byClass(card, "m-resultListEntryJobScan__company(?![\\w-])", "div") || null,
      location: byClass(card, "m-resultListEntryJobScan__location", "div") || null,
      url,
      publishedAt: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined,
    });
  }
  return out;
}

// Blättern (geprüft am 27. November 2026): ?page=N liefert serverseitig die Einträge ab offset (N-1)·20. Maßgeblich ist
// results im eingebetteten jsLibParamsIn (totalCount, totalPages, currentPage, pageSize 20, als JSON-Text mit \"…\");
// das Objekt pagination daneben rechnet mit 5 je Seite und nennt selbst auf der letzten Seite noch eine nextPageURI.
const ERGEBNIS = /\\?"results\\?"\s*:\s*\{\s*\\?"totalCount\\?"\s*:\s*(\d+)\s*,\s*\\?"totalPages\\?"\s*:\s*(\d+)\s*,\s*\\?"currentPage\\?"\s*:\s*(\d+)/;

export function weiter(html: string, base: string): string | null {
  const m = html.match(ERGEBNIS), u = new URL(base);
  const seite = m ? Number(m[3]) : Number(u.searchParams.get("page")) || 1;
  if (m && seite >= Number(m[2])) return null;
  // Ohne Gesamtzahl: nächste Seite trotzdem anfragen; eine leere Folgeseite beendet die Liste nachweislich.
  u.searchParams.set("page", String(seite + 1));
  return u.href;
}

// Leer nur bei ausdrücklich totalCount 0 und ohne Eintrag; die Seite zeigt dann keinen eigenen Hinweistext,
// und die Vorlage „Keine Ergebnisse“ steht auf jeder Trefferliste.
export function leer(html: string): boolean {
  const m = html.match(ERGEBNIS);
  return !!m && m[1] === "0" && !/data-component=["']resultListEntry/i.test(html);
}
