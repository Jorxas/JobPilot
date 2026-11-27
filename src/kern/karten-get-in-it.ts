// Trefferliste von get in IT (/jobsuche): Redux-Zustand in __NEXT_DATA__, sonst die Karten mit data-job-id im HTML.
// Die Liste nennt nur Städte (oft mehrere), keine Postleitzahl. Eine Stichwortsuche gibt es nicht; gefiltert wird
// über ?city=<Kennung>&radius=<km>. Steht die gesuchte Stadt unter den Einsatzorten, kommt sie nach vorn.
// Ab der zweiten Seite liest JobPilot die Schnittstelle, die auch „Mehr anzeigen“ der Seite benutzt (siehe weiter):
// /api/v2/open/job/search antwortet mit JSON { total, items: { results } } in derselben Form wie der Redux-Zustand.
import { type Karte, attr, byClass, cards, jsonScript, str, text } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Schnittstelle und Seitengröße des Seitenskripts (Konstante eS = 39 im Modul der Seite /jobsuche, geprüft am 27. November 2026).
const SCHNITTSTELLE = "https://www.get-in-it.de/api/v2/open/job/search";
const SEITE = 39;

// Eine Anzeige aus dem Redux-Zustand oder der Schnittstellenantwort (gleiche Felder: title, url, company.title, locations).
function karte(j: J, gesucht: Set<string>): Karte {
  const orte = liste(j.locations).map(l => str(o(l).name)).filter(Boolean);
  orte.sort((a, b) => Number(gesucht.has(b)) - Number(gesucht.has(a)));
  return { title: str(j.title), url: str(j.url), company: str(o(j.company).title) || null, location: orte.join(", ") || null };
}
const istAnzeige = (k: Karte) => !!k.title && /^\/jobsuche\/p\d+$/.test(k.url);

function ausZustand(html: string): Karte[] {
  const daten = o(jsonScript(html, "__NEXT_DATA__")), props = o(daten.props);
  const gesucht = new Set(liste(o(o(o(props.pageProps).pageProps).filters).city).map(c => str(o(c).name)).filter(Boolean));
  return liste(o(o(props.initialState).jobSearchJobs).jobs).map(o).map(j => karte(j, gesucht)).filter(istAnzeige);
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

// Antwort der Schnittstelle: total (alle Treffer der Suche) und items.results (diese Seite); sonst null (HTML-Seite).
function antwort(body: string): { gesamt: number; anzeigen: J[] } | null {
  if (!/^\s*\{/.test(body)) return null;
  try {
    const j = o(JSON.parse(body)), r = o(j.items).results;
    return typeof j.total === "number" && Array.isArray(r) ? { gesamt: j.total, anzeigen: r.map(o) } : null;
  } catch { return null; }
}

export function karten(html: string, _base: string): Karte[] {
  try {
    const api = antwort(html);
    if (api) return api.anzeigen.map(j => karte(j, new Set())).filter(istAnzeige);
    const zustand = ausZustand(html);
    return zustand.length ? zustand : ausHtml(html);
  } catch { return []; }
}

// Stand der Liste aus dem Redux-Zustand: jobsCount (alle Treffer), start und die gezeigten Anzeigen.
// pageProps.start ist die Seitennummer des Seitenskripts (0 bei der Serverseite); die Schnittstelle zählt start = Seite × 39.
function stand(html: string): { gesamt: number; gezeigt: number; fehler: unknown; laedt: unknown; filter: J; folgeStart: number } | null {
  const props = o(o(jsonScript(html, "__NEXT_DATA__")).props), zustand = o(o(props.initialState).jobSearchJobs), seite = o(o(props.pageProps).pageProps);
  if (typeof zustand.jobsCount !== "number" || !Array.isArray(zustand.jobs)) return null;
  const nummer = Number(seite.start) || 0;
  return { gesamt: zustand.jobsCount, gezeigt: nummer * SEITE + zustand.jobs.length, fehler: zustand.errorCode, laedt: zustand.loading, filter: o(seite.filters), folgeStart: (nummer + 1) * SEITE };
}

// Adresse der Schnittstelle so, wie das Seitenskript sie baut (eF.buildParameters, axios-Parameter): Listenfilter als
// filter[<name>][]=…, Umkreis filter[city][radius], je Stadt filter[city][city][i][lon|lat], dann start und limit.
// Ohne Stadt mit Koordinaten (bundesweite Liste ohne Ortsbezug) kein Blättern: null.
function schnittstelle(filter: J, start: number): string | null {
  const staedte = liste(filter.city).map(o).filter(c => typeof c.latitude === "number" && typeof c.longitude === "number");
  if (!staedte.length) return null;
  const teile: string[] = [];
  const wert = (v: unknown) => encodeURIComponent(v && typeof v === "object" ? str(o(v).id) : String(v));
  const feld = (name: string, v: unknown) => {
    if (Array.isArray(v)) for (const x of v) teile.push(`${name}[]=${wert(x)}`);
    else if (v !== undefined && v !== null && v !== "") teile.push(`${name}=${wert(v)}`);
  };
  feld("filter[company]", filter.company);
  feld("filter[state]", filter.state);
  feld("filter[degree]", filter.degree);
  feld("filter[thematic_priority]", filter.thematicPriority);
  feld("filter[study_subject]", filter.studySubject);
  feld("filter[city][radius]", filter.radius);
  feld("filter[homeOffice]", filter.homeOffice);
  staedte.forEach((c, i) => teile.push(`filter[city][city][${i}][lon]=${c.longitude}`, `filter[city][city][${i}][lat]=${c.latitude}`));
  teile.push(`start=${start}`, `limit=${SEITE}`);
  return SCHNITTSTELLE + "?" + teile.join("&");
}

// Blättern (geprüft am 27. November 2026): Die Seite /jobsuche zeigt 39 Treffer und übergeht ?start; „Mehr anzeigen“
// lädt die nächsten 39 über GET /api/v2/open/job/search mit denselben Filtern und start = 39, 78, … (Seitenskript).
// Die Schnittstelle ist öffentlich, ohne Anmeldung und ohne Cookie; sie verlangt nur den Kopf
// X-Requested-With: XMLHttpRequest, den das Seitenskript mitsendet (ohne ihn HTTP 400 „API calls MUST have the header
// `X-Requested-With: XMLHttpRequest` set.“), siehe kopfzeilen. Gießen, 100 km: 1062 Treffer, 28 Abrufe, letzte Seite 9.
// Ende: start + limit erreicht total. Ohne Stadtfilter oder ohne Zustand bleibt es bei der eigenen Adresse („teilweise“).
export function weiter(html: string, base: string): string | null {
  const api = antwort(html);
  if (api) {
    const u = new URL(base), start = Number(u.searchParams.get("start")) || 0, limit = Number(u.searchParams.get("limit")) || SEITE;
    // Eine leere Seite vor dem gemeldeten Ende ist widersprüchlich: nicht als Listenende werten.
    if (!api.anzeigen.length) return start >= api.gesamt ? null : base;
    const naechste = start + limit;
    return naechste >= api.gesamt ? null : base.replace(/([?&]start=)\d+/, "$1" + naechste);
  }
  const s = stand(html);
  if (s) return s.gezeigt >= s.gesamt ? null : schnittstelle(s.filter, s.folgeStart) ?? base;
  return /\bdata-cy=["']showMore["']/i.test(html) ? base : null;
}

// Zusätzliche Kopfzeilen, die fetchPublicHtml für eine Adresse dieser Plattform senden muss: die Schnittstelle verlangt
// X-Requested-With: XMLHttpRequest (wie axios im Seitenskript); Accept wie das Seitenskript. Ehrliche Kennung bleibt.
export function kopfzeilen(url: string): Record<string, string> | undefined {
  return url.startsWith(SCHNITTSTELLE + "?") ? { "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/plain, */*" } : undefined;
}

// Leermeldung: jobsCount 0 ohne Anzeigen, ohne Fehlercode und nicht mehr ladend; bei der Schnittstelle total 0 ohne Anzeige.
export function leer(html: string): boolean {
  const api = antwort(html);
  if (api) return api.gesamt === 0 && api.anzeigen.length === 0;
  const s = stand(html);
  return !!s && s.gesamt === 0 && s.gezeigt === 0 && s.fehler === 0 && s.laedt === false;
}
