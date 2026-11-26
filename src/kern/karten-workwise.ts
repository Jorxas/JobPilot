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
