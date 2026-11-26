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
