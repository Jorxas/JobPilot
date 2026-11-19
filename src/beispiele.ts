import type { Offer } from "./kern/core";
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
    "linkedin",
    "Knotenpunkt Systeme",
    "Werkstudent IT-Support",
    "Linux, Tickets und technische Dokumentation.",
    "Marburg",
  ),
  eintrag(
    "B03",
    "bundesagentur",
    "Bergtal Automation",
    "Praktikum Embedded Software",
    "C++, Mikrocontroller und Softwaretests.",
    "Wetzlar",
  ),
  eintrag(
    "S02",
    "stepstone",
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
export const quellenNamen = {
  arbeitgeber: 'Arbeitgeberseite',
  bundesagentur: "Bundesagentur",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  stepstone: "StepStone",
};
