import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  angebote,
  beispielprofil,
  quellenName,
  simulierteBerichte,
  type Stelle,
} from "./beispiele";
import {
  aufnehmen,
  batchPlan,
  bewerten,
  catalogueKeywords,
  firmenansicht,
  parseKeywordInput,
  pruefeManuellenImport,
  searchPlan,
  searchUrl,
  SEARCH_PASSES,
  TECH_FAMILIES,
} from "./ablauf";
import { PLATFORMS, SOURCE_IDS, SOURCE_LABELS } from "./kern/platforms";
import type { SourceReport } from "./kern/core";
import { Plattformen } from "./plattformen";
import "./stil.css";
type Ansicht = "stellen" | "ablauf" | "formular" | "technik";
type Sitzung = {
  stellen: Stelle[];
  runde: number;
  bank: { question: string; answer: string }[];
  modus?: "live";
  berichte?: SourceReport[];
  // Gewählte Plattformen (Standard: alle 21); gilt für Demo und lokale Live-Suche.
  quellen?: string[];
};
type Serverstatus = { live: boolean; indeedClaude?: boolean; geokodierung?: boolean };
type Lauf = {
  zustand: "laeuft" | "fertig" | "fehlgeschlagen";
  durchlaeufe: number;
  abgeschlossen: number;
  gefunden: number;
  neu: number;
  meldung?: string;
};
type Serverzustand = { stellen: Stelle[]; runde: number; berichte: SourceReport[]; lauf?: Lauf };
const FAMILIEN_JE_DURCHLAUF = Math.ceil(TECH_FAMILIES.length / SEARCH_PASSES);
// Gespeicherte Auswahl in Katalogreihenfolge; fehlt sie oder ist sie unlesbar, gelten alle 21 Plattformen.
const gewaehlteQuellen = (wert: unknown) =>
  SOURCE_IDS.filter((id) =>
    (Array.isArray(wert) ? wert : SOURCE_IDS).includes(id),
  );
const neu = (): Sitzung => ({
  stellen: aufnehmen(
    angebote.filter((s) => s.status === "applied"),
    angebote,
    beispielprofil,
  ).stellen,
  runde: 0,
  bank: [],
});
const laden = () => {
  try {
    const s = JSON.parse(localStorage.getItem("jobpilot-demo-v1") || "null");
    if (
      s &&
      Array.isArray(s.stellen) &&
      Number.isInteger(s.runde) &&
      Array.isArray(s.bank)
    )
      return s as Sitzung;
  } catch {}
  return neu();
};
function Zeichen({ art = "suche" }: { art?: string }) {
  const pfade: Record<string, string> = {
    suche: "m21 21-5-5M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14",
    raster: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
    ablauf: "M4 5h16M4 12h16M4 19h16M8 2v6m8 1v6m-8 1v6",
    formular: "M7 3h10l3 3v15H4V3h3m1 6h8m-8 5h8m-8 4h5",
    code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
    pfeil: "M5 19 19 5M5 5h14v14",
    plus: "M12 4v16M4 12h16",
    haken: "m4 12 5 5L20 6",
    kreis: "M21 12a9 9 0 1 1-3-7M21 3v6h-6",
    filter: "M3 5h18M6 12h12M10 19h4",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pfade[art] || pfade.suche} />
    </svg>
  );
}
function Anwendung() {
  const [sitzung, setzeSitzung] = useState(laden),
    [ansicht, setzeAnsicht] = useState<Ansicht>("stellen"),
    [suche, setzeSuche] = useState(""),
    [status, setzeStatus] = useState("alle"),
    [quelle, setzeQuelle] = useState("alle"),
    [aktiv, setzeAktiv] = useState(""),
    [meldung, setzeMeldung] = useState(
      "Beispieldaten geladen. Alle Unternehmen und Stellen sind frei erfunden.",
    ),
    [beschaeftigt, setzeBeschaeftigt] = useState(false),
    [importOffen, setzeImportOffen] = useState(false),
    [mobil, setzeMobil] = useState(false),
    [server, setzeServer] = useState<Serverstatus | null>(null),
    [live, setzeLive] = useState(false),
    [profiltext, setzeProfiltext] = useState(beispielprofil.skills.join(", ")),
    [formularmeldung, setzeFormularmeldung] = useState(
      "Das Übungsformular ist bereit.",
    ),
    [bankBereit, setzeBankBereit] = useState(false),
    [formularBereit, setzeFormularBereit] = useState(false),
    [stadt, setzeStadt] = useState("Gießen"),
    [radius, setzeRadius] = useState(100),
    [begriffe, setzeBegriffe] = useState(beispielprofil.keywords);
  const rahmen = useRef<HTMLIFrameElement>(null);
  const setzeFormularRahmen=useCallback((element:HTMLIFrameElement|null)=>{rahmen.current=element;if(!element)setzeFormularBereit(false);},[]);
  useEffect(() => {
    try {
      localStorage.setItem("jobpilot-demo-v1", JSON.stringify(sitzung));
    } catch {
      setzeMeldung(
        "Browserspeicher nicht verfügbar. Änderungen gelten nur bis zum Neuladen.",
      );
    }
  }, [sitzung]);
  useEffect(() => {
    if (["127.0.0.1", "localhost"].includes(location.hostname) && location.pathname === '/')
      fetch("/api/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.modus !== "lokaler Server") return;
          setzeServer(d);
          if (d.zustand?.lauf?.zustand === "laeuft")
            setzeMeldung(
              "Am lokalen Server läuft noch ein Suchstart. Neue Stellen erscheinen nach dessen Abschluss.",
            );
        })
        .catch(() => {});
  }, []);
  const profil = {
    ...beispielprofil,
    skills: profiltext
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const alle = useMemo(
    () => bewerten(sitzung.stellen, profil),
    [sitzung.stellen, profiltext],
  );
  const firmen = firmenansicht(alle);
  const sichtbar = firmen.filter(
    (s) =>
      (status === "alle" || s.status === status) &&
      (quelle === "alle" || s.source === quelle) &&
      [s.title, s.company, s.location, s.description]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(suche.toLocaleLowerCase("de")),
  );
  const gewaehlt = sichtbar.find((s) => s.id === aktiv) || sichtbar[0];
  const durchlauf = sitzung.runde % SEARCH_PASSES,
    plan = searchPlan(beispielprofil.keywords, true, durchlauf),
    familien = TECH_FAMILIES.slice(
      durchlauf * FAMILIEN_JE_DURCHLAUF,
      (durchlauf + 1) * FAMILIEN_JE_DURCHLAUF,
    );
  const quellen = gewaehlteQuellen(sitzung.quellen),
    begriffsliste = parseKeywordInput(begriffe),
    erstbegriff = begriffsliste[0] || beispielprofil.keywords;
  // Spurplan wie im Original: jede gewählte Plattform erhält je Durchlauf genau eine Anfrage.
  const verteilung = new Map<string, string[]>();
  batchPlan(begriffsliste, true, 0, quellen.length)[durchlauf].lanes.forEach(
    (q, i) => {
      if (q)
        verteilung.set(q.keywords, [
          ...(verteilung.get(q.keywords) || []),
          SOURCE_LABELS[quellen[i]],
        ]);
    },
  );
  const vorhandeneQuellen = [
    ...SOURCE_IDS.filter((id) => firmen.some((s) => s.source === id)),
    ...(firmen.some((s) => s.source === "arbeitgeber")
      ? (["arbeitgeber"] as const)
      : []),
  ];
  const statistik = {
    offen: firmen.filter((s) => s.status === "pending").length,
    versandt: firmen.filter((s) => s.status === "applied").length,
    archiv: firmen.filter((s) => s.status === "archived").length,
  };
  function plattformWechseln(id: string, an: boolean) {
    setzeSitzung((s) => {
      const vorher = gewaehlteQuellen(s.quellen);
      const danach = an
        ? SOURCE_IDS.filter((q) => q === id || vorher.includes(q))
        : vorher.filter((q) => q !== id);
      return danach.length ? { ...s, quellen: danach } : s;
    });
  }
  function serverstandUebernehmen(z: Serverzustand) {
    setzeSitzung((s) => ({
      ...s,
      stellen: z.stellen,
      runde: z.runde,
      modus: "live",
      berichte: z.berichte,
    }));
    const l = z.lauf;
    if (!l) return;
    setzeMeldung(
      l.zustand === "laeuft"
        ? `Lokale Live-Suche läuft: Durchlauf ${Math.min(l.abgeschlossen + 1, l.durchlaeufe)} von ${l.durchlaeufe}, bisher ${l.neu} ${l.neu === 1 ? "neue Stelle" : "neue Stellen"}. Blockierte Quellen werden in diesem Suchstart nicht erneut gefragt.`
        : l.zustand === "fehlgeschlagen"
          ? `Lokale Live-Suche abgebrochen: ${l.meldung || "unbekannter Fehler"}. Bereits gelesene Stellen bleiben gespeichert.`
          : `Lokale Live-Suche beendet: ${l.neu} ${l.neu === 1 ? "neue Stelle" : "neue Stellen"} aus ${l.gefunden} gelesenen Treffern in ${l.abgeschlossen} von ${l.durchlaeufe} Durchläufen. Teilabdeckung, keine vollständige Marktabdeckung.${l.meldung ? " " + l.meldung : ""}`,
    );
  }
  async function liveSuchen() {
    const r = await fetch("/api/suche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        live: true,
        hintergrund: true,
        city: stadt,
        radius,
        keywords: erstbegriff,
        keywordList: begriffsliste,
        quellen,
        // Indeed über Claude nur bei diesem ausdrücklichen Klick und nur mit Freigabe am Server.
        indeedUeberClaude: !!server?.indeedClaude && quellen.includes("indeed"),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.fehler);
    let z: Serverzustand = d.zustand,
      fehlversuche = 0;
    // Der Server arbeitet unabhängig von dieser Verbindung; der Stand wird nach jeder Anfrage gespeichert.
    while (z.lauf?.zustand === "laeuft") {
      serverstandUebernehmen(z);
      await new Promise((weiter) => setTimeout(weiter, 1500));
      try {
        const s = await fetch("/api/status");
        if (!s.ok) throw Error();
        z = (await s.json()).zustand;
        fehlversuche = 0;
      } catch {
        if (++fehlversuche > 20)
          throw Error(
            "Der lokale Server antwortet nicht mehr. Seite neu laden, um den gespeicherten Stand zu sehen.",
          );
      }
    }
    serverstandUebernehmen(z);
  }
  async function suchen() {
    setzeBeschaeftigt(true);
    try {
      if (server && live) {
        await liveSuchen();
      } else {
        const r = aufnehmen(sitzung.stellen, angebote, profil);
        setzeSitzung((s) => ({
          ...s,
          stellen: r.stellen,
          runde: s.runde + 1,
          modus: undefined,
          berichte: simulierteBerichte(
            quellen,
            angebote,
            erstbegriff,
            stadt,
            radius,
          ),
        }));
        setzeMeldung(
          `Demodurchlauf ${sitzung.runde + 1}: ${r.neu} neu, ${r.doppelt} Dubletten, ${r.ausgeschlossen} fachlich ausgeschlossen. Keine externe Suche ausgeführt.`,
        );
      }
    } catch (e) {
      setzeMeldung(e instanceof Error ? e.message : "Suche fehlgeschlagen.");
    } finally {
      setzeBeschaeftigt(false);
    }
  }
  async function statusAendern(id: string, wert: Stelle["status"]) {
    if (sitzung.modus === "live" && server) {
      try {
        const r = await fetch("/api/status-aendern", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, status: wert }),
        });
        if (!r.ok)
          throw Error(
            "Status konnte nicht am lokalen Server gespeichert werden.",
          );
      } catch (e) {
        setzeMeldung(
          e instanceof Error ? e.message : "Status nicht gespeichert.",
        );
        return;
      }
    }
    setzeSitzung((s) => ({
      ...s,
      stellen: s.stellen.map((x) => (x.id === id ? { ...x, status: wert } : x)),
    }));
    setzeMeldung(
      wert === "applied"
        ? "Nur der lokale Demostatus wurde geändert. Keine Bewerbung versendet."
        : "Demostatus gespeichert; die Firmenhistorie bleibt erhalten.",
    );
  }
  function zuruecksetzen() {
    setzeSitzung(neu());
    setzeLive(false);
    setzeSuche("");
    setzeStatus("alle");
    setzeQuelle("alle");
    setzeAktiv("");
    setzeProfiltext(beispielprofil.skills.join(", "));
    setzeBankBereit(false);
    setzeFormularBereit(false);
    setzeMeldung(
      "Demo zurückgesetzt. Es wurden keine echten Bewerbungsdaten verändert.",
    );
    if (rahmen.current) rahmen.current.src = "./formular/index.html";
  }
  function exportieren() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            hinweis: "Synthetische JobPilot-Demo. Keine realen Bewerbungen.",
            ...sitzung,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "jobpilot-demostand.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importieren(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const f = new FormData(e.currentTarget),
        daten = Object.fromEntries(f.entries()),
        o = pruefeManuellenImport(daten);
      let r = aufnehmen(sitzung.stellen, [o], profil);
      if (sitzung.modus === "live" && server) {
        const antwort = await fetch("/api/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(daten),
          }),
          d = await antwort.json();
        if (!antwort.ok) throw Error(d.fehler);
        r = d;
      }
      setzeSitzung((s) => ({ ...s, stellen: r.stellen }));
      setzeMeldung(
        `Manuell importiert: ${r.neu} neu, ${r.doppelt} bereits vorhanden, ${r.ausgeschlossen} ausgeschlossen.`,
      );
      setzeImportOffen(false);
    } catch (e) {
      setzeMeldung(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    }
  }
  async function beschreibungErgaenzen(
    e: React.FormEvent<HTMLFormElement>,
    id: string,
  ) {
    e.preventDefault();
    const beschreibung = String(
      new FormData(e.currentTarget).get("description") || "",
    ).trim();
    if (beschreibung.length < 150 || beschreibung.length > 20000) {
      setzeMeldung("Bitte 150 bis 20.000 Zeichen als Beschreibung eintragen.");
      return;
    }
    try {
      if (sitzung.modus === "live" && server) {
        const r = await fetch("/api/beschreibung", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, description: beschreibung }),
        });
        if (!r.ok) throw Error("Beschreibung konnte nicht gespeichert werden.");
      }
      setzeSitzung((s) => ({
        ...s,
        stellen: s.stellen.map((x) =>
          x.id === id ? { ...x, description: beschreibung, complete: true } : x,
        ),
      }));
      setzeMeldung(
        "Beschreibung manuell ergänzt. Die Firma und ihr Status bleiben erhalten.",
      );
    } catch (e) {
      setzeMeldung(
        e instanceof Error ? e.message : "Beschreibung nicht gespeichert.",
      );
    }
  }
  async function formularFuellen(merken = false) {
    const fenster = rahmen.current?.contentWindow as
      | (Window & {
          jobAssistantFields?: {
            run: (
              profil: Record<string, string>,
              bank: unknown[],
            ) => Promise<{ count: number; pending: { question: string }[] }>;
            clean: (s: string) => string;
          };
        })
      | null;
    const motor = fenster?.jobAssistantFields;
    if (!motor) {
      setzeFormularmeldung(
        "Formular wird noch geladen. Bitte erneut versuchen.",
      );
      return;
    }
    const bank = merken
      ? [
          {
            question: motor.clean("Wie haben Sie von uns gehört?"),
            answer: "StepStone",
          },
        ]
      : sitzung.bank;
    try {
      const r = await motor.run(
        {
          firstName: "Alex",
          lastName: "Beispiel",
          email: "alex@example.test",
          city: "Musterstadt",
        },
        bank,
      );
      if (merken) setzeSitzung((s) => ({ ...s, bank }));
      setzeBankBereit(true);
      setzeFormularmeldung(
        `${r.count} Felder in diesem Durchlauf ausgefüllt. Offene Fragen: ${r.pending.length}. Talentpool-Zustimmung bleibt ohne ausdrückliche Antwort leer.`,
      );
    } catch {
      setzeFormularmeldung(
        "Das Übungsformular konnte nicht vollständig gelesen werden.",
      );
    }
  }
  return (
    <div className="anwendung">
      <a className="sprung" href="#inhalt">
        Zum Inhalt
      </a>
      <aside className={`seitenleiste ${mobil ? "offen" : ""}`}>
        <a href="./" className="logo">
          <span>
            <Zeichen art="ablauf" />
          </span>
          JobPilot<b>↗</b>
        </a>
        <p className="seitenetikett">DEIN NÄCHSTER SCHRITT.</p>
        <nav aria-label="Arbeitsbereiche">
          {(
            [
              { id: "stellen", name: "Stellenübersicht", icon: "raster" },
              { id: "ablauf", name: "Suchmechanik", icon: "ablauf" },
              { id: "formular", name: "Formularassistent", icon: "formular" },
              { id: "technik", name: "Aufbau & Grenzen", icon: "code" },
            ] as const
          ).map((n) => (
            <button
              key={n.id}
              aria-current={ansicht === n.id ? "page" : undefined}
              onClick={() => {
                setzeAnsicht(n.id);
                setzeMobil(false);
              }}
            >
              <Zeichen art={n.icon} />
              {n.name}
              {n.id === "stellen" && <small>{firmen.length}</small>}
            </button>
          ))}
        </nav>
        <div className="seiteninfo">
          <span className="statuspunkt" /> Öffentliche Projektdemo
          <p>
            Fiktive Angebote.
            <br />
            Realer Such- und Bewertungs­kern.
          </p>
          <a
            href="https://github.com/Jorxas/JobPilot"
            target="_blank"
            rel="noopener noreferrer"
          >
            Quellcode ansehen <Zeichen art="pfeil" />
          </a>
        </div>
        <div className="demoprofil">
          <span>AB</span>
          <div>
            Alex Beispiel<small>Fiktives Beispielprofil</small>
          </div>
        </div>
      </aside>
      <div className="arbeitsplatz">
        <header className="kopf">
          <button
            className="mobilknopf"
            onClick={() => setzeMobil(!mobil)}
            aria-label="Navigation öffnen"
            aria-expanded={mobil}
          >
            ☰
          </button>
          <div>
            ARBEITSPLATZ{" "}
            <span>
              /{" "}
              {ansicht === "stellen"
                ? "STELLEN"
                : ansicht === "ablauf"
                  ? "SUCHMECHANIK"
                  : ansicht === "formular"
                    ? "FORMULARE"
                    : "TECHNIK"}
            </span>
          </div>
          <span className="demomarke">
            ●{" "}
            {sitzung.modus === "live"
              ? "Lokale Quellenresultate"
              : "Synthetische Demo"}
          </span>
          <button
            className="symbolknopf"
            onClick={zuruecksetzen}
            aria-label="Demo zurücksetzen"
          >
            <Zeichen art="kreis" />
          </button>
        </header>
        <main id="inhalt">
          <div className="seitentitel">
            <div>
              <p className="augenbraue">VON DER SUCHE ZUM ÜBERBLICK</p>
              <h1>
                {ansicht === "stellen" ? (
                  <>
                    Die nächste Chance.
                    <br />
                    <span>Mit klarem Überblick.</span>
                  </>
                ) : ansicht === "ablauf" ? (
                  <>
                    Breiter suchen.
                    <br />
                    <span>Nachvollziehbar auswählen.</span>
                  </>
                ) : ansicht === "formular" ? (
                  <>
                    Einmal beantworten.
                    <br />
                    <span>Gezielt wiederverwenden.</span>
                  </>
                ) : (
                  <>
                    Ein Werkzeug aus
                    <br />
                    <span>einem echten Arbeitsablauf.</span>
                  </>
                )}
              </h1>
              <p>
                {ansicht === "stellen"
                  ? "Stellen sammeln, Anforderungen vergleichen und den nächsten Schritt vorbereiten. Ein durchgängiger Ablauf statt verstreuter Tabs."
                  : "Die öffentliche Fassung macht die Mechanismen mit Beispieldaten zugänglich. Private Kontakte, Lebensläufe und Versandprotokolle sind nicht enthalten."}
              </p>
            </div>
            <div className="titelaktionen">
              <button
                className="knopf weiss"
                onClick={() => {
                  setzeAnsicht("stellen");
                  setzeImportOffen(!importOffen);
                }}
              >
                <Zeichen art="plus" /> Manuell importieren
              </button>
              <button
                className="knopf blau"
                onClick={suchen}
                disabled={beschaeftigt}
              >
                <Zeichen art="suche" />
                {beschaeftigt
                  ? "Suche läuft …"
                  : live
                    ? "Live-Suche starten"
                    : "Demodurchlauf starten"}
              </button>
            </div>
          </div>
          <div className="demohinweis">
            <span>{sitzung.modus === "live" ? "LOKAL" : "DEMO"}</span>{" "}
            {sitzung.modus === "live"
              ? "Ergebnisse aus freigeschalteten lokalen Quellenabrufen. Vergleich mit dem ausdrücklich bearbeitbaren Beispielprofil; keine Bewerbung wird versendet."
              : "Alle angezeigten Unternehmen und Stellen sind synthetisch. Quellenzugriffe sind in der Webdemo simuliert. Es werden keine Bewerbungen versendet."}
          </div>
          <p className="rueckmeldung" role="status">
            {meldung}
          </p>
          {ansicht === "stellen" && (
            <>
              <div className="kennzahlen">
                <div>
                  <span>Unternehmen im Überblick</span>
                  <strong>
                    {firmen.length}
                    <small>nach Zusammenführung</small>
                  </strong>
                  <Zeichen art="raster" />
                </div>
                <div>
                  <span>Offene Chancen</span>
                  <strong>
                    {statistik.offen}
                    <small>für den nächsten Schritt</small>
                  </strong>
                  <Zeichen art="pfeil" />
                </div>
                <div>
                  <span>Als beworben markiert</span>
                  <strong>
                    {statistik.versandt}
                    <small>nur fiktive Demohistorie</small>
                  </strong>
                  <Zeichen art="haken" />
                </div>
              </div>
              <Plattformen
                quellen={quellen}
                berichte={sitzung.berichte}
                simuliert={sitzung.modus !== "live"}
                begriff={erstbegriff}
                stadt={stadt}
                radius={radius}
                indeedClaude={!!server?.indeedClaude}
                wechseln={plattformWechseln}
              />
              {importOffen && (
                <form className="importformular" onSubmit={importieren}>
                  <div className="blocktitel">
                    <h2>Eine Anzeige manuell übernehmen</h2>
                    <button
                      type="button"
                      onClick={() => setzeImportOffen(false)}
                    >
                      Schließen ×
                    </button>
                  </div>
                  <p>
                    Bitte in dieser öffentlichen Demo ausschließlich erfundene
                    Angaben verwenden.
                  </p>
                  <div className="formularraster">
                    <label>
                      Titel
                      <input
                        name="title"
                        required
                        defaultValue="Werkstudent Python"
                      />
                    </label>
                    <label>
                      Unternehmen
                      <input
                        name="company"
                        required
                        defaultValue="Beispielwerk GmbH"
                      />
                    </label>
                    <label>
                      Ort
                      <input name="location" defaultValue="Gießen" />
                    </label>
                    <label>
                      HTTPS-Link
                      <input
                        name="url"
                        type="url"
                        required
                        defaultValue="https://stellen.example.test/manuell"
                      />
                    </label>
                    <label className="vollebreite">
                      Beschreibung
                      <textarea
                        name="description"
                        required
                        defaultValue="Python, SQL und Datenanalyse in einem kleinen Entwicklungsteam. Dies ist eine synthetische Beispielausschreibung mit klaren Aufgaben zur Aufbereitung und Prüfung von Daten sowie zur Dokumentation der Ergebnisse."
                      />
                    </label>
                  </div>
                  <button className="knopf blau">Anzeige übernehmen</button>
                </form>
              )}
              <div className="hauptgitter">
                <section className="stellenblock">
                  <div className="blocktitel">
                    <div>
                      <h2>
                        Deine Stellenübersicht <span>{sichtbar.length}</span>
                      </h2>
                      <p>Ein Unternehmen, ein nächster Schritt.</p>
                    </div>
                    <button
                      className="symbolknopf"
                      onClick={exportieren}
                      aria-label="Demostand exportieren"
                    >
                      ↓
                    </button>
                  </div>
                  <div className="filterzeile">
                    <label className="suchfeld">
                      <Zeichen />
                      <input
                        type="search"
                        placeholder="Titel, Unternehmen oder Technologie"
                        aria-label="Stellen durchsuchen"
                        value={suche}
                        onChange={(e) => setzeSuche(e.target.value)}
                      />
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setzeStatus(e.target.value)}
                      aria-label="Bewerbungsstatus"
                    >
                      <option value="alle">Alle Status</option>
                      <option value="pending">Offen</option>
                      <option value="applied">Beworben</option>
                      <option value="archived">Archiviert</option>
                    </select>
                    <select
                      value={quelle}
                      onChange={(e) => setzeQuelle(e.target.value)}
                      aria-label="Quelle filtern"
                    >
                      <option value="alle">Alle Quellen</option>
                      {vorhandeneQuellen.map((q) => (
                        <option key={q} value={q}>
                          {quellenName(q)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="listenlegende">
                    <span>UNTERNEHMEN & AUFGABE</span>
                    <span>VERGLEICHSWERT</span>
                  </div>
                  <div className="stellenliste">
                    {sichtbar.map((s, i) => (
                      <button
                        className={`stellenzeile ${gewaehlt?.id === s.id ? "gewaehlt" : ""}`}
                        key={s.id}
                        onClick={() => setzeAktiv(s.id)}
                        aria-label={`Stelle öffnen: ${s.company}`}
                      >
                        <span className={`firmenzeichen farbe${i % 4}`}>
                          {(s.company || "U")
                            .split(" ")
                            .slice(0, 2)
                            .map((w) => w[0])
                            .join("")}
                        </span>
                        <span className="stellenkurz">
                          <strong>{s.company}</strong>
                          <span>{s.title}</span>
                          <small>
                            {s.location} <b>·</b> {quellenName(s.source)}{" "}
                            <b>·</b>{" "}
                            {s.status === "applied"
                              ? "Beworben"
                              : s.status === "archived"
                                ? "Archiviert"
                                : "Offen"}
                          </small>
                        </span>
                        <span className="vergleich">
                          <strong>
                            {s.score}
                            <small>/100</small>
                          </strong>
                          <span
                            style={
                              { "--wert": s.score + "%" } as React.CSSProperties
                            }
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                  {!sichtbar.length && (
                    <div className="leer">
                      <h3>Kein passender Treffer.</h3>
                      <p>
                        Suche oder Filter ändern, um weitere Beispiele zu sehen.
                      </p>
                      <button
                        onClick={() => {
                          setzeSuche("");
                          setzeStatus("alle");
                          setzeQuelle("alle");
                        }}
                      >
                        Filter zurücksetzen
                      </button>
                    </div>
                  )}
                  <p className="listenfuss">
                    Vergleichswert = regelbasierte Heuristik, keine
                    Einstellungswahrscheinlichkeit.
                  </p>
                </section>
                <aside className="detailblock">
                  {gewaehlt ? (
                    <>
                      <div className="detailmarke">
                        STELLE IM FOKUS <Zeichen art="pfeil" />
                      </div>
                      <span className="detailfirma">{gewaehlt.company}</span>
                      <h2>{gewaehlt.title}</h2>
                      <p className="detailort">
                        {gewaehlt.location} · {quellenName(gewaehlt.source)}
                      </p>
                      <div className="detailwertung">
                        <strong>
                          {gewaehlt.score}
                          <span>/100</span>
                        </strong>
                        <div>
                          Nachvollziehbarer Vergleich
                          <small>
                            {gewaehlt.matched.length} Begriffe im Beispielprofil
                          </small>
                        </div>
                      </div>
                      <h3>Erkannte Übereinstimmungen</h3>
                      <div className="techniken">
                        {gewaehlt.matched.length ? (
                          gewaehlt.matched.map((t) => <span key={t}>{t}</span>)
                        ) : (
                          <p>
                            Andere Technologien bleiben als Lernchance sichtbar.
                          </p>
                        )}
                      </div>
                      <h3>Die Aufgabe</h3>
                      <p className="beschreibung">{gewaehlt.description}</p>
                      {!gewaehlt.complete && (
                        <div className="hinweis">
                          Beschreibung unvollständig. Vor dem Vorbereiten von
                          Unterlagen ergänzen.
                          <details>
                            <summary>Beschreibung ergänzen</summary>
                            <form
                              onSubmit={(e) =>
                                beschreibungErgaenzen(e, gewaehlt.id)
                              }
                            >
                              <label>
                                Vollständige Anzeigenbeschreibung
                                <textarea
                                  name="description"
                                  minLength={150}
                                  maxLength={20000}
                                  required
                                />
                              </label>
                              <button className="knopf weiss" type="submit">
                                Beschreibung speichern
                              </button>
                            </form>
                          </details>
                        </div>
                      )}
                      <h3>Nächster Schritt</h3>
                      <p className="beschreibung">
                        Bewerbungsweg und Originalanzeige prüfen. Ein bloßer
                        Kontakt ist kein Nachweis für eine erlaubte Bewerbung
                        per E-Mail.
                      </p>
                      <label className="statusauswahl">
                        Lokaler Demostatus
                        <select
                          value={gewaehlt.status}
                          onChange={(e) =>
                            statusAendern(
                              gewaehlt.id,
                              e.target.value as Stelle["status"],
                            )
                          }
                        >
                          <option value="pending">Offen</option>
                          <option value="applied">Beworben</option>
                          <option value="archived">Archiviert</option>
                        </select>
                      </label>
                      <button
                        className="knopf blau voll"
                        onClick={() => setzeAnsicht("formular")}
                      >
                        Formularablauf verstehen <Zeichen art="pfeil" />
                      </button>
                      {sitzung.modus === "live" &&
                      gewaehlt.url.startsWith("https://") ? (
                        <a
                          className="knopf weiss voll"
                          href={gewaehlt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Originalanzeige öffnen <Zeichen art="pfeil" />
                        </a>
                      ) : (
                        <p className="detailfuss">
                          Die Beispieladresse wird nicht als echte
                          Stellenanzeige geöffnet.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="leer">Eine Stelle auswählen.</p>
                  )}
                </aside>
              </div>
            </>
          )}
          {ansicht === "ablauf" && (
            <>
              <div className="mechanikkopf">
                <div>
                  <span className="rundenmarke">
                    DURCHLÄUFE {sitzung.runde}
                  </span>
                  <h2>
                    {TECH_FAMILIES.length} Technikfelder. {SEARCH_PASSES}{" "}
                    Durchläufe je Suchstart.
                  </h2>
                  <p>
                    {FAMILIEN_JE_DURCHLAUF} Themenfelder pro Durchlauf, mit
                    Varianten für Werkstudentenstellen, Praktika und
                    studentische Mitarbeit. Jede gewählte Plattform erhält je
                    Durchlauf genau eine Anfrage. Fehlende Kenntnisse schließen
                    ein Thema nicht aus.
                  </p>
                </div>
                <div
                  className="rundenschalter"
                  role="group"
                  aria-label="Durchlauf auswählen"
                >
                  {Array.from({ length: SEARCH_PASSES }, (_, i) => (
                    <button
                      aria-pressed={durchlauf === i}
                      key={i}
                      onClick={() => setzeSitzung((s) => ({ ...s, runde: i }))}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="familienraster">
                {TECH_FAMILIES.map((f) => (
                  <div
                    className={
                      familien.some((x) => x.id === f.id) ? "aktiv" : ""
                    }
                    key={f.id}
                  >
                    <span>{f.id}</span>
                    <strong>{f.terms[0]}</strong>
                  </div>
                ))}
              </div>
              <section className="planblock">
                <div className="blocktitel">
                  <div>
                    <h2>Durchlauf {durchlauf + 1}: Verteilung je Plattform</h2>
                    <p>
                      Direkt aus dem übernommenen Spurplan: eigene Suchbegriffe
                      zuerst, weniger als fünf Begriffe werden mit
                      Themenfamilien aufgefüllt.
                    </p>
                  </div>
                  <span>{quellen.length} Anfragen</span>
                </div>
                {[...verteilung].map(([begriff, namen]) => (
                  <div className="planzeile verteilung" key={begriff}>
                    <strong>{begriff}</strong>
                    <span>{namen.join(" · ")}</span>
                  </div>
                ))}
              </section>
              <section className="planblock familienplan">
                <div className="blocktitel">
                  <div>
                    <h2>Themenfamilien dieses Durchlaufs</h2>
                    <p>Direkt aus dem übernommenen Suchplan-Generator.</p>
                  </div>
                  <span>{plan.length} Varianten</span>
                </div>
                {plan.map((q) => (
                  <div className="planzeile" key={q.keywords}>
                    <span>{q.family}</span>
                    <strong>{q.keywords}</strong>
                    <span>→</span>
                  </div>
                ))}
              </section>
              <div className="technikgitter">
                <section className="karte">
                  <h2>Suchbegriffe, Ort und Quellen</h2>
                  <p>
                    Gilt für die Suchlinks und die lokale Live-Suche. Die Links
                    öffnen echte Suchseiten erst durch Ihren Klick und lösen
                    keine Bewerbung aus.
                  </p>
                  <label>
                    Suchbegriffe
                    <textarea
                      className="begriffsfeld"
                      value={begriffe}
                      onChange={(e) => setzeBegriffe(e.target.value)}
                      rows={2}
                    />
                  </label>
                  <p className="begriffshinweis">
                    Komma, Semikolon oder Zeilenumbruch trennen die Begriffe.{" "}
                    {begriffsliste.length} gültig.{" "}
                    <button
                      type="button"
                      className="textknopf"
                      onClick={() =>
                        setzeBegriffe(catalogueKeywords().join(", "))
                      }
                    >
                      IT-Katalog übernehmen
                    </button>
                  </p>
                  <div className="formularraster">
                    <label>
                      Suchort
                      <input
                        value={stadt}
                        onChange={(e) => setzeStadt(e.target.value)}
                      />
                    </label>
                    <label>
                      Umkreis in km
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={radius}
                        onChange={(e) =>
                          setzeRadius(
                            Math.max(
                              1,
                              Math.min(200, Number(e.target.value) || 1),
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="quellenlinks">
                    {PLATFORMS.map((p) => (
                      <a
                        href={searchUrl(p.id, erstbegriff, stadt, radius)}
                        key={p.id}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {p.label} <Zeichen art="pfeil" />
                      </a>
                    ))}
                  </div>
                </section>
                <section className="karte">
                  <h2>Breite Suche, ehrlicher Vergleich.</h2>
                  <label>
                    Kompetenzen des fiktiven Profils
                    <input
                      value={profiltext}
                      onChange={(e) => setzeProfiltext(e.target.value)}
                    />
                  </label>
                  <p>
                    Kommagetrennt. Der Vergleichswert verändert sich, die
                    Suchfelder bleiben erhalten. Ein fehlendes „C++“ oder „Power
                    BI“ entfernt keine Stelle.
                  </p>
                  <div className="hinweis">
                    Blockierte Quellen sind als blockiert zu kennzeichnen. Kein
                    Treffer und kein Zugriff sind unterschiedliche Ergebnisse.
                  </div>
                </section>
              </div>
            </>
          )}
          {ansicht === "formular" && (
            <>
              <div className="formularschritte">
                <div>
                  <span>01</span>
                  <h2>Erkennen</h2>
                  <p>
                    Bekannte Profilfelder erkennen, ausgefüllte Werte erhalten.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <h2>Nachfragen</h2>
                  <p>Unbekannte Fragen offen lassen und sichtbar machen.</p>
                </div>
                <div>
                  <span>03</span>
                  <h2>Merken</h2>
                  <p>
                    Eine ausdrückliche Antwort speichern und erneut verwenden.
                  </p>
                </div>
              </div>
              <div className="formularbuehne">
                <div className="formularsteuerung">
                  <p className="augenbraue">ECHTER GEMEINSAMER FELDMOTOR</p>
                  <h2>Am Übungsformular ausprobieren.</h2>
                  <p>
                    Der Feldmotor ist derselbe wie in der
                    Chrome-/Edge-Erweiterung. Die Daten hier sind ausschließlich
                    Alex Beispiel und eine Adresse unter example.test.
                  </p>
                  <button
                    className="knopf blau voll"
                    disabled={!formularBereit}
                    onClick={() => formularFuellen(false)}
                  >
                    1. Beispielprofil eintragen
                  </button>
                  <button
                    className="knopf weiss voll"
                    disabled={!bankBereit || !formularBereit}
                    onClick={() => formularFuellen(true)}
                  >
                    2. „StepStone“ merken & erneut füllen
                  </button>
                  <p className="formularergebnis" aria-live="polite">
                    {formularmeldung}
                  </p>
                  <a
                    className="textlink"
                    href="https://github.com/Jorxas/JobPilot/tree/main/public/erweiterung"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Browser-Erweiterung & Anleitung ↗
                  </a>
                  <div className="hinweis">
                    Einwilligungen bleiben ohne ausdrückliche Antwort leer. Der
                    Assistent klickt nie auf Absenden oder Weiter.
                  </div>
                </div>
                <iframe
                  ref={setzeFormularRahmen}
                  onLoad={()=>setzeFormularBereit(true)}
                  src="./formular/index.html"
                  title="Synthetisches Arbeitgeberformular zum Testen des Feldmotors"
                />
              </div>
            </>
          )}
          {ansicht === "technik" && (
            <>
              <div className="architektur">
                <span>{PLATFORMS.length} PLATTFORMEN</span>
                <b>→</b>
                <span>IMPORT & PRÜFUNG</span>
                <b>→</b>
                <span>VERGLEICH & DUBLETTEN</span>
                <b>→</b>
                <span>NÄCHSTER SCHRITT</span>
              </div>
              <div className="technikgitter">
                {[
                  {
                    titel: "Übernommener Kern",
                    text: "Plattformkatalog mit 21 Jobbörsen, ein Trefferlistenleser je Plattform, Vertragsklassifikation, Heuristik, Firmengruppierung, JSON-LD-Leser, Umkreisprüfung und der Spurplan über 25 Themenfelder stammen aus dem persönlichen JobPilot-Werkzeug. Fremdanteile sind mit MIT-Hinweisen dokumentiert.",
                  },
                  {
                    titel: "Öffentliche Browser-Demo",
                    text: "React und TypeScript. Synthetische Stellen, lokale Zustände und ausdrücklich simulierte Plattformzustände. Bewertung, Spurplan und Dublettenprüfung laufen tatsächlich im Browser; es wird keine Jobbörse abgefragt.",
                  },
                  {
                    titel: "Optionaler lokaler Server",
                    text: "Node.js, echte Quellenadapter für 21 Plattformen, fünf Durchläufe je Suchstart mit genau einer Anfrage je Plattform und Durchlauf, gespeicherte Seitennummern und atomare JSON-Dateien. Gesperrte Quellen werden nicht umgangen. Live-Zugriffe sind standardmäßig ausgeschaltet.",
                  },
                  {
                    titel: "Private Originalanwendung",
                    text: "Das persönliche Original verwendet Next.js, PostgreSQL und Prisma sowie private Dokumente. Diese öffentliche, eigenständig lauffähige Fassung ersetzt die persönliche Persistenz durch lokale JSON-Dateien. E-Mail-Versand und private Kontaktdaten sind nicht enthalten.",
                  },
                ].map((k) => (
                  <section className="karte" key={k.titel}>
                    <Zeichen art="code" />
                    <h2>{k.titel}</h2>
                    <p>{k.text}</p>
                  </section>
                ))}
              </div>
              <section className="karte lokaler-modus">
                <div>
                  <h2>Live nur mit eigenem lokalen Server.</h2>
                  <p>
                    Nach Installation mit JOBPILOT_LIVE=1 aktivieren. Die
                    GitHub-Pages-Demo hat keinen laufenden Backenddienst.
                    Öffentliche Stellenquellen können Änderungen, Anmeldung oder
                    Zugriffsbeschränkungen haben. Entfernungen werden über
                    OpenStreetMap ermittelt (Geodaten © OpenStreetMap-Mitwirkende,
                    ODbL).
                  </p>
                </div>
                {server ? (
                  <label className="umschalter">
                    <input
                      type="checkbox"
                      checked={live}
                      disabled={!server.live}
                      onChange={(e) => setzeLive(e.target.checked)}
                    />
                    {server.live
                      ? "Lokale Live-Suche verwenden"
                      : "Server läuft; Live-Suche nicht freigeschaltet"}
                  </label>
                ) : (
                  <span className="demomarke">Statischer Demomodus</span>
                )}
              </section>
              <a
                className="knopf blau"
                href="https://github.com/Jorxas/JobPilot#readme"
                target="_blank"
                rel="noopener noreferrer"
              >
                Dokumentation auf GitHub <Zeichen art="pfeil" />
              </a>
            </>
          )}
          <footer className="fuss">
            <span>
              JobPilot · Ein persönliches Werkzeug, öffentlich nachvollziehbar
              gemacht.
            </span>
            <a
              href="https://jorxas.github.io/Portfolio/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Jordan Freddy / Portfolio ↗
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Anwendung />);
