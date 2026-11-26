// Trefferliste von get in IT (/jobsuche): Redux-Zustand in __NEXT_DATA__, sonst die Karten mit data-job-id im HTML.
// Die Liste nennt nur Städte (oft mehrere), keine Postleitzahl. Eine Stichwortsuche gibt es nicht; gefiltert wird
// über ?city=<Kennung>&radius=<km>. Steht die gesuchte Stadt unter den Einsatzorten, kommt sie nach vorn.
import { type Karte, attr, byClass, cards, jsonScript, str, text } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function ausZustand(html: string): Karte[] {
  const daten = o(jsonScript(html, "__NEXT_DATA__")), props = o(daten.props);
  const gesucht = new Set(liste(o(o(o(props.pageProps).pageProps).filters).city).map(c => str(o(c).name)).filter(Boolean));
  return liste(o(o(props.initialState).jobSearchJobs).jobs).map(o).map(j => {
    const orte = liste(j.locations).map(l => str(o(l).name)).filter(Boolean);
    orte.sort((a, b) => Number(gesucht.has(b)) - Number(gesucht.has(a)));
    return { title: str(j.title), url: str(j.url), company: str(o(j.company).title) || null, location: orte.join(", ") || null };
  }).filter(k => k.title && /^\/jobsuche\/p\d+$/.test(k.url));
}

function ausHtml(html: string): Karte[] {
  return cards(html, /<a\b[^>]*\bdata-job-id=["']\d+["'][^>]*>/i).map(card => {
    const kopf = card.match(/^<a\b[^>]*>/i)?.[0] || "", id = attr(kopf, "data-job-id");
    card = card.slice(0, card.search(/<\/a>/i) + 1 || undefined);
    return {
      title: byClass(card, "jobTitle"), url: /^\d+$/.test(id) ? "/jobsuche/p" + id : "",
      company: text(card.match(/<div\b[^>]*class=["'][^"']*\bfs-15\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || attr(card.match(/<img\b[^>]*>/i)?.[0] || "", "alt") || null,
      // „Würzburg +8“: nur der erste Ort ist im HTML sichtbar.
      location: text(card.match(/class=["'][^"']*IconLocation_[^"']*["'][\s\S]*?<div\b[^>]*>([\s\S]*?)<\/div>/i)?.[1]).replace(/\s*\+\s*\d+$/, "") || null,
    };
  }).filter(k => k.title && k.url);
}

export function karten(html: string, _base: string): Karte[] {
  try { const zustand = ausZustand(html); return zustand.length ? zustand : ausHtml(html); } catch { return []; }
}
