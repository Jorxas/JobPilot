// Trefferliste von JobTeaser. Die allgemeine Suche /de/job-offers ist hinter einer Cloudflare-Prüfung
// (HTTP 403, cf-mitigated: challenge); öffentlich und laut robots.txt ausdrücklich erlaubt
// („Allow: /*/job-search/*“, „Allow: /*?page=*“) sind die serverseitig gerenderten Übersichtsseiten
// /de/job-search/<vertrag>-<ort>, z. B. /de/job-search/werkstudent-frankfurt (20 Karten je Seite).
// Karte: data-testid="jobad-card", Titel im <h3><a href="/de/job-offers/<uuid>-…">, Firma in
// data-testid="jobad-card-company-name", Ort in data-testid="jobad-card-location" („Frankfurt am Main, Germany“).
// Kein Datum und keine Beschreibung auf der Karte; die Detailseite liefert JobPosting-JSON-LD.
import { cards, text, type Karte } from "./karten-hilfe";

// „Mehrere angebotene Orte“ ist keine Ortsangabe: leer lassen, damit die Umkreisprüfung nichts errät
// und die Detailseite (jobLocation) den Ort nachliefern kann.
const KEIN_ORT = /^(mehrere angebotene orte|multiple locations|plusieurs lieux|several locations)$/i;

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const card of cards(html, /data-testid=["']jobad-card["']/i)) {
    const link = card.match(/<h3\b[^>]*>\s*<a\b[^>]*href=["']([^"']*\/job-offers\/[0-9a-f]{8}-[0-9a-f-]{27}[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const title = text(link[2]);
    if (!title) continue;
    const company = text(card.match(/data-testid=["']jobad-card-company-name["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    const ort = text(card.match(/data-testid=["']jobad-card-location["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
    out.push({ title, company: company || null, location: ort && !KEIN_ORT.test(ort) ? ort : null, url: link[1] });
  }
  return out;
}
