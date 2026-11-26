export const TECH_FAMILIES = [
  { id: "software", label: "Software", terms: ["Softwareentwicklung", "Software Developer", "Software Engineer", "Anwendungsentwicklung", "Programmierung"] },
  { id: "web", label: "Web", terms: ["Webentwicklung", "Web Developer", "Web Engineering", "Webanwendungen", "Webprogrammierung"] },
  { id: "frontend", label: "Frontend", terms: ["Frontend", "Front-End", "React", "Next.js", "JavaScript", "TypeScript", "UI Developer"] },
  { id: "backend", label: "Backend", terms: ["Backend", "Java", "Spring Boot", "API Developer", "REST", "Microservices", "Back-End"] },
  { id: "fullstack", label: "Full stack", terms: ["Fullstack", "Full Stack", "Full-Stack", "Webplattform", "Web Applications"] },
  { id: "mobile", label: "Mobile", terms: ["App-Entwicklung", "Mobile Development", "Android", "iOS", "Flutter", "React Native"] },
  { id: "analytics", label: "Analyse und BI", terms: ["Datenanalyse", "Data Analyst", "Business Intelligence", "Reporting", "Power BI", "Tableau", "Data Analytics"] },
  { id: "data", label: "Datenengineering", terms: ["Data Engineering", "ETL", "Datenintegration", "Data Warehouse", "SQL", "Datenbankentwicklung", "Data Engineer"] },
  { id: "ai", label: "KI und maschinelles Lernen", terms: ["Künstliche Intelligenz", "Machine Learning", "Data Science", "Deep Learning", "Generative AI", "LLM", "KI"] },
  { id: "quality", label: "Tests und Qualität", terms: ["Softwaretest", "Testautomatisierung", "QA Engineer", "Quality Assurance", "Test Engineer", "Softwarequalität", "Testing"] },
  { id: "cloud", label: "Cloud und DevOps", terms: ["DevOps", "Cloud Engineering", "Platform Engineering", "Kubernetes", "CI/CD", "Site Reliability", "Infrastructure as Code"] },
  { id: "systems", label: "Systeme", terms: ["Systemadministration", "IT-Administration", "Linux", "Windows Server", "IT Operations", "System Engineering"] },
  { id: "network", label: "Netzwerke", terms: ["Netzwerktechnik", "Network Engineer", "Netzwerkadministration", "Connectivity", "Telekommunikation", "WLAN"] },
  { id: "security", label: "IT-Sicherheit", terms: ["IT-Sicherheit", "Cybersecurity", "Informationssicherheit", "SOC Analyst", "Security Operations", "IAM", "Application Security"] },
  { id: "support", label: "IT-Support", terms: ["IT-Support", "Helpdesk", "Service Desk", "Anwendersupport", "Application Support", "First Level Support", "IT-Service"] },
  { id: "erp", label: "ERP und CRM", terms: ["SAP", "ERP", "ABAP", "S/4HANA", "Salesforce", "CRM", "Microsoft Dynamics", "Business Applications"] },
  { id: "consulting", label: "Beratung und Prozesse", terms: ["IT-Beratung", "IT Consulting", "Business Analyst IT", "Requirements Engineering", "Anforderungsmanagement", "Prozessdigitalisierung", "Digitalisierung"] },
  { id: "product", label: "IT-Produkte und Projekte", terms: ["IT-Projektmanagement", "Technical Project Management", "Product Management Software", "Product Owner IT", "PMO IT", "Technische Dokumentation"] },
  { id: "ux", label: "UX und Oberflächen", terms: ["UX Engineering", "UX/UI", "Usability", "Interaction Design", "Design Systems", "Web Accessibility", "UI Engineering"] },
  { id: "embedded", label: "Embedded und Industrie", terms: ["Embedded Software", "Embedded Systems", "Firmware", "C++", "IoT", "Robotik", "Automatisierung", "SPS", "Simulation"] },
  { id: "games", label: "Spiele und Grafik", terms: ["Game Development", "Spieleentwicklung", "Unity", "Unreal Engine", "Phaser", "Computer Graphics", "Visualization"] },
  { id: "research", label: "Forschung und Berechnung", terms: ["Wissenschaftliche Programmierung", "Research Software", "Scientific Computing", "Computer Vision", "NLP", "Numerische Simulation", "Forschungssoftware"] },
  { id: "solutions", label: "Technische Lösungen", terms: ["Technical Consultant", "Solutions Engineer", "Application Engineer", "Pre-Sales IT", "Implementation Consultant", "Customer Success Technical"] },
  { id: "platforms", label: "CMS und Automatisierung", terms: ["E-Commerce", "Shopware", "Shopify", "WordPress", "TYPO3", "Low-Code", "Power Platform", "RPA", "Magento"] },
  { id: "content", label: "Technische Inhalte und digitales Wissen", terms: ["Content Management", "Technische Redaktion", "Redaktion", "Digitale Lerninhalte", "Wissensmanagement", "E-Learning", "Content-Pflege"] },
] as const;

export type SearchQuery = { family: string; keywords: string };
export const SEARCH_PASSES = 5;
const CONTRACTS = ["Werkstudent", "Praktikum", "Studentische Mitarbeit", "Studentische Aushilfe", "Studentische Hilfskraft"];

// Stichwortkatalog je Fachgebiet. Heute gibt es nur Informatik; weitere Fachgebiete (oder von einer KI erzeugte Listen)
// kommen später als eigener Eintrag in KEYWORD_CATALOGUES beziehungsweise als eingefügte Liste, ohne dass Plan, Speicherung oder Oberfläche sich ändern.
// Reihenfolge = Nützlichkeit. Alle Vorschläge sind zunächst ausgewählt; wer will, entfernt einzelne.
export type KeywordArea = { id: string; label: string; keywords: readonly string[] };
export type KeywordCatalogue = { id: string; label: string; areas: readonly KeywordArea[] };
export const KEYWORD_CATALOGUES: readonly KeywordCatalogue[] = [{
  id: "it", label: "Informatik", areas: [
    { id: "allgemein", label: "Informatik allgemein", keywords: ["Werkstudent IT", "Werkstudent Informatik", "Praktikum Informatik", "Studentische Hilfskraft Informatik", "IT Werkstudent English", "Abschlussarbeit Informatik"] },
    { id: "entwicklung", label: "Softwareentwicklung", keywords: ["Werkstudent Softwareentwicklung", "Student Softwareentwicklung", "Praktikum Softwareentwicklung", "Werkstudent Backend"] },
    { id: "web", label: "Web, Frontend und Apps", keywords: ["Werkstudent Webentwicklung", "Werkstudent Frontend", "Werkstudent Fullstack", "Werkstudent App Entwicklung", "Werkstudent UX UI"] },
    { id: "daten", label: "Daten und KI", keywords: ["Werkstudent Data", "Werkstudent Datenanalyse", "Werkstudent Data Engineering", "Werkstudent Machine Learning", "Werkstudent KI", "Werkstudent Data Analytics"] },
    { id: "cloud", label: "Cloud und DevOps", keywords: ["Werkstudent DevOps", "Werkstudent Cloud"] },
    { id: "support", label: "Support, Systeme und Netzwerk", keywords: ["Werkstudent IT-Support", "Werkstudent Systemadministration", "Werkstudent Netzwerk"] },
    { id: "sicherheit", label: "Sicherheit", keywords: ["Werkstudent IT-Sicherheit", "Praktikum Cybersecurity"] },
    { id: "test", label: "Test und Qualität", keywords: ["Werkstudent Softwaretest", "Werkstudent QA"] },
    { id: "embedded", label: "Embedded und Technik", keywords: ["Werkstudent Embedded", "Praktikum Embedded Software"] },
    { id: "business", label: "ERP und Business-IT", keywords: ["Werkstudent SAP", "Werkstudent IT-Beratung"] },
  ],
}];
export const DEFAULT_KEYWORD_DOMAIN = "it";
export const KEYWORD_LIMIT = 40;
export function keywordCatalogue(domain: string = DEFAULT_KEYWORD_DOMAIN): KeywordCatalogue {
  return KEYWORD_CATALOGUES.find(c => c.id === domain) || KEYWORD_CATALOGUES[0];
}
export const catalogueKeywords = (domain?: string) => keywordCatalogue(domain).areas.flatMap(a => [...a.keywords]);

export function cleanKeyword(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60).trim();
}
// Gültige, eindeutige Stichwortliste (Groß-/Kleinschreibung egal), höchstens KEYWORD_LIMIT Einträge.
export function normalizeKeywordList(values: unknown, limit = KEYWORD_LIMIT): string[] {
  const seen = new Set<string>(), out: string[] = [];
  for (const value of Array.isArray(values) ? values : []) {
    const keyword = cleanKeyword(value), key = keyword.toLocaleLowerCase("de-DE");
    if (!keyword || seen.has(key)) continue;
    seen.add(key); out.push(keyword);
    if (out.length >= limit) break;
  }
  return out;
}
// Freitext mit Kommas, Semikolons oder Zeilenumbrüchen (zum Beispiel eine eingefügte KI-Liste) in einzelne Stichwörter zerlegen.
export function parseKeywordInput(text: string): string[] {
  return normalizeKeywordList(text.split(/[,;\n\r]+/));
}
const asRecord = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
// criteria.keywordList liegt im vorhandenen JSON-Feld `sources` (keine Datenbankmigration). Fehlt sie, gilt die alte Zeichenkette als einziges Stichwort.
export function keywordListFrom(criteria: { keywords?: string | null; sources?: unknown } | null | undefined): string[] {
  const list = normalizeKeywordList(asRecord(criteria?.sources).keywordList);
  if (list.length) return list;
  const legacy = cleanKeyword(criteria?.keywords);
  return legacy ? [legacy] : [];
}
export const hasSavedKeywordList = (criteria: { sources?: unknown } | null | undefined) => normalizeKeywordList(asRecord(criteria?.sources).keywordList).length > 0;
export function keywordDomainFrom(sources: unknown): string {
  const id = asRecord(sources).keywordDomain;
  return typeof id === "string" && KEYWORD_CATALOGUES.some(c => c.id === id) ? id : DEFAULT_KEYWORD_DOMAIN;
}
// Alte Aufrufer lesen weiter eine Zeichenkette: das erste validierte Stichwort.
export const legacyKeywords = (list: readonly string[]) => list[0] || "";
// Ausgangsliste der Oberfläche: gespeicherte Auswahl, sonst der gesamte Katalog (zunächst ausgewählt) nach einem vorhandenen alten Einzelbegriff.
export function initialKeywordList(criteria: { keywords?: string | null; sources?: unknown } | null | undefined, domain = DEFAULT_KEYWORD_DOMAIN): string[] {
  if (hasSavedKeywordList(criteria)) return keywordListFrom(criteria);
  return normalizeKeywordList([cleanKeyword(criteria?.keywords), ...catalogueKeywords(domain)]);
}

const lc = (value: string) => value.toLocaleLowerCase("de-DE");
function contractVariant(basis: string, variant: number) {
  const topic = basis.replace(/^(?:Werkstudent(?:en)?|Praktikum|Studentische (?:Mitarbeit|Aushilfe|Hilfskraft))\b\s*/i, "").trim() || "IT";
  const contracts = CONTRACTS.filter(c => !lc(basis).startsWith(lc(c) + " "));
  return contracts[(variant - 1) % contracts.length] + " " + topic;
}
function generalQuery(cycle: number): SearchQuery { return { family: "general", keywords: CONTRACTS[cycle % CONTRACTS.length] + (cycle % 2 ? " Informatik" : " IT") }; }
// Familienergänzung eines Durchlaufs: je Familie bis zu zwei Kombinationen aus Vertragsbezeichnung und Begriff.
function familyQueries(round: number): SearchQuery[] {
  const perPass = Math.ceil(TECH_FAMILIES.length / SEARCH_PASSES);
  const cycle = Math.floor(round / SEARCH_PASSES), first = (round % SEARCH_PASSES) * perPass, queries: SearchQuery[] = [];
  for (const family of TECH_FAMILIES.slice(first, first + perPass)) {
    if (family.id === "content") queries.push({ family: family.id, keywords: "Studentische Mitarbeit Content Management" }, { family: family.id, keywords: "Werkstudent Technische Redaktion" });
    if (family.id === "consulting") queries.push({ family: family.id, keywords: "Werkstudent Digitalisierung" });
    for (let variant = 0; variant < 2; variant++) {
      const term = family.terms[(cycle * 2 + variant) % family.terms.length];
      const contract = CONTRACTS[(cycle + variant) % CONTRACTS.length];
      queries.push({ family: family.id, keywords: [contract, term].filter(Boolean).join(" ") });
    }
  }
  return queries;
}

// Einzelplan für alte Aufrufer mit einer Zeichenkette (unverändert).
export function searchPlan(keywords: string, wide: boolean, round: number): SearchQuery[] {
  if (!wide) {
    const basis = keywords.trim() || "IT", variant = round % SEARCH_PASSES;
    return [{ family: "custom", keywords: variant === 0 ? basis : contractVariant(basis, variant) }];
  }
  // Fünf aufeinanderfolgende Durchläufe decken alle 25 Familien ab; der nächste Zyklus variiert Synonyme und Verträge.
  const queries: SearchQuery[] = [generalQuery(Math.floor(round / SEARCH_PASSES))];
  if (keywords.trim()) queries.push({ family: "custom", keywords: keywords.trim() });
  queries.push(...familyQueries(round));
  return queries.filter((q, i) => queries.findIndex(x => x.keywords.toLowerCase() === q.keywords.toLowerCase()) === i);
}

export type PassPlan = {
  pass: number; round: number;
  lanes: (SearchQuery | undefined)[]; // je Quelle (Reihenfolge der gewählten Plattformen) genau eine Anfrage
};
// Plan für einen ganzen Suchstart: JEDE Plattform erhält je Durchlauf genau eine Anfrage, fünf verschiedene je Lot.
// Die Plattform (Spur) mit Index L liest die validierte Liste ab Position (Lot × 5 + L × 5) rundum; dadurch laufen
// über mehrere Lote alle Stichwörter durch, und verschiedene Plattformen erhalten gleichzeitig verschiedene Begriffe.
// Hat die Liste weniger als fünf Einträge, füllen Familienrotation (alle IT-Bereiche) beziehungsweise andere Vertragsbezeichnungen auf.
export function batchPlan(keywordList: readonly string[], wide: boolean, startRound: number, lanes = 1): PassPlan[] {
  let list = normalizeKeywordList(keywordList);
  if (!list.length && !wide) list = ["IT"];
  const start = Number.isSafeInteger(startRound) && startRound >= 0 ? startRound : 0, cycle = Math.floor(start / SEARCH_PASSES), n = list.length;
  const count = Math.max(1, Math.floor(lanes) || 1), used = Array.from({ length: count }, () => new Set<string>());
  const passes: PassPlan[] = Array.from({ length: SEARCH_PASSES }, (_, p) => ({ pass: p + 1, round: start + p, lanes: Array.from({ length: count }, () => undefined) }));
  for (let lane = 0; lane < count; lane++) {
    const from = n ? ((cycle + lane) * SEARCH_PASSES) % n : 0, claim = (q: SearchQuery) => { const key = lc(q.keywords); if (used[lane].has(key)) return false; used[lane].add(key); return true; };
    // Erst die validierten Stichwörter (bei weniger als fünf nur so viele, wie es gibt).
    for (let p = 0; p < Math.min(SEARCH_PASSES, n); p++) { const q: SearchQuery = { family: "custom", keywords: list[(from + p) % n] }; if (claim(q)) passes[p].lanes[lane] = q; }
    // Übrige Durchläufe: Ergänzung ohne Wiederholung auf derselben Plattform.
    for (let p = 0; p < SEARCH_PASSES; p++) if (!passes[p].lanes[lane]) {
      const round = start + p, candidates: SearchQuery[] = [];
      if (wide) {
        const families = familyQueries(round).filter((q, i, all) => all.findIndex(x => x.family === q.family) === i);
        const ring = families.length ? families.map((_, i) => families[(cycle + lane + i) % families.length]) : [];
        candidates.push(...ring, generalQuery(round));
      }
      for (let variant = 1; variant <= CONTRACTS.length; variant++) for (let b = 0; b < n; b++) candidates.push({ family: "custom", keywords: contractVariant(list[(from + p + b) % n], variant) });
      if (wide) candidates.push(...familyQueries(round));
      const q = candidates.find(c => claim(c));
      if (q) passes[p].lanes[lane] = q;
    }
  }
  return passes;
}

export function optionsFrom(value: unknown) {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { techWide: v.techWide !== false, dailyTarget: typeof v.dailyTarget === "number" && Number.isInteger(v.dailyTarget) && v.dailyTarget >= 1 && v.dailyTarget <= 20 ? v.dailyTarget : 3 };
}

export function familyMatches(title: string, description: string) {
  const text = (title + " " + description).toLocaleLowerCase("de-DE");
  return TECH_FAMILIES.filter(f => f.terms.some(t => text.includes(t.toLocaleLowerCase("de-DE")))).map(f => f.id);
}
