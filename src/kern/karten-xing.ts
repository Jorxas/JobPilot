// Trefferliste von XING (/jobs/search/ki): Apollo-Zwischenspeicher im Skript runtime-config, sonst die Karten im HTML.
// Die Liste nennt nur die Stadt, keine Postleitzahl; die Detailseite trägt ein JobPosting.
import { type Karte, attr, cards, jsonAssignment, str, text } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});

function ausApollo(html: string): Karte[] {
  // window.crate ist kein reines JSON (enthält undefined); APOLLO_STATE darin schon.
  const state = o(jsonAssignment(html, '"APOLLO_STATE":'));
  const query = Object.entries(o(state.ROOT_QUERY)).find(([k]) => k.startsWith("jobSearchByQuery"))?.[1];
  // Reihenfolge der Trefferliste, sonst alle zwischengespeicherten Anzeigen.
  const refs = (Array.isArray(o(query).collection) ? o(query).collection as unknown[] : []).map(c => str(o(o(c).jobDetail).__ref)).filter(Boolean);
  const jobs = refs.length ? refs.map(r => o(state[r])) : Object.values(state).map(o).filter(v => v.__typename === "VisibleJob");
  return jobs.filter(j => j.__typename === "VisibleJob").map(j => ({
    title: str(j.title), url: str(j.url) || (str(j.slug) ? "/jobs/" + str(j.slug) : ""),
    company: str(o(j.companyInfo).companyNameOverride) || str(o(state[str(o(o(j.companyInfo).company).__ref)]).companyName) || null,
    location: str(o(j.location).city) || null, publishedAt: str(j.refreshedAt) || undefined,
  })).filter(k => k.title && k.url);
}

function ausHtml(html: string): Karte[] {
  return cards(html, /<article\b[^>]*data-testid=["']job-search-result["']/i).map(stueck => {
    const ende = stueck.search(/<\/article>/i), card = ende > 0 ? stueck.slice(0, ende) : stueck;
    const absatz = [...card.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => text(m[1]));
    return { title: text(card.match(/<h2\b[^>]*data-testid=["']job-teaser-list-title["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]), url: attr(card.match(/<a\b[^>]*href=["'][^"']*\/jobs\/[^"']+["'][^>]*>/i)?.[0] || "", "href"), company: absatz[0] || null, location: absatz[1]?.replace(/\s*\+\s*\d+\s*weitere.*$/i, "") || null };
  }).filter(k => k.title && k.url);
}

export function karten(html: string, _base: string): Karte[] {
  try { const liste = ausApollo(html); return liste.length ? liste : ausHtml(html); } catch { return []; }
}

// Blättern (geprüft am 27. November 2026): Im Browser lädt „Mehr anzeigen“ per Skript nach; serverseitig liefert ?page=N
// dieselbe Liste ab offset (N-1)·20 (Schlüssel jobSearchByQuery({…"limit":20,"offset":20…}) im Zwischenspeicher).
// boundedTotal nennt die Gesamtzahl: bis 1000 genau („EXACT“), darüber nur „AT_LEAST“ 1000.
function suche(html: string) {
  const state = o(jsonAssignment(html, '"APOLLO_STATE":'));
  const eintrag = Object.entries(o(state.ROOT_QUERY)).find(([k]) => k.startsWith("jobSearchByQuery"));
  if (!eintrag) return undefined;
  let args: J = {};
  try { args = o(JSON.parse(eintrag[0].slice(eintrag[0].indexOf("(") + 1, eintrag[0].lastIndexOf(")")))); } catch { /* Schlüssel ohne lesbare Argumente */ }
  const wert = o(eintrag[1]), gesamt = o(wert.boundedTotal);
  return {
    limit: typeof args.limit === "number" && args.limit > 0 ? args.limit : 20,
    offset: typeof args.offset === "number" ? args.offset : 0,
    anzahl: Array.isArray(wert.collection) ? wert.collection.length : 0,
    gesamt: gesamt.countType === "EXACT" && typeof gesamt.total === "number" ? gesamt.total : undefined,
  };
}

// Überschrift „17 Jobs gefunden“; „999+ Jobs gefunden“ ist keine genaue Zahl.
function treffer(html: string): number | undefined {
  const kopf = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<!--[\s\S]*?-->/g, "")).match(/^(\d[\d.]*|Keine)(\+?)\s+Jobs?\s+gefunden/i);
  return !kopf || kopf[2] ? undefined : /^keine$/i.test(kopf[1]) ? 0 : Number(kopf[1].replace(/\./g, ""));
}

export function weiter(html: string, base: string): string | null {
  const s = suche(html), u = new URL(base);
  let seite: number;
  if (s) {
    // Eine kürzere Seite als limit oder die erreichte genaue Gesamtzahl beendet die Liste.
    if (s.anzahl < s.limit || (s.gesamt !== undefined && s.offset + s.anzahl >= s.gesamt)) return null;
    seite = Math.floor(s.offset / s.limit) + 1;
  } else {
    seite = Number(u.searchParams.get("page")) || 1;
    const gesamt = treffer(html);
    if (gesamt !== undefined && (seite - 1) * 20 + ausHtml(html).length >= gesamt) return null;
  }
  u.searchParams.set("page", String(seite + 1));
  return u.href;
}

// Leer nur ohne Karte und mit ausdrücklich 0 Treffern (boundedTotal 0 oder „0 Jobs gefunden“). XING ergänzt semantisch
// ähnliche Anzeigen: Ein Unsinnsbegriff ergab am 27. November 2026 noch „3 Jobs gefunden“, keine Leermeldung.
export function leer(html: string): boolean {
  const s = suche(html), ohneKarte = s ? s.anzahl === 0 : !/data-testid=["']job-search-result["']/i.test(html);
  return ohneKarte && (s?.gesamt === 0 || treffer(html) === 0);
}
