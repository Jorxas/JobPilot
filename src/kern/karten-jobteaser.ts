// Trefferliste von JobTeaser. Die allgemeine Suche /de/job-offers ist hinter einer Cloudflare-Prüfung
// (HTTP 403, cf-mitigated: challenge); öffentlich und laut robots.txt ausdrücklich erlaubt
// („Allow: /*/job-search/*“, „Allow: /*?page=*“) sind die serverseitig gerenderten Übersichtsseiten
// /de/job-search/<vertrag>-<ort>, z. B. /de/job-search/werkstudent-frankfurt (20 Karten je Seite).
// Karte: data-testid="jobad-card", Titel im <h3><a href="/de/job-offers/<uuid>-…">, Firma in
// data-testid="jobad-card-company-name", Ort in data-testid="jobad-card-location" („Frankfurt am Main, Germany“).
// Kein Datum und keine Beschreibung auf der Karte; die Detailseite liefert JobPosting-JSON-LD.
import { attr, cards, text, type Karte } from "./karten-hilfe";

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

// Blättern: <nav aria-label="Paginierung"> mit <a aria-label="Zur nächsten Seite gehen" href="…?page=N">; auf der
// letzten Seite ist es ein <button … disabled>. 20 Karten je Seite, Gesamtzahl in den Seitendaten (totalCount).
// Stand 27. November 2026: Der Server liefert für ?page=2 und folgende dieselben ersten 20 Karten (jobAd.position 0–19),
// obwohl die Paginierung die Seite kennt. Auch der Next.js-Router des Browsers bekommt nichts anderes: die RSC-Antwort auf
// ?page=2 (Kopf RSC: 1, wie beim Klick auf „Zur nächsten Seite gehen“) enthielt ebenfalls die Positionen 0–19. Ein
// Nachladen per Skript gibt es auf diesen Seiten nicht (InteractivePage, Pagination: nur Links; Algolia und Suchproxy aus);
// die vollständige Suche /de/job-offers steht hinter Cloudflare. Die Liste ist öffentlich also nur bis Position 19 lesbar.
// scanPublicSource erkennt die Wiederholung und meldet die Quelle dann ehrlich als teilweise gelesen. Folgt JobTeaser
// eines Tages richtig, liest dieselbe Schleife alle Seiten.
// Kartenpositionen aus den Seitendaten (jobAd.position, im RSC-Payload vor "premium"); leer, wenn die Seite sie nicht nennt.
function positionen(html: string): number[] {
  return [...html.matchAll(/\\?"position\\?":(\d+),\\?"premium\\?"/g)].map(m => Number(m[1]));
}

export function weiter(html: string, base: string): string | null {
  // Eine Folgeseite, deren Karten wieder vorn beginnen, hat der Server nicht geblättert: nie als Listenende werten
  // (eigene Adresse: scanPublicSource bricht ohne weitere Anfrage ab, auch wenn zufällig eine neue Anzeige dabei war).
  const seite = Number(new URL(base).searchParams.get("page")) || 1, pos = positionen(html);
  if (seite > 1 && pos.length && Math.min(...pos) < (seite - 1) * 20) return base;
  const a = html.match(/<a\b[^>]*aria-label=["']Zur nächsten Seite gehen["'][^>]*>/i)?.[0];
  const href = a ? attr(a, "href") : "";
  if (!href) return null;
  const u = new URL(href, base);
  return u.host === new URL(base).host ? u.href : null;
}

// Leer nur bei ausdrücklicher Null ohne eine Karte: Seitendaten totalCount: 0 oder „zurzeit 0 offene Stellen“.
// Nicht vorhandene Übersichten (z. B. /de/job-search/werkstudent-giessen) beantwortet JobTeaser mit HTTP 404.
export function leer(html: string): boolean {
  if (/data-testid=["']jobad-card["']/i.test(html)) return false;
  return /\\?"countPerPage\\?":\d+[^{}]*?\\?"totalCount\\?":0\b/.test(html) || /finden Sie zurzeit 0 offene Stellen/i.test(html);
}
