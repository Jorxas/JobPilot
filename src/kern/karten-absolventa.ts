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

// Blättern: <a rel="next" aria-label="Nächste Seite" href="…?page=N…"> unter der Liste (20 Anzeigen je Seite, Zahl im
// Kopf „50 Jobs“); auf der letzten Seite und bei nur einer Seite fehlt er. Suchanfragen leitet Absolventa oft auf
// Bereichsseiten um (/jobs/channel/<bereich>/stadt/<ort>?…); der Link gilt dann für diese Adresse.
export function weiter(html: string, base: string): string | null {
  const a = html.match(/<a\b[^>]*\brel=["']next["'][^>]*>/i)?.[0];
  const href = a ? attr(a, "href") : "";
  if (!href) return null;
  const u = new URL(href, base);
  return u.host === new URL(base).host ? u.href : null;
}

// Leermeldung: „Leider konnten wir keine freien Stellen zu deiner Suche finden.“ und keine Karte; die darunter
// vorgeschlagenen Umkreise und Bereiche sind keine Treffer.
export function leer(html: string): boolean {
  return !/\bid=["']teaser_job_offer_\d+["']/.test(html) && /Leider konnten wir keine freien Stellen zu deiner Suche finden/i.test(html);
}
