// Zustand jeder Plattform, ausschließlich aus den gespeicherten Suchberichten und der öffentlichen Leseprüfung abgeleitet.
import { PLATFORMS, type PlatformId } from "./platforms";

export type PlatformState = "gelesen" | "teilweise" | "blockiert" | "nur-link" | "fehler" | "offen" | "aus";
export type ReportLike = { source: string; status: string; found?: number; inserted?: number; skipped?: boolean };
export type ProbeLike = { results: { id: string; report: ReportLike }[] } | null | undefined;
export type PlatformStateInfo = { id: PlatformId; label: string; state: PlatformState; origin: "suche" | "pruefung" | "keine"; found: number; inserted: number };

export const STATE_LABEL: Record<PlatformState, string> = {
  gelesen: "gelesen", teilweise: "teilweise", blockiert: "blockiert", "nur-link": "nur Link", fehler: "Abruf fehlgeschlagen", offen: "nicht abgefragt", aus: "aus",
};
// Nur diese Zustände verlangen etwas vom Nutzer und werden deshalb hervorgehoben.
export const PROBLEM_STATES: PlatformState[] = ["blockiert", "nur-link", "fehler"];
export const STATE_NOTE: Partial<Record<PlatformState, string>> = {
  blockiert: "Die Plattform lässt automatische Abrufe nicht zu. Im Browser suchen und gefundene Anzeigen über den manuellen Import des lokalen Servers hinzufügen.",
  "nur-link": "Die Trefferliste lässt sich nicht automatisch lesen. Nur der Suchlink ist nutzbar; Treffer im Browser prüfen.",
  fehler: "Der Abruf ist fehlgeschlagen. Er wird erst bei der nächsten Suche erneut versucht; bis dahin im Browser suchen.",
};

// Mehrere Berichte (fünf Durchläufe) werden vorsichtig zusammengefasst: Blockade vor Fehler vor Teilabdeckung.
export function stateFromReports(reports: ReportLike[]): Exclude<PlatformState, "offen" | "aus"> | null {
  if (!reports.length) return null;
  if (reports.some(r => r.status === "blocked")) return "blockiert";
  if (reports.every(r => r.status === "error")) return "fehler";
  if (reports.some(r => r.status !== "ok")) return reports.every(r => r.status !== "ok" && r.status !== "error" && !(r.found || 0)) ? "nur-link" : "teilweise";
  return "gelesen";
}

export function platformStates(enabled: Iterable<string>, reports: ReportLike[] = [], probe?: ProbeLike): PlatformStateInfo[] {
  const on = new Set(enabled);
  return PLATFORMS.map(p => {
    const own = reports.filter(r => r.source === p.id), check = probe?.results.find(r => r.id === p.id)?.report;
    const found = own.reduce((n, r) => n + (r.found || 0), 0), inserted = own.reduce((n, r) => n + (r.inserted || 0), 0);
    if (!on.has(p.id)) return { id: p.id, label: p.label, state: "aus" as const, origin: "keine" as const, found, inserted };
    const fromRun = stateFromReports(own);
    if (fromRun) return { id: p.id, label: p.label, state: fromRun, origin: "suche" as const, found, inserted };
    const fromProbe = check ? stateFromReports([check]) : null;
    if (fromProbe) return { id: p.id, label: p.label, state: fromProbe, origin: "pruefung" as const, found: check?.found || 0, inserted: 0 };
    return { id: p.id, label: p.label, state: "offen" as const, origin: "keine" as const, found: 0, inserted: 0 };
  });
}
