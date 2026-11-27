// Ablauf des Knopfs „Neue Stellen suchen“ am lokalen Server, ohne React und ohne Texte (die Oberfläche formuliert sie
// zweisprachig). Derselbe Weg wie das Werkzeug werkzeuge/suche-starten.mjs: gespeicherte Kriterien, POST /api/suche mit
// indeedProvider "auto" im Hintergrund, Fortschritt über GET /api/status. Nie zwei Suchen gleichzeitig, keine Wiederholung.

export type Lauf = {
  zustand: "laeuft" | "fertig" | "fehlgeschlagen";
  beginn: string;
  ende?: string;
  durchlaeufe: number;
  abgeschlossen: number;
  gefunden: number;
  neu: number;
  vorzubereiten?: number;
  firmaAusgeschlossen?: number;
  meldung?: string;
};
export type Bericht = { source: string; status: string; found?: number; inserted?: number; limited?: boolean; skipped?: boolean; pass?: number; keywords?: string; searchUrl?: string; message?: string };
export type Auftrag = { city: string; radius: number; keywordList: string[]; quellen: string[]; breit: boolean; keywordDomain?: string; bestaetigt?: string };
export type Stand = {
  live: boolean;
  suchAktiv?: boolean;
  zustand: { modus?: string; lauf?: Lauf; berichte?: Bericht[]; auftrag?: Auftrag; runde?: number; stellen?: { id: string; status: string; addedAt?: string; archiveAuto?: boolean; company?: string | null; companyExcluded?: boolean }[] };
};
export type Abruf = (pfad: string, optionen?: RequestInit) => Promise<Response>;
export type Ergebnis =
  | { art: "gestartet"; stand: Stand }
  | { art: "belegt"; stand?: Stand }
  | { art: "aus" }
  | { art: "fehler"; meldung: string; status?: number };

export const INDEED_ANBIETER = "auto";

/** Anfrage des Knopfs; gleich der des Werkzeugs ohne Angaben (gespeicherte Kriterien, Anbieter auto). */
export function suchkoerper(a: Auftrag) {
  return {
    live: true,
    hintergrund: true,
    city: a.city,
    radius: a.radius,
    keywordList: a.keywordList,
    quellen: a.quellen,
    breit: a.breit,
    keywords: a.keywordList[0],
    indeedProvider: INDEED_ANBIETER,
  };
}

/** Läuft gerade eine Suche dieses Servers? Ein als laufend gespeicherter Lauf ohne aktiven Prozess gilt als unterbrochen. */
export const sucheLaeuft = (s?: Stand | null) => !!s?.zustand?.lauf && s.suchAktiv === true;
export const sucheUnterbrochen = (s?: Stand | null) => s?.zustand?.lauf?.zustand === "laeuft" && s.suchAktiv !== true;

const RANG = ["blocked", "error", "partial"];
/** Quellen, die nicht vollständig geantwortet haben, einmal je Quelle mit dem schwersten Grund (luecken des Originals). */
export function luecken(berichte: readonly Bericht[]) {
  const schwerster = new Map<string, string>(), weitere = new Set<string>();
  for (const r of berichte) {
    if (r.status !== "ok") {
      const alt = schwerster.get(r.source);
      if (!alt || RANG.indexOf(r.status) < RANG.indexOf(alt)) schwerster.set(r.source, r.status);
    } else if (r.limited) weitere.add(r.source);
  }
  return {
    teilweise: [...schwerster].map(([quelle, status]) => ({ quelle, status })),
    weitere: [...weitere].filter((q) => !schwerster.has(q)),
  };
}

/** Zusammenfassung eines beendeten Laufs. Eine Suche ist nie eine vollständige Marktabdeckung. */
export function ergebnisDaten(lauf: Lauf, berichte: readonly Bericht[]) {
  const l = luecken(berichte), unterbrochen = lauf.abgeschlossen < lauf.durchlaeufe;
  return {
    fehlgeschlagen: lauf.zustand === "fehlgeschlagen",
    neu: lauf.neu,
    gefunden: lauf.gefunden,
    abgeschlossen: lauf.abgeschlossen,
    durchlaeufe: lauf.durchlaeufe,
    vorzubereiten: lauf.vorzubereiten || 0,
    firmaAusgeschlossen: lauf.firmaAusgeschlossen || 0,
    teilweise: l.teilweise,
    weitere: l.weitere,
    unterbrochen,
    unvollstaendig: l.teilweise.length > 0 || l.weitere.length > 0 || unterbrochen,
    meldung: lauf.meldung || "",
  };
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Steuerung für den Knopf. Ein zweiter Aufruf während eines Starts sendet nichts; läuft bereits eine Suche (auch aus einem
 * Gespräch oder Terminal), wird keine weitere gestartet, sondern deren Fortschritt verfolgt.
 */
export function suchsteuerung(abruf: Abruf, warten: (ms: number) => Promise<void> = pause, takt = 1500) {
  let aktiv = false;
  async function stand(): Promise<Stand> {
    const r = await abruf("/api/status", { cache: "no-store" });
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.json();
  }
  async function verfolgen(beginn: string, melden: (s: Stand) => void): Promise<Stand> {
    let fehlversuche = 0;
    for (;;) {
      await warten(takt);
      let s: Stand;
      try {
        s = await stand();
        fehlversuche = 0;
      } catch {
        if (++fehlversuche > 20) throw Error("unerreichbar");
        continue;
      }
      // Direkt nach dem Start kann die Datei noch den vorigen Lauf enthalten; erst ein neuerer Lauf oder ein Ende zählt.
      const andererLauf = s.zustand?.lauf?.beginn !== beginn;
      if (andererLauf) {
        if (!s.suchAktiv || (s.zustand?.lauf?.beginn || "") > beginn) return s;
        continue;
      }
      melden(s);
      if (!sucheLaeuft(s)) return s;
    }
  }
  return {
    aktiv: () => aktiv,
    stand,
    verfolgen,
    async starten(auftrag: Auftrag, melden: (s: Stand) => void): Promise<Ergebnis> {
      if (aktiv) return { art: "belegt" };
      aktiv = true;
      try {
        const vorher = await stand();
        if (sucheLaeuft(vorher)) {
          melden(vorher);
          return { art: "belegt", stand: await verfolgen(vorher.zustand.lauf!.beginn, melden) };
        }
        if (!vorher.live) return { art: "aus" };
        const r = await abruf("/api/suche", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(suchkoerper(auftrag)),
        });
        const d = await r.json().catch(() => ({}));
        if (r.status === 409) return { art: "belegt" };
        if (r.status !== 202 || !d.zustand?.lauf?.beginn)
          return { art: "fehler", status: r.status, meldung: String(d.error || d.fehler || "HTTP " + r.status) };
        melden({ live: true, suchAktiv: true, zustand: d.zustand });
        return { art: "gestartet", stand: await verfolgen(d.zustand.lauf.beginn, melden) };
      } finally {
        aktiv = false;
      }
    },
  };
}
