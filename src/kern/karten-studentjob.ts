// Trefferliste von studentjob (Rails): jede Karte ist ein <a data-job-opening-id=… data-job-opening-title=…>.
// Eigene Anzeigen verlinken /stellenangebote/<id>-<slug>; importierte Feed-Anzeigen nur die Weiterleitung
// /vacatures/<id>-<slug>/sollicitaties/redirect_application (robots.txt: Disallow /vacatures*). Deren eigene,
// kanonische Anzeigenseite ist /stellenangebote/<id>-<slug> mit denselben Kennungen aus der Karte.
import { type Karte, attr, text } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  // Ohne Treffer zeigt die Seite einen Hinweis und darunter fremde Top-Jobs; das sind keine Suchergebnisse.
  if (/\bjob-opening-zero-results\b/.test(html) || /"numberOfResults"\s*:\s*0\b/.test(html)) return [];
  const out: Karte[] = [];
  for (const card of html.split(/<a\b(?=[^>]*\bdata-job-opening-id=)/i).slice(1)) {
    const tag = card.slice(0, card.indexOf(">") + 1), body = card.slice(0, card.search(/<\/a>/i) >>> 0);
    const id = attr(tag, "data-job-opening-id"), href = attr(tag, "href");
    const slug = href.match(/^\/(?:stellenangebote|vacatures)\/(\d+-[a-z0-9-]+)/i);
    if (!/^\d+$/.test(id) || !slug || !slug[1].startsWith(id + "-")) continue;
    const title = attr(tag, "data-job-opening-title") || text(body.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    // Firma: Markenangabe der Karte; bei selbst eingestellten Anzeigen das Logo des einstellenden Kunden.
    // Importierte Feed-Anzeigen tragen nur das Logo des Feeds (z. B. StepStone) und nennen keinen Arbeitgeber.
    const brand = attr(tag, "data-job-opening-item-brand"), variant = attr(tag, "data-job-opening-item-variant");
    const logo = attr(body.match(/<img\b[^>]*class="[^"]*job-opening__customer-logo[^"]*"[^>]*>/i)?.[0] || "", "title");
    const company = brand && brand !== "null" ? brand : variant === "customer_created" ? logo : "";
    const location = text(body.match(/nyc-icon-location[^>]*>\s*<\/span>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    out.push({ title, company: company || null, location: location || null, url: "/stellenangebote/" + slug[1] });
  }
  return out;
}
