// Archivgründe und Firmenausschluss, nach scripts/tracker-archive-reasons.test.cjs und preparation.test.cjs des Originals
// (npm run test:jobpilot-archiv). Statt Datenbank: die Regeln auf einer Liste und der lokale Server mit JSON-Zustand und
// gemocktem Stellenmarkt. Keine echte Jobbörse, kein Ortsdienst.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ARCHIVE_REASONS, ArchivFehler, archivieren, firmenSperre, statusSetzen } from "../dist/archiv.mjs";
import { excludedCompanyRecord, selectCompanyOptions, ohneUnterlagen, missingDossierParts, dossierReady } from "../dist/firmen.mjs";
import { aufnehmen } from "../dist/ablauf.mjs";
import { erstelleServer } from "../dist/server.mjs";
import { stellenmarkt } from "./hilfen/stellenmarkt.mjs";

const profil = { skills: ["Java", "SQL"], anchoredSkills: ["Java"], keywords: "Werkstudent IT", englishBasic: true };
function speicher(status = "pending") {
  return [
    { id: "alt", status, sentAt: status === "applied" ? "2026-11-01" : null, revision: 3, company: "Acme GmbH", title: "Werkstudent IT", letter: true, documents: [{ kind: "cv", sha: "gleich" }, { kind: "letter", sha: "gleich" }] },
    { id: "zweite", status: "pending", revision: 1, company: "Acme", title: "Werkstudent IT" },
  ];
}
const angebot = (ref, company, extra = {}) => ({ source: "linkedin", externalRef: ref, title: "Werkstudent IT", company, location: "Gießen", url: "https://stellen.example.test/" + ref, description: "", complete: false, ...extra });

test("Drei kurze Gründe; nicht verfügbare Anzeige sperrt keine andere Stelle der Firma", () => {
  assert.deepEqual(Object.keys(ARCHIVE_REASONS), ["unavailable", "not-it", "other"]);
  const rows = speicher();
  archivieren(rows, "alt", 3, "unavailable", "");
  assert.equal(rows[0].status, "archived");
  assert.equal(rows[0].archiveScope, "offer");
  assert.equal(rows[0].companyExcluded, undefined);
  assert.equal(rows[0].revision, 4);
  assert.equal(rows[1].status, "pending");
  assert.equal(selectCompanyOptions(rows.map((r) => ({ ...r, score: 1 })))[0].id, "zweite");
});

test("Kein IT-Bezug bleibt firmenweit gesperrt, auch bei Namensvarianten und alten offenen Zweitstellen", () => {
  const rows = speicher();
  archivieren(rows, "alt", 3, "not-it");
  assert.equal(rows[0].companyExcluded, true);
  assert.equal(rows[0].archiveScope, "company");
  assert.equal(rows[0].archiveReason, "Kein IT-Bezug");
  assert.equal(rows[1].status, "pending");
  const liste = rows.map((r) => ({ ...r, score: 100 }));
  assert(excludedCompanyRecord(liste, "ACME & Co. KG", "neu"));
  assert.equal(selectCompanyOptions(liste).filter((r) => r.status === "pending").length, 0);
  assert.equal(excludedCompanyRecord(liste, "Acme Andere Tochter GmbH", "neu"), undefined);
  liste[0].status = "pending";
  assert(excludedCompanyRecord(liste, "Acme", "neu"), "Flag übersteht alte lokale Statusänderung");
});

test("Sonstiges archiviert nur das Angebot, speichert Notiz und erhält Dokumente", () => {
  const rows = speicher(), docs = JSON.stringify(rows[0].documents);
  archivieren(rows, "alt", 3, "other", "  Eigener Grund  ");
  assert.equal(rows[0].archiveNote, "Eigener Grund");
  assert.equal(rows[0].archiveScope, "offer");
  assert.equal(JSON.stringify(rows[0].documents), docs);
  assert.equal(rows[0].letter, true);
});

test("Ungültiger Grund, veraltete Revision, zu lange Notiz und unbekannte Firma verändern nichts", () => {
  const rows = speicher(), vorher = JSON.stringify(rows);
  assert.throws(() => archivieren(rows, "alt", 3, "falsch"), (e) => e instanceof ArchivFehler && e.status === 400);
  assert.throws(() => archivieren(rows, "alt", 2, "not-it"), (e) => e.status === 409);
  assert.throws(() => archivieren(rows, "alt", 3, "other", "x".repeat(501)), (e) => e.status === 400);
  assert.throws(() => archivieren(rows, "fehlt", 1, "other"), (e) => e.status === 404);
  assert.equal(JSON.stringify(rows), vorher);
  const ohneFirma = [{ id: "u", status: "pending", revision: 1, company: "" }];
  assert.throws(() => archivieren(ohneFirma, "u", 1, "not-it"), (e) => e.status === 400 && /Firmennamen/.test(e.message));
  assert.equal(ohneFirma[0].status, "pending");
});

test("Firmenausschluss erhält bereits bestätigten Versand, Datum und Unterlagen", () => {
  const rows = speicher("applied"), docs = JSON.stringify(rows[0].documents);
  archivieren(rows, "alt", 3, "not-it");
  assert.equal(rows[0].status, "applied");
  assert.equal(rows[0].sentAt, "2026-11-01");
  assert.equal(JSON.stringify(rows[0].documents), docs);
  assert.equal(rows[0].companyExcluded, true);
});

test("Firmensperre schützt Status und Bewerbung einer offenen Zweitstelle; der Ausschluss lässt sich nicht zurücksetzen", () => {
  const rows = speicher();
  archivieren(rows, "alt", 3, "not-it");
  const sperre = firmenSperre(rows, "zweite");
  assert.equal(sperre.excluded, true);
  assert.match(sperre.message, /dauerhaft ausgeschlossen/);
  assert.throws(() => statusSetzen(rows, "zweite", 1, "applied", "2026-11-26"), (e) => e.status === 409);
  assert.throws(() => statusSetzen(rows, "alt", 4, "pending", null), (e) => e.status === 409);
  assert.equal(rows[0].companyExcluded, true);
  // Erneutes Archivieren mit einem anderen Grund entfernt den Ausschluss nicht.
  archivieren(rows, "alt", 4, "unavailable");
  assert.equal(rows[0].companyExcluded, true);
  assert.equal(rows[0].archiveScope, "company");
  // Ohne Ausschluss: eine zweite Bewerbung an dieselbe Firma bleibt gesperrt.
  const beworben = speicher("applied");
  assert.throws(() => statusSetzen(beworben, "zweite", 1, "applied", "2026-11-26"), (e) => e.status === 409 && /bereits eine Bewerbung am 2026-11-01/.test(e.message));
});

test("Neue Anzeigen einer ausgeschlossenen Firma werden nicht aufgenommen; Historie bleibt unverändert", () => {
  const rows = speicher();
  archivieren(rows, "alt", 3, "not-it");
  const vorher = JSON.stringify(rows);
  const r = aufnehmen(rows, [angebot("n1", "ACME", { title: "Werkstudent Data" }), angebot("n2", "Acme GmbH & Co. KG", { title: "Praktikum Softwareentwicklung" }), angebot("n3", "Beta GmbH")], profil);
  assert.equal(r.neu, 1);
  assert.equal(r.firmaAusgeschlossen, 2);
  assert.deepEqual(r.stellen.map((s) => s.id), ["alt", "zweite", "linkedin-n3"]);
  assert.equal(JSON.stringify(rows), vorher, "Bestand unverändert");
  assert.equal(JSON.stringify(r.stellen.slice(0, 2)), vorher, "Historie samt Ausschluss bleibt");
  // „Angebot nicht verfügbar“ und „Sonstiges“ sperren keine späteren Anzeigen derselben Firma.
  for (const grund of ["unavailable", "other"]) {
    const b = speicher();
    archivieren(b, "alt", 3, grund);
    assert.equal(aufnehmen(b, [angebot("n4", "ACME", { title: "Werkstudent Data" })], profil).neu, 1, grund);
  }
});

test("Neue Anzeigen ohne Unterlagen werden für die Stellensuche gezählt, gesperrte Firmen nicht", () => {
  const zeile = (id, company, status, documents = [], extra = {}) => ({ id, status, metadata: { company, ...extra }, documents });
  const neu = [zeile("a", "Alpha", "pending"), zeile("b", "Beta", "pending", [{ kind: "cv" }, { kind: "letter" }]), zeile("c", "Gamma", "unknown", [{ kind: "cv" }]), zeile("d", "Delta", "archived"), zeile("e", "Epsilon", "pending"), zeile("f", "Zeta", "pending"), zeile("g", "Eta", "pending", [{ kind: "cv" }], { applicationChannel: "portal-only", letterNotRequired: true })];
  const bestand = [...neu, zeile("alt-e", "Epsilon GmbH", "applied"), zeile("alt-f", "Zeta", "archived", [], { companyExcluded: true }), { id: "__send-a", status: "sent", metadata: {} }];
  assert.equal(ohneUnterlagen(neu, bestand).map((r) => r.id).join(","), "a,c");
  // Dieselbe Regel wie im Original: Mappe oder gezielter Lebenslauf plus Anschreiben; Portalausnahme nur mit beiden Angaben.
  for (const documents of [[], [{ kind: "cv", isGeneral: true }], [{ kind: "cv" }], [{ kind: "cv" }, { kind: "letter" }], [{ kind: "cv" }, { kind: "letter", isGeneral: true }], [{ kind: "bundle" }]])
    for (const kanal of [undefined, "portal-only"])
      for (const ohneBrief of [undefined, true]) {
        const item = { documents, applicationChannel: kanal, letterNotRequired: ohneBrief }, fehlt = missingDossierParts(item).join(",");
        const gezielt = documents.some((d) => d.kind === "cv" && !d.isGeneral), brief = documents.some((d) => d.kind === "letter" && !d.isGeneral), mappe = documents.some((d) => d.kind === "bundle");
        assert.equal(fehlt === "", mappe || (gezielt && (brief || (kanal === "portal-only" && ohneBrief === true))), JSON.stringify(item));
        assert.equal(dossierReady(item), fehlt === "");
      }
});

// Lokaler Server: Archiv-Endpunkt mit Prüfung, Firmenausschluss über wiederholte Suchen, Datenwechsel und Zurücksetzen.
async function aufbauen(t, treffer) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-archiv-test-"));
  const server = erstelleServer({ datenordner: ordner, live: true, geokodierung: false, indeedClaude: { verfuegbar: false }, indeedCodex: { verfuegbar: false } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port, echt = globalThis.fetch, markt = stellenmarkt(echt, { treffer });
  globalThis.fetch = markt.abruf;
  t.after(async () => {
    globalThis.fetch = echt;
    await server.suchlauf();
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  });
  const senden = async (methode, pfad, inhalt) => {
    const r = await echt(basis + pfad, { method: methode, headers: { "Content-Type": "application/json" }, body: inhalt === undefined ? undefined : JSON.stringify(inhalt) });
    return { status: r.status, daten: await r.json() };
  };
  const suchen = (extra = {}) => senden("POST", "/api/suche", { live: true, city: "Gießen", radius: 50, keywordList: ["Werkstudent IT"], quellen: ["bundesagentur"], ...extra });
  const tracker = async () => (await senden("GET", "/api/tracker")).daten.applications;
  const archiv = (id, revision, archiveReasonCode, archiveNote) => senden("PATCH", `/api/tracker/${encodeURIComponent(id)}/state`, { status: "archived", sentAt: null, revision, archiveReasonCode, archiveNote });
  return { ordner, basis, senden, suchen, tracker, archiv, markt, server };
}

test("Lokaler Server: Kein IT-Bezug schließt spätere Importe derselben Firma aus, auch über wiederholte Suchen, Datenwechsel und Zurücksetzen", async (t) => {
  let liste = [
    { ref: "R-ACME-1", titel: "Werkstudent IT", firma: "Acme GmbH" },
    { ref: "R-BETA-1", titel: "Werkstudent Softwareentwicklung", firma: "Beta GmbH" },
    { ref: "R-GAMMA-1", titel: "Praktikum Informatik", firma: "Gamma AG" },
  ];
  const h = await aufbauen(t, () => liste);
  const erste = await h.suchen();
  assert.equal(erste.status, 200);
  assert.equal(erste.daten.neu, 3);
  let fichen = await h.tracker();
  const acme = fichen.find((f) => f.company === "Acme GmbH"), beta = fichen.find((f) => f.company === "Beta GmbH"), gamma = fichen.find((f) => f.company === "Gamma AG");
  assert.equal(acme.revision, 1);
  assert.equal(acme.sourceLabel, "Arbeitsagentur");
  assert.match(acme.addedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(acme.documents, []);

  // Prüfung des Endpunkts: nichts wird gespeichert.
  const vorher = await readFile(path.join(h.ordner, "zustand.json"), "utf8");
  assert.equal((await h.archiv(acme.id, 1, "falsch")).status, 400);
  assert.equal((await h.archiv(acme.id, 1, "other", "x".repeat(501))).status, 400);
  const konflikt = await h.archiv(acme.id, 7, "not-it");
  assert.equal(konflikt.status, 409);
  assert.equal(konflikt.daten.application.id, acme.id, "Konflikt liefert die aktuelle Fiche");
  assert.equal((await h.archiv("unbekannt", 1, "not-it")).status, 404);
  assert.equal((await h.senden("PATCH", `/api/tracker/${acme.id}/state`, { status: "gelöscht", revision: 1, sentAt: null })).status, 400);
  assert.equal((await h.senden("PATCH", `/api/tracker/${acme.id}/state`, { status: "applied", revision: 1, sentAt: "26.11.2026" })).status, 400);
  assert.equal((await h.senden("POST", `/api/tracker/${acme.id}/state`, { status: "archived", revision: 1 })).status, 405);
  assert.equal(await readFile(path.join(h.ordner, "zustand.json"), "utf8"), vorher);

  // Kein IT-Bezug: Firma dauerhaft ausgeschlossen. Nicht verfügbar und Sonstiges: nur das Angebot.
  const a = await h.archiv(acme.id, 1, "not-it");
  assert.equal(a.status, 200);
  assert.equal(a.daten.application.companyExcluded, true);
  assert.equal(a.daten.application.archiveScope, "company");
  assert.equal(a.daten.application.revision, 2);
  assert.equal((await h.archiv(beta.id, 1, "unavailable")).daten.application.archiveScope, "offer");
  const g = await h.archiv(gamma.id, 1, "other", "Später prüfen");
  assert.equal(g.daten.application.archiveNote, "Später prüfen");
  assert.equal(g.daten.application.companyExcluded, undefined);

  // Neue Anzeigen derselben Firmen: Acme (auch als Namensvariante) bleibt draußen, Beta und Gamma kommen wieder.
  liste = [
    { ref: "R-ACME-2", titel: "Praktikum Softwareentwicklung", firma: "ACME GmbH & Co. KG" },
    { ref: "R-ACME-3", titel: "Werkstudent Data", firma: "Acme" },
    { ref: "R-BETA-2", titel: "Werkstudent Frontend", firma: "Beta GmbH" },
    { ref: "R-GAMMA-2", titel: "Werkstudent DevOps", firma: "Gamma AG" },
  ];
  const zweite = await h.suchen();
  assert.equal(zweite.daten.neu, 2);
  assert.equal(zweite.daten.zustand.lauf.firmaAusgeschlossen, 2);
  assert.match(zweite.daten.zustand.berichte.find((b) => b.source === "bundesagentur").message, /2 Treffer dauerhaft ausgeschlossener Firmen nicht übernommen/);
  fichen = await h.tracker();
  assert.deepEqual(fichen.filter((f) => /acme/i.test(f.company)).map((f) => f.id), [acme.id], "keine neue Acme-Fiche");
  assert.equal(fichen.filter((f) => f.company === "Beta GmbH").length, 2);
  assert.equal(fichen.filter((f) => f.company === "Gamma AG").length, 2);
  // Wiederholte Suchen: der Ausschluss bleibt, die Archivhistorie auch.
  for (let i = 0; i < 2; i++) assert.equal((await h.suchen()).daten.neu, 0);
  const acmeNachher = (await h.tracker()).find((f) => f.id === acme.id);
  assert.equal(acmeNachher.companyExcluded, true);
  assert.equal(acmeNachher.archiveReasonCode, "not-it");
  assert.equal(acmeNachher.status, "archived");

  // Statusabgleich und ältere Statusänderung entfernen den Ausschluss nicht.
  assert.equal((await h.senden("PATCH", `/api/tracker/${acme.id}/state`, { status: "pending", revision: 2, sentAt: null })).status, 409);
  assert.equal((await h.senden("POST", "/api/status-aendern", { id: acme.id, status: "pending" })).status, 409);

  // Wechsel zu Beispieldaten und zurück, dann Zurücksetzen: der Ausschluss bleibt bestehen.
  const synthetisch = await h.senden("POST", "/api/suche", {});
  assert.equal(synthetisch.daten.modus, "synthetisch");
  assert(synthetisch.daten.zustand.stellen.some((s) => s.id === acme.id && s.companyExcluded === true));
  assert(synthetisch.daten.zustand.stellen.some((s) => s.id.endsWith("R-BETA-1") && s.archiveReasonCode === "unavailable"), "Archivhistorie bleibt");
  assert(!synthetisch.daten.zustand.stellen.some((s) => s.id.endsWith("R-BETA-2")), "Live-Daten ohne Entscheidung entfallen wie bisher");
  assert.equal((await h.senden("POST", "/api/zuruecksetzen", {})).status, 200);
  liste = [{ ref: "R-ACME-4", titel: "Werkstudent Cloud", firma: "Acme GmbH" }, { ref: "R-DELTA-1", titel: "Werkstudent IT", firma: "Delta GmbH" }];
  const danach = await h.suchen();
  assert.equal(danach.daten.neu, 1);
  assert.equal(danach.daten.zustand.lauf.firmaAusgeschlossen, 1);
  assert(danach.daten.zustand.stellen.some((s) => s.id === acme.id && s.companyExcluded === true && s.archiveReasonCode === "not-it"));
  assert(!h.markt.extern.some((u) => !u.startsWith("https://rest.arbeitsagentur.de/")), "nur die gemockte Arbeitsagentur");
});

test("Lokaler Server: Archivieren während eines Suchstarts wird abgewiesen, statt den Lauf zu überschreiben", async (t) => {
  let freigeben;
  const halt = new Promise((r) => { freigeben = r; });
  const h = await aufbauen(t, () => [{ ref: "R-1", titel: "Werkstudent IT", firma: "Acme GmbH" }]);
  await h.suchen();
  const [fiche] = await h.tracker();
  // Der nächste Suchstart hält bei der Arbeitsagentur an, bis die Prüfung ihn freigibt.
  const markt = h.markt.abruf;
  globalThis.fetch = async (u, i) => { if (String(u).startsWith("https://rest.arbeitsagentur.de/")) await halt; return markt(u, i); };
  const start = await h.suchen({ hintergrund: true });
  assert.equal(start.status, 202);
  const status = (await h.senden("GET", "/api/status")).daten;
  assert.equal(status.suchAktiv, true);
  const gesperrt = await h.archiv(fiche.id, 1, "not-it");
  assert.equal(gesperrt.status, 409);
  assert.match(gesperrt.daten.fehler, /Suche läuft bereits/);
  assert.equal((await h.senden("POST", "/api/kriterien", { radius: 30 })).status, 409);
  freigeben();
  await h.server.suchlauf();
  assert.equal((await h.senden("GET", "/api/status")).daten.suchAktiv, false);
  assert.equal((await h.archiv(fiche.id, 1, "not-it")).status, 200);
});
