export function normalize(text: string) { return text.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[̀-ͯ]/g, ""); }
export function classifyContract(title: string, description = "") {
    // A mention of students in benefits must never turn a senior job into a student role.
    void description;
    const t = normalize(title);
    if (/\b(senior|sr\.?|lead|principal|head of|leiter|leitung)\b/.test(t)) return "senior";
    // An optional trial internship does not turn an apprenticeship into a university placement.
    if (/ausbildung|auszubild|\bazubi|duales studium/.test(t)) return "ausbildung";
    if (/\bfos\b|fachoberschul|\bschulerpraktik|\bschulpraktik|praktik[^\n]{0,20}\bschuler\b/.test(t)) return "school-internship";
    if (/initiativ|candidature spontan|unsolicited application/.test(t)) return "initiative";
    if (/pflichtpraktik/.test(t))
        return "pflichtpraktikum";
    if (/werkstud|working student|student trainee/.test(t))
        return "werkstudent";
    if (/praktik|prakt\.|internship|\bintern\b|\bstage\b/.test(t))
        return "praktikum";
    if (/studentische.*(?:hilf|mitarbeit|aushilfe)|\bshk\b|\bhiwi\b/.test(t))
        return "studentische-hilfskraft";
    if (/junior|berufseinsteiger|graduate|trainee/.test(t))
        return "junior";
    return "other";
}
export function eligibleRole(title: string, opportunityType?: string) {
    if (opportunityType === "out-of-scope") return false;
    const text = normalize(title);
    const tech = /\bit\b|informatik|software|webentwickl|programmier|\bdata\b|daten|cloud|\bki\b|\bai\b|\bsap\b|\berp\b|\bcrm\b|cyber|security|digital|devops|backend|frontend|full.?stack|netzwerk|embedded|\bux\b|\bui\b|\bgrc\b|machine learning|computer vision|\bjava\b|javascript|typescript|python|\bc\+\+|\bc#|\.net\b|\bphp\b|\bsql\b|\breact\b|angular|\bnode\b|linux|developer|entwickler|anwendungsentwickl|fachinformatik|datenbank|helpdesk|service desk|support engineer|technischer support|technical support|\bplm\b|testautomat|computer graphics|computergrafik|spieleentwickl|game dev|\bunity\b|unreal|\bapp\b|mobile|android|numerisch/.test(text);
    if (!tech && /personalentwicklung|human resources|\bhr\b|steuerberatung|umsatzsteuer|wirtschaftspruf|immobilien|sprachdozent|\bverkauf\b|content creator|social media|gestaltung und design|produktionsmanagement|\blogistik\b|\blogistics\b|kommunikation.*kultur|lieferfahr|restaurant|gastronom|\bbooking\b|artist management|weg.verwal|group communications|motion design|finanzen|controlling|konzernentwicklung|online.marketing|\bmarketing\b|talentmanagement|mitarbeiterbindung|strassenbahngleisbau|workplace.*people|investment intern|konstruktion|produktionsentwicklung|kraftfahrzeug/.test(text)) return false;
    // Nur Informatik: ohne IT-Bezug im Titel keine Stelle, außer bei einer ausdrücklichen Initiativbewerbung und bei
    // Redaktions- und Content-Stellen, die oft die Pflege von Websites meinen.
    const content = /technische.redaktion|content.management|redaktion|digitale.lern|e.learning|wissensmanagement|content.pflege|web.?content|webseite|website|\bcms\b|typo3|wordpress/.test(text);
    if (!tech && !content && opportunityType !== "initiative" && !/initiativ|spontan|unsolicited/.test(text)) return false;
    const contract = classifyContract(title);
    return !["senior", "ausbildung", "school-internship"].includes(contract) && (opportunityType === "initiative" || ["werkstudent", "praktikum", "pflichtpraktikum", "initiative", "studentische-hilfskraft"].includes(contract));
}
// Bekannte Namensvarianten derselben Firma (Niederlassungen, Rechtsformzusätze) teilen einen Schlüssel.
// Verschiedene Konzerntöchter bleiben bewusst getrennt.
const COMPANY_ALIAS_PREFIXES = ["finanzinformatik", "ferchau", "schunk", "pricewaterhousecoopers"];
export function companyKey(company: string | null | undefined, fallback: string) {
    const key = normalize(company || "").replace(/ß/g, "ss").replace(/&/g, " ")
        .replace(/\b(und|gmbh|ag|kg|co|kgaa|se|ug|mbh|inc|ltd|limited|holding|haftungsbeschrankt)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
    return !key || /^(?:employeuraverifier|unbekannt|unknown)$/.test(key) ? "unknown:" + fallback : COMPANY_ALIAS_PREFIXES.find(prefix => key.startsWith(prefix)) || key;
}
export type CompanyOption = { id: string; company?: string | null; title: string; opportunityType?: string; status: string; score: number | null; arrived?: string };
// Retain all original IDs and sent evidence. Only one representative is displayed.
// A company already applied to stays in history instead of reappearing as a new lead.
// A dismissed company also stays archived until restored; new offers cannot undo that choice.
export function selectCompanyOptions<T extends CompanyOption>(items: T[]) {
    const selected = new Map<string, T>();
    const dismissed = (item: T) => ["archived", "skipped", "rejected"].includes(item.status);
    const priority = (a: T, b: T) => Number(a.status === "applied") - Number(b.status === "applied")
        || Number(dismissed(a)) - Number(dismissed(b))
        || (a.score ?? -1) - (b.score ?? -1) || (a.arrived || "").localeCompare(b.arrived || "") || b.id.localeCompare(a.id);
    for (const item of items) {
        if (item.status !== "applied" && !dismissed(item) && !eligibleRole(item.title, item.opportunityType)) continue;
        const key = companyKey(item.company, item.id), previous = selected.get(key);
        if (!previous || priority(item, previous) > 0) selected.set(key, item);
    }
    return [...selected.values()];
}
