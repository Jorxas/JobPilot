type ItemDocuments = { documents: { kind: string; isGeneral?: boolean }[]; transcript?: boolean; enrollment?: boolean; certificates?: boolean; applicationChannel?: unknown; letterNotRequired?: unknown };

// Gleiche Regel wie in discovery/company-catalogue.ts (dort für das Browserpaket); hier ohne Import, weil sync:tracker diese Datei eigenständig übersetzt.
export function missingDossierParts(item: ItemDocuments): ("cv" | "letter")[] {
  if (item.documents.some(d => d.kind === "bundle")) return [];
  const missing: ("cv" | "letter")[] = [];
  if (!item.documents.some(d => d.kind === "cv" && !d.isGeneral)) missing.push("cv");
  if (!(item.applicationChannel === "portal-only" && item.letterNotRequired === true) && !item.documents.some(d => d.kind === "letter" && !d.isGeneral)) missing.push("letter");
  return missing;
}

export function dossierReady(item: ItemDocuments) { return missingDossierParts(item).length === 0; }

// Begründung, warum zu einer offenen Bewerbung noch nichts beigelegt oder versendet werden darf; sonst leer.
export function dossierBlock(item: { status?: unknown; documents?: ItemDocuments["documents"]; applicationChannel?: unknown; letterNotRequired?: unknown }) {
  if (item.status !== "pending" && item.status !== "unknown") return "";
  const missing = missingDossierParts({ ...item, documents: item.documents || [] });
  if (!missing.length) return "";
  const text = missing.map(kind => kind === "cv" ? "gezielter Lebenslauf" : "Anschreiben").join(" und ");
  return "Unterlagen fehlen: " + text + ". Bitte zuerst die Unterlagen für diese Stelle vorbereiten und prüfen. Der allgemeine Lebenslauf wird nicht zum Bewerben verwendet.";
}

// Gemeinsamer Profil-Lebenslauf oder allgemeine Ersatzdatei: wird nie einer Bewerbung beigelegt.
export function isGeneralDocument(kind: string, document: { itemId?: string; isGeneral?: boolean }) {
  return (kind === "cv" || kind === "letter") && (document.isGeneral === true || document.itemId === "__profile__");
}

export const GENERAL_DOCUMENT_REASON = "Der allgemeine Lebenslauf wird nicht zum Bewerben verwendet. Bitte zuerst einen gezielten Lebenslauf und das Anschreiben für diese Stelle hinterlegen.";

export function emailApplicationBlock(item: { status: string; applicationChannel?: unknown; contactPurpose?: unknown }) {
  if (item.status === "archived") return "Diese Bewerbung ist archiviert. Öffne sie zuerst wieder im Arbeitsraum, bevor du einen Versand vorbereitest.";
  if (item.applicationChannel === "portal-only" || item.contactPurpose === "questions") return "Dieses Unternehmen verlangt die Bewerbung über sein offizielles Formular. Nutze den Link zum Unternehmensportal; der veröffentlichte Kontakt ist für Rückfragen vorgesehen.";
  return "";
}

export class AttachmentSelectionError extends Error {}
export class DossierIncompleteError extends Error {}

export function applicationAttachmentKinds(item: ItemDocuments, selection?: unknown): string[] {
  // Allgemeine Unterlagen (isGeneral) sind nie ein Bewerbungsanhang, weder vorausgewählt noch auswählbar.
  const available = new Set(item.documents.filter(d => !d.isGeneral).map(d => d.kind));
  if (selection !== undefined) {
    if (Array.isArray(selection) && item.documents.some(d => d.isGeneral && selection.includes(d.kind))) throw new AttachmentSelectionError(GENERAL_DOCUMENT_REASON);
    if (!Array.isArray(selection) || selection.length > 5 || selection.some(k => typeof k !== "string" || !available.has(k)) || new Set(selection).size !== selection.length || (selection.includes("bundle") && (selection.includes("cv") || selection.includes("letter")))) {
      throw new AttachmentSelectionError("Sélection de pièces jointes invalide. Actualise les documents et réessaie.");
    }
    return selection;
  }
  // Seit 27. November 2026: Nachweise, die die Anzeige ausdrücklich verlangt (Flags aus verlangteNachweise), werden ohne
  // Klick beigelegt, sofern eine eigene Datei vorliegt; andere Nachweise nur nach ausdrücklicher Auswahl.
  const nachweise = (["enrollment", "transcript", "certificates"] as const).filter(kind => item[kind] === true && available.has(kind));
  if (available.has("bundle") && !(available.has("cv") && available.has("letter"))) return ["bundle", ...nachweise];
  return [...["cv", "letter"].filter(kind => available.has(kind)), ...nachweise];
}
