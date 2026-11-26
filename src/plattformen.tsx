import { useState } from "react";
import { KEIN_ABRUF, PLATFORMS, platformSearchUrl, type PlatformId } from "./kern/platforms";
import {
  platformStates,
  PROBLEM_STATES,
  STATE_LABEL,
  STATE_NOTE,
  type PlatformState,
  type ReportLike,
} from "./kern/platform-status";

// Kompakte Quellenübersicht nach dem Vorbild der privaten PlatformCoverage: eine Zusammenfassung, nur Problemquellen
// hervorgehoben, einklappbare Auswahl mit Zustandspastille. Zustände stammen ausschließlich aus Suchberichten
// (in der Demo ausdrücklich simuliert) und aus den fest konfigurierten Sperren; nichts wird erfunden.
export function Plattformen({
  quellen,
  berichte,
  simuliert,
  begriff,
  stadt,
  radius,
  indeedClaude,
  wechseln,
}: {
  quellen: string[];
  berichte?: ReportLike[];
  simuliert: boolean;
  begriff: string;
  stadt: string;
  radius: number;
  indeedClaude: boolean;
  wechseln: (id: string, an: boolean) => void;
}) {
  const [hinweis, setzeHinweis] = useState("");
  // Ohne Suchbericht: Quellen, an die nie eine Anfrage geht, sind schon aus der Konfiguration bekannt.
  const bekannt = {
    results: (Object.entries(KEIN_ABRUF) as [PlatformId, { blocked: boolean }][])
      .filter(([id]) => !(id === "indeed" && indeedClaude))
      .map(([id, k]) => ({ id, report: { source: id, status: k.blocked ? "blocked" : "partial", found: 0 } })),
  };
  const zustaende = platformStates(quellen, berichte || [], bekannt);
  const probleme = zustaende.filter((s) => PROBLEM_STATES.includes(s.state));
  const zaehler = (["gelesen", "teilweise", "blockiert", "nur-link", "fehler", "offen"] as PlatformState[])
    .map((z) => [z, zustaende.filter((s) => s.state === z).length] as const)
    .filter(([, n]) => n);
  const link = (id: PlatformId) => platformSearchUrl(id, begriff, stadt, radius);
  const ausSuche = zustaende.some((s) => s.origin === "suche");
  function umschalten(id: string, an: boolean) {
    if (!an && quellen.length <= 1) {
      setzeHinweis("Mindestens eine Plattform muss ausgewählt bleiben.");
      return;
    }
    setzeHinweis(an ? "Plattform gewählt. Sie gilt ab der nächsten Suche." : "Plattform abgewählt. Sie wird bei der nächsten Suche nicht gefragt.");
    wechseln(id, an);
  }
  return (
    <section className="plattformen" aria-labelledby="plattformen-titel">
      <div className="plattformkopf">
        <strong id="plattformen-titel">
          {quellen.length} von {PLATFORMS.length} Plattformen bei jeder Suche abgefragt
        </strong>
        <span>Keine vollständige Marktabdeckung.</span>
        {simuliert && !!berichte?.length && (
          <span className="simuliert">Zustände simuliert</span>
        )}
        {indeedClaude && quellen.includes("indeed") && (
          <span className="simuliert">Indeed über Claude freigeschaltet</span>
        )}
      </div>
      {probleme.length > 0 && (
        <ul className="plattformprobleme" aria-label="Plattformen, die den Browser brauchen">
          {probleme.map((p) => (
            <li key={p.id} data-problem={p.id}>
              <div>
                <strong>{p.label}</strong>{" "}
                <span className="chip-status" data-state={p.state}>
                  <i aria-hidden="true" />
                  {STATE_LABEL[p.state]}
                </span>
                <small>{STATE_NOTE[p.state]}</small>
              </div>
              <a
                href={link(p.id)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.label + " im Browser öffnen"}
              >
                Öffnen ↗
              </a>
            </li>
          ))}
        </ul>
      )}
      <details className="plattformwahl">
        <summary>
          Plattformen anzeigen oder abwählen
          <span>{zaehler.map(([z, n]) => `${n} ${STATE_LABEL[z]}`).join(" · ")}</span>
        </summary>
        <ul className="plattformchips">
          {zustaende.map((s) => {
            const an = quellen.includes(s.id);
            return (
              <li key={s.id}>
                <label className="plattformchip" data-platform={s.id} data-aktiv={an}>
                  <input
                    type="checkbox"
                    checked={an}
                    onChange={(e) => umschalten(s.id, e.target.checked)}
                  />
                  <span className="chipname">{s.label}</span>
                  <span className="chip-status" data-state={s.state}>
                    <i aria-hidden="true" />
                    {STATE_LABEL[s.state]}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="plattformlegende">
          {ausSuche
            ? simuliert
              ? "Simulierter Zustand des letzten Demodurchlaufs; es wurde keine Website aufgerufen."
              : "Zustand des letzten lokalen Suchstarts."
            : "Noch kein Suchbericht; bekannte Sperren stammen aus der Konfiguration."}{" "}
          Ein Klick wählt eine Plattform ab oder wieder an.
        </p>
        <p className="plattformlegende" aria-live="polite">
          {hinweis}
        </p>
      </details>
    </section>
  );
}
