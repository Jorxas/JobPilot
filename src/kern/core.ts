// Adapted from JobScout (MIT), commit 0e820e9. See NOTICE.md.
export const SOURCES = ["bundesagentur", "linkedin", "indeed", "stepstone"] as const;
export type Source = typeof SOURCES[number] | "arbeitgeber";
export type Offer = {
    source: Source;
    externalRef: string;
    title: string;
    company: string | null;
    location: string | null;
    url: string;
    description: string;
    complete: boolean;
    publishedAt?: string;
    distanceKm?: number | null;
};
export type SourceReport = {
    source: Source;
    status: "ok" | "partial" | "blocked" | "error";
    found: number;
    inserted: number;
    message: string;
    searchUrl: string;
    keywords?: string;
    family?: string;
    pages?: number;
    limited?: boolean;
};
import { normalize, classifyContract } from "./company-catalogue";
export { normalize, classifyContract, eligibleRole, companyKey, selectCompanyOptions } from "./company-catalogue";
export function textOnly(html: string): string {
    return html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n: string) => { const code = parseInt(n.replace(/^x/i, ""), /^x/i.test(n) ? 16 : 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " "; }).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
export function offerKey(offer: Pick<Offer, "title" | "company">) {
    return [offer.company || "", offer.title].map(s => normalize(s).replace(/^bewerbung\s+(?:als\s+|um\s+)?/, '').replace(/\b(gmbh|ag|kg|co|mwd|mfd|wmd)\b/g, "").replace(/\([mwfdx /-]+\)/g, "").replace(/[^a-z0-9]/g, "")).join(":");
}
export function containsTerm(text: string, term: string) {
    const t = normalize(term).trim();
    if (t.length < 2)
        return false;
    return new RegExp(`(^|[^a-z0-9+#])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9+#])`).test(normalize(text));
}
export type Candidate = {
    skills: string[];
    anchoredSkills: string[];
    keywords: string;
    englishBasic?: boolean;
};
export function scoreOffer(offer: Pick<Offer, "title" | "description" | "complete">, candidate: Candidate) {
    const text = offer.title + " " + offer.description, matched = candidate.skills.filter(s => containsTerm(text, s)), anchored = matched.filter(s => candidate.anchoredSkills.some(a => normalize(a) === normalize(s)));
    const contract = classifyContract(offer.title, offer.description);
    const reasons: string[] = [], warnings: string[] = [];
    let score = Math.min(55, matched.length * 6 + anchored.length * 3);
    if (matched.length)
        reasons.push("Profilbegriffe: " + matched.slice(0, 8).join(", "));
    if (["werkstudent", "praktikum", "pflichtpraktikum", "studentische-hilfskraft"].includes(contract)) {
        score += 30;
        reasons.push("Studentischer Vertrag: " + contract);
    }
    else if (contract === "junior") {
        score += 15;
        reasons.push("Juniorposition");
    }
    else if (contract === "ausbildung") {
        score -= 25;
        warnings.push("Ausbildung oder duales Studium: anderer Weg als eine Werkstudentenstelle");
    }
    const tokens = normalize(candidate.keywords).split(/[^a-z0-9+#]+/).filter(t => t.length > 3 && !['werkstudent', 'praktikum', 'pflichtpraktikum', 'software', 'student'].includes(t));
    if (tokens.some(t => normalize(offer.title).includes(t)))
        score += 15;
    if (/\b(senior|lead|principal|head of)\b/i.test(offer.title)) {
        score -= 35;
        warnings.push("Erfahrene Position");
    }
    if (candidate.englishBasic && /(?:englisch|english)[^.!\n]{0,65}(?:c1|c2|fluent|verhandlungssicher)|(?:fluent|verhandlungssicher)[^.!\n]{0,30}(?:englisch|english)/i.test(text)) {
        score -= 30;
        warnings.push("Fortgeschrittenes Englisch verlangt; mit dem angegebenen Niveau vergleichen");
    }
    if (!offer.complete)
        warnings.push("Beschreibung unvollständig; vor der Dokumentvorbereitung ergänzen");
    return { score: Math.max(0, Math.min(100, Math.round(score))), contract, matched, reasons, warnings };
}
export function searchUrl(source: Source, keywords: string, city: string, radius: number) {
    if (source === "linkedin")
        return "https://www.linkedin.com/jobs/search/?" + new URLSearchParams({ keywords, location: city + ", Deutschland", distance: String(Math.round(radius / 1.609344)) });
    if (source === "indeed")
        return "https://de.indeed.com/jobs?" + new URLSearchParams({ q: keywords, l: city, radius: String(radius) });
    if (source === "stepstone")
        return "https://www.stepstone.de/jobs/" + encodeURIComponent(keywords.replace(/\s+/g, "-")) + "/in-" + encodeURIComponent(city) + "?radius=" + radius;
    return "https://www.arbeitsagentur.de/jobsuche/suche?" + new URLSearchParams({ was: keywords, wo: city, umkreis: String(radius) });
}
export function sourceSelection(value: unknown): Source[] {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return ["bundesagentur"];
    return SOURCES.filter(s => (value as Record<string, unknown>)[s] === true);
}
