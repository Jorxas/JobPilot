import { createHash } from "node:crypto";
import { type Offer, type Source, type SourceReport, searchUrl, textOnly, eligibleRole } from "./core";
import { platformForUrl, KEIN_ABRUF, type PlatformId } from "./platforms";
import { KARTEN, SEITEN } from "./karten";
import { anzeige as mittelhessenAnzeige } from "./karten-mittelhessen";
import type { Karte, Seiten } from "./karten-hilfe";
const recent = new Map<string, {
    at: number;
    result: {
        offers: Offer[];
        report: SourceReport;
    };
}>();
export class SourceUnavailable extends Error {
    constructor(message: string, public blocked = false) { super(message); }
}
export function allowedUrl(raw: string) {
    const url = new URL(raw);
    if (!platformForUrl(raw))
        throw new SourceUnavailable("Einen HTTPS-Anzeigenlink einer der 18 unterstützten Jobbörsen verwenden.");
    return url;
}
export function sourceOf(raw: string): PlatformId { return platformForUrl(allowedUrl(raw).href)!.id; }
// Mindestabstand zwischen zwei Abrufen desselben Hosts, wenn dessen robots.txt einen Crawl-delay verlangt.
// Abstand je Host: UNICUM laut robots.txt (Crawl-delay 10 s); LinkedIn antwortete am 27. November nach drei schnellen Seiten
// mit HTTP 429, deshalb ruhiger blättern (keine Wiederholung nach einer Sperre, ehrliche Kennung bleibt).
const ABSTAND_MS: Record<string, number> = { "karriere.unicum.de": 10000, "www.linkedin.com": 5000 };
const letzterAbruf = new Map<string, number>();
export async function fetchPublicHtml(raw: string, redirects = 2, extra?: Record<string, string>): Promise<{
    html: string;
    url: string;
}> {
    const url = allowedUrl(raw);
    if (/\/(?:login|sign[-_]?in|anmelden|auth)(?:[/?]|$)/i.test(url.pathname)) throw new SourceUnavailable("Anmeldung erforderlich. Quelle im Browser öffnen und die Anzeige manuell importieren.", true);
    const abstand = ABSTAND_MS[url.hostname];
    if (abstand) {
        const seit = Date.now() - (letzterAbruf.get(url.hostname) || 0);
        if (seit < abstand) await new Promise(resolve => setTimeout(resolve, abstand - seit));
        letzterAbruf.set(url.hostname, Date.now());
    }
    const response = await fetch(url, { redirect: "manual", headers: { "Accept": "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.7", ...ohneKennung(extra), "User-Agent": "Mozilla/5.0 (compatible; JobAssistant public offer reader)" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next || !redirects)
            throw new SourceUnavailable("Weiterleitung nicht verwertbar.");
        return fetchPublicHtml(new URL(next, url).href, redirects - 1, extra);
    }
    if ([401, 403, 429, 999].includes(response.status))
        throw new SourceUnavailable(`Öffentlicher Zugriff blockiert (HTTP ${response.status}). Seite selbst öffnen oder Anzeigentext manuell importieren.`, true);
    if (!response.ok)
        throw new SourceUnavailable(`Quelle nicht verfügbar (HTTP ${response.status}).`);
    const reader = response.body?.getReader();
    if (!reader)
        throw new SourceUnavailable("Leere Antwort.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
        const { value, done } = await reader.read();
        if (done)
            break;
        size += value.length;
        if (size > 3 * 1024 * 1024) {
            await reader.cancel();
            throw new SourceUnavailable("Seite zu groß.");
        }
        chunks.push(value);
    }
    const html = Buffer.concat(chunks).toString("utf8");
    // Auch AWS-WAF-Aufgaben (HTTP 202), Anubis- und Cloudflare-Prüfseiten sind Sperren, keine leeren Trefferlisten.
    if (/verify you are human|unusual traffic|access denied|AwsWafIntegration|\.awswaf\.com\/|anubis_challenge|making sure you(?:'|&#39;|’)re not a bot|cf-mitigated|_cf_chl_opt|<title>[^<]*(?:captcha|just a moment|security check|sign in|anmelden)/i.test(html.slice(0, 100000)))
        throw new SourceUnavailable("Die Seite verlangt eine Zugriffsprüfung oder Anmeldung. Manueller Import bleibt möglich.", true);
    return { html, url: url.href };
}
function ref(source: Source, url: string) { const u = new URL(url); return source === "linkedin" ? (u.pathname.match(/(?:-|\/)(\d{7,})(?:\/)?$/)?.[1] || createHash("sha256").update(url).digest("hex").slice(0, 24)) : source === "indeed" ? (u.searchParams.get("jk") || createHash("sha256").update(url).digest("hex").slice(0, 24)) : createHash("sha256").update(url).digest("hex").slice(0, 24); }
function cleanUrl(raw: string, base: string) { const u = allowedUrl(new URL(textOnly(raw), base).href); u.hash = ""; for (const k of [...u.searchParams.keys()])
    if (!["jk", "vjk", "id", "jobId", "jobid", "job_id", "offerId", "reference", "angebot"].includes(k))
        u.searchParams.delete(k); return u.href; }
type JsonObj = Record<string, unknown>;
function obj(v: unknown): JsonObj { return v && typeof v === "object" && !Array.isArray(v) ? v as JsonObj : {}; }
export function structuredOffers(html: string, base: string, source: Source, now = new Date()): Offer[] {
    const out: Offer[] = [];
    function walk(value: unknown, depth = 0) {
        if (depth > 25)
            return;
        if (Array.isArray(value)) {
            value.forEach(v => walk(v, depth + 1));
            return;
        }
        const j = obj(value);
        if (!Object.keys(j).length)
            return;
        const types = Array.isArray(j["@type"]) ? j["@type"] : [j["@type"]];
        if (types.includes("JobPosting")) {
            if (typeof j.validThrough === "string" && Number.isFinite(Date.parse(j.validThrough)) && Date.parse(j.validThrough) < now.getTime())
                return;
            const title = typeof j.title === "string" ? textOnly(j.title) : "", company = obj(j.hiringOrganization).name, loc = obj(Array.isArray(j.jobLocation) ? j.jobLocation[0] : j.jobLocation), address = obj(loc.address), country = address.addressCountry;
            const countryName = typeof country === "string" ? country : String(obj(country).name || "");
            if (countryName && !/^(de|deu|deutschland|germany|allemagne)$/i.test(countryName.trim()))
                return;
            let url: string;
            try {
                url = cleanUrl(typeof j.url === "string" ? j.url : base, base);
            }
            catch {
                return;
            }
            // Manche Börsen (z. B. Absolventa) kodieren das HTML der Beschreibung doppelt: dann ein zweiter Durchgang.
            const once = typeof j.description === "string" ? textOnly(j.description) : "", description = /<\/?(?:p|br|div|ul|li|strong|b|span|h[1-6])\b[^>]*>/i.test(once) ? textOnly(once) : once;
            if (title)
                out.push({ source, externalRef: ref(source, url), title, company: typeof company === "string" ? textOnly(company) : null, location: [address.postalCode, address.addressLocality, address.addressRegion].filter(v => typeof v === "string").join(" ") || null, url, description, complete: description.length >= 150, publishedAt: typeof j.datePosted === "string" ? j.datePosted : undefined });
            return;
        }
        for (const v of Object.values(j))
            walk(v, depth + 1);
    }
    for (const s of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            walk(JSON.parse(s[1]));
        }
        catch { }
    }
    return [...new Map(out.map(o => [o.externalRef, o])).values()];
}
function byClass(html: string, cls: string, tag = "[a-z0-9]+") { return textOnly(html.match(new RegExp(`<(${tag})\\b[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i"))?.[2] || ""); }
export function linkedinCards(html: string, base: string): Offer[] {
    const out: Offer[] = [];
    for (const card of html.split(/<li\b[^>]*>/i).slice(1)) {
        const title = byClass(card, "base-search-card__title", "h3"), company = byClass(card, "base-search-card__subtitle", "h4"), location = byClass(card, "job-search-card__location", "span");
        const href = card.match(/<a\b[^>]*class=["'][^"']*base-card__full-link[^"']*["'][^>]*href=["']([^"']+)/i)?.[1];
        if (!title || !href)
            continue;
        try {
            const url = cleanUrl(href, base);
            out.push({ source: "linkedin", externalRef: ref("linkedin", url), title, company: company || null, location: location || null, url, description: "", complete: false, publishedAt: card.match(/<time\b[^>]*datetime=["']([^"']+)/i)?.[1] });
        }
        catch { }
    }
    return out;
}
// Rohkarten eines Plattformparsers werden hier geprüft: nur HTTPS-Anzeigen derselben Quelle, Titel Pflicht, nichts erfunden.
export function cardOffers(list: Karte[], base: string, source: Source): Offer[] {
    const out = new Map<string, Offer>();
    for (const card of list) {
        const title = textOnly(card.title || "");
        if (!title || !card.url) continue;
        let url: string;
        try {
            const resolved = new URL(textOnly(card.url), base);
            if (resolved.protocol === "http:") resolved.protocol = "https:";
            url = cleanUrl(resolved.href, base);
            const actual = sourceOf(url);
            if (actual !== source && !(source === "thm" && actual === "jobware")) continue;
        } catch { continue; }
        const description = card.description ? textOnly(card.description) : "", externalRef = ref(source, url);
        if (!out.has(externalRef)) out.set(externalRef, { source, externalRef, title, company: card.company ? textOnly(card.company) || null : null, location: card.location ? textOnly(card.location) || null : null, url, description, complete: description.length >= 150, publishedAt: card.publishedAt || undefined });
    }
    return [...out.values()];
}
export function parseOffers(html: string, url: string, source: PlatformId) {
    const parser = KARTEN[source], own = parser ? cardOffers(parser(html, url), url, source) : [];
    if (own.length) return own;
    const ld = structuredOffers(html, url, source);
    return ld.length ? ld : source === "linkedin" ? linkedinCards(html, url) : [];
}
export function linkedinDetail(html: string, url: string): Offer | null {
    const title = byClass(html, "top-card-layout__title", "h[12]") || byClass(html, "topcard__title", "h[12]"), company = byClass(html, "topcard__org-name-link") || byClass(html, "topcard__flavor--black-link"), location = byClass(html, "topcard__flavor--bullet"), description = byClass(html, "show-more-less-html__markup", "div") || byClass(html, "description__text", "div");
    return title && description.length >= 150 ? { source: "linkedin", externalRef: ref("linkedin", url), title, company: company || null, location: location || null, url, description, complete: true } : null;
}
// THM-Jobportal (Jobware-Vorlage): kein JSON-LD. Der Seitentitel lautet „Titel, Ort, Firma“, der Anzeigentext
// steht in einem iframe desselben Hosts (/jobsearch/embed/job/…/index.html).
export async function thmDetail(html: string, url: string): Promise<Offer | null> {
    const parts = textOnly(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").split(/,\s+/);
    const embed = html.match(/<iframe\b[^>]*src=["'](https:\/\/th-mittelhessen\.al\.sites\.jobware\.net\/jobsearch\/embed\/job\/[^"']+)["']/i)?.[1];
    if (parts.length < 3 || !embed) return null;
    const inner = await fetchPublicHtml(embed), description = textOnly(inner.html.replace(/<head\b[\s\S]*?<\/head>/i, ""));
    const company = parts.pop()!, location = parts.pop()!, title = parts.join(", ");
    return title && description.length >= 150 ? { source: "thm", externalRef: ref("thm", url), title, company, location, url, description, complete: true } : null;
}
export async function importPublicOffer(url: string, expectedSource?: Source) {
    const actual = sourceOf(url), source = expectedSource || actual;
    if (source !== actual && !(source === "thm" && actual === "jobware")) throw new SourceUnavailable("Quellenwechsel nicht zulässig.");
    const gesperrt = KEIN_ABRUF[actual];
    if (gesperrt) throw new SourceUnavailable(gesperrt.grund + " Titel, Unternehmen und Beschreibung bitte manuell importieren.", gesperrt.blocked);
    const id = ref(source, url), target = source === "linkedin" && /^\d{7,}$/.test(id) ? "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/" + id : url, page = await fetchPublicHtml(target);
    const offers = structuredOffers(page.html, url, source);
    if (offers.length === 1)
        return offers[0];
    if (source === "linkedin") {
        const detail = linkedinDetail(page.html, url);
        if (detail)
            return detail;
    }
    if (actual === "mittelhessen") {
        // Kein JSON-LD; der Anzeigentext steht im RSC-Datenstrom der Seite.
        const k = mittelhessenAnzeige(page.html, url);
        if (k) return { source, externalRef: ref(source, url), title: k.title, company: k.company ?? null, location: k.location ?? null, url, description: k.description, complete: k.description.length >= 150, publishedAt: k.publishedAt };
    }
    if (actual === "thm") {
        const detail = await thmDetail(page.html, url);
        if (detail)
            return detail;
    }
    throw new SourceUnavailable("Anzeige nicht zuverlässig erkannt. Titel, Unternehmen und Beschreibung manuell importieren.");
}
export function offerLinks(html: string, base: string, source: Source): string[] {
    const urls = new Map<string, number>();
    const add = (raw: string, hint = "") => {
        try {
            const resolved = new URL(textOnly(raw), base);
            // Manche THM-Anzeigen verlinken noch HTTP; abgerufen wird ausschließlich die geprüfte HTTPS-Variante.
            if (resolved.protocol === "http:") resolved.protocol = "https:";
            const url = cleanUrl(resolved.href, base), actual = sourceOf(url);
            if (actual !== source && !(source === "thm" && actual === "jobware")) return;
            const path = new URL(url).pathname;
            if (/\/(?:job|stellenangebot|job-offers)\/[^/]{6,}|\/stellenangebote\/\d+|\/jobs\/[^/]*\d[^/]*|\/jobsuche\/p\d+|\/Job\/|\/Praktikum\/(?:Detail\/)?[^/]+\d+\.html|\/[^/]+\/[^/]*\d{6}-\d{5,}/i.test(path)) urls.set(url, Math.max(urls.get(url) || 0, (eligibleRole(textOnly(hint)) ? 4 : 0) + (/werkstudent|studentische|praktik/i.test(hint) ? 2 : 0)));
        } catch { /* Nur ausdrücklich zugelassene öffentliche Anzeigenziele. */ }
    };
    for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) add(m[1], m[2]);
    // ItemList-Links sind strukturierte Verweise, noch keine erfundenen Stellenbeschreibungen.
    for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
            const walk = (v: unknown, depth = 0) => {
                if (depth > 20 || !v || typeof v !== "object") return;
                if (Array.isArray(v)) { v.forEach(x => walk(x, depth + 1)); return; }
                const j = v as Record<string, unknown>;
                if (typeof j.url === "string") add(j.url, String(j.name || j.title || ""));
                Object.values(j).forEach(x => walk(x, depth + 1));
            };
            walk(JSON.parse(m[1]));
        } catch { /* Ungültige Metadaten werden nicht als Treffer gezählt. */ }
    }
    return [...urls].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

// Keine fachliche Grenze (Auftrag vom 27. November 2026: alle Treffer lesen, nach Passung sortieren). MAX_SEITEN schützt nur
// vor einer endlosen Blätterschleife einer fehlerhaften Seite; die längste bekannte Liste hat zwölf Seiten. Pause zwischen Seiten.
export const MAX_SEITEN = 100;
const SEITEN_PAUSE_MS = 1500;
// LinkedIn (Gast-Schnittstelle): bis zu zehn Karten je Antwort, weiter über start; eine kürzere Antwort ist die letzte.
const LINKEDIN_SEITE = 10;
const LINKEDIN: Seiten = {
    weiter: (html, base) => {
        const karten = (html.match(/<li\b/gi) || []).length;
        if (karten < LINKEDIN_SEITE) return null;
        const u = new URL(base);
        u.searchParams.set("start", String(Number(u.searchParams.get("start") || 0) + karten));
        return u.href;
    },
    leer: html => !/<li\b/i.test(html) && html.trim().length < 2000,
};
// Zusätzliche Kopfzeilen dürfen die ehrliche Kennung nie ersetzen.
function ohneKennung(extra?: Record<string, string>) { return Object.fromEntries(Object.entries(extra || {}).filter(([k]) => !/^(user-agent|cookie|authorization)$/i.test(k))); }
function blaetternFuer(source: string): Seiten | undefined { return source === "linkedin" ? LINKEDIN : (SEITEN as Partial<Record<string, Seiten>> | undefined)?.[source]; }
export async function scanPublicSource(source: Exclude<PlatformId, "bundesagentur">, keywords: string, city: string, radius: number): Promise<{
    offers: Offer[];
    report: SourceReport;
}> {
    const search = searchUrl(source, keywords, city, radius);
    const gesperrt = KEIN_ABRUF[source];
    if (gesperrt)
        return { offers: [], report: { source, status: gesperrt.blocked ? "blocked" : "partial", found: 0, inserted: 0, limited: true, message: gesperrt.grund + " Keine Anfrage gesendet; Suche im Browser öffnen und Anzeigen manuell importieren.", searchUrl: search } };
    const cacheKey = [source, search, city, radius].join('|'), cached = recent.get(cacheKey);
    if (cached && Date.now() - cached.at < 30 * 60000)
        return structuredClone(cached.result);
    let target = search;
    if (source === "linkedin")
        target = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + new URLSearchParams({ keywords, location: city + ", Deutschland", distance: String(Math.round(radius / 1.609344)), start: "0", f_TPR: "r2592000" });
    try {
        const page = await fetchPublicHtml(target);
        // Seit 27. November 2026 keine Begrenzung auf zehn Karten: die ganze Trefferliste wird Seite für Seite gelesen,
        // höchstens MAX_SEITEN Seiten je Suchbegriff und mit Pause zwischen den Seiten. Nur eine nachweislich zu Ende
        // gelesene oder ausdrücklich leere Liste gilt als gelesen („ok“); sonst bleibt der Bericht ehrlich „partial“.
        const blaettern = blaetternFuer(source), offers = parseOffers(page.html, page.url, source);
        const lauf = { seiten: 1, ende: false, leer: false, ohneBlaettern: false, nurBrowser: false, wiederholt: false, folgeGesperrt: "", folgeFehler: false };
        if (!offers.length) lauf.leer = !!blaettern?.leer?.(page.html);
        else {
            let html = page.html, url = page.url;
            const besucht = new Set([url]);
            for (;;) {
                const next = blaettern?.weiter ? blaettern.weiter(html, url) : undefined;
                if (next === null) { lauf.ende = true; break; }
                if (next === undefined) { lauf.ohneBlaettern = true; break; }
                // weiter nennt die eigene Adresse: die Plattform meldet mehr Treffer, lädt sie aber nur im Browser nach.
                if (next === url || next === page.url) { lauf.nurBrowser = true; break; }
                if (lauf.seiten >= MAX_SEITEN || besucht.has(next)) break;
                besucht.add(next);
                await new Promise(resolve => setTimeout(resolve, SEITEN_PAUSE_MS));
                let folge: { html: string; url: string };
                try { folge = await fetchPublicHtml(next, 2, blaettern?.kopfzeilen?.(next)); }
                catch (e) { if (e instanceof SourceUnavailable && e.blocked) lauf.folgeGesperrt = e.message; else lauf.folgeFehler = true; break; }
                lauf.seiten++;
                const neue = parseOffers(folge.html, folge.url, source);
                // Eine Folgeseite ohne lesbare Karte (z. B. nur Privatanzeigen bei Stellenwerk) beendet die Liste nur, wenn auch
                // ihr eigenes Blättern kein Weiter mehr nennt; eine Seite, die nur frühere Anzeigen wiederholt, gilt als unzuverlässig.
                if (!neue.length && !(blaettern?.weiter?.(folge.html, folge.url))) { lauf.ende = true; break; }
                const vorher = offers.length, schon = new Set(offers.map(o => o.externalRef));
                for (const o of neue) if (!schon.has(o.externalRef)) { schon.add(o.externalRef); offers.push(o); }
                if (neue.length && offers.length === vorher) { lauf.wiederholt = true; break; }
                html = folge.html; url = folge.url;
            }
        }
        // Studentische IT-Stellen zuerst, bei Gleichstand Karten mit genannter Firma (z. B. StudentJob übernimmt viele Fremdanzeigen ohne Arbeitgeber).
        offers.sort((a,b) => Number(eligibleRole(b.title)) - Number(eligibleRole(a.title)) || Number(!!b.company) - Number(!!a.company));
        let detailBlocked = false;
        const fromList = offers.length > 0;
        if (!offers.length && !lauf.leer && source !== "linkedin") {
            for (const url of offerLinks(page.html, page.url, source).slice(0, 4)) {
                try { offers.push(await importPublicOffer(url, source)); }
                catch (e) { if (e instanceof SourceUnavailable && e.blocked) { detailBlocked = true; break; } }
            }
        }
        if (!offers.length) {
            const message = lauf.leer ? "Trefferliste gelesen: Die Plattform meldet zu diesem Suchbegriff keine Anzeige." : detailBlocked ? "Anzeigenabruf blockiert oder Anmeldung erforderlich. Quelle im Browser öffnen und Anzeige importieren." : "Keine Anzeige zuverlässig extrahiert. Suche im Browser ergänzen und Anzeige importieren; dies ist kein bestätigtes Nullergebnis.";
            const result = { offers: [] as Offer[], report: { source, status: lauf.leer ? "ok" as const : detailBlocked ? "blocked" as const : "partial" as const, found: 0, inserted: 0, pages: 1, limited: !lauf.leer, message, searchUrl: search } };
            if (recent.size > 100) recent.clear();
            recent.set(cacheKey, { at: Date.now(), result: structuredClone(result) });
            return result;
        }
        if (source === "linkedin")
            for (let i = 0; i < Math.min(3, offers.length); i++) {
                try {
                    const detail = await importPublicOffer(offers[i].url);
                    offers[i] = { ...offers[i], ...detail };
                }
                catch { /* Keep a clearly marked incomplete offer. */ }
            }
        else if (fromList) {
            // Karten ohne Beschreibung: höchstens drei Detailseiten, Kartenangaben haben Vorrang.
            // Eine gesperrte Detailseite beendet nur die Ergänzung; die gelesene Trefferliste bleibt gültig.
            let enrichBlocked = false;
            for (let i = 0, tried = 0; i < offers.length && tried < 3 && !enrichBlocked; i++) {
                if (offers[i].complete) continue;
                tried++;
                try {
                    const detail = await importPublicOffer(offers[i].url, source), card = offers[i];
                    // Die Detailseite nennt oft die Postleitzahl, die Karte nur die Stadt; die Umkreisprüfung braucht die Postleitzahl.
                    const plz = (s: string | null) => !!s && /\b\d{5}\b/.test(s), location = plz(detail.location) && !plz(card.location) ? detail.location : card.location || detail.location;
                    // StudentJob nennt bei übernommenen Fremdanzeigen den Zulieferer („StepStone“, „Workwise“) als Arbeitgeber: keine Firma statt einer falschen.
                    const company = card.company || (source === "studentjob" ? null : detail.company);
                    offers[i] = { ...card, description: detail.description, complete: detail.complete, company, location, publishedAt: card.publishedAt || detail.publishedAt };
                }
                catch (e) { if (e instanceof SourceUnavailable && e.blocked) enrichBlocked = true; }
            }
        }
        const vollstaendig = lauf.ende && !detailBlocked, n = offers.length, seiten = `${lauf.seiten} ${lauf.seiten === 1 ? "Seite" : "Seiten"}`;
        const message = detailBlocked ? "Teiltreffer erhalten; weitere Anzeigen blockiert. Im Browser ergänzen."
            : lauf.folgeGesperrt ? `${seiten} gelesen (${n} Anzeigen); die nächste Seite wurde blockiert. ${lauf.folgeGesperrt}`
            : vollstaendig ? `Trefferliste vollständig gelesen: ${seiten}, ${n} Anzeigen.`
            : lauf.ohneBlaettern ? `Erste Seite gelesen (${n} Anzeigen); ob weitere Seiten folgen, erkennt JobPilot bei dieser Plattform nicht.`
            : lauf.nurBrowser ? `${seiten} gelesen (${n} Anzeigen); die Plattform meldet weitere Treffer, lädt sie aber nur im Browser nach.`
            : lauf.wiederholt ? `${seiten} gelesen (${n} Anzeigen); die nächste Seite wiederholt frühere Anzeigen, das Blättern ist unzuverlässig.`
            : lauf.folgeFehler ? `${seiten} gelesen (${n} Anzeigen); die nächste Seite war nicht erreichbar.`
            : `${seiten} gelesen (${n} Anzeigen); die Plattform nennt weitere Seiten, die Schutzgrenze von ${MAX_SEITEN} Seiten ist erreicht.`;
        const result = { offers, report: { source, status: detailBlocked || lauf.folgeGesperrt ? "blocked" as const : vollstaendig ? "ok" as const : "partial" as const, found: n, inserted: 0, pages: lauf.seiten, limited: !vollstaendig, message, searchUrl: search } };
        if (recent.size > 100)
            recent.clear();
        recent.set(cacheKey, { at: Date.now(), result: structuredClone(result) });
        return result;
    }
    catch (e) {
        const result = { offers: [], report: { source, status: e instanceof SourceUnavailable && e.blocked ? "blocked" as const : "error" as const, found: 0, inserted: 0, message: e instanceof SourceUnavailable ? e.message : "Quelle antwortet nicht. Suchseite öffnen oder Anzeige manuell importieren.", searchUrl: search } };
        if (recent.size > 100)
            recent.clear();
        recent.set(cacheKey, { at: Date.now(), result: structuredClone(result) });
        return result;
    }
}
