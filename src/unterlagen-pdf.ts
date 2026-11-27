// Kleiner PDF-Schreiber für automatisch erstellte Bewerbungsunterlagen (öffentliche Fassung, 27. November 2026).
// Ohne Abhängigkeit und ohne Browser: Standardschriften Helvetica, Helvetica-Bold und Helvetica-Oblique (in jedem
// PDF-Betrachter vorhanden, keine Einbettung), WinAnsi-Kodierung für ä, ö, ü, ß und deutsche Anführungszeichen,
// Zeilenumbruch nach Schriftmetrik, Linien und anklickbare Verweise. Sichtbare Adressen entstehen hier nie von selbst:
// ein Verweis liegt immer auf einem Wort (Projektname, „Portfolio“, „GitHub“).

export type Farbe = readonly [number, number, number];
export type Lauf = { text: string; fett?: boolean; kursiv?: boolean; farbe?: Farbe; link?: string };

// Zeichenbreiten der Standardschriften (Adobe-Metrik, Tausendstel der Schriftgröße) für die Zeichen 32 bis 126.
const HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELVETICA_FETT = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// WinAnsi-Bytes oberhalb von ASCII, die nicht Latin-1 entsprechen.
const WINANSI: Record<string, number> = { "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f };
// Breiten der Sonderzeichen [normal, fett].
const SONDERBREITE: Record<string, readonly [number, number]> = { "ß": [611, 611], "„": [333, 500], "“": [333, 500], "”": [333, 500], "‚": [222, 278], "‘": [222, 278], "’": [222, 278], "–": [556, 556], "—": [1000, 1000], "•": [350, 350], "…": [1000, 1000], "€": [556, 556], "·": [278, 278], "§": [556, 556], "°": [400, 400], "©": [737, 737], "®": [737, 737], "«": [556, 556], "»": [556, 556], "‹": [333, 333], "›": [333, 333], "×": [584, 584], " ": [278, 278], "Æ": [1000, 1000], "æ": [889, 889], "Ø": [778, 778], "ø": [611, 611], "Œ": [1000, 1000], "œ": [944, 944], "™": [1000, 1000] };
// Zeichen ohne WinAnsi-Platz: lesbarer Ersatz statt eines Fragezeichens.
const ERSATZ: Record<string, string> = { "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ı": "i", "ħ": "h", "Ħ": "H", "−": "-", "‐": "-", "‑": "-", " ": " ", " ": " ", " ": " ", "​": "", "­": "", "\t": " ", "→": ">", "←": "<", "✓": "+", "★": "*", "∙": "·", "′": "'", "″": "\"" };

/** Ersetzt nicht darstellbare Zeichen (Kombinationszeichen werden zusammengesetzt, sonst Grundbuchstabe oder Ersatz). */
export function pdfText(text: string): string {
  let aus = "";
  for (const ch of String(text).normalize("NFC").replace(/\r?\n/g, " ")) {
    if (darstellbar(ch)) { aus += ch; continue; }
    if (ch in ERSATZ) { aus += ERSATZ[ch]; continue; }
    const basis = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    aus += [...basis].every(darstellbar) && basis ? basis : "?";
  }
  return aus;
}
function darstellbar(ch: string) {
  const c = ch.codePointAt(0)!;
  return (c >= 32 && c < 127) || (c >= 0xa0 && c <= 0xff) || ch in WINANSI;
}
function byteVon(ch: string) {
  const c = ch.codePointAt(0)!;
  return c < 256 ? c : WINANSI[ch] ?? 63;
}
function zeichenbreite(ch: string, fett: boolean): number {
  const c = ch.codePointAt(0)!;
  if (c >= 32 && c < 127) return (fett ? HELVETICA_FETT : HELVETICA)[c - 32];
  const s = SONDERBREITE[ch];
  if (s) return s[fett ? 1 : 0];
  const basis = ch.normalize("NFD")[0];
  const b = basis.codePointAt(0)!;
  return b >= 32 && b < 127 ? (fett ? HELVETICA_FETT : HELVETICA)[b - 32] : 556;
}
/** Breite eines bereits mit pdfText bereinigten Textes in Punkt. */
export function textBreite(text: string, groesse: number, fett = false) {
  let summe = 0;
  for (const ch of text) summe += zeichenbreite(ch, fett);
  return (summe * groesse) / 1000;
}
function pdfString(text: string) {
  let aus = "(";
  for (const ch of text) {
    const b = byteVon(ch);
    if (b === 40 || b === 41 || b === 92) aus += "\\" + String.fromCharCode(b);
    else if (b >= 32 && b < 127) aus += String.fromCharCode(b);
    else aus += "\\" + b.toString(8).padStart(3, "0");
  }
  return aus + ")";
}
// Metadaten (Titel, Autor) als UTF-16BE, damit jeder Name unverändert erscheint.
function pdfTextstring(text: string) {
  let hex = "FEFF";
  for (let i = 0; i < text.length; i++) hex += text.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return "<" + hex + ">";
}
const zahl = (n: number) => (Math.round(n * 100) / 100).toString();
/** Nur https-, http- und mailto-Verweise; alles andere wird nicht verlinkt. */
export function sichererVerweis(roh: string | undefined): string | undefined {
  if (!roh) return undefined;
  const wert = /^[a-z][a-z0-9+.-]*:/i.test(roh) ? roh : "https://" + roh.replace(/^\/+/, "");
  try {
    const u = new URL(wert);
    if (u.protocol === "mailto:" && /^[^@\s]+@[^@\s]+$/.test(decodeURIComponent(u.pathname))) return u.href;
    if ((u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") && !u.username && !u.password) return u.href;
  } catch { /* kein Verweis */ }
  return undefined;
}

type Teil = { text: string; stil: Omit<Lauf, "text">; breite: number; leerVor: boolean };
type Seite = { ops: string[]; links: { rect: [number, number, number, number]; uri: string }[] };
export type Rand = { links: number; rechts: number; oben: number; unten: number };
export const A4 = { breite: 595.28, hoehe: 841.89 } as const;
const SCHWARZ: Farbe = [0.118, 0.161, 0.231];

/** Setzt Text von oben nach unten auf A4-Seiten; neue Seiten entstehen, sobald der Platz nicht reicht. */
export class Setzer {
  seiten: Seite[] = [];
  y = 0;
  constructor(readonly rand: Rand, readonly grundfarbe: Farbe = SCHWARZ) { this.neueSeite(); }
  get breite() { return A4.breite - this.rand.links - this.rand.rechts; }
  private get seite() { return this.seiten[this.seiten.length - 1]; }
  neueSeite() { this.seiten.push({ ops: [], links: [] }); this.y = A4.hoehe - this.rand.oben; }
  platz(hoehe: number) { if (this.y - hoehe < this.rand.unten) this.neueSeite(); }
  abstand(hoehe: number) { this.y -= hoehe; }

  private schreiben(x: number, grundlinie: number, text: string, stil: Teil["stil"], groesse: number) {
    if (!text) return;
    const schrift = stil.fett ? "F2" : stil.kursiv ? "F3" : "F1";
    const [r, g, b] = stil.farbe || this.grundfarbe;
    this.seite.ops.push(`BT /${schrift} ${zahl(groesse)} Tf ${zahl(r)} ${zahl(g)} ${zahl(b)} rg ${zahl(x)} ${zahl(grundlinie)} Td ${pdfString(text)} Tj ET`);
    const uri = sichererVerweis(stil.link);
    if (uri) this.seite.links.push({ rect: [x, grundlinie - groesse * 0.25, x + textBreite(text, groesse, !!stil.fett), grundlinie + groesse * 0.8], uri });
  }
  private teile(laeufe: Lauf[], groesse: number): Teil[] {
    const teile: Teil[] = [];
    let leer = false;
    for (const lauf of laeufe) {
      const { text, ...stil } = lauf;
      for (const stueck of pdfText(text).split(/( +)/)) {
        if (!stueck) continue;
        if (/^ +$/.test(stueck)) { leer = true; continue; }
        teile.push({ text: stueck, stil, breite: textBreite(stueck, groesse, !!stil.fett), leerVor: leer && teile.length > 0 });
        leer = false;
      }
    }
    return teile;
  }
  /** Bricht Läufe auf die gegebene Breite um; zu lange Wörter werden zeichenweise geteilt. */
  zeilen(laeufe: Lauf[], breite: number, groesse: number): Teil[][] {
    const zeilen: Teil[][] = [];
    let zeile: Teil[] = [], b = 0;
    const leerzeichen = (t: Teil) => textBreite(" ", groesse, !!t.stil.fett);
    for (let teil of this.teile(laeufe, groesse)) {
      while (teil.breite > breite) {
        let n = teil.text.length - 1;
        while (n > 1 && textBreite(teil.text.slice(0, n), groesse, !!teil.stil.fett) > breite) n--;
        if (zeile.length) { zeilen.push(zeile); zeile = []; b = 0; }
        zeilen.push([{ ...teil, text: teil.text.slice(0, n), breite: textBreite(teil.text.slice(0, n), groesse, !!teil.stil.fett), leerVor: false }]);
        teil = { ...teil, text: teil.text.slice(n), breite: textBreite(teil.text.slice(n), groesse, !!teil.stil.fett), leerVor: false };
      }
      const zusatz = (teil.leerVor && zeile.length ? leerzeichen(teil) : 0) + teil.breite;
      if (zeile.length && b + zusatz > breite + 0.01) { zeilen.push(zeile); zeile = [{ ...teil, leerVor: false }]; b = teil.breite; }
      else { zeile.push(zeile.length ? teil : { ...teil, leerVor: false }); b += zusatz; }
    }
    if (zeile.length) zeilen.push(zeile);
    return zeilen;
  }
  private zeilenbreite(zeile: Teil[], groesse: number) {
    return zeile.reduce((s, t) => s + t.breite + (t.leerVor ? textBreite(" ", groesse, !!t.stil.fett) : 0), 0);
  }
  private zeileSchreiben(zeile: Teil[], x: number, grundlinie: number, groesse: number) {
    // Gleich gestaltete Wörter bilden ein Textstück; Verweise bleiben einzeln anklickbar.
    let start = x, text = "", stil: Teil["stil"] | null = null;
    const gleich = (a: Teil["stil"], b: Teil["stil"]) => !!a.fett === !!b.fett && !!a.kursiv === !!b.kursiv && a.link === b.link && String(a.farbe) === String(b.farbe);
    for (const teil of zeile) {
      const leer = teil.leerVor ? " " : "";
      if (stil && gleich(stil, teil.stil)) { text += leer + teil.text; continue; }
      if (stil) { this.schreiben(start, grundlinie, text, stil, groesse); start += textBreite(text, groesse, !!stil.fett); }
      if (leer) start += textBreite(" ", groesse, !!teil.stil.fett);
      text = teil.text; stil = teil.stil;
    }
    if (stil) this.schreiben(start, grundlinie, text, stil, groesse);
  }
  /** Absatz mit Umbruch. Rechtsbündig für den Absenderblock des Anschreibens. */
  absatz(laeufe: Lauf[], o: { groesse: number; zeilenfaktor?: number; einzug?: number; ausrichtung?: "links" | "rechts"; nach?: number }) {
    const zf = o.zeilenfaktor ?? 1.35, hoehe = o.groesse * zf, einzug = o.einzug ?? 0, breite = this.breite - einzug;
    for (const zeile of this.zeilen(laeufe, breite, o.groesse)) {
      this.platz(hoehe);
      const x = this.rand.links + einzug + (o.ausrichtung === "rechts" ? breite - this.zeilenbreite(zeile, o.groesse) : 0);
      this.zeileSchreiben(zeile, x, this.y - o.groesse * 0.95, o.groesse);
      this.y -= hoehe;
    }
    this.y -= o.nach ?? 0;
  }
  /** Linker Text mit Umbruch, rechter Text (Zeitraum, Kontext) bündig in derselben ersten Zeile. */
  linksRechts(links: Lauf[], rechts: Lauf[], o: { groesse: number; zeilenfaktor?: number; nach?: number }) {
    const zf = o.zeilenfaktor ?? 1.35, hoehe = o.groesse * zf;
    const rechtsZeile = rechts.length ? this.zeilen(rechts, this.breite * 0.45, o.groesse)[0] || [] : [];
    const rechtsBreite = rechtsZeile.length ? this.zeilenbreite(rechtsZeile, o.groesse) : 0;
    const zeilen = this.zeilen(links, this.breite - (rechtsBreite ? rechtsBreite + 12 : 0), o.groesse);
    zeilen.forEach((zeile, i) => {
      this.platz(hoehe);
      const grundlinie = this.y - o.groesse * 0.95;
      this.zeileSchreiben(zeile, this.rand.links, grundlinie, o.groesse);
      if (i === 0 && rechtsZeile.length) this.zeileSchreiben(rechtsZeile, this.rand.links + this.breite - rechtsBreite, grundlinie, o.groesse);
      this.y -= hoehe;
    });
    this.y -= o.nach ?? 0;
  }
  /** Aufzählungspunkt mit hängendem Einzug. */
  punkt(laeufe: Lauf[], o: { groesse: number; einzug?: number; zeilenfaktor?: number; nach?: number }) {
    const zf = o.zeilenfaktor ?? 1.3, hoehe = o.groesse * zf, einzug = o.einzug ?? 2, text = einzug + o.groesse * 1.05;
    this.zeilen(laeufe, this.breite - text, o.groesse).forEach((zeile, i) => {
      this.platz(hoehe);
      const grundlinie = this.y - o.groesse * 0.95;
      if (i === 0) this.schreiben(this.rand.links + einzug, grundlinie, "•", {}, o.groesse);
      this.zeileSchreiben(zeile, this.rand.links + text, grundlinie, o.groesse);
      this.y -= hoehe;
    });
    this.y -= o.nach ?? 0;
  }
  linie(o: { farbe: Farbe; dicke: number; vor?: number; nach?: number }) {
    this.y -= o.vor ?? 0;
    this.platz(o.dicke + 2);
    const [r, g, b] = o.farbe, y = this.y - o.dicke / 2;
    this.seite.ops.push(`q ${zahl(r)} ${zahl(g)} ${zahl(b)} RG ${zahl(o.dicke)} w ${zahl(this.rand.links)} ${zahl(y)} m ${zahl(this.rand.links + this.breite)} ${zahl(y)} l S Q`);
    this.y -= o.dicke + (o.nach ?? 0);
  }

  /** Fertige PDF-Datei (PDF 1.4, unkomprimiert, nur ASCII-Bytes im Inhalt). */
  pdf(meta: { titel: string; autor: string; datum: Date }): Buffer {
    const objekte: string[] = [];
    const neu = (inhalt: string) => { objekte.push(inhalt); return objekte.length; };
    const katalog = neu(""), seitenbaum = neu("");
    const schriften = ["Helvetica", "Helvetica-Bold", "Helvetica-Oblique"].map(s => neu(`<< /Type /Font /Subtype /Type1 /BaseFont /${s} /Encoding /WinAnsiEncoding >>`));
    const d = meta.datum.toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const info = neu(`<< /Title ${pdfTextstring(meta.titel)} /Author ${pdfTextstring(meta.autor)} /Creator (JobPilot) /Producer (JobPilot) /CreationDate (D:${d}Z) >>`);
    const kinder: number[] = [];
    for (const seite of this.seiten) {
      const strom = seite.ops.join("\n");
      const inhalt = neu(`<< /Length ${strom.length} >>\nstream\n${strom}\nendstream`);
      const verweise = seite.links.map(l => neu(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.map(zahl).join(" ")}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(l.uri)} >> >>`));
      kinder.push(neu(`<< /Type /Page /Parent ${seitenbaum} 0 R /MediaBox [0 0 ${A4.breite} ${A4.hoehe}] /Resources << /Font << /F1 ${schriften[0]} 0 R /F2 ${schriften[1]} 0 R /F3 ${schriften[2]} 0 R >> >> /Contents ${inhalt} 0 R${verweise.length ? ` /Annots [${verweise.map(v => v + " 0 R").join(" ")}]` : ""} >>`));
    }
    objekte[katalog - 1] = `<< /Type /Catalog /Pages ${seitenbaum} 0 R >>`;
    objekte[seitenbaum - 1] = `<< /Type /Pages /Kids [${kinder.map(k => k + " 0 R").join(" ")}] /Count ${kinder.length} >>`;
    let text = "%PDF-1.4\n%âãÏÓ\n";
    const positionen = objekte.map((inhalt, i) => { const p = text.length; text += `${i + 1} 0 obj\n${inhalt}\nendobj\n`; return p; });
    const xref = text.length;
    text += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n` + positionen.map(p => String(p).padStart(10, "0") + " 00000 n \n").join("");
    text += `trailer\n<< /Size ${objekte.length + 1} /Root ${katalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(text, "latin1");
  }
}

/** Sichtbarer Text einer mit diesem Modul erzeugten PDF (für Prüfungen): Textstücke je Seite in Schreibreihenfolge. */
export function pdfTextLesen(pdf: Buffer): string[] {
  const roh = pdf.toString("latin1"), seiten: string[] = [];
  for (const strom of roh.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const stuecke: string[] = [];
    for (const m of strom[1].matchAll(/\((.*?)(?<!\\)\) Tj/g))
      stuecke.push(m[1].replace(/\\([0-7]{3}|.)/g, (_, e: string) => {
        if (!/^[0-7]{3}$/.test(e)) return e;
        const b = parseInt(e, 8), ch = Object.entries(WINANSI).find(([, v]) => v === b)?.[0];
        return ch ?? String.fromCharCode(b);
      }));
    seiten.push(stuecke.join(" "));
  }
  return seiten;
}
