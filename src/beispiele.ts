import type { Offer, SourceReport } from "./kern/core";
import { KEIN_ABRUF, SOURCE_IDS, SOURCE_LABELS, platformSearchUrl, type PlatformId } from "./kern/platforms";
export type Stelle = Offer & {
  id: string;
  status: "pending" | "applied" | "archived";
  score: number;
  notiz?: string;
  nachladeVersuch?: number;
};
export const beispielprofil = {
  skills: ["Java", "TypeScript", "React", "SQL", "Python", "Docker"],
  anchoredSkills: ["Java", "React", "SQL"],
  keywords: "Werkstudent Software",
  englishBasic: true,
};
const beschreibung = (text: string) =>
  text +
  " Du unterstützt ein Entwicklungsteam bei klar begrenzten Aufgaben, arbeitest mit Code-Reviews und dokumentierst die Ergebnisse. Die Ausschreibung ist ein frei erfundenes Beispiel für diese öffentliche Demo.";
const eintrag = (
  id: string,
  source: Offer["source"],
  company: string,
  title: string,
  text: string,
  ort = "Gießen",
  complete = true,
): Stelle => ({
  id,
  source,
  externalRef: id,
  company,
  title,
  description: beschreibung(text),
  location: ort,
  url: "https://stellen.example.test/" + id,
  complete,
  status: "pending",
  score: 0,
  distanceKm: ort === "Gießen" ? 0 : 25,
});
export const angebote: Stelle[] = [
  eintrag(
    "B01",
    "bundesagentur",
    "Nordlicht Software GmbH",
    "Werkstudent Java-Entwicklung",
    "Java, SQL und Docker für interne Anwendungen.",
  ),
  eintrag(
    "L01",
    "linkedin",
    "Nordlicht Software",
    "Werkstudent Java-Entwicklung",
    "Java, SQL und Docker für interne Anwendungen.",
  ),
  eintrag(
    "B02",
    "bundesagentur",
    "Flusswerk Daten AG",
    "Praktikum Data Engineering",
    "Python, SQL und ETL. Datenqualität systematisch prüfen.",
  ),
  eintrag(
    "S01",
    "stepstone",
    "Blaupunkt Weblabor",
    "Werkstudent Frontend",
    "React und TypeScript, zugängliche Weboberflächen und Tests.",
    "Wetzlar",
  ),
  eintrag(
    "L02",
    "xing",
    "Knotenpunkt Systeme",
    "Werkstudent IT-Support",
    "Linux, Tickets und technische Dokumentation.",
    "Marburg",
  ),
  eintrag(
    "B03",
    "jobware",
    "Bergtal Automation",
    "Praktikum Embedded Software",
    "C++, Mikrocontroller und Softwaretests.",
    "Wetzlar",
  ),
  eintrag(
    "S02",
    "studentjob",
    "Wolkenfeld IT",
    "Werkstudent Cloud Engineering",
    "Docker, Kubernetes und Linux für Testumgebungen.",
    "Marburg",
    false,
  ),
  {
    ...eintrag(
      "A01",
      "linkedin",
      "Morgenrot Digital GmbH",
      "Werkstudent Softwareentwicklung",
      "Java, React und SQL.",
    ),
    status: "applied",
  },
  eintrag(
    "A02",
    "bundesagentur",
    "Morgenrot Digital",
    "Werkstudent Softwareentwicklung",
    "Java, React und SQL.",
  ),
  eintrag(
    "X01",
    "bundesagentur",
    "Demo Senior Systems",
    "Senior Java Developer",
    "Java und Docker mit langjähriger Berufserfahrung.",
  ),
  eintrag(
    "X02",
    "stepstone",
    "Demo Handel",
    "Werkstudent Verkauf",
    "Regale, Kundenberatung und Kasse.",
  ),
  eintrag(
    "B04",
    "arbeitgeber",
    "Taktgeber Prozesse",
    "Werkstudent Prozessdigitalisierung",
    "Power BI und Microsoft Power Platform. Neue Technologien bleiben im Suchraum, auch wenn sie nicht im Beispielprofil stehen.",
    "Wetzlar",
  ),
];
// Herkunft einer Stelle: Plattformname aus dem gemeinsamen Katalog, Arbeitgeberseiten gesondert.
export function quellenName(source: string) {
  return source === "arbeitgeber" ? "Arbeitgeberseite" : SOURCE_LABELS[source] || source;
}
// Simulierte Quellenberichte für Demo und synthetischen Servermodus: es wird keine Website aufgerufen.
// Gesperrte Quellen erscheinen wie im echten Betrieb (KEIN_ABRUF), alle anderen als ausdrückliche Teilabdeckung.
export function simulierteBerichte(
  quellen: readonly string[],
  stellen: readonly Pick<Offer, "source">[],
  suchbegriff: string,
  stadt: string,
  radius: number,
): SourceReport[] {
  return SOURCE_IDS.filter((id) => quellen.includes(id)).map((source: PlatformId) => {
    const gesperrt = KEIN_ABRUF[source],
      eigene = stellen.filter((s) => s.source === source).length;
    return {
      source,
      status: gesperrt
        ? gesperrt.blocked
          ? ("blocked" as const)
          : ("partial" as const)
        : source === "bundesagentur"
          ? ("ok" as const)
          : ("partial" as const),
      found: gesperrt ? 0 : eigene || (SOURCE_IDS.indexOf(source) % 4) + 1,
      inserted: 0,
      limited: source !== "bundesagentur",
      message: "Simulierter Quellenzustand; es wurde keine Website aufgerufen.",
      searchUrl: platformSearchUrl(source, suchbegriff, stadt, radius),
    };
  });
}
