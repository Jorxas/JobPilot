// Knopf „Neue Stellen suchen“ der Oberfläche am lokalen Server: gespeicherte Kriterien, ein Suchstart über POST /api/suche
// mit indeedProvider "auto", Fortschritt über GET /api/status, nie zwei Suchen gleichzeitig, ehrliche Teilabdeckung.
// Derselbe Weg wie das Werkzeug suche-starten.mjs. Gemockter Stellenmarkt; keine echte Jobbörse, kein Ortsdienst.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { erstelleServer } from "../dist/server.mjs";
import { suchsteuerung, suchkoerper, ergebnisDaten, luecken, sucheLaeuft } from "../dist/suchablauf.mjs";
import { stellenmarkt, tor } from "./hilfen/stellenmarkt.mjs";

delete process.env.JOBPILOT_INDEED_PROVIDER;
const hier = path.dirname(fileURLToPath(import.meta.url));
const werkzeug = path.join(hier, "../werkzeuge/suche-starten.mjs");
const dist = path.join(hier, "../dist");
const ausfuehren = (basis, argumente) => new Promise((fertig) => {
  const kind = spawn(process.execPath, [werkzeug, ...argumente], { env: { ...process.env, JOBPILOT_URL: basis + "/" }, windowsHide: true });
  let aus = "", fehler = "";
  kind.stdout.on("data", (d) => { aus += d; });
  kind.stderr.on("data", (d) => { fehler += d; });
  kind.on("close", (code) => fertig({ code, aus, fehler }));
});


async function aufbauen(t, { live = true, treffer = () => [], halt = null } = {}) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-knopf-test-"));
  const server = erstelleServer({ datenordner: ordner, live, geokodierung: false, wurzel: dist, indeedClaude: { verfuegbar: false }, indeedCodex: { verfuegbar: false } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port, echt = globalThis.fetch;
  const markt = stellenmarkt(echt, { treffer, tor: halt });
  globalThis.fetch = markt.abruf;
  t.after(async () => {
    await server.suchlauf();
    globalThis.fetch = echt;
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  });
  // Wie der Browser: relative Pfade gegen den lokalen Server; jede Anfrage wird protokolliert.
  const anfragen = [];
  const abruf = (pfad, optionen = {}) => {
    anfragen.push({ pfad, methode: optionen.method || "GET", inhalt: optionen.body ? JSON.parse(optionen.body) : undefined });
    return echt(basis + pfad, optionen);
  };
  const senden = async (methode, pfad, inhalt) => {
    const r = await echt(basis + pfad, { method: methode, headers: { "Content-Type": "application/json" }, body: inhalt === undefined ? undefined : JSON.stringify(inhalt) });
    return { status: r.status, daten: await r.json().catch(() => ({})), r };
  };
  return { ordner, basis, server, markt, abruf, anfragen, senden, echt };
}

test("Der lokale Server liefert dieselbe Oberfläche ohne Demo-Daten; die gebaute Datei für GitHub Pages bleibt unverändert", async (t) => {
  const h = await aufbauen(t, { live: false });
  const datei = await readFile(path.join(dist, "index.html"), "utf8");
  assert.match(datei, /<script src="\.\/assets\/demo\.js"><\/script>/, "statische Demo lädt demo.js");
  assert.doesNotMatch(datei, /jobpilot-modus/);
  for (const pfad of ["/", "/index.html", "/suivi", "/offres", "/offres?lang=fr"]) {
    const r = await h.echt(h.basis + pfad);
    assert.equal(r.status, 200, pfad);
    assert.match(r.headers.get("content-type"), /text\/html/);
    const html = await r.text();
    assert.match(html, /<meta name="jobpilot-modus" content="lokal">/, pfad);
    assert.doesNotMatch(html, /demo\.js/, pfad);
    assert.match(html, /src="\/assets\/app\.js"/);
  }
  assert.equal(await readFile(path.join(dist, "index.html"), "utf8"), datei, "Datei auf der Festplatte unverändert");
  // Unterseiten des Originals gibt es nicht; das Übungsformular bleibt die statische Datei.
  assert.equal((await h.echt(h.basis + "/dossier/x")).status, 200, "page de dossier locale ; une ID inconnue sera refusée par son API");
  assert.doesNotMatch(await (await h.echt(h.basis + "/formular/")).text(), /jobpilot-modus/);
  // Posteingang: ehrlicher Hinweis statt erfundener Antworten.
  const post = await h.senden("GET", "/api/jobpilot/antworten");
  assert.deepEqual(post.daten.stand.antworten, []);
  assert.match(post.daten.stand.error, /nicht Teil der öffentlichen Fassung/);
  assert.equal((await h.senden("POST", "/api/jobpilot/antworten", {})).status, 501);
  // Ohne JOBPILOT_LIVE=1 startet der Knopf nichts und meldet den Grund.
  const steuerung = suchsteuerung(h.abruf, () => Promise.resolve(), 0);
  assert.deepEqual(await steuerung.starten({ city: "Gießen", radius: 50, keywordList: ["Werkstudent IT"], quellen: ["bundesagentur"], breit: true }, () => {}), { art: "aus" });
  assert(!h.anfragen.some((a) => a.methode === "POST"), "keine Suchanfrage ohne Live-Freigabe");
  assert.equal((await h.senden("POST", "/api/suche", { live: true })).status, 403);
});

test("Suchkriterien werden geprüft, zusammengeführt und für Knopf und Werkzeug gespeichert", async (t) => {
  const h = await aufbauen(t);
  for (const falsch of [{}, { unbekannt: 1 }, { keywordList: [] }, { keywordList: "Werkstudent IT" }, { radius: 0 }, { radius: 201 }, { radius: 12.5 }, { city: "" }, { quellen: [] }, { quellen: ["monster"] }, { breit: "ja" }, { keywordDomain: "medizin" }])
    assert.equal((await h.senden("POST", "/api/kriterien", falsch)).status, 400, JSON.stringify(falsch));
  assert.equal((await h.senden("GET", "/api/status")).daten.zustand.auftrag, undefined, "nichts gespeichert");
  const a = await h.senden("POST", "/api/kriterien", { keywordList: [" Werkstudent IT ", "werkstudent it", "Praktikum Data"], keywordDomain: "it" });
  assert.equal(a.status, 200);
  assert.deepEqual(a.daten.auftrag.keywordList, ["Werkstudent IT", "Praktikum Data"]);
  assert.equal(a.daten.auftrag.city, "Gießen");
  assert.equal(a.daten.auftrag.radius, 50);
  assert.equal(a.daten.auftrag.quellen.length, 18);
  assert.match(a.daten.auftrag.bestaetigt, /^\d{4}-/);
  const b = await h.senden("POST", "/api/kriterien", { quellen: ["xing", "bundesagentur"], city: "Marburg", radius: 30, breit: false });
  assert.deepEqual(b.daten.auftrag.quellen, ["bundesagentur", "xing"], "Reihenfolge des Katalogs");
  assert.deepEqual(b.daten.auftrag.keywordList, ["Werkstudent IT", "Praktikum Data"], "Suchbegriffe bleiben");
  assert.equal(b.daten.auftrag.city, "Marburg");
  assert.equal(b.daten.auftrag.breit, false);
  assert.equal((await h.senden("POST", "/api/kriterien", { quellen: ["bundesagentur"] }, { Origin: "x" })).status, 200);
  const fremd = await h.echt(h.basis + "/api/kriterien", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://fremd.example.test" }, body: JSON.stringify({ radius: 10 }) });
  assert.equal(fremd.status, 403);
});

test("Knopf: ein Suchstart mit Anbieter auto, Fortschritt, nie eine zweite Suche, ehrliche Teilabdeckung", async (t) => {
  const halt = tor();
  t.after(halt.oeffnen);
  const h = await aufbauen(t, {
    halt: halt.warten,
    treffer: () => [
      { ref: "K-1", titel: "Werkstudent Softwareentwicklung", firma: "Nordwerk GmbH" },
      { ref: "K-2", titel: "Praktikum Data Engineering", firma: "Südlicht AG" },
      { ref: "K-3", titel: "Werkstudent Buchhaltung", firma: "Zahlenhaus GmbH" },
    ],
  });
  const auftrag = (await h.senden("POST", "/api/kriterien", { keywordList: ["Werkstudent IT", "Praktikum Data", "Werkstudent Cloud"], quellen: ["bundesagentur", "stepstone", "indeed", "xing"] })).daten.auftrag;
  const steuerung = suchsteuerung(h.abruf, (ms) => new Promise((r) => setTimeout(r, ms)), 20);
  const meldungen = [];
  const erster = steuerung.starten(auftrag, (s) => meldungen.push(s));
  // Während des Starts: derselbe Knopf sendet nichts, ein zweites Fenster verfolgt nur, der Server lehnt ab.
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(steuerung.aktiv(), true);
  assert.deepEqual(await steuerung.starten(auftrag, () => {}), { art: "belegt" });
  const posts = () => h.anfragen.filter((a) => a.methode === "POST" && a.pfad === "/api/suche");
  assert.equal(posts().length, 1);
  const body = posts()[0].inhalt;
  assert.equal(body.indeedProvider, "auto");
  assert.equal(body.live, true);
  assert.equal(body.hintergrund, true);
  assert.deepEqual(body.keywordList, auftrag.keywordList);
  assert.deepEqual(body.quellen, ["bundesagentur", "indeed", "stepstone", "xing"], "Reihenfolge des Katalogs");
  assert.deepEqual(body, suchkoerper(auftrag));
  let stand;
  for(let i=0;i<200;i++){stand=(await h.senden("GET","/api/status")).daten;if(sucheLaeuft(stand))break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(sucheLaeuft(stand), true,"Attendre le démarrage confirmé, pas une durée fixe de 50 ms");
  assert.equal(stand.zustand.lauf.zustand, "laeuft");
  const zweitesFenster = suchsteuerung(h.abruf, (ms) => new Promise((r) => setTimeout(r, ms)), 20).starten(auftrag, () => {});
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(posts().length, 1, "ein zweites Fenster startet keine weitere Suche");
  assert.equal((await h.senden("POST", "/api/suche", body)).status, 409, "der Server lehnt eine zweite Suche ab");
  halt.oeffnen();
  const ergebnis = await erster;
  assert.equal(ergebnis.art, "gestartet");
  const belegt = await zweitesFenster;
  assert.equal(belegt.art, "belegt");
  assert.equal(belegt.stand.zustand.lauf.zustand, "fertig", "das zweite Fenster sieht dasselbe Ergebnis");
  assert.equal(posts().length, 1);
  // Fortschritt: laufende Zwischenstände, danach das Ende.
  assert(meldungen.some((s) => s.zustand.lauf?.zustand === "laeuft"));
  assert(meldungen.map((s) => s.zustand.lauf?.abgeschlossen ?? 0).every((n, i, alle) => i === 0 || n >= alle[i - 1]), "Fortschritt steigt");
  const lauf = ergebnis.stand.zustand.lauf;
  assert.equal(lauf.zustand, "fertig");
  assert.equal(lauf.abgeschlossen, 5);
  assert.equal(lauf.neu, 2, "Buchhaltung ohne IT-Bezug entfällt");
  assert.equal(lauf.vorzubereiten, 2, "neue Stellen ohne Unterlagen sind noch vorzubereiten");
  assert.equal(ergebnis.stand.suchAktiv, false);
  // Teilabdeckung: gesperrte Quellen ehrlich benannt, nie als vollständig ausgewiesen.
  const e = ergebnisDaten(lauf, ergebnis.stand.zustand.berichte);
  assert.equal(e.unvollstaendig, true);
  assert.deepEqual(e.teilweise.map((x) => x.quelle + ":" + x.status).sort(), ["indeed:error", "stepstone:blocked", "xing:blocked"]);
  assert.equal(e.neu, 2);
  const indeed = ergebnis.stand.zustand.berichte.filter((b) => b.source === "indeed");
  assert(indeed.length > 0 && indeed.every((b) => b.status === "error"), "Direkter Abruf im Test abgeschaltet und kein freigeschalteter Ersatz: ehrlicher Fehler");
  assert(!h.markt.extern.some((u) => /indeed\.com|jobvector|heyjobs/.test(u)), "technisch gesperrte Quellen erhalten keine Anfrage");
  assert.equal(h.markt.extern.filter((u) => u.includes("stepstone.de")).length, 1, "blockierte Quelle nur einmal gefragt");
  assert.deepEqual(luecken([{ source: "a", status: "ok", limited: true }, { source: "b", status: "partial" }, { source: "b", status: "blocked" }]), { teilweise: [{ quelle: "b", status: "blocked" }], weitere: ["a"] });
  // Die Stellenübersicht zeigt die neuen Stellen mit Plattform.
  const fichen = (await h.senden("GET", "/api/tracker")).daten;
  assert.equal(fichen.modus, "live");
  assert.deepEqual(fichen.applications.map((f) => f.company).sort(), ["Nordwerk GmbH", "Südlicht AG"]);
  assert(fichen.applications.every((f) => f.sourceLabel === "Arbeitsagentur" && f.status === "pending" && f.documents.length === 0));
});

test("Unterbrochener Lauf: als laufend gespeichert, aber ohne aktiven Prozess; der Knopf darf neu starten", async (t) => {
  const h = await aufbauen(t, { treffer: () => [] });
  const auftrag = (await h.senden("POST", "/api/kriterien", { keywordList: ["Werkstudent IT"], quellen: ["bundesagentur"] })).daten.auftrag;
  const zustand = JSON.parse(await readFile(path.join(h.ordner, "zustand.json"), "utf8"));
  zustand.lauf = { zustand: "laeuft", beginn: "2026-11-26T08:00:00.000Z", durchlaeufe: 5, abgeschlossen: 2, gefunden: 4, neu: 1 };
  zustand.modus = "live";
  await (await import("node:fs/promises")).writeFile(path.join(h.ordner, "zustand.json"), JSON.stringify(zustand));
  const unterbrechen = () => (async () => (await import("node:fs/promises")).writeFile(path.join(h.ordner, "zustand.json"), JSON.stringify(zustand)))();
  const stand = (await h.senden("GET", "/api/status")).daten;
  assert.equal(stand.suchAktiv, false);
  assert.equal(sucheLaeuft(stand), false);
  // Das Werkzeug im Gespräch verhält sich gleich: es startet nach einer Unterbrechung neu, statt endlos abzulehnen.
  const werkzeugLauf = await ausfuehren(h.basis, ["--run"]);
  assert.equal(werkzeugLauf.code, 0, werkzeugLauf.fehler);
  await h.server.suchlauf();
  await unterbrechen();
  const e = await suchsteuerung(h.abruf, () => Promise.resolve(), 0).starten(auftrag, () => {});
  assert.equal(e.art, "gestartet");
  assert.equal(e.stand.zustand.lauf.zustand, "fertig");
});

test("Knopf und Gespräch starten dieselbe Suche: das Werkzeug ohne Angaben sendet dieselbe Anfrage mit den gespeicherten Kriterien", async (t) => {
  const auftrag = { city: "Wetzlar", radius: 40, keywordList: ["Werkstudent Informatik", "Praktikum Python"], quellen: ["bundesagentur", "linkedin"], breit: false, keywordDomain: "it", bestaetigt: "2026-11-26T09:00:00.000Z" };
  const erhalten = [];
  // Ein Testserver mit demselben Vertrag wie der lokale Server, der nur die Anfrage festhält.
  const fake = http.createServer(async (req, res) => {
    let text = "";
    for await (const b of req) text += b;
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET" && req.url === "/api/suche") return res.end(JSON.stringify({ manualSearchCommandVersion: 1, live: true, indeedConnectoren: { codex: false, claude: false }, plattformen: ["bundesagentur", "linkedin", "indeed"] }));
    if (req.method === "GET" && req.url === "/api/status") return res.end(JSON.stringify({ live: true, suchAktiv: false, zustand: { auftrag, berichte: [] } }));
    if (req.method === "POST" && req.url === "/api/suche") {
      erhalten.push(JSON.parse(text));
      res.statusCode = 202;
      return res.end(JSON.stringify({ gestartet: true, zustand: { lauf: { zustand: "fertig", beginn: "2026-11-26T10:00:00.000Z", durchlaeufe: 5, abgeschlossen: 5, gefunden: 0, neu: 0 }, berichte: [] } }));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  await new Promise((r) => fake.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => fake.close(r)));
  const lauf = await ausfuehren("http://127.0.0.1:" + fake.address().port, ["--run"]);
  assert.equal(lauf.code, 0, lauf.fehler);
  assert.equal(erhalten.length, 1);
  assert.deepEqual(erhalten[0], suchkoerper(auftrag));
  assert.match(lauf.aus, /Suche gestartet: Wetzlar, 40 km, 2 Suchbegriffe, 2 Plattformen, Indeed: ts-jobspy, Ersatz: auto/);
});

test("Werkzeug am echten lokalen Server: in der Oberfläche gespeicherte Kriterien gelten auch für den Suchstart aus dem Gespräch", async (t) => {
  const h = await aufbauen(t, { treffer: () => [{ ref: "W-1", titel: "Werkstudent IT", firma: "Werkzeugtest GmbH" }] });
  const leer = await ausfuehren(h.basis, ["--run"]);
  assert.equal(leer.code, 1);
  assert.match(leer.fehler, /--ort und --begriffe angeben/);
  await h.senden("POST", "/api/kriterien", { keywordList: ["Werkstudent IT", "Werkstudent Data", "Praktikum Informatik"], quellen: ["bundesagentur", "xing"], radius: 25 });
  const lauf = await ausfuehren(h.basis, ["--run"]);
  assert.equal(lauf.code, 0, lauf.fehler);
  assert.match(lauf.aus, /Suche gestartet: Gießen, 25 km, 3 Suchbegriffe, 2 Plattformen, Indeed: ts-jobspy, Ersatz: auto/);
  assert.match(lauf.aus, /Suchstart beendet: 1 neue Stelle .* Teilabdeckung, keine vollständige Marktabdeckung\./);
  assert.match(lauf.aus, /Brauchen den Browser: XING Jobs \(blockiert\)/);
  await h.server.suchlauf();
  const stand = (await h.senden("GET", "/api/status")).daten;
  assert.equal(stand.zustand.lauf.zustand, "fertig");
  assert.deepEqual(stand.zustand.auftrag.keywordList, ["Werkstudent IT", "Werkstudent Data", "Praktikum Informatik"]);
  assert.match(stand.zustand.auftrag.bestaetigt, /^\d{4}-/, "Bestätigung der Oberfläche bleibt beim Suchstart erhalten");
});
