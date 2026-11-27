// Trefferliste von Workwise (/jobs/<stadt>): Redux-Zustand in __NEXT_DATA__, je Anzeige ein Eintrag { enquiries: {...} }.
// Die Stadtliste enthält nur Festanstellungen und kennt keine Suchbegriffe; die Detailseite trägt ein JobPosting.
import { type Karte, findObjects, jsonScript, str } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});
const slug = (s: string) => s.toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/\s+/g, "-");

export function karten(html: string, base: string): Karte[] {
  try {
    // Gesuchte Stadt aus der Adresse (/jobs/giessen): passender Standort zuerst, damit die Umkreisprüfung ihn liest.
    const stadt = decodeURIComponent(new URL(base).pathname.split("/").filter(Boolean)[1] || "");
    const treffer = findObjects(jsonScript(html, "__NEXT_DATA__"), x => { const e = o(x.enquiries); return !!e.id && !!e.name && !!e.slug; });
    return treffer.map(t => {
      const e = o(t.enquiries), firma = o(e.company);
      const orte = (Array.isArray(e.locationLevels) ? e.locationLevels : []).map(o).filter(l => str(l.city))
        .sort((a, b) => Number(slug(str(b.city)) === stadt) - Number(slug(str(a.city)) === stadt))
        .slice(0, 3).map(l => [/^\d{5}$/.test(str(l.zip)) ? str(l.zip) : "", str(l.city)].filter(Boolean).join(" "));
      return { title: str(e.name), url: `/job/${str(e.id)}-${str(e.slug)}`, company: firma.displayAnonymously === true ? null : str(firma.name) || null, location: orte.join("; ") || null };
    }).filter(k => k.title);
  } catch { return []; }
}

// Seitenangabe der Stadtliste im Redux-Zustand: matchings.data.paging = { page, pages, size, total }
// (27. November 2026: 14 Anzeigen je Seite, „1 - 14 von 162 Jobs“, Folgeseiten /jobs/<stadt>/<n>).
function paging(html: string): { page: number; pages: number; total: number } | null {
  try {
    const p = o(o(o(o(o(o(o(o(jsonScript(html, "__NEXT_DATA__")).props).pageProps).initialState).enquiries).matchings).data).paging);
    const page = Number(p.page), pages = Number(p.pages), total = Number(p.total);
    return Number.isInteger(page) && Number.isInteger(pages) && Number.isInteger(total) ? { page, pages, total } : null;
  } catch { return null; }
}

// Nächste Seite: /jobs/giessen → /jobs/giessen/2 → … → /jobs/giessen/<pages>, danach null.
export function weiter(html: string, base: string): string | null {
  const u = new URL(base), teile = u.pathname.split("/").filter(Boolean);
  const nummer = /^\d+$/.test(teile[teile.length - 1] || "") ? Number(teile.pop()) : 1;
  const p = paging(html);
  if (p && p.page >= p.pages) return null;
  const pfad = "/" + [...teile, String((p ? p.page : nummer) + 1)].join("/");
  // Ohne Seitenangabe zählt nur der eigene Link der Seite auf die Folgeseite.
  if (!p && !html.includes(`href="${pfad}"`)) return null;
  u.pathname = pfad; u.search = ""; u.hash = "";
  return u.href;
}

// Die Stadtliste hat keine Suchbegriffe; leer ist sie nur, wenn der Zustand ausdrücklich total: 0 meldet.
// Unbekannte Städte beantwortet Workwise mit HTTP 404: ein Fehler, keine Leermeldung.
export function leer(html: string): boolean {
  const p = paging(html);
  return !!p && p.total === 0 && karten(html, "https://www.workwise.io/jobs/").length === 0;
}
