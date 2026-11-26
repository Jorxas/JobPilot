// Trefferliste von jobmensa (Next.js, serverseitig gerendert): Treffer sind <a data-testid="job-offer-item">.
// Bezahlte Empfehlungen (data-testid="promoted-job-offer-item", Abzeichen „Empfohlen“) stehen davor,
// gelten bundesweit und sind keine Suchergebnisse; sie werden übergangen.
// Zeilen tragen ein Symbol: location-dot = Ort, building = Firma. Anzeigen von jobvalley (data-jobvalley-job="true")
// zeigen statt einer Firmenzeile das jobvalley-Logo; die Detailseite nennt jobvalley ebenfalls als Arbeitgeber.
import { type Karte, attr, text } from "./karten-hilfe";

function zeile(card: string, icon: string): string {
  for (const m of card.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    if (new RegExp(`<svg\\b[^>]*data-icon="${icon}"`, "i").test(m[1])) return text(m[1].replace(/<svg\b[\s\S]*?<\/svg>/gi, ""));
  return "";
}

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const part of html.split(/<a\b(?=[^>]*\bdata-testid="job-offer-item")/i).slice(1)) {
    const card = part.slice(0, part.search(/<\/a>/i) >>> 0), tag = card.slice(0, card.indexOf(">") + 1);
    const href = attr(tag, "href"), title = text(card.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
    if (!title || !/^\/jobs\/[^?#]+/.test(href)) continue;
    const logo = attr(card.match(/<svg\b[^>]*aria-label="[^"]*"[^>]*>/i)?.[0] || "", "aria-label");
    const company = zeile(card, "building") || (attr(tag, "data-jobvalley-job") === "true" && /^jobvalley$/i.test(logo) ? logo : "");
    out.push({ title, company: company || null, location: zeile(card, "location-dot") || null, url: href });
  }
  return out;
}
