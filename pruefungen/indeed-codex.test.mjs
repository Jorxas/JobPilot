// Indeed über ChatGPT/Codex und gemeinsame Anbieterwahl, nach scripts/indeed-codex.test.cjs des Originals.
// Kein echter Codex-, Claude- oder Indeed-Aufruf: ein synthetischer App-Server (fixtures/indeed-codex) spricht das
// Protokoll, Jobbörsen sind gemockt, die Ortsauflösung nutzt einen vorbelegten Zwischenspeicher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import * as codex from "../dist/indeed-codex.mjs";
import { scanIndeedViaConnector } from "../dist/indeed-connectors.mjs";
import { INDEED_SUCHE } from "../dist/indeed-claude.mjs";
import { erstelleServer } from "../dist/server.mjs";

delete process.env.JOBPILOT_INDEED_PROVIDER;
const echterFetch = globalThis.fetch;
const hier = path.dirname(fileURLToPath(import.meta.url));
const fake = path.join(hier, "fixtures/indeed-codex/fake-app-server.cjs");
const fixture = JSON.parse(await readFile(path.join(hier, "fixtures/indeed-codex/result.json"), "utf8"));
const werkzeug = path.join(hier, "../werkzeuge/suche-starten.mjs");
const codexUmgebung = (extra = {}) => ({ ...process.env, JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: fake, JOBPILOT_CODEX_TEST_SCENARIO: "", ...extra });
const protokoll = async (datei) => existsSync(datei) ? (await readFile(datei, "utf8")).trim().split("\n").map((z) => JSON.parse(z)) : [];
const suchen = (zeilen) => zeilen.filter((z) => z.method === "mcpServer/tool/call");

test("Strukturierte Daten: Originallinks, Beschreibungen ohne HTML und nur verlässliche Daten", () => {
  const parsed = codex.codexIndeedErgebnis(fixture);
  assert.equal(parsed.offers.length, 3);
  assert.equal(parsed.totalAvailable, 29);
  const first = parsed.offers[0];
  assert(first.complete);
  assert.equal(first.publishedAt, "2026-11-26");
  assert.equal(first.url, fixture.structuredContent.jobs[0].url);
  assert(!first.description.includes("<p>"));
  assert.equal(parsed.offers[2].publishedAt, undefined);
  assert.equal(parsed.offers[2].complete, false);
  const changed = structuredClone(fixture);
  changed.structuredContent.jobs[0].url = "https://to.indeed.com/changed";
  changed.structuredContent.jobs[0].jrtk = "JOBSEARCH_999";
  assert.equal(codex.codexIndeedErgebnis(changed).offers[0].externalRef, first.externalRef, "Wechselnde Kennungen und Kurzlinks erzeugen keine Dubletten");
});

test("Fehlende oder fehlerhafte Daten und unsichere Links sind nie eine erfolgreiche leere Suche", () => {
  for (const raw of [{}, { isError: true, structuredContent: { jobs: [] } }, { structuredContent: { error: "oops", jobs: [] } }]) assert.throws(() => codex.codexIndeedErgebnis(raw), /keine lesbare/);
  const raw = structuredClone(fixture), job = raw.structuredContent.jobs[0];
  raw.structuredContent.jobs = [{ ...job, company: null }, { ...job, url: "https://indeed.com.evil.test/job" }, { ...job, url: "https://user:pass@indeed.com/job" }, { ...job, description: "x".repeat(50001) }];
  const result = codex.codexIndeedErgebnis(raw);
  assert.equal(result.offers.length, 0);
  assert.equal(result.rejected, 4);
  assert.equal(codex.codexIndeedErgebnis({ structuredContent: { jobs: [] } }).offers.length, 0, "Eine ausdrücklich leere Liste ist ein echtes leeres Ergebnis");
});

test("Fünf verschiedene Anfragen je Start in einer Sitzung, keine erfundenen Beschreibungen, beste Dublette bleibt", async () => {
  const requests = [];
  let opened = 0, closed = 0;
  const result = await codex.scanIndeedViaCodex(["A", "B", "C", "D", "E", "F", "A"], "Gießen", 100, async () => { opened++; return { search: async (q, city, radius) => { requests.push({ q, city, radius }); return fixture; }, close: () => { closed++; } }; });
  assert.equal(opened, 1);
  assert.equal(closed, 1);
  assert.equal(requests.length, 5);
  assert.equal(result.offers.length, 3);
  assert.equal(result.report.status, "partial");
  assert(result.report.limited);
  assert.equal(result.report.found, 3);
  assert(requests.every((r) => r.city === "Gießen" && r.radius === 100));
  let calls = 0;
  const empty = await codex.scanIndeedViaCodex(["A"], "Gießen", 50, async () => ({ search: async () => { calls++; return { structuredContent: { jobs: [] } }; }, close() {} }));
  assert.equal(calls, 1);
  assert.equal(empty.report.status, "partial");
  assert.equal(empty.report.found, 0, "Keine Ausweitung und keine Wiederholung");
});

test("Teilergebnisse bleiben nach einem Fehler; fehlender Connector unterscheidet sich von einer unsicheren Anfrage", async () => {
  let count = 0, closed = 0;
  const partial = await codex.scanIndeedViaCodex(["A", "B", "C"], "Gießen", 50, async () => ({ search: async () => (++count === 1 ? fixture : { isError: true }), close() { closed++; } }));
  assert.equal(count, 2);
  assert.equal(closed, 1);
  assert.equal(partial.offers.length, 3);
  assert.equal(partial.report.status, "partial");
  assert.equal(partial.unavailable, false);
  const missing = await codex.scanIndeedViaCodex(["A"], "Gießen", 50, async () => { throw new codex.IndeedCodexUnavailable("missing"); });
  assert.equal(missing.unavailable, true);
  assert.equal(missing.report.status, "error");
  let opened = false;
  await codex.scanIndeedViaCodex([], "Gießen", 50, async () => { opened = true; });
  assert.equal(opened, false);
});

test("Natives Protokoll: genau die installierte App, lesendes Werkzeug, Deutschland, Kilometer zu Meilen, kein Modellzug", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jobpilot-codex-test-")), log = path.join(dir, "protocol.jsonl");
  t.after(() => rm(dir, { recursive: true, force: true }));
  const session = await codex.openIndeedCodex(codexUmgebung({ JOBPILOT_CODEX_TEST_LOG: log }));
  try {
    assert.equal(codex.codexIndeedErgebnis(await session.search("Werkstudent Informatik", "Gießen", 100)).offers.length, 3);
  } finally {
    session.close();
  }
  const calls = await protokoll(log);
  assert(!calls.some((c) => /turn\/|login|resume|company|approval/i.test(c.method)));
  const request = calls.find((c) => c.method === "mcpServer/tool/call");
  assert.equal(request.params.tool, "namespace.search_jobs");
  assert.deepEqual(request.params.arguments, { search: "Werkstudent Informatik", location: "Gießen", country_code: "DE", radius: 63 });
  assert.equal(calls.find((c) => c.method === "thread/start").params.ephemeral, true);
  assert.equal(calls.find((c) => c.method === "thread/start").params.sandbox, "read-only");
});

test("Vorprüfung schlägt geschlossen fehl: falsche App, Rechte, Anmeldung, geändertes Schema; Schlüssel werden entfernt", async () => {
  for (const scenario of ["missing-app", "wrong-app", "not-read-only", "api-key", "changed-schema", "bad-protocol"])
    await assert.rejects(codex.openIndeedCodex(codexUmgebung({ JOBPILOT_CODEX_TEST_SCENARIO: scenario })), Error, scenario);
  const env = codex.codexUmgebung({ OPENAI_API_KEY: "private", DATABASE_URL: "private", SMTP_PASSWORD: "private", ANTHROPIC_AUTH_TOKEN: "private", PATH: "keep", CODEX_HOME: "keep" });
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.SMTP_PASSWORD, undefined);
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.PATH, "keep");
  assert.equal(env.CODEX_HOME, "keep");
});

test("Öffentliche Fassung: nur mit JOBPILOT_INDEED_CODEX=1; Codex unter Windows, macOS und Linux ohne Shell gefunden", async (t) => {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-codex-pfad-")), leer = path.join(ordner, "kein-heim");
  t.after(() => rm(ordner, { recursive: true, force: true }));
  assert.equal(codex.codexProgramm({ JOBPILOT_CODEX_CLI: fake }), null, "Ohne Freigabe kein Codex");
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "0", JOBPILOT_CODEX_CLI: fake }), null);
  assert.equal(codex.indeedViaCodexVerfuegbar({ JOBPILOT_CODEX_CLI: fake }), false);
  assert.equal(codex.indeedViaCodexVerfuegbar({ JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: fake }), true);
  assert.deepEqual(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: fake }), { command: process.execPath, prefix: [fake] }, "JavaScript-Datei über Node, ohne Shell");
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: "fixtures/fake-app-server.cjs" }), null, "Nur absolute Pfade");
  await writeFile(path.join(ordner, "codex.cmd"), "");
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: path.join(ordner, "codex.cmd") }), null, "Keine .cmd-Datei über eine Shell");
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", JOBPILOT_CODEX_CLI: path.join(ordner, "fehlt.exe") }), null);
  // Windows: im Suchpfad nur codex.exe; der npm-Starter codex.cmd wird übergangen, codex.js läuft über Node.
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: ordner, APPDATA: ordner }, "win32", leer), null);
  const starter = path.join(ordner, "npm/node_modules/@openai/codex/bin/codex.js");
  await mkdir(path.dirname(starter), { recursive: true });
  await writeFile(starter, "");
  assert.deepEqual(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: ordner, APPDATA: ordner }, "win32", leer, "C:/node/node.exe"), { command: "C:/node/node.exe", prefix: [starter] });
  await mkdir(path.join(ordner, "win"));
  await writeFile(path.join(ordner, "win", "codex.exe"), "");
  assert.deepEqual(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: path.join(ordner, "win"), APPDATA: ordner }, "win32", leer), { command: path.join(ordner, "win", "codex.exe"), prefix: [] });
  // macOS und Linux: codex im Suchpfad (native Datei oder npm-Verknüpfung mit Shebang), sonst neben Node installiert.
  await mkdir(path.join(ordner, "posix"));
  await writeFile(path.join(ordner, "posix", "codex"), "");
  assert.deepEqual(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: path.join(ordner, "posix") }, "linux", leer), { command: path.join(ordner, "posix", "codex"), prefix: [] });
  const knoten = path.join(ordner, "prefix", "bin", "node"), npmStarter = path.join(ordner, "prefix", "lib/node_modules/@openai/codex/bin/codex.js");
  await mkdir(path.dirname(npmStarter), { recursive: true });
  await writeFile(npmStarter, "");
  assert.deepEqual(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: "" }, "darwin", leer, knoten), { command: knoten, prefix: [npmStarter] });
  assert.equal(codex.codexProgramm({ JOBPILOT_INDEED_CODEX: "1", PATH: "" }, "linux", leer, path.join(ordner, "x", "node")), null, "Ohne Codex bleibt Indeed ein Browserlink");
  // Ohne Freigabe startet kein Prozess: der synthetische App-Server schreibt nichts.
  const log = path.join(ordner, "ohne-freigabe.jsonl");
  await assert.rejects(codex.openIndeedCodex({ ...process.env, JOBPILOT_INDEED_CODEX: "", JOBPILOT_CODEX_CLI: fake, JOBPILOT_CODEX_TEST_LOG: log }), codex.IndeedCodexUnavailable);
  assert.equal(existsSync(log), false);
});

test("Anbieterwahl: nie beide Connectoren, kein Wechsel nach einer gesendeten Anfrage, Claude nur mit Freigabe", async () => {
  const calls = [];
  const ergebnis = (unavailable = false, status = "error") => ({ offers: [], report: { source: "indeed", status, found: 0, inserted: 0, message: "Test", searchUrl: "https://example.test" }, unavailable });
  const deps = (codexErgebnis = ergebnis(), claudeFrei = true) => ({ codex: async () => { calls.push("codex"); return codexErgebnis; }, claude: async () => { calls.push("claude"); return ergebnis(); }, claudeAvailable: () => claudeFrei });
  const wahl = async (anbieter, d) => { calls.length = 0; return scanIndeedViaConnector(["A"], "Gießen", 50, anbieter, d); };
  await wahl("codex", deps());
  assert.deepEqual(calls, ["codex"]);
  await wahl("claude", deps());
  assert.deepEqual(calls, ["claude"]);
  await wahl("auto", deps());
  assert.deepEqual(calls, ["codex"], "auto bevorzugt ChatGPT/Codex");
  const ersatz = await wahl("auto", deps(ergebnis(true)));
  assert.deepEqual(calls, ["codex", "claude"], "Wechsel nur bei ausdrücklicher Nichtverfügbarkeit vor jeder Suche");
  assert.match(ersatz.report.message, /^ChatGPT\/Codex vor jeder Suchanfrage nicht verfügbar; Claude verwendet\./);
  await wahl("auto", deps(ergebnis(false, "partial")));
  assert.deepEqual(calls, ["codex"], "Nach einer gesendeten Anfrage kein Wechsel");
  await wahl("codex", deps(ergebnis(true)));
  assert.deepEqual(calls, ["codex"], "Ausdrückliche Wahl ohne Ausweichen");
  const ohneClaude = await wahl("auto", deps(ergebnis(true), false));
  assert.deepEqual(calls, ["codex"]);
  assert.equal(ohneClaude.report.status, "error");
  const gesperrt = await wahl("claude", deps(ergebnis(), false));
  assert.deepEqual(calls, [], "Claude ohne Freigabe startet nicht, auch nicht bei ausdrücklicher Wahl");
  assert.match(gesperrt.report.message, /Claude ist nicht freigeschaltet.*keine Anfrage/);
  assert.equal(gesperrt.unavailable, true);
  // Echter Codex-Weg ohne Freigabe: Nichtverfügbarkeit vor jeder Anfrage, Claude übernimmt.
  calls.length = 0;
  const echt = await scanIndeedViaConnector(["A"], "Gießen", 50, "auto", { codex: (k, c, r) => codex.scanIndeedViaCodex(k, c, r, () => codex.openIndeedCodex({ JOBPILOT_CODEX_CLI: fake })), claude: async () => { calls.push("claude"); return ergebnis(false, "partial"); }, claudeAvailable: () => true });
  assert.deepEqual(calls, ["claude"]);
  assert.equal(echt.report.status, "partial");
  // JOBPILOT_INDEED_PROVIDER legt nur „auto“ fest.
  try {
    process.env.JOBPILOT_INDEED_PROVIDER = "claude";
    await wahl("auto", deps());
    assert.deepEqual(calls, ["claude"]);
    await wahl("codex", deps());
    assert.deepEqual(calls, ["codex"]);
    process.env.JOBPILOT_INDEED_PROVIDER = "codex";
    await wahl("auto", deps(ergebnis(true)));
    assert.deepEqual(calls, ["codex"], "Vorgabe codex weicht nicht auf Claude aus");
    process.env.JOBPILOT_INDEED_PROVIDER = "beide";
    await assert.rejects(wahl("auto", deps()), /Unbekannter Indeed-Suchassistent/);
    assert.deepEqual(calls, []);
  } finally {
    delete process.env.JOBPILOT_INDEED_PROVIDER;
  }
});

// Lokaler Server mit gemockten Jobbörsen. LinkedIn antwortet mit 403 (Sperre), Indeed erhält nie eine direkte Anfrage.
const ev = (o) => JSON.stringify(o);
const claudeStrom = [
  ev({ type: "assistant", message: { content: [{ type: "tool_use", id: "s", name: INDEED_SUCHE, input: {} }] } }),
  ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "s", content: [{ type: "text", text: JSON.stringify({ result: "**Job Title:** Werkstudent Data Engineering (m/w/d)\n **Job Id:** J1\n **Company:** Synthetische Datenwerk GmbH\n **Location:** Gießen\n **Posted on:** November 20, 2026\n **View Job URL:** https://to.indeed.com/J1" }) }] }] } }),
].join("\n");
const auftrag = { live: true, quellen: ["indeed", "linkedin"], keywords: "Werkstudent Informatik", breit: false, city: "Gießen", radius: 100 };
async function aufbauen(t, { codexFrei = true, claudeFrei = true, szenario = "", live = true } = {}) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-anbieter-test-")), log = path.join(ordner, "codex.jsonl"), claude = [];
  await writeFile(path.join(ordner, "geocache.json"), JSON.stringify({ orte: { berlin: { lat: 52.52, lon: 13.405 } }, geprueft: {} }));
  const server = erstelleServer({
    datenordner: ordner, live, geokodierung: false,
    indeedClaude: { verfuegbar: claudeFrei, lauf: async (a) => { claude.push(a); return claudeStrom; } },
    indeedCodex: { verfuegbar: codexFrei, umgebung: codexUmgebung({ JOBPILOT_CODEX_TEST_LOG: log, JOBPILOT_CODEX_TEST_SCENARIO: szenario }) },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port, client = echterFetch, extern = [];
  globalThis.fetch = async (input, init) => {
    const u = String(input);
    if (u.startsWith("http://127.0.0.1:")) return client(input, init);
    extern.push(u);
    return new Response("", { status: 403 });
  };
  t.after(async () => {
    globalThis.fetch = echterFetch;
    await server.suchlauf();
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  });
  const post = async (inhalt) => { const r = await client(basis + "/api/suche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inhalt) }); return { status: r.status, daten: await r.json() }; };
  const indeedBerichte = (z) => z.berichte.filter((b) => b.source === "indeed");
  return { server, basis, client, extern, claude, log, post, ordner, indeedBerichte };
}

test("Suchstart mit auto: genau ein Connector, ChatGPT/Codex bevorzugt, fünf Begriffe in einer Sitzung, Umkreis und IT geprüft", async (t) => {
  const h = await aufbauen(t);
  const r = await h.post({ ...auftrag, indeedProvider: "auto" });
  assert.equal(r.status, 200);
  assert.equal(h.claude.length, 0, "Claude startet nicht, wenn Codex verfügbar ist");
  const zeilen = await protokoll(h.log), anfragen = suchen(zeilen);
  assert.equal(anfragen.length, 5);
  assert.equal(new Set(anfragen.map((a) => a.params.arguments.search)).size, 5);
  assert(anfragen.every((a) => a.params.arguments.location === "Gießen" && a.params.arguments.radius === 63 && a.params.arguments.country_code === "DE"));
  assert.equal(zeilen.filter((z) => z.method === "initialize").length, 1, "Eine Codex-Sitzung je Suchstart");
  assert(!zeilen.some((z) => /turn\/|login|resume|company|approval/i.test(z.method)));
  const bericht = h.indeedBerichte(r.daten.zustand);
  assert.equal(bericht.length, 1);
  assert.equal(bericht[0].status, "partial");
  assert.match(bericht[0].message, /^Indeed über ChatGPT\/Codex: 5 Suchen/);
  assert.equal(bericht[0].inserted, 1, "Berlin außerhalb des Umkreises, Buchhaltung ohne IT-Bezug");
  const indeed = r.daten.zustand.stellen.filter((s) => s.source === "indeed");
  assert.deepEqual(indeed.map((s) => s.company), ["Beispiel GmbH"]);
  assert.match(indeed[0].externalRef, /^codex-[0-9a-f]{24}$/);
  assert(!h.extern.some((u) => u.includes("indeed.com")), "Kein direkter Abruf von Indeed");
  assert.equal(r.daten.zustand.berichte.filter((b) => b.source === "linkedin").length, 5);
});

test("Ohne Anbieterwahl kein Connector; ungültige Wahl startet nichts", async (t) => {
  const h = await aufbauen(t);
  const ohne = await h.post(auftrag);
  assert.equal(ohne.status, 200);
  assert(h.indeedBerichte(ohne.daten.zustand).every((b) => b.status === "blocked"), "Indeed bleibt ohne Anfrage");
  assert.equal(existsSync(h.log), false, "Kein Codex-Prozess");
  assert.equal(h.claude.length, 0);
  const vorher = JSON.parse(await readFile(path.join(h.ordner, "zustand.json"), "utf8")).lauf.beginn;
  h.extern.length = 0;
  for (const indeedProvider of ["beide", 5, null, "Codex"]) {
    const r = await h.post({ ...auftrag, indeedProvider });
    if (indeedProvider === null) { assert.equal(r.status, 200); continue; }
    assert.equal(r.status, 400, String(indeedProvider));
    assert.match(r.daten.fehler, /Unbekannter Indeed-Suchassistent/);
  }
  const nachUngueltig = JSON.parse(await readFile(path.join(h.ordner, "zustand.json"), "utf8")).lauf.beginn;
  assert.notEqual(nachUngueltig, vorher, "Nur der gültige Aufruf ohne Wahl (null) hat gesucht");
  try {
    process.env.JOBPILOT_INDEED_PROVIDER = "beide";
    const r = await h.post({ ...auftrag, indeedProvider: "auto" });
    assert.equal(r.status, 500);
    assert.match(r.daten.fehler, /JOBPILOT_INDEED_PROVIDER/);
  } finally {
    delete process.env.JOBPILOT_INDEED_PROVIDER;
  }
  assert.equal(JSON.parse(await readFile(path.join(h.ordner, "zustand.json"), "utf8")).lauf.beginn, nachUngueltig, "Fehlkonfiguration startet keinen Suchlauf");
  assert.equal(existsSync(h.log), false);
});

test("auto: Claude nur, wenn ChatGPT/Codex vor jeder Anfrage nicht verfügbar ist", async (t) => {
  const fehlt = await aufbauen(t, { szenario: "missing-app" });
  const r = await fehlt.post({ ...auftrag, indeedProvider: "auto" });
  assert.equal(fehlt.claude.length, 1, "Ein Claude-Lauf mit den fünf Begriffen");
  assert.equal((fehlt.claude[0].match(/^- "/gm) || []).length, 5);
  assert.equal(suchen(await protokoll(fehlt.log)).length, 0, "Codex hat keine Suche gesendet");
  const bericht = fehlt.indeedBerichte(r.daten.zustand);
  assert.equal(bericht.length, 1);
  assert.match(bericht[0].message, /^ChatGPT\/Codex vor jeder Suchanfrage nicht verfügbar; Claude verwendet\. Indeed über den Claude-Connector/);
  const aus = await aufbauen(t, { codexFrei: false });
  await aus.post({ ...auftrag, indeedProvider: "auto" });
  assert.equal(aus.claude.length, 1, "Codex nicht freigeschaltet: Claude übernimmt");
  assert.equal(existsSync(aus.log), false, "Ohne Freigabe startet kein Codex-Prozess");
});

test("Kein Wechsel zu Claude, nachdem eine Codex-Anfrage gesendet wurde", async (t) => {
  const zweite = await aufbauen(t, { szenario: "second-error" });
  const a = await zweite.post({ ...auftrag, indeedProvider: "auto" });
  assert.equal(suchen(await protokoll(zweite.log)).length, 2);
  assert.equal(zweite.claude.length, 0);
  const ba = zweite.indeedBerichte(a.daten.zustand);
  assert.equal(ba[0].status, "partial");
  assert.match(ba[0].message, /nach 1 bestätigten Suchen unterbrochen.*Keine automatische Wiederholung/);
  const abbruch = await aufbauen(t, { szenario: "close-on-search" });
  const b = await abbruch.post({ ...auftrag, indeedProvider: "auto" });
  assert.equal(suchen(await protokoll(abbruch.log)).length, 1);
  assert.equal(abbruch.claude.length, 0, "Unsichere Anfrage wird nicht mit einem anderen Konto wiederholt");
  assert.equal(abbruch.indeedBerichte(b.daten.zustand)[0].status, "error");
});

test("Ausdrückliche Wahl ohne Freigabe: ehrlicher Fehler, keine Anfrage, kein Wechsel; ältere Angabe bleibt gültig", async (t) => {
  const ohneCodex = await aufbauen(t, { codexFrei: false });
  const a = await ohneCodex.post({ ...auftrag, indeedProvider: "codex" });
  assert.equal(ohneCodex.claude.length, 0);
  assert.equal(existsSync(ohneCodex.log), false);
  assert.match(ohneCodex.indeedBerichte(a.daten.zustand)[0].message, /ChatGPT\/Codex ist am Server nicht freigeschaltet/);
  const alt = await ohneCodex.post({ ...auftrag, indeedUeberClaude: true });
  assert.equal(ohneCodex.claude.length, 1, "indeedUeberClaude: true entspricht der Wahl claude");
  assert.equal(ohneCodex.indeedBerichte(alt.daten.zustand)[0].status, "partial");
  const ohneClaude = await aufbauen(t, { claudeFrei: false });
  const b = await ohneClaude.post({ ...auftrag, indeedProvider: "claude" });
  assert.equal(existsSync(ohneClaude.log), false, "Kein Wechsel zu Codex");
  assert.equal(ohneClaude.claude.length, 0);
  assert.match(ohneClaude.indeedBerichte(b.daten.zustand)[0].message, /Claude ist nicht freigeschaltet/);
  const keiner = await aufbauen(t, { codexFrei: false, claudeFrei: false });
  const c = await keiner.post({ ...auftrag, indeedProvider: "auto" });
  assert(keiner.indeedBerichte(c.daten.zustand).every((x) => x.status === "blocked"), "auto ohne Connector: Indeed bleibt Browserlink");
});

test("Fähigkeitsabfrage ist lesend und meldet Anbieter, Freigaben und Plattformen", async (t) => {
  const h = await aufbauen(t, { claudeFrei: false });
  const f = await h.client(h.basis + "/api/suche").then((r) => r.json());
  assert.equal(f.manualSearchCommandVersion, 1);
  assert.deepEqual(f.indeedProviders, ["auto", "codex", "claude"]);
  assert.deepEqual(f.indeedConnectoren, { codex: true, claude: false });
  assert.equal(f.live, true);
  assert.equal(f.plattformen.length, 21);
  assert.equal(existsSync(path.join(h.ordner, "zustand.json")), false, "Keine Zustandsänderung");
  assert.equal((await h.client(h.basis + "/api/suche", { headers: { Origin: "https://fremd.example.test" } })).status, 403);
  const status = await h.client(h.basis + "/api/status").then((r) => r.json());
  assert.equal(status.indeedCodex, true);
  assert.equal(status.indeedClaude, false);
  const ohneLive = await aufbauen(t, { live: false });
  assert.deepEqual((await ohneLive.client(ohneLive.basis + "/api/suche").then((r) => r.json())).indeedConnectoren, { codex: false, claude: false });
});

const ausfuehren = (basis, argumente) => new Promise((fertig) => {
  const kind = spawn(process.execPath, [werkzeug, ...argumente], { env: { ...process.env, JOBPILOT_URL: basis + "/" }, windowsHide: true });
  let aus = "", fehler = "";
  kind.stdout.on("data", (d) => { aus += d; });
  kind.stderr.on("data", (d) => { fehler += d; });
  kind.on("close", (code) => fertig({ code, aus, fehler }));
});

test("Werkzeug suche-starten.mjs: ein Suchstart mit gewähltem Anbieter, prüft Freigaben vorher, wiederholt gespeicherte Kriterien", async (t) => {
  const h = await aufbauen(t, { claudeFrei: false });
  const gesperrt = await ausfuehren(h.basis, ["--run", "--provider=claude", "--ort=Gießen", "--begriffe=Werkstudent Informatik"]);
  assert.equal(gesperrt.code, 1);
  assert.match(gesperrt.fehler, /Claude ist am Server nicht freigeschaltet.*keine Suche gestartet/);
  assert.equal(existsSync(path.join(h.ordner, "zustand.json")), false, "Keine Suche gestartet");
  const leer = await ausfuehren(h.basis, ["--run"]);
  assert.equal(leer.code, 1);
  assert.match(leer.fehler, /--ort und --begriffe angeben/);
  const falsch = await ausfuehren(h.basis, ["--run", "--ort=Gießen", "--begriffe=X", "--ohne=monster"]);
  assert.equal(falsch.code, 1);
  assert.match(falsch.fehler, /Unbekannte Plattform: monster/);
  const lauf = await ausfuehren(h.basis, ["--run", "--provider=codex", "--ort=Gießen", "--umkreis=100", "--begriffe=Werkstudent Informatik; Werkstudent Data", "--plattformen=indeed,linkedin,xing", "--ohne=xing"]);
  assert.equal(lauf.code, 0, lauf.fehler);
  assert.match(lauf.aus, /Suche gestartet: Gießen, 100 km, 2 Suchbegriffe, 2 Plattformen, Indeed: ChatGPT\/Codex\./);
  assert.match(lauf.aus, /Suchstart beendet: 1 neue Stelle aus \d+ gelesenen Treffern in 5 von 5 Durchläufen\. Teilabdeckung, keine vollständige Marktabdeckung\./);
  assert.match(lauf.aus, /Plattformen: 2 von 21 abgefragt; teilweise 1, blockiert 1\./);
  assert.match(lauf.aus, /Brauchen den Browser: LinkedIn Jobs \(blockiert\)\./);
  assert.match(lauf.aus, /Indeed: Indeed über ChatGPT\/Codex: 5 Suchen/);
  assert.equal(suchen(await protokoll(h.log)).length, 5);
  await h.server.suchlauf();
  // Ohne Kriterien: dieselben Kriterien wie beim letzten Live-Suchstart, auto wählt ChatGPT/Codex.
  const wieder = await ausfuehren(h.basis, ["--run", "--json"]);
  assert.equal(wieder.code, 0, wieder.fehler);
  const json = JSON.parse(wieder.aus.trim());
  assert.equal(json.anbieter, "auto");
  assert.deepEqual(json.kriterien, { city: "Gießen", radius: 100, keywordList: ["Werkstudent Informatik", "Werkstudent Data"], quellen: ["linkedin", "indeed"], breit: true });
  assert.equal(json.lauf.zustand, "fertig");
  assert.equal(json.indeed.length, 1);
  assert.match(json.indeed[0].message, /^Indeed über ChatGPT\/Codex/);
  assert.equal(json.plattformen.find((p) => p.id === "indeed").state, "teilweise");
  assert.equal(suchen(await protokoll(h.log)).length, 10);
  assert(!h.extern.some((u) => u.includes("indeed.com")));
});
