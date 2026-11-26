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
