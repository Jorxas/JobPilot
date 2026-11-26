// Trefferliste von Absolventa (/jobs?text=…&location=…&radius=…): je Anzeige ein Link mit id="teaser_job_offer_<nummer>".
// Titel im ersten h2, Firma im kleinen Text darunter (sonst Logo-Alternativtext), Ort im Eintrag mit dem Symbol „Standort“.
import { type Karte, attr, cards, text } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  try {
    return cards(html, /<a\b[^>]*\bid=["']teaser_job_offer_\d+["'][^>]*>/i).map(stueck => {
      const ende = stueck.search(/<\/a>/i), karte = ende > 0 ? stueck.slice(0, ende) : stueck, kopf = karte.match(/^<a\b[^>]*>/i)?.[0] || "";
      const logo = attr(karte.match(/<img\b[^>]*>/i)?.[0] || "", "alt").replace(/\s+Logo$/i, "");
      const firma = text(karte.match(/<span\b[^>]*class=["'][^"']*\bt-small\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) || logo;
      const ort = text(karte.match(/<title\b[^>]*>\s*Standort\s*<\/title>[\s\S]*?<\/svg>([\s\S]*?)<\/li>/i)?.[1]);
      return { title: text(karte.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]), url: attr(kopf, "href"), company: firma || null, location: ort || null };
    }).filter(k => k.title && /\/stellenangebote\/\d+/.test(k.url));
  } catch { return []; }
}
