// Trefferliste von stellenanzeigen.de (Next.js). Die Treffer stehen zweimal in der Antwort:
// im React-Server-Payload (self.__next_f.push) unter jobAdSearchResultModel.jobAds, dort mit
// Postleitzahl je Ort (regions[].zip), und als serverseitig gerenderte Karten (class="jat-wrapper", data-jobid).
// Der Payload hat Vorrang; die Karten dienen als Ersatz, falls sich der Payload ändert.
import { byClass, cards, findObjects, jsonAssignment, str, text, type Karte } from "./karten-hilfe";

// Setzt die Textstücke aus self.__next_f.push([1,"..."]) wieder zusammen.
function payload(html: string): string {
  const key = "self.__next_f.push(";
  let out = "", at = 0;
  while ((at = html.indexOf(key, at)) >= 0) {
    const end = html.indexOf("</script>", at);
    if (end < 0) break;
    try {
      const chunk = JSON.parse(html.slice(at + key.length, html.lastIndexOf(")", end)));
      if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === "string") out += chunk[1];
    } catch { /* unlesbares Teilstück überspringen */ }
    at = end;
  }
  return out;
}

function ausPayload(html: string): Karte[] {
  const model = jsonAssignment(payload(html), '"jobAdSearchResultModel":{');
  if (!model) return [];
  return findObjects(model, o => typeof o.positionTitle === "string" && typeof o.link === "string").map(ad => {
    const regions = Array.isArray(ad.regions) ? ad.regions as Record<string, unknown>[] : [];
    const orte = [...new Set(regions.map(r => [str(r.zip), str(r.region)].filter(Boolean).join(" ")).filter(Boolean))];
    return {
      title: str(ad.positionTitle),
      company: str(ad.companyName) || null,
      location: orte.slice(0, 3).join(", ") || str(ad.region) || null,
      url: str(ad.link),
      publishedAt: str(ad.originalStartDate) || str(ad.startDate) || undefined,
    };
  });
}

function ausKarten(html: string): Karte[] {
  return cards(html, /<div\b[^>]*\bdata-jobid=["'][^"']+["']/i).map(card => {
    const link = card.match(/<a\b[^>]*class=["'][^"']*jat-position-title-link[^"']*["'][^>]*>[\s\S]*?<\/a>/i)?.[0] || "";
    return {
      title: text(link),
      company: byClass(card, "jat-company-name-text", "span") || null,
      location: byClass(card, "jat-locations-text", "span") || null,
      url: link.match(/\bhref=["']([^"']+)["']/i)?.[1] || "",
    };
  }).filter(k => k.title && k.url);
}

export function karten(html: string, _base: string): Karte[] {
  const own = ausPayload(html);
  return own.length ? own : ausKarten(html);
}
