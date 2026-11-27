// Nachweise, die eine Stellenanzeige ausdrücklich verlangt (27. November 2026). Gilt gleichlautend in beiden Fassungen
// (öffentlich: src/kern/nachweise.ts). Verlangte Nachweise werden ohne Klick beigelegt, sofern eine eigene Datei
// hinterlegt ist; fehlt sie, wird das offen genannt. Erkennung bewusst eng: nur ausdrückliche Nennungen, keine Vermutung.
export type NachweisArt = "enrollment" | "transcript" | "certificates";
export const NACHWEIS_TITEL: Record<NachweisArt, string> = {
  enrollment: "Immatrikulationsbescheinigung",
  transcript: "Leistungsübersicht",
  certificates: "Zeugnisse",
};
const MUSTER: Record<NachweisArt, RegExp> = {
  enrollment: /immatrikulationsbescheinigung|immatrikulationsnachweis|studienbescheinigung|studierendenbescheinigung|nachweis (?:uber |der |ihrer |deiner )?(?:die )?immatrikulation|einschreibebescheinigung|(?:certificate of|proof of) enrol{1,2}ment|enrol{1,2}ment certificate/,
  transcript: /notenspiegel|notenubersicht|notenuebersicht|leistungsubersicht|leistungsuebersicht|leistungsnachweis|notenauszug|transcript of records|\btranscripts?\b|aktuelle[nr]? noten|bisherige[nr]? (?:studien)?leistungen|grade (?:report|transcript)/,
  certificates: /\bzeugnisse?n?\b|arbeitszeugnis|abiturzeugnis|schulzeugnis|hochschulzeugnis|praktikumszeugnis|\bzertifikate\b|\b(?:relevant |work )?certificates\b|letters? of reference/,
};
// „Zeugnisse nicht erforderlich“, „ohne Anschreiben und Zeugnisse“: eine Verneinung kurz davor oder danach hebt die Nennung auf.
const VERNEINT_VOR = /\b(?:kein(?:e|en)?|ohne|nicht|no|without)\b[^.!?\n]{0,40}$/;
const VERNEINT_NACH = /^[^.!?\n]{0,30}\b(?:nicht (?:notwendig|erforderlich|noetig|notig|benotigt|benoetigt)|nicht nötig|nicht erforderlich|not required|not necessary)\b/;
const norm = (text: string) => text.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function verlangteNachweise(beschreibung: string | null | undefined): NachweisArt[] {
  const text = norm(beschreibung || "");
  if (!text.trim()) return [];
  return (Object.keys(MUSTER) as NachweisArt[]).filter(art => {
    for (const m of text.matchAll(new RegExp(MUSTER[art].source, "g"))) {
      const vor = text.slice(Math.max(0, m.index! - 60), m.index), nach = text.slice(m.index! + m[0].length, m.index! + m[0].length + 40);
      if (!VERNEINT_VOR.test(vor) && !VERNEINT_NACH.test(nach)) return true;
    }
    return false;
  });
}
