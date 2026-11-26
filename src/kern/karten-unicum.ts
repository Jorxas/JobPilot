// Trefferliste des UNICUM Karrierezentrums (Drupal „recruiter“): je Treffer ein <article class="… node-job …">
// mit h2.node__title > a (Titel, Anzeigenlink), .recruiter-company-profile-job-organization (Firma),
// .location (Anschrift oder Ort, dahinter „Distanz: … km“) und span.date (TT.MM.JJJJ).
import { type Karte, byClass, text } from "./karten-hilfe";

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const card of html.split(/<article\b(?=[^>]*class="[^"]*\bnode-job\b)/i).slice(1)) {
    const node = card.slice(0, card.search(/<\/article>/i) >>> 0);
    const link = node.match(/<h2\b[^>]*class="[^"]*node__title[^"]*"[^>]*>\s*<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link || !/\/job\/[^/?#]+/.test(link[1])) continue;
    const title = text(link[2]);
    if (!title) continue;
    // Ort ohne Entfernungsangabe; aus einer Anschrift „Straße, PLZ Ort“ bleibt „PLZ Ort“ für die Umkreisprüfung.
    const ortHtml = node.match(/<div\b[^>]*class="[^"]*\blocation\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    const ort = text(ortHtml.replace(/<span\b[^>]*recruiter-geo-job-distance[\s\S]*?<\/span>/i, "")).replace(/\s*-\s*$/, "").trim();
    const plzOrt = ort.match(/(?:^|,\s*)(\d{5}\s+[^,]+)$/)?.[1];
    const datum = byClass(node, "date", "span").match(/(\d{2})\.(\d{2})\.(\d{4})/);
    out.push({
      title,
      company: byClass(node, "recruiter-company-profile-job-organization", "span") || null,
      location: plzOrt || ort || null,
      url: link[1],
      publishedAt: datum ? `${datum[3]}-${datum[2]}-${datum[1]}` : undefined,
    });
  }
  return out;
}
