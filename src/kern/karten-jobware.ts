// Trefferliste von www.jobware.de (Qwik, serverseitig gerendert): je Stelle ein <article class="card">
// mit job-card__title-wrapper (h2), job-card__advertiser-name, Ortsangabe hinter dem verborgenen „in“,
// <time dateTime> und dem Detaillink mit data-job-detail-link. Postleitzahlen stehen nicht in der Karte.
import { attr, cards, text, type Karte } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const card of cards(html, /<article\b[^>]*class=["'][^"']*\bcard\b/i)) {
    const link = card.match(/<a\b[^>]*\bdata-job-detail-link\b[^>]*>/i)?.[0] || "";
    const url = attr(link, "href");
    if (!url) continue;
    const title = text(card.match(/class=["'][^"']*job-card__title-wrapper[^"']*["'][^>]*>\s*<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]);
    const company = text(card.match(/class=["'][^"']*job-card__advertiser-name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const location = text(card.match(/nrmdy-visually-hidden["'][^>]*>\s*in\s*<\/span>([\s\S]*?)<\/span>/i)?.[1]);
    out.push({ title, company: company || null, location: location || null, url, publishedAt: card.match(/\bdateTime=["']([^"']+)["']/i)?.[1] });
  }
  return out;
}

// Unterzeile „949 Stellenangebote gefunden.“ beziehungsweise „Keine Stellenangebote gefunden.“
function gefunden(html: string): number | undefined {
  const m = html.match(/>\s*(\d[\d.]*|Keine)\s+Stellenangebote?\s+gefunden\b/i);
  return !m ? undefined : /^keine$/i.test(m[1]) ? 0 : Number(m[1].replace(/\./g, ""));
}

// Blättern (geprüft am 27. November 2026): ?page=N liefert serverseitig Seite N mit 20 Karten. Die Seitennavigation
// <nav data-testid="pagination"> besteht aus Knöpfen ohne Link; der aktuelle trägt aria-current="true" und
// aria-label="Page 2 of 48". Bei nur einer Seite fehlt die Navigation, dann entscheidet die gefundene Anzahl.
export function weiter(html: string, base: string): string | null {
  const u = new URL(base);
  let seite = Number(u.searchParams.get("page")) || 1;
  const aktuell = (html.match(/<button\b[^>]*aria-current=["']true["'][^>]*>/gi) || [])
    .map(tag => attr(tag, "aria-label").match(/^(?:Page|Seite)\s+(\d+)\s+(?:of|von)\s+(\d+)$/i)).find(Boolean);
  if (aktuell) {
    seite = Number(aktuell[1]);
    if (seite >= Number(aktuell[2])) return null;
  } else {
    const gesamt = gefunden(html);
    if (gesamt !== undefined && (seite - 1) * 20 + karten(html, base).length >= gesamt) return null;
  }
  u.searchParams.set("page", String(seite + 1));
  return u.href;
}

// Leer: Bereich empty-resultlist („Wir haben leider keine freien Stellen zu Ihrer Suche gefunden.“) oder
// „Keine Stellenangebote gefunden.“, jeweils ohne Anzeigenlink.
export function leer(html: string): boolean {
  return !/\bdata-job-detail-link\b/i.test(html) && (/class=["'][^"']*\bempty-resultlist\b/i.test(html) || gefunden(html) === 0);
}
