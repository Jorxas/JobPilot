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

// Zähler über der Liste („48 Jobs“). Er zählt die bezahlten Empfehlungen dieser Seite mit (geprüft am 27. November 2026:
// Seite 1 „48“ bei 17 Empfehlungen, Seiten 3 und 4 derselben Suche „31“ ohne Empfehlungen); echte Treffer = Zähler − Empfehlungen.
function treffer(html: string): number | null {
  const m = html.match(/>\s*([\d.]+)\s*(?:<!--\s*-->\s*)*Jobs?\s*<\/span>/i);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "")) - (html.match(/data-testid="promoted-job-offer-item"/gi) || []).length;
}
const eigene = (html: string) => (html.match(/data-testid="job-offer-item"/gi) || []).length;

// Blättern: <nav aria-label="Seitennummerierung"> mit <a aria-label="Nächste Seite" href="/jobs-suchen?…&page=N">
// (12 Treffer je Seite); auf der letzten Seite ist der Pfeil ein <span> ohne Link. Der Zähler ist auf Seite 1 nur eine
// Schätzung, die Navigation kann daher eine Seite zu viel nennen; eine leere Folgeseite beendet die Liste in public.ts.
export function weiter(html: string, base: string): string | null {
  const u = new URL(base), seite = Number(u.searchParams.get("page") || 1), gesamt = treffer(html);
  // Alle echten Treffer schon auf Seite 1: die übrigen Seiten der Navigation zählen nur Empfehlungen.
  if (seite === 1 && gesamt !== null && eigene(html) >= gesamt) return null;
  const nav = html.match(/<nav\b[^>]*aria-label="Seitennummerierung"[^>]*>([\s\S]*?)<\/nav>/i)?.[1];
  const pfeil = nav?.match(/<a\b[^>]*aria-label="Nächste Seite"[^>]*>/i)?.[0];
  if (pfeil) {
    const next = new URL(attr(pfeil, "href"), base);
    next.hash = "";
    return next.host === u.host ? next.href : base;
  }
  if (nav || seite !== 1 || gesamt === null || eigene(html) >= gesamt) return null;
  // Ohne Navigation, aber mit mehr Treffern als gezeigt: Seite 2 über den Seitenparameter der Navigation.
  u.searchParams.set("page", "2");
  return u.href;
}

// Leermeldung: Zähler „0 Jobs“ (abzüglich bezahlter Empfehlungen) und data-testid="empty-state" ohne eigene Treffer.
// „Kein passender Job dabei?“ (empty-state) steht auch unter vollen Listen und genügt allein nie.
// Geprüft: „Werkstudent IT“ in 100 km zeigte auf Seite 1 nur 16 Empfehlungen bei Zähler 16, Seite 2 dann „0 Jobs“.
export function leer(html: string): boolean {
  return eigene(html) === 0 && treffer(html) === 0 && /data-testid="empty-state"/i.test(html);
}
