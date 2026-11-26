// Trefferliste von stellenwerk (SvelteKit, je Hochschulstandort ein Portal, Suche über ?_q=).
// Karten: <a href="/<portal>/<slug>-<JJMMTT>-<id>"> mit fettem Titel und der Zeile „Firma · Ort“.
// Die eingebetteten Seitendaten (kit.start … data) liefern je Anzeige Einsatzort mit Postleitzahl,
// Veröffentlichungsdatum und Beschreibung; zugeordnet wird ausschließlich über den Slug der Karte.
import { type Karte, text } from "./karten-hilfe";

// Objektliteral ab Position i (beginnt mit „{“), Zeichenketten berücksichtigt.
function objektAb(src: string, i: number): string {
  if (src[i] !== "{") return "";
  let depth = 0, inString = false, escaped = false;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return src.slice(i, k + 1);
  }
  return "";
}
// JS-Zeichenkette aus den Seitendaten (devalue schreibt JSON-kompatible Literale).
function zeichenkette(raw: string | undefined): string {
  if (raw === undefined) return "";
  try { return JSON.parse(`"${raw}"`); } catch { return ""; }
}
const feld = (seg: string, name: string) => zeichenkette(seg.match(new RegExp(`\\b${name}:"((?:[^"\\\\]|\\\\.)*)"`))?.[1]);

// Angaben aus den Seitendaten zu einem Slug: Abschnitt bis zur nächsten Anzeige (attributes:{owner:).
function daten(html: string, slug: string): { location?: string; publishedAt?: string; description?: string } {
  const at = html.indexOf(`slug:"${slug}"`, Math.max(0, html.indexOf("kit.start")));
  if (at < 0) return {};
  const next = html.indexOf("attributes:{owner:", at), seg = html.slice(at, next < 0 ? undefined : next);
  const p = seg.indexOf("placeOfEmployment:"), ort = p < 0 ? "" : objektAb(seg, p + "placeOfEmployment:".length);
  const plz = ort.match(/\bpostalCode:"(\d{5})"/)?.[1] || "", stadt = feld(ort, "city"), label = feld(ort, "label");
  return {
    location: stadt ? [plz, stadt].filter(Boolean).join(" ") : label || undefined,
    publishedAt: feld(seg, "releasedAt") || undefined,
    description: feld(seg, "description") || undefined,
  };
}

export function karten(html: string, _base: string): Karte[] {
  const out: Karte[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href="(\/[a-z0-9-]+\/([a-z0-9-]+-\d{6}-\d+))"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const [, href, slug, inner] = m;
    const title = text(inner.match(/<p\b[^>]*class="[^"]*font-bold[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
    if (!title) continue;
    // Zeile „Firma · Ort“: der Mittelpunkt steht in einem eigenen <span>.
    const trenner = /<span\b[^>]*>\s*·\s*<\/span>/i;
    const zeile = [...inner.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(z => z[1]).find(z => trenner.test(z)) || "";
    const [firma, kartenOrt] = zeile ? zeile.split(trenner).map(t => text(t)) : [];
    const d = daten(html, slug);
    // „Raum Frankfurt am Main“ bezeichnet das Portalgebiet; für die Umkreisprüfung zählt der Ortsname.
    out.push({ title, company: firma || null, location: d.location || kartenOrt?.replace(/^Raum\s+/i, "") || null, url: href, publishedAt: d.publishedAt, description: d.description });
  }
  return out;
}
