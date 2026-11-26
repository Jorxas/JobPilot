// Gemeinsamer öffentlicher Quellenkatalog für Suche, Import und Oberfläche.
export const PLATFORMS = [
  { id: "bundesagentur", label: "Arbeitsagentur", hosts: ["arbeitsagentur.de"], home: "https://www.arbeitsagentur.de/jobsuche/", regional: false },
  { id: "linkedin", label: "LinkedIn Jobs", hosts: ["linkedin.com"], home: "https://www.linkedin.com/jobs/search/", regional: false },
  { id: "indeed", label: "Indeed", hosts: ["indeed.com"], home: "https://de.indeed.com/jobs", regional: false },
  { id: "stepstone", label: "StepStone", hosts: ["stepstone.de"], home: "https://www.stepstone.de/", regional: false },
  { id: "stellenanzeigen", label: "Stellenanzeigen.de", hosts: ["stellenanzeigen.de"], home: "https://www.stellenanzeigen.de/", regional: false },
  { id: "meinestadt", label: "meinestadt.de", hosts: ["jobs.meinestadt.de"], home: "https://jobs.meinestadt.de/", regional: false },
  { id: "xing", label: "XING Jobs", hosts: ["xing.com"], home: "https://www.xing.com/jobs", regional: false },
  { id: "heyjobs", label: "HeyJobs", hosts: ["heyjobs.co"], home: "https://www.heyjobs.co/de-de", regional: false },
  { id: "jobware", label: "Jobware", hosts: ["www.jobware.de"], home: "https://www.jobware.de/", regional: false },
  { id: "workwise", label: "Workwise", hosts: ["workwise.io"], home: "https://www.workwise.io/jobs", regional: false },
  { id: "jobteaser", label: "JobTeaser", hosts: ["jobteaser.com"], home: "https://www.jobteaser.com/de/job-offers", regional: false },
  { id: "stellenwerk", label: "Stellenwerk", hosts: ["stellenwerk.de"], home: "https://www.stellenwerk.de/", regional: false },
  { id: "studentjob", label: "StudentJob", hosts: ["studentjob.de"], home: "https://www.studentjob.de/stellenangebote", regional: false },
  { id: "jobmensa", label: "Jobmensa", hosts: ["jobmensa.de"], home: "https://www.jobmensa.de/jobs-suchen", regional: false },
  { id: "absolventa", label: "Absolventa", hosts: ["absolventa.de"], home: "https://www.absolventa.de/jobs", regional: false },
  { id: "get-in-it", label: "get in IT", hosts: ["get-in-it.de"], home: "https://www.get-in-it.de/jobsuche", regional: false },
  { id: "jobvector", label: "Jobvector", hosts: ["jobvector.de"], home: "https://www.jobvector.de/jobs/", regional: false },
  { id: "unicum", label: "UNICUM Karrierezentrum", hosts: ["karriere.unicum.de"], home: "https://karriere.unicum.de/jobs", regional: false },
  { id: "mittelhessen", label: "Jobs in Mittelhessen", hosts: ["jobs-in-mittelhessen.de"], home: "https://www.jobs-in-mittelhessen.de/", regional: true },
  { id: "thm", label: "THM Jobportal (Jobware)", hosts: ["th-mittelhessen.al.sites.jobware.net"], home: "https://th-mittelhessen.al.sites.jobware.net/", regional: true },
  { id: "stwgi", label: "Studierendenwerk Gießen", hosts: ["www.stwgi.de"], home: "https://www.stwgi.de/jobboerse-studierende/", regional: true },
] as const;
export type PlatformId = typeof PLATFORMS[number]["id"];
export const SOURCE_IDS = PLATFORMS.map(p => p.id);
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(PLATFORMS.map(p => [p.id, p.label]));
export const SOURCE_POLICY_VERSION = 2;
export function platform(id: PlatformId) { return PLATFORMS.find(p => p.id === id)!; }
export function platformForUrl(raw: string) {
  const u = new URL(raw), host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || u.username || u.password || u.port) return undefined;
  // Partnerportale zuerst, damit THM nicht mit der allgemeinen Jobware-Suche verschmilzt.
  return PLATFORMS.find(p => p.hosts.some(h => host === h || host.endsWith("." + h)));
}

export function platformSearchUrl(source: PlatformId, keywords: string, city: string, radius: number) {
  const slug = (s: string) => encodeURIComponent(s.toLocaleLowerCase("de-DE").replace(/ß/g, "ss").replace(/\s+/g, "-"));
  const query = (base: string, values: Record<string, string>) => base + "?" + new URLSearchParams(values);
  switch (source) {
    case "linkedin": return query("https://www.linkedin.com/jobs/search/", { keywords, location: city + ", Deutschland", distance: String(Math.round(radius / 1.609344)) });
    case "indeed": return query("https://de.indeed.com/jobs", { q: keywords, l: city, radius: String(radius) });
    case "stepstone": return "https://www.stepstone.de/jobs/" + encodeURIComponent(keywords.replace(/\s+/g, "-")) + "/in-" + encodeURIComponent(city) + "?radius=" + radius;
    case "bundesagentur": return query("https://www.arbeitsagentur.de/jobsuche/suche", { was: keywords, wo: city, umkreis: String(radius) });
    case "meinestadt": return query("https://jobs.meinestadt.de/" + slug(city), { words: keywords, radius: String(radius) });
    // Workwise schreibt Umlaute aus (jobs/koeln, jobs/muenchen); die Liste enthält nur Festanstellungen.
    case "workwise": return "https://www.workwise.io/jobs/" + slug(city.replace(/ä/gi, "ae").replace(/ö/gi, "oe").replace(/ü/gi, "ue"));
    // Ort nur als interne Kennung (Auflöser der Seite: /api/suggest/?value=<Ort>&resolverType=LocationResolver); ohne Kennung
    // bundesweite Treffer, dann prüft die Postleitzahl der Karte den Umkreis. Die Seite kennt 10 bis 200 km in festen Stufen.
    case "stellenanzeigen": { const id = STELLENANZEIGEN_ORT[ortKey(city)]; return query("https://www.stellenanzeigen.de/suche/", { fulltext: keywords, ...(id ? { locationIds: id, perimeterRadius: String([10, 20, 30, 40, 50, 75, 100, 200].find(r => r >= radius) ?? 200) } : {}) }); }
    // /jobs/search leitet per 301 auf /jobs/search/ki weiter; direkt dorthin spart eine Anfrage.
    case "xing": return query("https://www.xing.com/jobs/search/ki", { keywords, location: city, radius: String(radius) });
    case "heyjobs": return "https://www.heyjobs.co/de-de/jobs-als-Werkstudent";
    // Muster der eigenen Links von Jobware (/jobs--fuer-x--in-y?r=25); die Seite kennt nur 25, 50, 75 und 100 km.
    case "jobware": { const seo = (s: string) => s.toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); return "https://www.jobware.de/jobs--fuer-" + seo(keywords) + "--in-" + seo(city) + "?" + new URLSearchParams({ q: keywords, l: city, r: String(radius <= 25 ? 25 : radius <= 50 ? 50 : radius <= 75 ? 75 : 100) }); }
    // Ort als Name oder Postleitzahl; die Seite kennt 10, 25, 50 und 100 km. Bundesweite Anzeigen erscheinen bei jedem Ort.
    case "studentjob": return query("https://www.studentjob.de/stellenangebote", { "search[keywords_scope]": keywords, ...(city.trim() ? { "search[zipcode_eq]": city.trim(), "search[geo_distance_eq]": String([10, 25, 50, 100].find(r => r >= radius) ?? 100) } : {}) });
    // Ohne Koordinaten ignoriert Jobmensa den Ort und liefert bundesweite Treffer; die Seite kennt 10, 25, 50 und 100 km.
    case "jobmensa": { const punkt = KOORDINATEN[ortKey(city)]; return query("https://www.jobmensa.de/jobs-suchen", { "job-title": keywords, location: city, ...(punkt ? { latitude: punkt[0], longitude: punkt[1] } : {}), radius: String(radius) }); }
    // Stellenwerk hat ein Portal je Hochschulstadt und keine Umkreissuche; für Mittelhessen ist Frankfurt (rund 55 km) das nächste.
    case "stellenwerk": { const portal = STELLENWERK_PORTAL[ortKey(city)]; return portal ? query("https://www.stellenwerk.de/" + portal, { _q: ohneVertrag(keywords) }) : platform(source).home; }
    // Absolventa kennt nur Festanstellung, Praktikum und Trainee; Vertragswörter verwirren die Volltextsuche und entfallen.
    case "absolventa": return query("https://www.absolventa.de/jobs", { text: ohneVertrag(keywords), location: city, radius: String(radius), "positions[]": "praktikum" });
    case "unicum": return query("https://karriere.unicum.de/jobs", { search: keywords, job_geo_location: city, radius: String(radius) });
    case "thm": return query("https://th-mittelhessen.al.sites.jobware.net/Suchergebnis-Praktika.html", { jsjn: keywords, jsjo: city });
    // Stadtliste ohne Abfrageparameter (jeder Parameter leitet auf /jobs/<ort> ohne Vertragsfilter um): nur dieser Ort,
    // keine Suchbegriffe, höchstens 14 Treffer. Die Freitextsuche /search steht hinter einer Anubis-Prüfung.
    case "mittelhessen": return "https://www.jobs-in-mittelhessen.de/" + (/praktik/i.test(keywords) ? "praktikum/" : "werkstudent/") + encodeURIComponent(city.trim().toLocaleLowerCase("de-DE").replace(/\s+/g, "-"));
    // get in IT kennt keine Stichwortsuche, nur eine numerische Stadtkennung mit Umkreis (Seite /staedte).
    case "get-in-it": { const id = GET_IN_IT_STADT[ortKey(city)]; return id ? query("https://www.get-in-it.de/jobsuche", { city: String(id), radius: String(radius) }) : platform(source).home; }
    // /de/job-offers steht hinter einer Cloudflare-Prüfung; die Übersicht je Vertrag und Stadt ist öffentlich und laut
    // robots.txt erlaubt („Allow: /*/job-search/*“). Für Gießen gibt es keine; Frankfurt (rund 53 km) ist die nächste.
    case "jobteaser": return "https://www.jobteaser.com/de/job-search/werkstudent-" + (JOBTEASER_STADT[ortKey(city)] || city.trim().toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-"));
    default: return platform(source).home;
  }
}
const ortKey = (city: string) => city.trim().toLocaleLowerCase("de-DE").replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue");
const GET_IN_IT_STADT: Record<string, number> = { giessen: 4814, "frankfurt am main": 5061, frankfurt: 5061, darmstadt: 5665, wiesbaden: 279, kassel: 3822, fulda: 4977, mainz: 3142 };
const JOBTEASER_STADT: Record<string, string> = { giessen: "frankfurt", marburg: "frankfurt", wetzlar: "frankfurt", "frankfurt am main": "frankfurt" };
// Ortskennungen von stellenanzeigen.de, ermittelt über den Auflöser der Seite (26. November 2026).
const STELLENANZEIGEN_ORT: Record<string, string> = { giessen: "M-DE-7696", "frankfurt am main": "M-DE-7340", frankfurt: "M-DE-7340", marburg: "M-DE-7817", wetzlar: "M-DE-7750", darmstadt: "M-DE-7303" };
const STELLENWERK_PORTAL: Record<string, string> = { giessen: "frankfurt-am-main", marburg: "frankfurt-am-main", wetzlar: "frankfurt-am-main", frankfurt: "frankfurt-am-main", "frankfurt am main": "frankfurt-am-main", darmstadt: "darmstadt", hamburg: "hamburg" };
// Gleicher Mittelpunkt wie die Umkreisprüfung in scope.ts.
const KOORDINATEN: Record<string, [string, string]> = { giessen: ["50.5841", "8.6784"] };
// Vertragswörter verwirren die Volltextsuche von Börsen, die nur studentische Stellen oder keinen Werkstudentenfilter haben.
const ohneVertrag = (keywords: string) => keywords.replace(/\b(?:werkstudent(?:in|en)?|working student|pflichtpraktikum|praktikum|praktikant(?:in)?|studentische[rn]?\s+(?:hilfskraft|mitarbeiter(?:in)?)|studentenjob)\b/gi, " ").replace(/\s+/g, " ").trim() || keywords;

// Kein automatischer Abruf, Prüfung vom 26. November 2026: die Plattform sperrt ehrliche Clients technisch
// (Cloudflare-Prüfung, AWS-WAF-Aufgabe) oder die Liste nennt weder Firma noch eigenen Anzeigenlink.
// Diese Quellen bleiben als Suchlink und Textimport nutzbar; es wird keine Anfrage gesendet.
// Verbote in robots.txt allein sind auf ausdrücklichen Wunsch der Nutzerin bzw. des Nutzers (26. November 2026,
// private Stellensuche, ehrliche Kennung, wenige Anfragen) kein Ausschlussgrund mehr; technische Sperren bleiben bestehen.
export const KEIN_ABRUF: Partial<Record<PlatformId, { blocked: boolean; grund: string }>> = {
  indeed: { blocked: true, grund: "Indeed beantwortet automatische Abrufe mit einer Cloudflare-Prüfung; Anzeigenseiten leiten auf die Anmeldung um." },
  jobvector: { blocked: true, grund: "Jobvector sperrt die gesamte Seite einschließlich robots.txt mit einer Cloudflare-Prüfung." },
  heyjobs: { blocked: true, grund: "HeyJobs beantwortet jede Seite mit einer AWS-WAF-Prüfung (HTTP 202 mit JavaScript-Aufgabe)." },
  stwgi: { blocked: false, grund: "Die Jobbörse des Studierendenwerks nennt weder Firma noch eigenen Anzeigenlink; Kontaktdaten gibt es nur nach Anmeldung." },
};

export function platformFilterNote(source: PlatformId) {
  if (["heyjobs", "jobteaser", "stellenwerk", "get-in-it", "jobvector", "stwgi"].includes(source)) return "Öffentliche Übersicht; Suchbegriffe und Ort im Browser ergänzen. Bei den neu ergänzten Quellen werden nur automatische Treffer mit bestätigtem Ort im Umkreis übernommen.";
  return "Suchlink vorbereitet; die tatsächlichen Filter der Plattform im Browser kontrollieren. Standort und Vertragsart der Anzeige vor einer Bewerbung prüfen.";
}

// Herkunft einer Stelle für die Anzeige: gespeicherte Quelle, sonst die Plattform der Anzeigenadresse.
export function platformLabelOfOffer(platformId: unknown, url: unknown): string | undefined {
  if (typeof platformId === "string") { if (platformId === "employer") return "Firmenseite"; if (Object.prototype.hasOwnProperty.call(SOURCE_LABELS, platformId)) return SOURCE_LABELS[platformId]; }
  if (typeof url !== "string") return undefined;
  try { return platformForUrl(url)?.label; } catch { return undefined; }
}

// Auf Wunsch vom 24. November alte Auswahl einmal auf alle Quellen erweitern; neue Abwahl bleibt verbindlich.
export function selectedPlatforms(value: unknown): PlatformId[] {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (v.platformCoverageVersion === SOURCE_POLICY_VERSION) return SOURCE_IDS.filter(id => v[id] === true);
  return [...SOURCE_IDS];
}
