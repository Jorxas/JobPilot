// Öffentliche Demo: Die echte Oberfläche läuft unverändert, nur die Daten kommen aus diesem Modul statt vom lokalen
// Server. Alle Unternehmen, Personen, Adressen und Nachrichten sind erfunden. Es wird nichts gesendet; ein Neuladen
// setzt die Demo zurück.
import type { AntwortEintrag, TrackerItemView } from "./typen";
import { t, spracheStarten } from "./sprache";

spracheStarten();

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
      distanceKm: 3,
      addedAt: datum(0), documents: [lebenslauf, anschreiben], email: "bewerbung@morgenrot-digital.example",
      compatibility: passung(78, ["Passende Kenntnisse: Java, React, SQL", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("morgenrot-qa", "Morgenrot Digital GmbH", "Praktikum Qualitätssicherung", "35390 Gießen", "archived", {
      distanceKm: 3,
      addedAt: datum(0), archiveAuto: true, archiveScope: "offer", duplicateOf: "morgenrot",
      archiveReason: "Unternehmen bereits in der Datenbank; Stelle für später archiviert, keine zweite Vorbereitung oder erneuter Versand.",
      compatibility: passung(52, ["Passende Kenntnisse: SQL", "Studentische Vertragsart: Praktikum"]),
    }),
    stelle("nordlicht", "Nordlicht Software GmbH", "Werkstudent Java-Entwicklung", "35037 Marburg", "applied", {
      distanceKm: 27,
      sentAt: datum(4), revision: 3, updatedAt: iso(4), addedAt: datum(12), documents: [mappe, lebenslauf, anschreiben], email: "karriere@nordlicht-software.example",
      compatibility: passung(74, ["Passende Kenntnisse: Java, SQL, Docker", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("nordlicht-devops", "Nordlicht Software GmbH", "Werkstudent DevOps", "35037 Marburg", "pending", {
      distanceKm: 27,
      addedAt: datum(1), documents: [], compatibility: passung(61, ["Passende Kenntnisse: Docker, Linux", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("flusswerk", "Flusswerk Daten AG", "Praktikum Data Engineering", "60311 Frankfurt am Main", "pending", {
      distanceKm: 55,
      addedAt: datum(2), documents: [allgemeinerLebenslauf], email: "talent@flusswerk-daten.example",
      compatibility: passung(66, ["Passende Kenntnisse: Python, SQL", "Studentische Vertragsart: Praktikum"]),
    }),
    stelle("blaupunkt", "Blaupunkt Weblabor", "Werkstudent Frontend", "35578 Wetzlar", "applied", {
      distanceKm: 17,
      sentAt: datum(11), revision: 2, updatedAt: iso(11), addedAt: datum(19), documents: [lebenslauf, anschreiben], email: "jobs@blaupunkt-weblabor.example",
      compatibility: passung(69, ["Passende Kenntnisse: JavaScript, React, TypeScript", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("wolkenfeld", "Wolkenfeld IT", "Werkstudent Cloud Engineering", "35037 Marburg", "archived", {
      distanceKm: 27,
      addedAt: datum(21), updatedAt: iso(9), documents: [lebenslauf, anschreiben],
      compatibility: passung(48, ["Passende Kenntnisse: Docker, Linux", "Studentische Vertragsart: Werkstudent"], ["Fortgeschrittenes Englisch gefordert, mit deinem angegebenen Niveau abgleichen"]),
    }),
    stelle("quellwerk", "Quellwerk Systeme GmbH", "Werkstudent Linux-Administration", "35390 Gießen", "applied", {
      distanceKm: 4, sentAt: datum(9), revision: 2, updatedAt: iso(9), addedAt: datum(16), documents: [lebenslauf, anschreiben], email: "bewerbung@quellwerk-systeme.example",
      compatibility: passung(58, ["Passende Kenntnisse: Linux, Docker", "Studentische Vertragsart: Werkstudent"]),
    }),
    // Weitere versandte Bewerbungen mit verschiedenen Daten (eine ohne Datum) und unterschiedlichem Ergebnis.
    stelle("eisvogel", "Eisvogel Datensysteme GmbH", "Werkstudent Datenbankentwicklung", "35452 Heuchelheim", "applied", {
      distanceKm: 5, sentAt: datum(20), revision: 2, updatedAt: iso(20), addedAt: datum(27), documents: [lebenslauf, anschreiben], email: "karriere@eisvogel-datensysteme.example",
      compatibility: passung(71, ["Passende Kenntnisse: SQL, Python", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("silberdistel", "Silberdistel IT-Service", "Praktikum IT-Administration", "35305 Grünberg", "applied", {
      distanceKm: 21, sentAt: datum(2), revision: 2, updatedAt: iso(2), addedAt: datum(8), documents: [lebenslauf, anschreiben], email: "bewerbung@silberdistel-it.example",
      compatibility: passung(52, ["Passende Kenntnisse: Linux", "Studentische Vertragsart: Praktikum"]),
    }),
    stelle("waldkante", "Waldkante Software", "Werkstudent Webentwicklung", "35510 Butzbach", "applied", {
      distanceKm: 19, sentAt: null, revision: 2, updatedAt: iso(14), addedAt: datum(18), documents: [lebenslauf, anschreiben], email: "jobs@waldkante-software.example",
      compatibility: passung(60, ["Passende Kenntnisse: JavaScript, React", "Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("knotenpunkt", "Knotenpunkt Systeme", "Werkstudent IT-Support", "35398 Gießen", "unknown", {
      distanceKm: 2,
      sentAt: null, addedAt: datum(14), documents: [lebenslauf, anschreiben], email: "bewerbung@knotenpunkt-systeme.example",
      compatibility: passung(43, ["Studentische Vertragsart: Werkstudent"]),
    }),
    stelle("bergtal", "Bergtal Automation", "Praktikum Embedded Software", "35576 Wetzlar", "pending", {
      distanceKm: 17,
      addedAt: datum(1), documents: [allgemeinerLebenslauf],
      compatibility: passung(54, ["Passende Kenntnisse: Java, C++", "Studentische Vertragsart: Praktikum"], ["Beschreibung unvollständig: Stellenanzeige importieren, bevor Unterlagen erstellt werden"]),
    }),
    stelle("taktgeber", "Taktgeber Prozesse", "Werkstudent Prozessdigitalisierung", "35630 Ehringshausen", "pending", {
      addedAt: datum(7), documents: [lebenslauf, anschreiben], email: "kontakt@taktgeber-prozesse.example",
      compatibility: passung(41, ["Passende Kenntnisse: Python", "Studentische Vertragsart: Werkstudent"]),
    }),
    // Initiativbewerbungen (keine ausgeschriebene Stelle) mit Entfernung von Gießen in Kilometern.
    stelle("lindenhof", "Lindenhof Softwarewerkstatt GmbH", "Initiativbewerbung Softwareentwicklung (Werkstudent)", "35625 Hüttenberg", "pending", {
      distanceKm: 14, opportunityType: "initiative", addedAt: datum(3), documents: [lebenslauf, anschreiben], email: "info@lindenhof-softwarewerkstatt.example",
      compatibility: { ...passung(66, ["Passende Kenntnisse: Java, SQL", "Initiativbewerbung: keine ausgeschriebene Stelle"]), basis: "initiative" as const },
    }),
    stelle("rotbuche", "Rotbuche Cloudsysteme GmbH", "Initiativbewerbung Praktikum Cloud und DevOps", "65183 Wiesbaden", "pending", {
      distanceKm: 82, opportunityType: "initiative", addedAt: datum(6),
      compatibility: { ...passung(63, ["Passende Kenntnisse: Docker, Linux", "Initiativbewerbung: keine ausgeschriebene Stelle"]), basis: "initiative" as const },
    }),
    stelle("sternwarte", "Sternwarte Datenhaus AG", "Initiativbewerbung IT", "34117 Kassel", "pending", {
      distanceKm: 94, opportunityType: "initiative", addedAt: datum(8),
    }),
    // Ohne IT-Bezug im Titel: Die Regel "Nur Informatik" blendet diese Stelle aus, sie erscheint in keiner Ansicht.
    stelle("federkiel", "Federkiel Treuhand GmbH", "Werkstudent Buchhaltung", "35390 Gießen", "pending", {
      distanceKm: 3, addedAt: datum(1), compatibility: passung(35, ["Studentische Vertragsart: Werkstudent"]),
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
    {
      id: "a5", messageId: "<absage-2@quellwerk-systeme.example>", applicationId: "quellwerk", kandidaten: ["quellwerk"], art: "absage",
      subject: "Ihre Bewerbung als Werkstudent Linux-Administration", from: "bewerbung@quellwerk-systeme.example", receivedAt: iso(2, 14),
      beleg: "Nach sorgfältiger Prüfung müssen wir Ihnen leider mitteilen, dass wir die Stelle anderweitig besetzen.", grund: "Absender und Betreff passen zur Bewerbung.", automatisch: true,
    },
    {
      id: "a7", messageId: "<einladung-2@eisvogel-datensysteme.example>", applicationId: "eisvogel", kandidaten: ["eisvogel"], art: "interview",
      subject: "Einladung zu einem ersten Gespräch", from: "karriere@eisvogel-datensysteme.example", receivedAt: iso(15, 9),
      beleg: "Wir möchten Sie gern kennenlernen. Passt Ihnen ein Gespräch in der nächsten Woche?", grund: "Antwort auf die versandte Bewerbung, Betreff verweist auf die Stelle.", automatisch: true,
    },
    {
      id: "a8", messageId: "<absage-3@eisvogel-datensysteme.example>", applicationId: "eisvogel", kandidaten: ["eisvogel"], art: "absage",
      subject: "Rückmeldung zu unserem Gespräch", from: "karriere@eisvogel-datensysteme.example", receivedAt: iso(8, 16),
      beleg: "Nach dem Gespräch haben wir uns leider für einen anderen Kandidaten entschieden. Wir danken Ihnen für Ihr Interesse.", grund: "Absender und Betreff passen zur Bewerbung.", automatisch: true,
    },
    {
      id: "a9", messageId: "<eingang-2@silberdistel-it.example>", applicationId: "silberdistel", kandidaten: ["silberdistel"], art: "eingang",
      subject: "Eingangsbestätigung Ihrer Bewerbung", from: "bewerbung@silberdistel-it.example", receivedAt: iso(2, 8),
      beleg: "Vielen Dank, Ihre Bewerbung ist bei uns eingegangen. Wir melden uns bei Ihnen.", grund: "Betreff und Absender passen zur versandten Bewerbung.", automatisch: true,
    },
    {
      id: "a6", messageId: "<portal-1@bewerberportal.example>", applicationId: "knotenpunkt", kandidaten: ["knotenpunkt"], art: "portal",
      subject: "Neue Nachricht in Ihrem Bewerberportal", from: "noreply@bewerberportal.example", receivedAt: iso(0, 12),
      beleg: "Sie haben eine neue Nachricht. Bitte melden Sie sich im Bewerberportal an, um sie zu lesen.", grund: "Portalhinweis ohne Inhalt: Der Text steht nur im Portal, die Mail zählt nicht als Antwort.", automatisch: true,
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
    if (!eintrag) return json({ error: t("Nicht gefunden", "Introuvable") }, 404);
    if (koerper.revision !== eintrag.revision) return json({ error: t("Der Status hat sich geändert. Die Fiche wurde aktualisiert.", "Le statut a changé. La fiche a été mise à jour."), application: eintrag }, 409);
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
      if (!antwort) return json({ error: t("Nicht gefunden", "Introuvable") }, 404);
      if (koerper.ignore) antwort.ignoriert = true; else { antwort.applicationId = koerper.applicationId; antwort.manuell = true; antwort.automatisch = false; }
      return json({ gespeichert: true });
    }
  }
  if (pfad === "/api/jobpilot/assistent") {
    if (methode === "GET") return json({ aktiv: false });
    return json({ error: t("In der Demo öffnet sich kein Browserfenster. Im lokalen JobPilot startet hier der Formularassistent in einem eigenen Fenster.", "Dans la démo, aucune fenêtre de navigateur ne s'ouvre. Dans JobPilot en local, l'assistant de formulaire démarre ici dans une fenêtre dédiée.") }, 409);
  }
  return json({ error: t("In der Demo nicht verfügbar.", "Non disponible dans la démo.") }, 404);
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
const plaketteText = () => t("Öffentliche Demo · erfundene Daten · es wird nichts gesendet", "Démo publique · données fictives · rien n'est envoyé");
plakette.textContent = plaketteText();
window.addEventListener("jobpilot-sprache", () => { plakette.textContent = plaketteText(); });
plakette.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:40;padding:7px 12px;border-radius:99px;background:#fff;color:#165dff;border:1px solid #d7e5ff;font:600 11px/1.2 'DM Sans',system-ui,sans-serif;box-shadow:0 4px 14px #1b3b6514";
document.addEventListener("DOMContentLoaded", () => { document.body.append(hinweis, plakette); });

const unterlagen: Record<string, string> = { cv: "lebenslauf-beispiel.pdf", letter: "anschreiben-beispiel.pdf", bundle: "anschreiben-beispiel.pdf" };
document.addEventListener("click", ereignis => {
  const anker = (ereignis.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anker) return;
  const ziel = anker.getAttribute("href") || "";
  const dokument = /\/api\/tracker\/[^/]+\/documents\/(\w+)/.exec(ziel);
  if (dokument) { ereignis.preventDefault(); // Wie im lokalen JobPilot (?ansehen=1): im Browser ansehen, ohne Download (kein download-Attribut, PDF inline).
    window.open(`./beispiel/${unterlagen[dokument[1]] || unterlagen.cv}`, "_blank", "noopener"); return; }
  if (!ziel.startsWith("/") || ziel.startsWith("//")) return;
  ereignis.preventDefault();
  if (ziel.startsWith("/suivi")) {
    const markierung = ziel.includes("#") ? ziel.slice(ziel.indexOf("#")) : "";
    if (markierung) location.hash = markierung; else history.replaceState(null, "", location.pathname + location.search), window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  zeigeHinweis(ziel.startsWith("/offres") ? t("Die Stellensuche gehört zum lokalen JobPilot. Diese Demo zeigt die Stellenübersicht und die Antworten mit erfundenen Daten.", "La recherche d'offres fait partie de JobPilot en local. Cette démo montre l'aperçu des offres et les réponses avec des données fictives.")
    : ziel.startsWith("/dossier") ? t("Das Dossier mit Unterlagen und Versandprüfung gehört zum lokalen JobPilot. Hier sind nur die Beispielunterlagen abrufbar.", "Le dossier avec les documents et la vérification d'envoi fait partie de JobPilot en local. Ici, seuls les documents d'exemple sont consultables.")
    : t("Diese Seite gehört zum lokalen JobPilot und ist in der Demo nicht enthalten.", "Cette page fait partie de JobPilot en local et n'est pas incluse dans la démo."));
}, true);
