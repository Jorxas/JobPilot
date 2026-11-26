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
