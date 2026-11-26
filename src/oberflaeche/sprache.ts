// Zweisprachige Oberfläche: Deutsch ist der Standard, Französisch wird mit ?lang=fr oder dem Umschalter DE | FR gewählt.
// Der Zustand liegt in document.documentElement.lang. So teilen sich die Demo-Daten (demo.js) und die Oberfläche (app.js)
// dieselbe Sprache, obwohl beide getrennt gebündelt werden.
import { lokal } from "./modus";

export type Sprache = "de" | "fr";

export const sprache = (): Sprache => (document.documentElement.lang === "fr" ? "fr" : "de");
/** Text in der gewählten Sprache: erst Deutsch, dann Französisch. */
export const t = (de: string, fr: string) => (sprache() === "fr" ? fr : de);
export const ortsformat = () => (sprache() === "fr" ? "fr-FR" : "de-DE");

const titel = () => (lokal() ? t("JobPilot · Lokaler Server", "JobPilot · Serveur local") : t("JobPilot · Öffentliche Demo", "JobPilot · Démo publique"));

export function spracheAusAdresse(): Sprache {
  try { return new URLSearchParams(location.search).get("lang")?.toLowerCase() === "fr" ? "fr" : "de"; } catch { return "de"; }
}

/** Setzt Sprache, Adresse (?lang=fr, ohne Neuladen) und Seitentitel und benachrichtigt die Oberfläche. */
export function spracheSetzen(neu: Sprache) {
  document.documentElement.lang = neu;
  document.title = titel();
  try {
    const adresse = new URL(location.href);
    if (neu === "fr") adresse.searchParams.set("lang", "fr"); else adresse.searchParams.delete("lang");
    history.replaceState(null, "", adresse.pathname + adresse.search + adresse.hash);
  } catch { /* Adressleiste nicht änderbar: Sprache gilt trotzdem für diese Ansicht. */ }
  window.dispatchEvent(new CustomEvent("jobpilot-sprache"));
}

export function spracheStarten() { document.documentElement.lang = spracheAusAdresse(); document.title = titel(); }

// Texte der erfundenen Beispieldaten, die die Oberfläche erklärend anzeigt. Mailinhalte (Betreff, Auszug, Absender) bleiben
// im Original, weil sie als deutsche Arbeitgebermails gelten; nur die Erklärungen des Werkzeugs werden übersetzt.
const daten: Record<string, string> = {
  "Betreff und Absender passen zur versandten Bewerbung.": "L'objet et l'expéditeur correspondent à la candidature envoyée.",
  "Antwort auf die versandte Bewerbung, Betreff verweist auf die Stelle.": "Réponse à la candidature envoyée, l'objet renvoie à l'offre.",
  "Absender und Betreff passen zur Bewerbung.": "L'expéditeur et l'objet correspondent à la candidature.",
  "Mehrdeutiger Bezug: zwei Bewerbungen passen zur Nachricht.": "Référence ambiguë : deux candidatures correspondent au message.",
  "Portalhinweis ohne Inhalt: Der Text steht nur im Portal, die Mail zählt nicht als Antwort.": "Simple notification de portail : le texte n'est que dans le portail, le mail ne compte pas comme réponse.",
};
const vertrag: Record<string, string> = { Werkstudent: "Werkstudent (étudiant salarié)", Praktikum: "stage" };
export function datentext(text: string) {
  if (sprache() !== "fr") return text;
  if (daten[text]) return daten[text];
  const kenntnisse = /^Passende Kenntnisse: (.+)$/.exec(text);
  if (kenntnisse) return "Compétences correspondantes : " + kenntnisse[1];
  const art = /^Studentische Vertragsart: (.+)$/.exec(text);
  if (art) return "Type de contrat étudiant : " + (vertrag[art[1]] || art[1]);
  const initiativ = /^Initiativbewerbung: keine ausgeschriebene Stelle$/.exec(text);
  if (initiativ) return "Candidature spontanée : aucune offre publiée";
  return text;
}
