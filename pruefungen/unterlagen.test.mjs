// Automatische Bewerbungsunterlagen der öffentlichen Fassung: Vorlage ohne Netz, PDF-Regeln, Profilprüfung, KI-Wege mit
// ausschließlich gemockten Anbietern (kein echter API- oder Programmaufruf) und der Ablauf am lokalen Server nach einer
// gemockten Suche. Nur erfundene Personen, Firmen und Dateien in temporären Ordnern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as u from "../dist/unterlagen.mjs";
import { erstelleServer } from "../dist/server.mjs";

const FORMULAR = { firstName: "Mira", lastName: "Beispiel", email: "mira.beispiel@example.test", phone: "0151 0000000", phoneCountryCode: "+49", city: "Musterstadt", state: "Hessen", street: "Lindenweg", houseNumber: "4", postalCode: "35000", portfolio: "https://mira.example.test", github: "https://github.com/mira-beispiel", startDate: "2027-01-15", weeklyHours: "20", fieldOfInterest: "Webentwicklung" };
const LEBENSLAUF = {
  ausbildung: [{ abschluss: "Bachelor Informatik", einrichtung: "Hochschule Musterstadt", ort: "Musterstadt", zeitraum: "seit 2024", punkte: "Schwerpunkte: Softwaretechnik, Datenbanken, Webanwendungen." }],
  erfahrung: [{ titel: "Tutorin Programmieren", firma: "Hochschule Musterstadt", zeitraum: "04/2025 bis 09/2025", punkte: ["Übungen zu Java für Erstsemester betreut."] }],
  projekte: [
    { name: "Wetterstation", technik: "Python, MQTT, Grafana", kontext: "Eigenes Projekt", link: "https://github.com/mira-beispiel/wetter", punkte: "Messwerte per MQTT gesammelt und in einem Dashboard dargestellt.\nDocker Compose für eine reproduzierbare Umgebung." },
    { name: "Lernkarten-App", technik: "TypeScript, React, Node.js, SQL", kontext: "Gruppenprojekt", punkte: ["Webanwendung zum Lernen mit Karteikarten im Team umgesetzt.", "REST-Schnittstelle und SQL-Datenbank entworfen."] },
    { name: "Notenrechner", technik: "Java, JavaFX", kontext: "Hochschule", punkte: ["Desktop-Anwendung zur Berechnung von Notenschnitten."] },
  ],
  kenntnisse: [{ kategorie: "Web", eintraege: "HTML, CSS, JavaScript, TypeScript, React" }, { kategorie: "Backend und Daten", eintraege: "Java, Python, Node.js, SQL" }, { kategorie: "Werkzeuge", eintraege: "Git, Docker, Linux" }],
  sprachen: "Deutsch (C1), Englisch (B2), Französisch (Muttersprache)",
  weiterbildung: "Online-Kurs Cloud-Grundlagen (2025)",
};
const STELLE = { id: "s1", title: "Werkstudent Webentwicklung (m/w/d)", company: "Nordwind Digital GmbH", location: "Frankfurt am Main", description: "Du unterstützt unser Frontend-Team mit React und TypeScript. Ansprechpartnerin: Frau Anna Schmidt. Bitte sende Lebenslauf, Immatrikulationsbescheinigung und aktuelle Zeugnisse." };
const HEUTE = new Date("2026-11-27T10:00:00Z");
const eingabe = (profil = {}, stelle = STELLE) => ({ kontakt: u.kontaktAus(FORMULAR), profil: u.unterlagenprofilPruefen({ lebenslauf: LEBENSLAUF, ...profil }), stelle, heute: HEUTE });
const text = (d) => u.pdfTextLesen(Buffer.from(d.base64, "base64")).join(" ");
const roh = (d) => Buffer.from(d.base64, "base64").toString("latin1");
// Nichts aus dem persönlichen Original darf in erzeugten Unterlagen auftauchen.
const ORIGINAL = /Jordan|Freddy|Jorxas|Concal|quizgame|Mittelhessen|Eichendorff|DSH 3/i;
const VORSCHLAG = (absaetze) => ({
  projekte: ["Lernkarten-App"],
  kenntnisse: [{ kategorie: "Web", eintraege: ["React", "TypeScript"] }],
  anrede: "Sehr geehrte Frau Schmidt,",
  absaetze: absaetze || [
    "mit großem Interesse habe ich Ihre Anzeige für die Stelle als Werkstudent Webentwicklung gelesen. Bei Nordwind Digital möchte ich das Frontend-Team mit React und TypeScript unterstützen und dabei lernen.",
    "Zurzeit studiere ich Bachelor Informatik an der Hochschule Musterstadt – dort beschäftige ich mich vor allem mit Webanwendungen. Im Gruppenprojekt Lernkarten-App habe ich eine Webanwendung mit React und einer SQL-Datenbank umgesetzt.",
    "Ich arbeite sorgfältig, stimme mich im Team ab und dokumentiere meine Ergebnisse nachvollziehbar. Neue Themen erschließe ich mir zügig und frage nach, wenn etwas unklar ist.",
    "Ab dem 15. Januar 2027 stehe ich mit bis zu 20 Stunden pro Woche zur Verfügung. Über die Einladung zu einem persönlichen Gespräch freue ich mich sehr.",
  ],
});

test("Vorlage ohne Netz: gezielter Lebenslauf und Anschreiben auf je einer Seite, Schreibregeln und keine Daten des Originals", async () => {
  const e = await u.unterlagenErzeugen(eingabe());
  assert.equal(e.anbieter, "vorlage");
  assert.deepEqual(e.seiten, { cv: 1, letter: 1 });
  assert.deepEqual(e.dokumente.map((d) => [d.kind, d.name]), [["cv", "Lebenslauf_Mira_Beispiel.pdf"], ["letter", "Anschreiben_Mira_Beispiel.pdf"]]);
  for (const d of e.dokumente) {
    const r = roh(d);
    assert(r.startsWith("%PDF-1.4") && r.trimEnd().endsWith("%%EOF"));
    // Querverweistabelle zeigt auf die tatsächlichen Objekte (gültige Datei für jeden Betrachter).
    const xref = Number(/startxref\n(\d+)/.exec(r)[1]), zeilen = r.slice(xref).split("\n");
    const anzahl = Number(zeilen[1].split(" ")[1]);
    for (let i = 1; i < anzahl; i++) assert(r.slice(Number(zeilen[2 + i].slice(0, 10))).startsWith(`${i} 0 obj`), "Objekt " + i);
    assert(!/FontFile|Type0/.test(r), "nur Standardschriften, nichts eingebettet");
    assert.match(d.sha256, /^[a-f0-9]{64}$/);
    assert(!ORIGINAL.test(text(d)) && !ORIGINAL.test(r));
  }
  const brief = text(e.dokumente[1]), cv = text(e.dokumente[0]);
  for (const teil of ["Musterstadt, den 27. November 2026", "Bewerbung als Werkstudent Webentwicklung (m/w/d)", "Sehr geehrte Frau Schmidt,", "Nordwind Digital GmbH", "Kenntnisse in TypeScript und React", "ab dem 15. Januar 2027 mit bis zu 20 Stunden pro Woche", "Mit freundlichen Grüßen", "Portfolio"]) assert(brief.includes(teil), teil);
  assert(/[äöüß]/.test(brief) && !/\b(?:fuer|ueber|moechte|Gruessen)\b/i.test(brief), "echte Umlaute");
  for (const t of [brief, cv]) {
    assert(!/[–—]/.test(t), "keine Gedankenstriche");
    assert(!/https?:|www\.|mira\.example\.test|github\.com/.test(t), "keine sichtbaren Adressen");
  }
  // Verweise liegen nur auf Wörtern: Projektname, Portfolio, GitHub.
  assert(roh(e.dokumente[0]).includes("/URI (https://github.com/mira-beispiel/wetter)"));
  assert(roh(e.dokumente[1]).includes("/URI (https://mira.example.test/)"));
  // Zur Anzeige passende Projekte zuerst; Kenntnisse vollständig, passende vorn.
  assert(cv.indexOf("Lernkarten-App") < cv.indexOf("Wetterstation"));
  assert(cv.includes("PROJEKTE") && cv.includes("KOMPETENZEN") && cv.includes("Web: TypeScript, React, HTML, CSS, JavaScript"));
  assert(cv.includes("Sprachen: Deutsch (C1), Englisch (B2), Französisch (Muttersprache)"));
});

test("Grundlage und Briefvorlage: eigene Struktur, eigener Text mit Platzhaltern, Initiativbewerbung", async () => {
  const eigen = await u.unterlagenErzeugen(eingabe({ grundlage: "eigene", brief: "eigene", lebenslauf: { ...LEBENSLAUF, kurzprofil: "Informatikstudentin mit Freude an gut bedienbaren Webanwendungen." }, eigenerBrief: "ich bewerbe mich bei {Firma} als {Stelle}, weil mich Aufgaben im Bereich {Bereich} begeistern.\n\nMeine passenden Kenntnisse: {Kenntnisse}. Dazu bringe ich Erfahrung aus mehreren Hochschulprojekten mit, die ich gern bei Ihnen einbringe.\n\nIch freue mich auf ein Gespräch." }));
  const cv = text(eigen.dokumente[0]), brief = text(eigen.dokumente[1]);
  assert(cv.includes("Kurzprofil") && !cv.includes("PROJEKTE"), "schlichte eigene Gestaltung");
  for (const p of ["Wetterstation", "Lernkarten-App", "Notenrechner"]) assert(cv.includes(p));
  assert(brief.includes("ich bewerbe mich bei Nordwind Digital GmbH als Werkstudent Webentwicklung (m/w/d)"));
  assert(brief.includes("Meine passenden Kenntnisse: TypeScript und React."));
  assert.equal(eigen.grundlage, "eigene");
  const initiativ = await u.unterlagenErzeugen(eingabe({}, { id: "i", title: "Initiativbewerbung Softwareentwicklung", company: "Lindenhof Software", description: "" }));
  const b = text(initiativ.dokumente[1]);
  assert(b.includes("Initiativbewerbung bei Lindenhof Software") && b.includes("Sehr geehrte Damen und Herren,"));
});

test("Umfangreiches Profil: JobPilot-Struktur kürzt auf eine Seite, eigene Gestaltung darf zwei Seiten haben", async () => {
  const projekt = (i) => ({ name: "Projekt " + i, technik: "TypeScript, React, SQL", kontext: "Gruppenprojekt", punkte: ["Ein ausführlicher Stichpunkt über die Umsetzung einer Funktion mit mehreren Teilen und Tests.", "Noch ein Stichpunkt mit Details zu Architektur, Datenbank und Bereitstellung.", "Dritter Stichpunkt zur Dokumentation."] });
  const voll = { ...LEBENSLAUF, erfahrung: [1, 2, 3].map((i) => ({ titel: "Werkstudent " + i, firma: "Firma " + i, zeitraum: "2024 bis 2025", punkte: ["Aufgabe eins.", "Aufgabe zwei.", "Aufgabe drei."] })), projekte: [1, 2, 3, 4, 5, 6].map(projekt), kenntnisse: [1, 2, 3, 4, 5].map((i) => ({ kategorie: "Kategorie " + i, eintraege: "Eins, Zwei, Drei, Vier, Fünf, Sechs, Sieben, Acht, Neun, Zehn, Elf, Zwölf" })) };
  assert.equal((await u.unterlagenErzeugen(eingabe({ lebenslauf: voll }))).seiten.cv, 1);
  assert(((await u.unterlagenErzeugen(eingabe({ lebenslauf: voll, grundlage: "eigene" }))).seiten.cv) <= 2);
});

test("Profil: Prüfung der Eingaben und fehlende Angaben werden genannt statt geraten", async () => {
  assert.throws(() => u.unterlagenprofilPruefen({ lebenslauf: { projekte: [{ name: "X", link: "javascript:alert(1)" }] } }), /Internetadresse/);
  assert.throws(() => u.unterlagenprofilPruefen({ lebenslauf: { projekte: [{ name: "X", punkte: "a\nb\nc\nd\ne\nf\ng" }] } }), /höchstens 6/);
  assert.throws(() => u.unterlagenprofilPruefen({ brief: "eigene", eigenerBrief: "zu kurz" }), /200 Zeichen/);
  assert.throws(() => u.unterlagenprofilPruefen({ grundlage: "fremd" }), /Unbekannte Vorlage/);
  assert.deepEqual(u.unterlagenprofilPruefen({ lebenslauf: { projekte: [{ name: "P", punkte: "• erster\n- zweiter" }] } }).lebenslauf.projekte[0].punkte, ["erster", "zweiter"]);
  assert.deepEqual(u.fehlendeAngaben(u.kontaktAus({ firstName: "Mira" }), u.leeresProfil().lebenslauf), ["E-Mail", "Ausbildung, Erfahrung oder Projekte"]);
  await assert.rejects(u.unterlagenErzeugen({ ...eingabe(), kontakt: u.kontaktAus({}) }), (e) => e.status === 409 && /Vor- und Nachname/.test(e.message));
  assert.equal(u.anredeAus("Ansprechpartnerin: Frau Anna Schmidt, Tel. 0000"), "Sehr geehrte Frau Schmidt,");
  assert.equal(u.anredeAus("Kontakt: Herr Dr. Max Weber\nPersonal"), "Sehr geehrter Herr Dr. Weber,");
  assert.equal(u.anredeAus("Ihre Ansprechpartnerin ist Frau Schmidt Ihnen gern behilflich."), "Sehr geehrte Frau Schmidt,");
  assert.equal(u.anredeAus("Frau Schmidt freut sich auf dich."), "Sehr geehrte Damen und Herren,");
  assert.deepEqual(u.nachweisStand(STELLE.description, { enrollment: {} }), { verlangt: ["enrollment", "certificates"], beigelegt: ["enrollment"], fehlen: ["certificates"] });
});

test("KI über eigene API-Schlüssel: geprüftes JSON, Rückfall bei erfundenen Projekten, keine Kontaktdaten, Sperre nach Zugangsfehler", async () => {
  const anfragen = [];
  const antworten = { anthropic: [], openai: [] };
  const abruf = async (url, init) => {
    const body = JSON.parse(init.body);
    anfragen.push({ url, headers: init.headers, body });
    const anbieter = url.includes("anthropic") ? "anthropic" : "openai", n = antworten[anbieter].shift();
    if (typeof n === "number") return new Response("{}", { status: n });
    return anbieter === "anthropic"
      ? Response.json({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(n) }] })
      : Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(n), refusal: null } }] });
  };
  const env = { JOBPILOT_UNTERLAGEN_ANBIETER: "auto", ANTHROPIC_API_KEY: "test-schluessel-a", OPENAI_API_KEY: "test-schluessel-o" };
  const optionen = { einstellung: "auto", env, fetch: abruf, programme: { claude: null, codex: null, gemini: null } };
  assert.deepEqual(u.kette(optionen), ["api-anthropic", "api-openai"]);
  // Claude erfindet ein Projekt: abgewiesen; OpenAI liefert gültig. Gedankenstriche werden zu Kommas.
  antworten.anthropic.push({ ...VORSCHLAG(), projekte: ["Raketenbau"] });
  antworten.openai.push(VORSCHLAG());
  const e = await u.unterlagenErzeugen(eingabe(), { optionen });
  assert.equal(e.anbieter, "api-openai");
  assert.deepEqual(e.versuche.map((v) => v.schritt), ["api-anthropic"]);
  const brief = text(e.dokumente[1]);
  assert(brief.includes("Bei Nordwind Digital möchte ich") && brief.includes("Musterstadt, dort beschäftige") && !/[–—]/.test(brief));
  assert(text(e.dokumente[0]).indexOf("Lernkarten-App") < text(e.dokumente[0]).indexOf("Wetterstation"));
  const [a, o] = anfragen;
  assert.equal(a.url, "https://api.anthropic.com/v1/messages");
  assert.equal(a.headers["x-api-key"], "test-schluessel-a");
  assert.equal(a.headers["anthropic-version"], "2026-10-21");
  assert.equal(a.body.model, "claude-opus-5-5");
  assert.equal(a.body.output_config.format.type, "json_schema");
  assert.equal(o.body.response_format.json_schema.strict, true);
  for (const anfrage of anfragen) {
    const s = JSON.stringify(anfrage.body);
    assert(!s.includes("mira.beispiel@example.test") && !s.includes("0151") && !s.includes("Lindenweg") && !s.includes("Beispiel\""), "keine Kontaktdaten an Anbieter");
    assert(s.includes("echten Umlauten") && s.includes("Gedankenstriche") && s.includes("Internetadressen") && s.includes("Erfinde keine"));
  }
  // Beide Antworten verletzen Regeln (ae/oe/ue, sichtbare Adresse): Vorlage, beide Versuche protokolliert.
  anfragen.length = 0;
  antworten.anthropic.push(VORSCHLAG(VORSCHLAG().absaetze.map((p) => p.replace("freue ich mich", "freue ich mich ueber"))));
  antworten.openai.push(VORSCHLAG([...VORSCHLAG().absaetze, "Mehr unter www.mira.example.test."]));
  const v = await u.unterlagenErzeugen(eingabe(), { optionen });
  assert.equal(v.anbieter, "vorlage");
  assert.equal(v.versuche.length, 2);
  // Zugangsfehler (401): der Weg wird im selben Durchgang nicht erneut gefragt.
  anfragen.length = 0;
  const gesperrt = new Set();
  antworten.anthropic.push(401);
  antworten.openai.push(VORSCHLAG(), VORSCHLAG());
  assert.equal((await u.unterlagenErzeugen(eingabe(), { optionen, gesperrt })).anbieter, "api-openai");
  assert.equal((await u.unterlagenErzeugen(eingabe(), { optionen, gesperrt })).anbieter, "api-openai");
  assert.equal(anfragen.filter((x) => x.url.includes("anthropic")).length, 1);
  // Standard ohne Freischaltung: nur die Vorlage, keine Anfrage.
  anfragen.length = 0;
  assert.deepEqual(u.kette({ ...optionen, einstellung: "vorlage" }), []);
  assert.equal(u.einstellungAus({}).einstellung, "vorlage");
  assert.match(u.einstellungAus({ JOBPILOT_UNTERLAGEN_ANBIETER: "irgendwas" }).warnung, /ungültig/);
  assert.equal((await u.unterlagenErzeugen(eingabe(), { optionen: { ...optionen, einstellung: "vorlage" } })).anbieter, "vorlage");
  // Eigener Brieftext wird nie umgeschrieben.
  assert.equal((await u.unterlagenErzeugen(eingabe({ brief: "eigene", eigenerBrief: "x".repeat(10) + " ".repeat(5) + "Eigener Text für {Firma}. ".repeat(10) }), { optionen })).anbieter, "vorlage");
  assert.equal(anfragen.length, 0);
});

test("KI über lokale Programme: Claude Code, Codex, Gemini ohne Werkzeuge, ohne API-Schlüssel, mit Zeitlimit und Rückfall", async () => {
  const aufrufe = [];
  const programme = { claude: { command: "claude-test", prefix: [] }, codex: { command: "node-test", prefix: ["codex.js"] }, gemini: { command: "gemini-test", prefix: [] } };
  const verhalten = {};
  const starten = async (programm, args, o) => {
    aufrufe.push({ programm, args, env: o.env, eingabe: o.eingabe, cwd: o.cwd });
    return verhalten[programm.command](args, o);
  };
  // Claude nicht angemeldet (Code 1), Codex schreibt die letzte Nachricht in die verlangte Datei.
  verhalten["claude-test"] = async () => ({ code: 1, stdout: "", stderr: "nicht angemeldet" });
  verhalten["node-test"] = async (args) => { await writeFile(args[args.indexOf("--output-last-message") + 1], JSON.stringify(VORSCHLAG())); return { code: 0, stdout: "", stderr: "" }; };
  const env = { PATH: "", ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" };
  const e = await u.unterlagenErzeugen(eingabe(), { optionen: { einstellung: "auto", env, starten, programme } });
  assert.equal(e.anbieter, "codex");
  const [claude, codex] = aufrufe;
  assert.deepEqual(claude.args.slice(0, 5), ["-p", "--output-format", "json", "--tools", ""]);
  assert(claude.args.includes("--strict-mcp-config") && claude.args.includes("dontAsk"));
  assert(codex.args.includes("exec") && codex.args.includes("read-only") && codex.args.includes("features.shell_tool=false"));
  assert(codex.eingabe.includes("Verwende nur Tatsachen aus dem Profil") && !codex.eingabe.includes("mira.beispiel@example.test"));
  assert(codex.cwd.startsWith(os.tmpdir()));
  await assert.rejects(access(codex.cwd), "temporärer Ordner wieder entfernt");
  // Ausdrücklich Claude: nur dieser Weg, Schlüssel und Tokens aus der Umgebung entfernt, JSON aus der Hülle von claude -p.
  aufrufe.length = 0;
  verhalten["claude-test"] = async () => ({ code: 0, stdout: JSON.stringify({ type: "result", is_error: false, result: "```json\n" + JSON.stringify(VORSCHLAG()) + "\n```" }), stderr: "" });
  const c = await u.unterlagenErzeugen(eingabe(), { optionen: { einstellung: "claude", env: { ANTHROPIC_API_KEY: "test-schluessel-a", CLAUDE_CODE_OAUTH_TOKEN: "x" }, starten, programme } });
  assert.equal(c.anbieter, "claude");
  assert.equal(aufrufe.length, 1);
  assert(!("ANTHROPIC_API_KEY" in aufrufe[0].env) && !("CLAUDE_CODE_OAUTH_TOKEN" in aufrufe[0].env));
  // Gemini: Antwort in der JSON-Hülle; ungültige Antwort oder Zeitlimit führen zur Vorlage.
  aufrufe.length = 0;
  verhalten["gemini-test"] = async () => ({ code: 0, stdout: JSON.stringify({ response: JSON.stringify(VORSCHLAG()) }), stderr: "" });
  assert.equal((await u.unterlagenErzeugen(eingabe(), { optionen: { einstellung: "gemini", env: {}, starten, programme } })).anbieter, "gemini");
  verhalten["gemini-test"] = async () => { throw Object.assign(new Error("Zeitlimit überschritten."), { art: "zugang" }); };
  const g = await u.unterlagenErzeugen(eingabe(), { optionen: { einstellung: "gemini", env: {}, starten, programme } });
  assert.equal(g.anbieter, "vorlage");
  assert.match(g.versuche[0].fehler, /Zeitlimit/);
  // Nicht installiert: der Weg fehlt in der Kette.
  assert.deepEqual(u.kette({ einstellung: "codex", env: {}, programme: { codex: null } }), []);
});

// Gemockte Arbeitsagentur: feste synthetische Treffer und Beschreibungen; alles andere außerhalb des Rechners ist gesperrt.
function stellenmarkt(echt, treffer) {
  return async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("http://127.0.0.1:")) return echt(input, init);
    const detail = /\/pc\/v4\/jobdetails\/([^/?]+)/.exec(url);
    if (detail) {
      const t = treffer.find((x) => Buffer.from(x.ref).toString("base64").replace(/=+$/, "") === decodeURIComponent(detail[1]).replace(/=+$/, "") || x.ref === decodeURIComponent(detail[1]));
      return t ? Response.json({ referenznummer: t.ref, stellenangebotsTitel: t.titel, firma: t.firma, stellenangebotsBeschreibung: t.text }) : new Response("", { status: 404 });
    }
    if (url.startsWith("https://rest.arbeitsagentur.de/")) return Response.json({ ergebnisliste: treffer.map((t) => ({ referenznummer: t.ref, stellenangebotsTitel: t.titel, firma: t.firma, stellenlokationen: [{ adresse: { ort: "Musterstadt" } }] })) });
    return new Response("", { status: 403 });
  };
}
const TREFFER = [
  { ref: "NW-1", titel: "Werkstudent Webentwicklung (m/w/d)", firma: "Nordwind Digital GmbH", text: "Du unterstützt unser Frontend-Team mit React und TypeScript bei der Entwicklung unserer Kundenportale. Bitte sende uns Lebenslauf, Immatrikulationsbescheinigung und aktuelle Zeugnisse. Wir freuen uns auf dich." },
  { ref: "NW-2", titel: "Praktikum Softwareentwicklung", firma: "Nordwind Digital GmbH", text: "Im Praktikum arbeitest du an internen Werkzeugen mit Java und SQL. Wir bieten flexible Arbeitszeiten und ein freundliches Team. Bewerbungen bitte über unser Karriereportal." },
  { ref: "ZW-1", titel: "Werkstudent Buchhaltung", firma: "Zahlenwerk GmbH", text: "Unterstützung der Finanzbuchhaltung, Rechnungsprüfung und Ablage. Wir bieten eine faire Vergütung und flexible Arbeitszeiten für Studierende aller Fachrichtungen." },
];
async function lokalerServer(extra = {}) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-unterlagen-test-"));
  const server = erstelleServer({ datenordner: ordner, live: true, geokodierung: false, indeedClaude: { verfuegbar: false }, ...extra });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port;
  const echt = globalThis.fetch;
  globalThis.fetch = stellenmarkt(echt, TREFFER);
  const req = async (p, body, headers = {}) => { const r = await echt(basis + p, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); const typ = r.headers.get("content-type") || ""; return { status: r.status, typ, body: typ.includes("json") ? await r.json() : Buffer.from(await r.arrayBuffer()) }; };
  const ende = async () => { globalThis.fetch = echt; await server.unterlagenlauf(); await new Promise((r) => server.close(r)); assert(path.resolve(ordner).startsWith(path.resolve(os.tmpdir()) + path.sep + "jobpilot-unterlagen-test-")); await rm(ordner, { recursive: true, force: true }); };
  return { server, ordner, req, ende };
}
const pdfDatei = (inhalt) => Buffer.from("%PDF-1.4\n" + inhalt + "\n%%EOF").toString("base64");

test("Lokaler Server: nach der Suche ohne Klick erstellt, verlangte Nachweise beigelegt oder offen benannt, nie versandt", async () => {
  const { server, ordner, req, ende } = await lokalerServer();
  try {
    assert.deepEqual((await req("/api/unterlagen/profil")).body.profilFehlt, ["Vor- und Nachname", "E-Mail", "Ausbildung, Erfahrung oder Projekte"]);
    assert.equal((await req("/api/profil", { profile: FORMULAR, bank: [] })).status, 200);
    assert.equal((await req("/api/unterlagen/profil", { lebenslauf: LEBENSLAUF })).status, 200);
    assert.equal((await req("/api/unterlagen/nachweis", { art: "enrollment", name: "Immatrikulation.pdf", base64: pdfDatei("Synthetische Bescheinigung") })).status, 200);
    assert.equal((await req("/api/unterlagen/nachweis", { art: "transcript", name: "kein.pdf", base64: Buffer.from("kein PDF").toString("base64") })).status, 400);
    assert.equal((await req("/api/unterlagen/nachweis", { art: "fremd", name: "x.pdf", base64: pdfDatei("x") })).status, 400);
    const suche = await req("/api/suche", { live: true, quellen: ["bundesagentur"] });
    assert.equal(suche.status, 200);
    assert.equal(suche.body.unterlagenEingeplant, 1, "eine Stelle je Firma, nur Informatik");
    await server.unterlagenlauf();
    const stellen = suche.body.zustand.stellen, nw = stellen.find((s) => s.externalRef === "NW-1") || stellen.find((s) => s.company === "Nordwind Digital GmbH");
    const mappen = JSON.parse(await readFile(path.join(ordner, "bewerbungsunterlagen.json"), "utf8"));
    assert.deepEqual(Object.keys(mappen), [nw.id], "nur der Vertreter der Firma");
    const dossier = (await req("/api/bewerbung?id=" + encodeURIComponent(nw.id))).body;
    assert.deepEqual(dossier.mappe.dokumente.map((d) => d.kind), ["cv", "letter"]);
    assert(dossier.mappe.dokumente.every((d) => d.erzeugt?.anbieter === "vorlage" && !d.isGeneral));
    assert.equal(dossier.block, "", "gezielte Unterlagen: vollständig");
    assert.equal(dossier.erzeugung.zustand, "fertig");
    assert.deepEqual([dossier.nachweise.verlangt, dossier.nachweise.beigelegt, dossier.nachweise.fehlen], [["enrollment", "certificates"], ["enrollment"], ["certificates"]]);
    const brief = u.pdfTextLesen(Buffer.from(dossier.mappe.dokumente[1].base64, "base64")).join(" ");
    assert(brief.includes("Nordwind Digital GmbH") && brief.includes("Bewerbung als Werkstudent Webentwicklung (m/w/d)") && /Musterstadt, den \d{1,2}\. \S+ 20\d\d/.test(brief));
    // Stellensuche: verlangte, fehlende Datei offen benannt; Übersicht: Flags und beigelegter Nachweis.
    const status = (await req("/api/status")).body;
    assert.deepEqual(status.unterlagen[nw.id], ["Zeugnisse (in der Anzeige verlangt, keine Datei im Profil hinterlegt)"]);
    const app = (await req("/api/tracker")).body.applications.find((a) => a.id === nw.id);
    assert.deepEqual(app.documents.map((d) => d.kind), ["cv", "letter", "enrollment"]);
    assert.equal(app.enrollment, true);
    assert.equal(app.certificates, true);
    assert.equal(app.transcript, undefined);
    assert.equal(app.unterlagenErzeugt.anbieter, "vorlage");
    assert.equal((await req(`/api/tracker/${encodeURIComponent(nw.id)}/documents/enrollment`)).typ, "application/pdf");
    assert.equal((await req(`/api/tracker/${encodeURIComponent(nw.id)}/documents/certificates`)).status, 404);
    assert(String((await req(`/api/tracker/${encodeURIComponent(nw.id)}/documents/cv`)).body).startsWith("%PDF-"));
    // Formularassistent: vollständige Mappe, verlangter Nachweis geht mit; nichts wird abgesendet oder als beworben markiert.
    const ext = (body) => req("/api/jobpilot/erweiterung", body, { "X-JobPilot-Erweiterung": "1" });
    assert.equal((await ext({ aktion: "start", id: nw.id })).status, 200);
    assert.deepEqual((await ext({ aktion: "dateien", id: nw.id })).body.dokumente.map((d) => d.kind), ["cv", "letter", "enrollment"]);
    const zustand = JSON.parse(await readFile(path.join(ordner, "zustand.json"), "utf8"));
    assert(zustand.stellen.every((s) => s.status === "pending" && !s.sentAt), "nichts versandt oder beworben");
    assert.equal(zustand.lauf.vorzubereiten, 1, "nur noch die zweite Nordwind-Anzeige ohne Unterlagen");
    assert(!stellen.some((s) => s.company === "Zahlenwerk GmbH" && mappen[s.id]));
    // Eigener Upload bleibt; „neu erstellen“ ersetzt nur das automatische Anschreiben.
    const eigenerCv = pdfDatei("Eigener gezielter Lebenslauf");
    assert.equal((await req("/api/bewerbung", { id: nw.id, dokumente: [{ kind: "cv", name: "Mein_CV.pdf", base64: eigenerCv }, dossier.mappe.dokumente[1]] })).status, 200);
    const nachSpeichern = (await req("/api/bewerbung?id=" + encodeURIComponent(nw.id))).body.mappe.dokumente;
    assert.equal(nachSpeichern[1].erzeugt?.anbieter, "vorlage", "unverändertes automatisches Anschreiben bleibt gekennzeichnet");
    assert.equal((await req("/api/unterlagen/erstellen", { id: nw.id })).status, 202);
    await server.unterlagenlauf();
    const neu = (await req("/api/bewerbung?id=" + encodeURIComponent(nw.id))).body.mappe.dokumente;
    assert.equal(neu.find((d) => d.kind === "cv").base64, eigenerCv);
    assert(neu.find((d) => d.kind === "letter").erzeugt);
    // Beim Öffnen eines Dossiers ohne Unterlagen wird im Hintergrund erstellt (ausdrückliche Wahl der Person).
    const zweite = stellen.find((s) => s.company === "Nordwind Digital GmbH" && s.id !== nw.id);
    assert(["wartet", "laeuft", "fertig"].includes((await req("/api/bewerbung?id=" + encodeURIComponent(zweite.id))).body.erzeugung.zustand));
    await server.unterlagenlauf();
    assert.equal((await req("/api/bewerbung?id=" + encodeURIComponent(zweite.id))).body.block, "");
    // Vorschau mit erfundener Beispielstelle.
    const vorschau = await req("/api/unterlagen/vorschau/letter");
    assert.equal(vorschau.typ, "application/pdf");
    assert(u.pdfTextLesen(vorschau.body).join(" ").includes("Beispiel Software GmbH"));
  } finally {
    await ende();
  }
});

test("Lokaler Server: ohne Profil wird nichts geschrieben, die Stelle nennt, was fehlt; KI-Weg wird protokolliert", async () => {
  const leer = await lokalerServer();
  try {
    assert.equal((await leer.req("/api/suche", { live: true, quellen: ["bundesagentur"] })).body.unterlagenEingeplant, 0);
    await leer.server.unterlagenlauf();
    for (const datei of ["bewerbungsunterlagen.json", "unterlagen-erzeugt.json", "unterlagenprofil.json"]) await assert.rejects(access(path.join(leer.ordner, datei)), datei);
    const teile = Object.values((await leer.req("/api/status")).body.unterlagen);
    assert(teile.some((t) => t.join(" und ").includes("gezielter Lebenslauf und Anschreiben (automatisch, sobald im Profil Vor- und Nachname, E-Mail, Ausbildung, Erfahrung oder Projekte hinterlegt sind)")));
    assert(teile.some((t) => t.includes("Zeugnisse (in der Anzeige verlangt, keine Datei im Profil hinterlegt)")));
  } finally {
    await leer.ende();
  }
  // Freigeschalteter API-Weg (gemockt): Anbieter steht im Protokoll und im Dossier.
  const kiAbruf = async () => Response.json({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...VORSCHLAG(), anrede: "Sehr geehrte Damen und Herren," }) }] });
  const mitKi = await lokalerServer({ unterlagen: { ki: { einstellung: "api", env: { ANTHROPIC_API_KEY: "test-schluessel-a" }, fetch: kiAbruf } } });
  try {
    await mitKi.req("/api/profil", { profile: FORMULAR, bank: [] });
    await mitKi.req("/api/unterlagen/profil", { lebenslauf: LEBENSLAUF });
    const r = await mitKi.req("/api/suche", { live: true, quellen: ["bundesagentur"] });
    await mitKi.server.unterlagenlauf();
    const id = Object.keys(JSON.parse(await readFile(path.join(mitKi.ordner, "unterlagen-erzeugt.json"), "utf8")))[0];
    assert(r.body.zustand.stellen.some((s) => s.id === id));
    const d = (await mitKi.req("/api/bewerbung?id=" + encodeURIComponent(id))).body;
    assert.equal(d.erzeugung.satz.anbieter, "api-anthropic");
    assert.equal(d.erzeugung.anbieterName, "Claude API (eigener Schlüssel)");
    assert(u.pdfTextLesen(Buffer.from(d.mappe.dokumente[1].base64, "base64")).join(" ").includes("Bei Nordwind Digital möchte ich"));
    const p = (await mitKi.req("/api/unterlagen/profil")).body;
    assert.deepEqual(p.erstellung.kette, ["Claude API (eigener Schlüssel)", "JobPilot-Vorlage (offline)"]);
    assert.equal(p.verlangtIn.enrollment, 1);
  } finally {
    await mitKi.ende();
  }
});
