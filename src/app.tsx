import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  angebote,
  beispielprofil,
  quellenNamen,
  type Stelle,
} from "./beispiele";
import {
  aufnehmen,
  bewerten,
  firmenansicht,
  pruefeManuellenImport,
  searchPlan,
  searchUrl,
  TECH_FAMILIES,
} from "./ablauf";
import { SOURCES, type Source } from "./kern/core";
import "./stil.css";
type Ansicht = "stellen" | "ablauf" | "formular" | "technik";
type Sitzung = {
  stellen: Stelle[];
  runde: number;
  bank: { question: string; answer: string }[];
  modus?: "live";
  berichte?: { source: Source; status: string }[];
};
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
    [server, setzeServer] = useState<{ live: boolean } | null>(null),
    [live, setzeLive] = useState(false),
    [profiltext, setzeProfiltext] = useState(beispielprofil.skills.join(", ")),
    [formularmeldung, setzeFormularmeldung] = useState(
      "Das Übungsformular ist bereit.",
    ),
    [bankBereit, setzeBankBereit] = useState(false),
    [formularBereit, setzeFormularBereit] = useState(false),
    [stadt, setzeStadt] = useState("Gießen"),
    [radius, setzeRadius] = useState(100);
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
          if (d?.modus === "lokaler Server") setzeServer(d);
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
  const plan = searchPlan(beispielprofil.keywords, true, sitzung.runde % 6),
    familien = TECH_FAMILIES.slice(
      (sitzung.runde % 6) * 4,
      (sitzung.runde % 6) * 4 + 4,
    );
  const statistik = {
    offen: firmen.filter((s) => s.status === "pending").length,
    versandt: firmen.filter((s) => s.status === "applied").length,
    archiv: firmen.filter((s) => s.status === "archived").length,
  };
  function quellenstatus(q: Source) {
    if (sitzung.modus === "live") {
      const wert = sitzung.berichte
        ?.filter((r) => r.source === q)
        .at(-1)?.status;
      return wert === "ok"
        ? "bereit"
        : wert === "blocked"
          ? "blockiert"
          : wert === "partial"
            ? "teilweise"
            : wert === "error"
              ? "nicht erreichbar"
              : "nicht geprüft";
    }
    return q === "indeed"
      ? "blockiert"
      : q === "stepstone"
        ? "teilweise"
        : "bereit";
  }
  async function suchen() {
    setzeBeschaeftigt(true);
    try {
      if (server && live) {
        const r = await fetch("/api/suche", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            live: true,
            city: stadt,
            radius,
            keywords: beispielprofil.keywords,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.fehler);
        setzeSitzung((s) => ({
          ...s,
          stellen: d.zustand.stellen,
          runde: d.zustand.runde,
          modus: "live",
          berichte: d.zustand.berichte,
        }));
        setzeMeldung(
          `Lokale Live-Suche: ${d.neu} neue Stellen. Quellenberichte sind im lokalen JSON-Zustand gespeichert; öffentliche Quellen können blockiert sein.`,
        );
      } else {
        const r = aufnehmen(sitzung.stellen, angebote, profil);
        setzeSitzung((s) => ({
          ...s,
          stellen: r.stellen,
          runde: s.runde + 1,
          modus: undefined,
          berichte: undefined,
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
              <section className="quellenzeile" aria-label="Quellenzustände">
                <strong>Quellenlage</strong>
                {[...SOURCES, "arbeitgeber" as const].map((q) => (
                  <span className={quellenstatus(q)} key={q}>
                    <i />
                    {quellenNamen[q]}
                    <small>{quellenstatus(q)}</small>
                  </span>
                ))}
              </section>
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
                      {[...SOURCES, "arbeitgeber" as const].map((q) => (
                        <option key={q} value={q}>
                          {quellenNamen[q]}
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
                            {s.location} <b>·</b> {quellenNamen[s.source]}{" "}
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
                        {gewaehlt.location} · {quellenNamen[gewaehlt.source]}
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
                    SUCHRUNDEN {sitzung.runde}
                  </span>
                  <h2>24 Technikfelder. Sechs Suchpläne.</h2>
                  <p>
                    Vier Themenfelder pro Plan, mit Varianten für
                    Werkstudentenstellen und Praktika. Fehlende Kenntnisse
                    schließen ein Thema nicht aus.
                  </p>
                </div>
                <div
                  className="rundenschalter"
                  role="group"
                  aria-label="Suchplan auswählen"
                >
                  {Array.from({ length: 6 }, (_, i) => (
                    <button
                      aria-pressed={sitzung.runde % 6 === i}
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
                    <h2>Der nächste Suchplan</h2>
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
                  <h2>Quellen gezielt öffnen</h2>
                  <p>
                    Diese Links öffnen echte Suchseiten erst durch Ihren Klick.
                    Sie lösen keine Bewerbung aus.
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
                    {SOURCES.map((q) => (
                      <a
                        href={searchUrl(
                          q,
                          beispielprofil.keywords,
                          stadt,
                          radius,
                        )}
                        key={q}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {quellenNamen[q]} <Zeichen art="pfeil" />
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
                <span>4 QUELLEN</span>
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
                    text: "Vertragsklassifikation, Heuristik, Firmengruppierung, Quellen-URLs, JSON-LD-Leser und 24-Themen-Suchplan stammen aus dem persönlichen JobPilot-Werkzeug. Fremdanteile sind mit MIT-Hinweisen dokumentiert.",
                  },
                  {
                    titel: "Öffentliche Browser-Demo",
                    text: "React und TypeScript. Synthetische Stellen, lokale Zustände und simulierte Quellenberichte. Der Bewertungs- und Deduplizierungskern läuft tatsächlich im Browser.",
                  },
                  {
                    titel: "Optionaler lokaler Server",
                    text: "Node.js, echte Quellenadapter, begrenzte Suchpakete, gespeicherte Seitennummern und atomare JSON-Dateien. Eine Dateisperre verhindert gleichzeitige Suchschreibvorgänge. Live-Zugriffe sind standardmäßig ausgeschaltet.",
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
                    Zugriffsbeschränkungen haben.
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
