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
