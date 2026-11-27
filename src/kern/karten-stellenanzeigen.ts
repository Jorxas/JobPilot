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

type J = Record<string, unknown>;
const obj = (v: unknown): J | undefined => (v && typeof v === "object" && !Array.isArray(v) ? v as J : undefined);

// Antwort der Schnittstelle /api/jobs/ (ab der zweiten Seite, siehe weiter): JSON { jobAdSearchResultModel, searchFailed? }.
function antwort(body: string): J | undefined {
  if (!/^\s*\{/.test(body)) return undefined;
  try { return obj(JSON.parse(body)); } catch { return undefined; }
}

// Suchergebnis im Payload der Seite oder in der Schnittstellenantwort: jobAds (diese Seite), count (Gesamtzahl der Liste).
// Eine Antwort mit searchFailed hat kein verwertbares Modell.
function modell(html: string): J | undefined {
  const api = antwort(html);
  if (api) return api.searchFailed === true ? undefined : obj(api.jobAdSearchResultModel);
  return obj(jsonAssignment(payload(html), '"jobAdSearchResultModel":{'));
}

function ausPayload(html: string): Karte[] {
  const model = modell(html);
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

// Schnittstelle des Seitenskripts: RTK Query getJobs mit baseUrl "/api" und Pfad `/jobs/?${qs.stringify(params,
// { arrayFormat: "repeat" })}` (Chunk 3235 und 5160, geprüft am 27. November 2026).
const SCHNITTSTELLE = "https://www.stellenanzeigen.de/api/jobs/";
const NACHLADEN = 25; // loadMoreCount im appConfig
// qs kodiert nach RFC 3986: auch ! ' ( ) * werden prozentkodiert.
const kodiert = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());

// Adresse der nächsten Seite, wie „Mehr anzeigen“ sie baut: die Suchparameter der Seite (currentPageParams.pageParams.
// searchParams; RSC-Verweise wie "$36:props:preloadedState:appConfig:defaultSearchParams:contractType" aus
// appConfig.defaultSearchParams aufgelöst) ohne portal, dazu getCompanyProfileTypes aus appConfig.companyProfileTypes.
// offset wird offset + limit der Seite (0 + 25), limit die Nachladegröße (loadMoreCount 25).
// Leere Listen und undefined lässt qs weg, leere Zeichenketten bleiben („company=“).
function schnittstelle(html: string): string | null {
  const text = payload(html);
  const seite = obj(obj(obj(jsonAssignment(text, '"currentPageParams":{'))?.pageParams)?.searchParams);
  if (!seite) return null;
  const vorgaben = obj(jsonAssignment(text, '"defaultSearchParams":{')) || {};
  let profile: unknown = [];
  try { profile = JSON.parse(text.match(/"companyProfileTypes":(\[[^\]]*\])/)?.[1] || "[]"); } catch { /* ohne Profiltypen */ }
  const werte: J = {};
  for (const [k, v] of Object.entries(seite)) {
    if (k === "portal") continue;
    if (typeof v === "string" && /^\$[0-9a-f]*:/.test(v)) werte[k] = /:defaultSearchParams:/.test(v) ? vorgaben[v.split(":").pop()!] : undefined;
    else werte[k] = v === "$undefined" ? undefined : typeof v === "string" && v.startsWith("$$") ? v.slice(1) : v;
  }
  const offset = (Number(werte.offset) || 0) + (Number(werte.limit) || NACHLADEN);
  werte.limit = NACHLADEN; werte.offset = offset; werte.getCompanyProfileTypes = profile;
  const teile: string[] = [];
  for (const [k, v] of Object.entries(werte)) {
    const liste = Array.isArray(v) ? v : [v];
    for (const x of liste) if (x === null || ["string", "number", "boolean"].includes(typeof x)) teile.push(kodiert(k) + "=" + kodiert(x === null ? "" : String(x)));
  }
  return SCHNITTSTELLE + "?" + teile.join("&");
}

// Blättern (geprüft am 27. November 2026): Die Seite /suche/ liefert die ersten 25 Anzeigen; pageNumber, offset und limit
// in ihrer Adresse übergeht der Server. „Mehr anzeigen“ (loadingModes "endless", showSimilarResults: true) lädt je 25
// weitere über GET /api/jobs/?…&offset=25, 50, … mit denselben Suchparametern; öffentlich, ohne Anmeldung, ohne Cookie
// und ohne besondere Kopfzeile (JSON auch bei Accept: text/html). Die Seite zeigt so viele Anzeigen, wie count nennt
// (mit den „ähnlichen“ Treffern, isRelevant false). Werkstudent IT, Gießen, 50 km: count 137, sechs Abrufe, letzte Seite 12.
// Ende: offset + limit erreicht count. Ohne Modell oder ohne Suchparameter bleibt es bei der eigenen Adresse („teilweise“).
export function weiter(html: string, base: string): string | null {
  const model = modell(html), gesamt = model?.count, anzeigen = model?.jobAds;
  if (typeof gesamt !== "number" || !Array.isArray(anzeigen)) return base;
  if (base.startsWith(SCHNITTSTELLE + "?")) {
    const u = new URL(base), offset = Number(u.searchParams.get("offset")) || 0, limit = Number(u.searchParams.get("limit")) || NACHLADEN;
    // Eine leere Seite vor dem gemeldeten Ende ist widersprüchlich: nicht als Listenende werten.
    if (!anzeigen.length) return offset >= gesamt ? null : base;
    const naechste = offset + limit;
    return naechste >= gesamt ? null : base.replace(/([?&]offset=)\d+/, "$1" + naechste);
  }
  if (gesamt <= anzeigen.length) return null;
  return schnittstelle(html) ?? base;
}

// Leer: das Modell meldet count 0 ohne Anzeigen; ohne Payload die Überschrift „Es passt gerade kein Job zu deiner Suche.“,
// die nur bei Nullergebnissen gerendert wird („0 Jobs“ steht dagegen auf jedem Filterknopf und zählt nicht).
export function leer(html: string): boolean {
  const model = modell(html);
  if (model) return model.count === 0 && Array.isArray(model.jobAds) && model.jobAds.length === 0;
  if (antwort(html)) return false;
  return /<h1\b[^>]*>\s*Es passt gerade kein Job zu deiner Suche\.?\s*<\/h1>/i.test(html);
}
