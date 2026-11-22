// Öffentliche Demo: Die echte Oberfläche läuft unverändert, nur die Daten kommen aus diesem Modul statt vom lokalen
// Server. Alle Unternehmen, Personen, Adressen und Nachrichten sind erfunden. Es wird nichts gesendet; ein Neuladen
// setzt die Demo zurück.
import type { AntwortEintrag, TrackerItemView } from "./typen";

const TAG = 86400000;
const vor = (tage: number) => new Date(Date.now() - tage * TAG);
const datum = (tage: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(vor(tage));
const iso = (tage: number, stunde = 9) => { const d = vor(tage); d.setHours(stunde, 14, 0, 0); return d.toISOString(); };

const lebenslauf = { kind: "cv", filename: "Lebenslauf_Alex_Beispiel.pdf", contentType: "application/pdf" };
const anschreiben = { kind: "letter", filename: "Anschreiben_Alex_Beispiel.pdf", contentType: "application/pdf" };
const mappe = { kind: "bundle", filename: "Bewerbung_Alex_Beispiel.pdf", contentType: "application/pdf" };
const allgemeinerLebenslauf = { kind: "cv", filename: "Lebenslauf_Alex_Beispiel.pdf", contentType: "application/pdf", isGeneral: true, isShared: true };

function stelle(id: string, firma: string, rolle: string, ort: string, status: string, werte: Partial<TrackerItemView>): TrackerItemView {
  return {
    id, status, sentAt: null, revision: 1, updatedAt: iso(0), documents: [], company: firma, role: rolle, location: ort,
    opportunityType: "open-role", addedAt: datum(5), ...werte,
  } as TrackerItemView;
}
const passung = (score: number, gruende: string[], hinweise: string[] = []) => ({ score, basis: "description" as const, reasons: gruende, warnings: hinweise });

function ausgangsdaten(): { items: TrackerItemView[]; antworten: AntwortEintrag[] } {
  const items: TrackerItemView[] = [
    stelle("morgenrot", "Morgenrot Digital GmbH", "Werkstudent Softwareentwicklung", "35390 Gießen", "pending", {
      addedAt: datum(0), documents: [lebenslauf, anschreiben], email: "bewerbung@morgenrot-digital.example",
      compatibility: passung(78, ["Passende Kenntnisse: Java, React, SQL", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("morgenrot-qa", "Morgenrot Digital GmbH", "Praktikum Qualitätssicherung", "35390 Gießen", "archived", {
      addedAt: datum(0), archiveAuto: true, archiveScope: "offer", duplicateOf: "morgenrot",
      archiveReason: "Unternehmen bereits in der Datenbank; Stelle für später archiviert, keine zweite Vorbereitung oder erneuter Versand.",
      compatibility: passung(52, ["Passende Kenntnisse: SQL", "Studentische Vertragsart: Praktikum"]),
    }),
    stelle("nordlicht", "Nordlicht Software GmbH", "Werkstudent Java-Entwicklung", "35037 Marburg", "applied", {
      sentAt: datum(4), revision: 3, updatedAt: iso(4), addedAt: datum(12), documents: [mappe, lebenslauf, anschreiben], email: "karriere@nordlicht-software.example",
      compatibility: passung(74, ["Passende Kenntnisse: Java, SQL, Docker", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("nordlicht-devops", "Nordlicht Software GmbH", "Werkstudent DevOps", "35037 Marburg", "pending", {
      addedAt: datum(1), documents: [], compatibility: passung(61, ["Passende Kenntnisse: Docker, Linux", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("flusswerk", "Flusswerk Daten AG", "Praktikum Data Engineering", "60311 Frankfurt am Main", "pending", {
      addedAt: datum(2), documents: [allgemeinerLebenslauf], email: "talent@flusswerk-daten.example",
      compatibility: passung(66, ["Passende Kenntnisse: Python, SQL", "Studentische Vertragsart: Praktikum"]),
    }),
    stelle("blaupunkt", "Blaupunkt Weblabor", "Werkstudent Frontend", "35578 Wetzlar", "applied", {
      sentAt: datum(11), revision: 2, updatedAt: iso(11), addedAt: datum(19), documents: [lebenslauf, anschreiben], email: "jobs@blaupunkt-weblabor.example",
      compatibility: passung(69, ["Passende Kenntnisse: JavaScript, React, TypeScript", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("wolkenfeld", "Wolkenfeld IT", "Werkstudent Cloud Engineering", "35037 Marburg", "archived", {
      addedAt: datum(21), updatedAt: iso(9), documents: [lebenslauf, anschreiben],
      compatibility: passung(48, ["Passende Kenntnisse: Docker, Linux", "Studentische Vertragsart: Werkstudent"], ["Fortgeschrittenes Englisch gefordert, mit deinem angegebenen Niveau abgleichen"]),
    }),
    stelle("knotenpunkt", "Knotenpunkt Systeme", "Werkstudent IT-Support", "35398 Gießen", "unknown", {
      sentAt: null, addedAt: datum(14), documents: [lebenslauf, anschreiben], email: "bewerbung@knotenpunkt-systeme.example",
      compatibility: passung(43, ["Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("bergtal", "Bergtal Automation", "Praktikum Embedded Software", "35576 Wetzlar", "pending", {
      addedAt: datum(1), documents: [allgemeinerLebenslauf],
      compatibility: passung(54, ["Passende Kenntnisse: Java, C++", "Studentische Vertragsart: Praktikum"], ["Beschreibung unvollständig: Stellenanzeige importieren, bevor Unterlagen erstellt werden"]),
    }),
    stelle("taktgeber", "Taktgeber Prozesse", "Werkstudent Prozessdigitalisierung", "35630 Ehringshausen", "pending", {
      addedAt: datum(7), documents: [lebenslauf, anschreiben], email: "kontakt@taktgeber-prozesse.example",
      compatibility: passung(41, ["Passende Kenntnisse: Python", "Studentische Vertragsart: Werkstudent"]),
    }),
  ];
  const antworten: AntwortEintrag[] = [
    {
      id: "a1", messageId: "<eingang-1@nordlicht-software.example>", applicationId: "nordlicht", kandidaten: ["nordlicht"], art: "eingang",
      subject: "Eingangsbestätigung: Ihre Bewerbung als Werkstudent Java-Entwicklung", from: "karriere@nordlicht-software.example", receivedAt: iso(4, 10),
      beleg: "Vielen Dank für Ihre Bewerbung. Wir haben Ihre Unterlagen erhalten und melden uns in den nächsten Tagen.", grund: "Betreff und Absender passen zur versandten Bewerbung.", automatisch: true,
    },
    {
      id: "a2", messageId: "<gespraech-1@nordlicht-software.example>", applicationId: "nordlicht", kandidaten: ["nordlicht"], art: "interview",
      subject: "Einladung zum Kennenlerngespräch", from: "karriere@nordlicht-software.example", receivedAt: iso(1, 11),
      beleg: "Wir würden Sie gern kennenlernen und laden Sie zu einem Gespräch ein. Bitte nennen Sie uns zwei Terminvorschläge.", grund: "Antwort auf die versandte Bewerbung, Betreff verweist auf die Stelle.", automatisch: true,
    },
    {
      id: "a3", messageId: "<absage-1@blaupunkt-weblabor.example>", applicationId: "blaupunkt", kandidaten: ["blaupunkt"], art: "absage",
      subject: "Ihre Bewerbung bei Blaupunkt Weblabor", from: "jobs@blaupunkt-weblabor.example", receivedAt: iso(3, 15),
      beleg: "Leider haben wir uns für eine andere Bewerbung entschieden. Wir wünschen Ihnen für Ihren weiteren Weg alles Gute.", grund: "Absender und Betreff passen zur Bewerbung.", automatisch: true,
    },
    {
      id: "a4", messageId: "<rueckfrage-1@system-partner.example>", applicationId: null, kandidaten: ["knotenpunkt", "taktgeber"], art: "antwort",
      subject: "Ihre Anfrage zur Werkstudentenstelle", from: "personal@system-partner.example", receivedAt: iso(0, 8),
      beleg: "Danke für Ihr Interesse. Könnten Sie uns noch Ihren frühestmöglichen Starttermin nennen?", grund: "Mehrdeutiger Bezug: zwei Bewerbungen passen zur Nachricht.", automatisch: false,
    },
  ];
  return { items, antworten };
}

const zustand = ausgangsdaten();
const json = (daten: unknown, status = 200) => new Response(JSON.stringify(daten), { status, headers: { "Content-Type": "application/json" } });
const originalFetch = window.fetch.bind(window);

window.fetch = async (eingabe: RequestInfo | URL, optionen?: RequestInit) => {
  const adresse = new URL(typeof eingabe === "string" ? eingabe : eingabe instanceof URL ? eingabe.href : eingabe.url, location.href);
  const pfad = adresse.pathname, methode = (optionen?.method || "GET").toUpperCase();
  if (!pfad.startsWith("/api/")) return originalFetch(eingabe, optionen);
  const koerper = typeof optionen?.body === "string" && optionen.body ? JSON.parse(optionen.body) : {};

  if (pfad === "/api/tracker" && methode === "GET") {
    const heute = datum(0);
    return json({
      version: 2, applications: zustand.items, syncedAt: new Date().toISOString(),
      tagesziel: { ziel: 3, heute: zustand.items.filter(i => i.status === "applied" && i.sentAt === heute).length },
    });
  }
  const statusPfad = /^\/api\/tracker\/([^/]+)\/state$/.exec(pfad);
  if (statusPfad && methode === "PATCH") {
    const eintrag = zustand.items.find(i => i.id === decodeURIComponent(statusPfad[1]));
    if (!eintrag) return json({ error: "Nicht gefunden" }, 404);
    if (koerper.revision !== eintrag.revision) return json({ error: "Der Status hat sich geändert. Die Fiche wurde aktualisiert.", application: eintrag }, 409);
    Object.assign(eintrag, { status: koerper.status, sentAt: koerper.status === "applied" ? koerper.sentAt || datum(0) : null, revision: eintrag.revision + 1, updatedAt: new Date().toISOString() });
    return json({ application: eintrag, saved: true });
  }
  if (pfad === "/api/jobpilot/antworten") {
    if (methode === "GET") {
      return json({ stand: { version: 1, uidValidity: "", lastUid: 0, mailbox: "Demo", lastAttempt: iso(0, 8), lastSuccess: iso(0, 8), error: null, remaining: 0, checked: zustand.antworten.length, antworten: zustand.antworten }, plan: { zeit: "08:30", zeitzone: "Europe/Berlin", task: "demo" } });
    }
    if (methode === "POST") return json({ neu: 0, zugeordnet: 0, rest: 0, grosseNachrichtenUebersprungen: 0 });
    if (methode === "PATCH") {
      const antwort = zustand.antworten.find(a => a.id === koerper.id);
      if (!antwort) return json({ error: "Nicht gefunden" }, 404);
      if (koerper.ignore) antwort.ignoriert = true; else { antwort.applicationId = koerper.applicationId; antwort.manuell = true; antwort.automatisch = false; }
      return json({ gespeichert: true });
    }
  }
  if (pfad === "/api/jobpilot/assistent") {
    if (methode === "GET") return json({ aktiv: false });
    return json({ error: "In der Demo öffnet sich kein Browserfenster. Im lokalen JobPilot startet hier der Formularassistent in einem eigenen Fenster." }, 409);
  }
  return json({ error: "In der Demo nicht verfügbar." }, 404);
};

// Hinweise und Navigation: Die Demo enthält die Stellenübersicht und die Antworten. Seiten, die im lokalen JobPilot
// Serverdaten brauchen, führen zu einem kurzen Hinweis statt zu einer erfundenen Ersatzseite.
const hinweis = document.createElement("div");
hinweis.setAttribute("role", "status");
hinweis.setAttribute("data-demo-hinweis", "");
hinweis.style.cssText = "position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:50;max-width:min(520px,calc(100vw - 32px));padding:12px 16px;border-radius:10px;background:#0f2a5c;color:#fff;font:500 13px/1.5 'DM Sans',system-ui,sans-serif;box-shadow:0 10px 30px #0f2a5c33;display:none";
let hinweisTimer = 0;
function zeigeHinweis(text: string) {
  hinweis.textContent = text; hinweis.style.display = "block";
  clearTimeout(hinweisTimer); hinweisTimer = window.setTimeout(() => { hinweis.style.display = "none"; }, 4500);
}
const plakette = document.createElement("div");
plakette.textContent = "Öffentliche Demo · erfundene Daten · es wird nichts gesendet";
plakette.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:40;padding:7px 12px;border-radius:99px;background:#fff;color:#165dff;border:1px solid #d7e5ff;font:600 11px/1.2 'DM Sans',system-ui,sans-serif;box-shadow:0 4px 14px #1b3b6514";
document.addEventListener("DOMContentLoaded", () => { document.body.append(hinweis, plakette); });

const unterlagen: Record<string, string> = { cv: "lebenslauf-beispiel.pdf", letter: "anschreiben-beispiel.pdf", bundle: "anschreiben-beispiel.pdf" };
document.addEventListener("click", ereignis => {
  const anker = (ereignis.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anker) return;
  const ziel = anker.getAttribute("href") || "";
  const dokument = /\/api\/tracker\/[^/]+\/documents\/(\w+)/.exec(ziel);
  if (dokument) { ereignis.preventDefault(); window.open(`./beispiel/${unterlagen[dokument[1]] || unterlagen.cv}`, "_blank", "noopener"); return; }
  if (!ziel.startsWith("/") || ziel.startsWith("//")) return;
  ereignis.preventDefault();
  if (ziel.startsWith("/suivi")) {
    const markierung = ziel.includes("#") ? ziel.slice(ziel.indexOf("#")) : "";
    if (markierung) location.hash = markierung; else history.replaceState(null, "", location.pathname + location.search), window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  zeigeHinweis(ziel.startsWith("/offres") ? "Die Stellensuche gehört zum lokalen JobPilot. Diese Demo zeigt die Stellenübersicht und die Antworten mit erfundenen Daten."
    : ziel.startsWith("/dossier") ? "Das Dossier mit Unterlagen und Versandprüfung gehört zum lokalen JobPilot. Hier sind nur die Beispielunterlagen abrufbar."
    : "Diese Seite gehört zum lokalen JobPilot und ist in der Demo nicht enthalten.");
}, true);
