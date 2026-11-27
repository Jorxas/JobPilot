// Trefferliste des THM-Stellenmarkts (Jobware-Partnerportal th-mittelhessen.al.sites.jobware.net):
// klassisches Jobware-Vorlagen-HTML, je Stelle <div class="jwtpl-hili-item"> mit itemTitel, itemLink,
// itemCompany, itemLocation und itemDate (TT.MM.JJJJ). Anzeigenlinks stehen teils mit http://;
// public.ts hebt sie auf HTTPS an. Hinweis: robots.txt dieses Hosts sperrt alle Pfade (Disallow: /).
import { attr, byClass, cards, type Karte } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const card of cards(html, /<div\b[^>]*class=["'][^"']*\bjwtpl-hili-item(?![\w-])/i)) {
    const link = card.match(/<a\b[^>]*class=["'][^"']*jwtpl-hili-itemLink[^"']*["'][^>]*>/i)?.[0] || "";
    const url = attr(link, "href");
    if (!url) continue;
    const date = byClass(card, "jwtpl-hili-itemDate", "span").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    out.push({
      title: byClass(card, "jwtpl-hili-itemTitel", "span"),
      company: byClass(card, "jwtpl-hili-itemCompany", "span") || null,
      location: byClass(card, "jwtpl-hili-itemLocation", "span") || null,
      url,
      publishedAt: date ? `${date[3]}-${date[2]}-${date[1]}` : undefined,
    });
  }
  return out;
}

// Gesamtzahl der Treffer aus data-jwtpl-hili-rowCnt (Überschrift „17 Jobs in und um Gießen“).
function gesamt(html: string): number | null {
  const tag = html.match(/<div\b[^>]*\bdata-jwtpl-hili-rowCnt=["']\d+["'][^>]*>/i)?.[0];
  return tag ? Number(attr(tag, "data-jwtpl-hili-rowCnt")) : null;
}

// Blättern: Pager jwtpl-hilipage-pager, 10 Treffer je Seite. Der Vorwärtspfeil heißt pagerSpecialGoForwardLink und führt
// auf ?jmyc=3&jssi=<Suchsitzung>&jssc=<Versatz>#hili (geprüft am 27. November 2026: ohne Cookie abrufbar, jede Antwort
// nennt eine neue Sitzung); auf der letzten Seite steht pagerSpecialGoForwardNullLink, der auf die eigene Seite zeigt.
export function weiter(html: string, base: string): string | null {
  const pfeil = html.match(/<a\b[^>]*class=["'][^"']*\bjwtpl-hilipage-pagerSpecialGoForwardLink\b[^"']*["'][^>]*>/i)?.[0];
  if (pfeil) {
    const u = new URL(attr(pfeil, "href"), base);
    u.hash = "";
    return u.host === new URL(base).host ? u.href : base;
  }
  if (/\bjwtpl-hilipage-pagerSpecialGoForwardNullLink\b/i.test(html)) return null;
  // Ohne Pager: mehr Treffer als Karten heißt unvollständig (eigene Adresse, siehe scanPublicSource), sonst Listenende.
  const n = gesamt(html);
  return n !== null && n > cards(html, /<div\b[^>]*class=["'][^"']*\bjwtpl-hili-item(?![\w-])/i).length ? base : null;
}

// Leermeldung: rowCnt="0" mit „Es wurde kein passender Job gefunden“ bzw. <div class="jwtpl-hili-noResult"> ohne Karten.
export function leer(html: string): boolean {
  return gesamt(html) === 0
    && !/class=["'][^"']*\bjwtpl-hili-item(?![\w-])/i.test(html)
    && (/<div\b[^>]*class=["'][^"']*\bjwtpl-hili-noResult\b/i.test(html) || /<h3\b[^>]*jwtpl-hili-headline[^>]*>[\s\S]{0,200}?kein passender Job gefunden/i.test(html));
}
