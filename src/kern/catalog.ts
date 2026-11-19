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
] as const;

export type SearchQuery = { family: string; keywords: string };
const CONTRACTS = ["Werkstudent", "Praktikum"];
export function searchPlan(keywords: string, wide: boolean, round: number): SearchQuery[] {
  if (!wide) return [{ family: "custom", keywords }];
  const cycle = Math.floor(round / 6), first = (round % 6) * 4;
  const queries: SearchQuery[] = [{ family: "general", keywords: cycle % 2 ? "Praktikum Informatik" : "Werkstudent IT" }];
  if (keywords.trim()) queries.push({ family: "custom", keywords: keywords.trim() });
  for (const family of TECH_FAMILIES.slice(first, first + 4)) {
    for (let variant = 0; variant < 2; variant++) {
      const term = family.terms[(cycle * 2 + variant) % family.terms.length];
      const contract = CONTRACTS[(cycle + variant) % CONTRACTS.length];
      queries.push({ family: family.id, keywords: [contract, term].filter(Boolean).join(" ") });
    }
  }
  return queries.filter((q, i) => queries.findIndex(x => x.keywords.toLowerCase() === q.keywords.toLowerCase()) === i);
}

export function optionsFrom(value: unknown) {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { techWide: v.techWide !== false, dailyTarget: typeof v.dailyTarget === "number" && Number.isInteger(v.dailyTarget) && v.dailyTarget >= 1 && v.dailyTarget <= 20 ? v.dailyTarget : 3 };
}

export function familyMatches(title: string, description: string) {
  const text = (title + " " + description).toLocaleLowerCase("de-DE");
  return TECH_FAMILIES.filter(f => f.terms.some(t => text.includes(t.toLocaleLowerCase("de-DE")))).map(f => f.id);
}
