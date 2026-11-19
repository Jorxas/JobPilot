import { createHash } from "node:crypto";
import { type Offer, type Source, type SourceReport, searchUrl, textOnly } from "./core";
const ALLOWED = ["linkedin.com", "indeed.com", "stepstone.de", "arbeitsagentur.de"];
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
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || !ALLOWED.some(h => host === h || host.endsWith("." + h)))
        throw new SourceUnavailable("Eine HTTPS-Anzeigenadresse von LinkedIn, Indeed, StepStone oder Bundesagentur verwenden.");
    return url;
}
export function sourceOf(raw: string): Source { const host = allowedUrl(raw).hostname; return host.endsWith("linkedin.com") ? "linkedin" : host.endsWith("indeed.com") ? "indeed" : host.endsWith("stepstone.de") ? "stepstone" : "bundesagentur"; }
export async function fetchPublicHtml(raw: string, redirects = 2): Promise<{
    html: string;
    url: string;
}> {
    const url = allowedUrl(raw);
    const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; JobAssistant public offer reader)", "Accept": "text/html", "Accept-Language": "de-DE,de;q=0.9,en;q=0.7" }, signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get("location");
        if (!next || !redirects)
            throw new SourceUnavailable("Weiterleitung nicht verwertbar.");
        return fetchPublicHtml(new URL(next, url).href, redirects - 1);
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
    if (/verify you are human|unusual traffic|access denied|<title>[^<]*(?:captcha|just a moment|sign in|anmelden)/i.test(html.slice(0, 100000)))
        throw new SourceUnavailable("Die Seite verlangt eine Zugriffsprüfung oder Anmeldung. Manueller Import bleibt möglich.", true);
    return { html, url: url.href };
}
function ref(source: Source, url: string) { const u = new URL(url); return source === "linkedin" ? (u.pathname.match(/(?:-|\/)(\d{7,})(?:\/)?$/)?.[1] || createHash("sha256").update(url).digest("hex").slice(0, 24)) : source === "indeed" ? (u.searchParams.get("jk") || createHash("sha256").update(url).digest("hex").slice(0, 24)) : createHash("sha256").update(url.split("?")[0]).digest("hex").slice(0, 24); }
function cleanUrl(raw: string, base: string) { const u = allowedUrl(new URL(textOnly(raw), base).href); u.hash = ""; for (const k of [...u.searchParams.keys()])
    if (!["jk", "vjk"].includes(k))
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
            const description = typeof j.description === "string" ? textOnly(j.description) : "";
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
export function parseOffers(html: string, url: string, source: Source) { const ld = structuredOffers(html, url, source); return ld.length ? ld : source === "linkedin" ? linkedinCards(html, url) : []; }
export function linkedinDetail(html: string, url: string): Offer | null {
    const title = byClass(html, "top-card-layout__title", "h[12]") || byClass(html, "topcard__title", "h[12]"), company = byClass(html, "topcard__org-name-link") || byClass(html, "topcard__flavor--black-link"), location = byClass(html, "topcard__flavor--bullet"), description = byClass(html, "show-more-less-html__markup", "div") || byClass(html, "description__text", "div");
    return title && description.length >= 150 ? { source: "linkedin", externalRef: ref("linkedin", url), title, company: company || null, location: location || null, url, description, complete: true } : null;
}
export async function importPublicOffer(url: string) {
    const source = sourceOf(url), id = ref(source, url), target = source === "linkedin" && /^\d{7,}$/.test(id) ? "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/" + id : url, page = await fetchPublicHtml(target);
    const offers = structuredOffers(page.html, url, source);
    if (offers.length === 1)
        return offers[0];
    if (source === "linkedin") {
        const detail = linkedinDetail(page.html, url);
        if (detail)
            return detail;
    }
    throw new SourceUnavailable("Anzeige nicht zuverlässig erkannt. Titel, Unternehmen und Beschreibung manuell importieren.");
}
export async function scanPublicSource(source: "linkedin" | "indeed" | "stepstone", keywords: string, city: string, radius: number): Promise<{
    offers: Offer[];
    report: SourceReport;
}> {
    const cacheKey = [source, keywords, city, radius].join('|'), cached = recent.get(cacheKey);
    if (cached && Date.now() - cached.at < 5 * 60000)
        return structuredClone(cached.result);
    const search = searchUrl(source, keywords, city, radius);
    let target = search;
    if (source === "linkedin")
        target = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?" + new URLSearchParams({ keywords, location: city + ", Deutschland", distance: String(Math.round(radius / 1.609344)), start: "0", f_TPR: "r2592000" });
    try {
        const page = await fetchPublicHtml(target);
        const offers = parseOffers(page.html, page.url, source).slice(0, 10);
        if (!offers.length)
            return { offers: [], report: { source, status: "partial", found: 0, inserted: 0, message: "Keine Anzeige zuverlässig erkannt. Suchseite öffnen oder manuell importieren.", searchUrl: search } };
        if (source === "linkedin")
            for (let i = 0; i < Math.min(3, offers.length); i++) {
                try {
                    const detail = await importPublicOffer(offers[i].url);
                    offers[i] = { ...offers[i], ...detail };
                }
                catch { /* Keep a clearly marked incomplete offer. */ }
            }
        const complete = offers.every(o => o.complete);
        const result = { offers, report: { source, status: complete ? "ok" as const : "partial" as const, found: offers.length, inserted: 0, message: complete ? "Öffentliche Anzeigen gelesen." : "Teilweise Ergebnisse: fehlende Beschreibungen vor der Vorbereitung importieren.", searchUrl: search } };
        if (recent.size > 100)
            recent.clear();
        recent.set(cacheKey, { at: Date.now(), result: structuredClone(result) });
        return result;
    }
    catch (e) {
        const result = { offers: [], report: { source, status: e instanceof SourceUnavailable && e.blocked ? "blocked" as const : "error" as const, found: 0, inserted: 0, message: e instanceof SourceUnavailable ? e.message : "Quelle antwortet nicht. Suchseite öffnen oder Anzeige importieren.", searchUrl: search } };
        if (recent.size > 100)
            recent.clear();
        recent.set(cacheKey, { at: Date.now(), result: structuredClone(result) });
        return result;
    }
}
