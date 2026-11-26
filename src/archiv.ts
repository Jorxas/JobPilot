// Archivgründe und Firmenausschluss nach src/lib/tracker-archive.ts und src/lib/company-guard.ts des Originals.
// Ohne Datenbank: Die Funktionen arbeiten auf einer Liste von Einträgen, im lokalen Server auf daten/zustand.json, in der
// Browser-Demo auf den erfundenen Fichen. Genau drei Gründe; nur „Kein IT-Bezug“ schließt die Firma dauerhaft aus.
import {
  ARCHIVE_REASONS,
  appliedForCompany,
  companyKey,
  excludedCompanyRecord,
  type ArchiveReason,
} from "./kern/company-catalogue";

export { ARCHIVE_REASONS, type ArchiveReason };
export const STATUSWERTE = ["pending", "applied", "unknown", "archived"] as const;

export type ArchivSatz = {
  id: string;
  status: string;
  company?: string | null;
  sentAt?: string | null;
  revision?: number;
  updatedAt?: string;
  archiveReasonCode?: string;
  archiveReason?: string;
  archiveNote?: string;
  archiveScope?: string;
  archiveAuto?: boolean;
  archivedAt?: string;
  companyExcluded?: unknown;
  companyExcludedAt?: string;
};

// code: kurze Kennung, damit die zweisprachige Demo die Meldung übersetzen kann; der Server meldet den deutschen Text.
export class ArchivFehler extends Error {
  constructor(message: string, public status = 400, public code = "grund") {
    super(message);
  }
}

const revisionVon = (e: ArchivSatz) => (Number.isInteger(e.revision) ? Number(e.revision) : 1);

/** Archiviert einen Eintrag mit Grund. Prüft alles vor der ersten Änderung; ein Fehler verändert nichts. */
export function archivieren<T extends ArchivSatz>(
  liste: T[],
  id: string,
  revision: unknown,
  grund: unknown = "other",
  notiz: unknown = "",
  jetzt = new Date(),
): T {
  if (typeof grund !== "string" || !Object.hasOwn(ARCHIVE_REASONS, grund))
    throw new ArchivFehler("Bitte einen Archivgrund auswählen.", 400, "grund");
  if (typeof notiz !== "string" || notiz.length > 500)
    throw new ArchivFehler("Die Anmerkung darf höchstens 500 Zeichen lang sein.", 400, "notiz");
  const wert = grund as ArchiveReason;
  const eintrag = liste.find((e) => e.id === id);
  if (!eintrag) throw new ArchivFehler("Bewerbung nicht gefunden.", 404, "fehlt");
  if (revisionVon(eintrag) !== revision)
    throw new ArchivFehler("Die Bewerbung wurde auf einem anderen Gerät geändert. Bitte neu laden.", 409, "revision");
  if (wert === "not-it" && companyKey(eintrag.company, id).startsWith("unknown:"))
    throw new ArchivFehler("Bitte zuerst den Firmennamen prüfen.", 400, "firma");
  const zeit = jetzt.toISOString();
  Object.assign(eintrag, {
    archiveReasonCode: wert,
    archiveReason: ARCHIVE_REASONS[wert],
    archiveNote: notiz.trim(),
    // Ein bereits ausgeschlossener Eintrag bleibt firmenweit gesperrt, auch wenn ein späterer Grund nur das Angebot nennt.
    archiveScope: wert === "not-it" || eintrag.companyExcluded === true ? "company" : "offer",
    archiveAuto: false,
    archivedAt: zeit,
    ...(wert === "not-it" ? { companyExcluded: true, companyExcludedAt: zeit } : {}),
    // Bereits bestätigte Versände samt Datum bleiben als Versandhistorie erhalten.
    status: eintrag.status === "applied" || eintrag.sentAt ? eintrag.status : "archived",
    revision: revisionVon(eintrag) + 1,
    updatedAt: zeit,
  });
  return eintrag;
}

/** Sperre einer Fiche wie companyApplicationBlock: ausgeschlossene Firma oder schon beworbene Firma. */
export function firmenSperre<T extends ArchivSatz & { role?: string; title?: string }>(liste: T[], id: string) {
  const aktuell = liste.find((e) => e.id === id);
  if (!aktuell) return null;
  const ausgeschlossen = excludedCompanyRecord(liste, aktuell.company, id);
  if (ausgeschlossen)
    return { message: "Diese Firma wurde dauerhaft ausgeschlossen: kein IT-Bezug.", otherId: ausgeschlossen.id, excluded: true };
  const andere = appliedForCompany(liste, id, aktuell.company);
  if (!andere) return null;
  const rolle = andere.role || andere.title || "";
  return {
    message: `An diese Firma ging bereits eine Bewerbung${andere.sentAt ? " am " + andere.sentAt : ""}${rolle ? " (" + rolle + ")" : ""}. Eine Firma erhält nur eine Bewerbung; ein zweiter Versand ist gesperrt.`,
    otherId: andere.id,
    excluded: false,
  };
}

const gueltigesDatum = (v: unknown) =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + "T12:00:00Z")) && new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;

/** Prüft eine Statusänderung wie die PATCH-Route des Originals (Status, Revision, Versanddatum). */
export function statusAnfragePruefen(inhalt: Record<string, unknown>) {
  if (
    !STATUSWERTE.includes(inhalt.status as (typeof STATUSWERTE)[number]) ||
    !Number.isInteger(inhalt.revision) ||
    Number(inhalt.revision) < 0 ||
    (inhalt.sentAt !== null && inhalt.sentAt !== undefined && !gueltigesDatum(inhalt.sentAt))
  )
    throw new ArchivFehler("Ungültiger Status.", 400, "status");
  return {
    status: inhalt.status as (typeof STATUSWERTE)[number],
    revision: Number(inhalt.revision),
    sentAt: (inhalt.sentAt ?? null) as string | null,
  };
}

/**
 * Setzt einen Status ohne Archivgrund. Eine ausgeschlossene Firma bleibt gesperrt (kein Zurücksetzen über alte
 * Statusänderungen), eine zweite Bewerbung an dieselbe Firma wird abgelehnt.
 */
export function statusSetzen<T extends ArchivSatz & { role?: string; title?: string }>(
  liste: T[],
  id: string,
  revision: number,
  status: "pending" | "applied" | "unknown",
  sentAt: string | null,
  jetzt = new Date(),
): T {
  const eintrag = liste.find((e) => e.id === id);
  if (!eintrag) throw new ArchivFehler("Bewerbung nicht gefunden.", 404, "fehlt");
  const sperre = firmenSperre(liste, id);
  if (sperre?.excluded) throw new ArchivFehler(sperre.message, 409, "ausgeschlossen");
  if (status === "applied" && eintrag.status !== "applied" && sperre) throw new ArchivFehler(sperre.message, 409, "beworben");
  if (revisionVon(eintrag) !== revision)
    throw new ArchivFehler("Der Status hat sich geändert. Die Fiche wurde aktualisiert.", 409, "revision");
  Object.assign(eintrag, {
    status,
    sentAt: status === "applied" ? sentAt || berlinTag(jetzt) : null,
    revision: revision + 1,
    updatedAt: jetzt.toISOString(),
  });
  return eintrag;
}

export const berlinTag = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Einträge mit einer ausdrücklichen Archiventscheidung oder einem Firmenausschluss; sie überstehen jeden Datenwechsel. */
export const entscheidungen = <T extends ArchivSatz>(liste: readonly T[]) =>
  liste.filter((e) => e.companyExcluded === true || typeof e.archiveReasonCode === "string");
