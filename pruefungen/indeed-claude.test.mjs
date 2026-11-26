// Indeed über den Claude-Connector: Auswertung eines echten, gekürzten Ereignisstroms (ohne Sitzungskopf; Kurzlinks,
// Kontaktpersonen und Telefonnummern ersetzt) und Einbindung in den lokalen Suchablauf.
// Kein Netzwerk zu Jobbörsen, kein Claude-Aufruf: der Lauf wird durch eine Funktion ersetzt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  INDEED_DETAIL,
  INDEED_SUCHE,
  alsAngebot,
  claudeArgumente,
  claudeProgramm,
  claudeUmgebung,
  indeedAuftrag,
  indeedErgebnis,
  indeedViaClaudeVerfuegbar,
  scanIndeedViaClaude,
} from "../dist/indeed-claude.mjs";
import { erstelleServer } from "../dist/server.mjs";

const hier = fileURLToPath(import.meta.url);
const stream = await readFile(
  path.join(path.dirname(hier), "fixtures/indeed-claude/stream.jsonl"),
  "utf8",
);

test("Ereignisstrom: Suchtreffer und Detailtexte werden roh gelesen, nicht von Claude abgeschrieben", () => {
  const r = indeedErgebnis(stream);
  assert.equal(r.suchen, 1);
  assert.equal(r.details, 2);
  assert(r.treffer.length >= 2);
  const erster = r.treffer.find((t) => t.jobId === "JOBSEARCH_16");
  assert.equal(erster.title, "Werkstudent im Dokumentenmanagement (m/w/d)");
  assert.equal(erster.company, "Vereinigte Hagel");
  assert.equal(erster.location, "Gießen");
  assert(erster.url.startsWith("https://to.indeed.com/"), "Link aus der Suche");
  assert(erster.description.length > 1000);
  assert(!/\*\*Company:\*\*|^###/m.test(erster.description), "Kopfzeilen nicht in der Beschreibung");
  const o = alsAngebot(erster);
  assert.equal(o.source, "indeed");
  assert(o.complete);
  assert.equal(o.publishedAt, "2026-11-19");
  assert.match(o.externalRef, /^claude-[0-9a-f]{24}$/);
  assert.equal(alsAngebot({ ...erster, url: "https://to.indeed.com/anderer-kurzlink" }).externalRef, o.externalRef, "Wechselnder Kurzlink ändert die Kennung nicht");
  const ohneDetail = r.treffer.find((t) => !t.description);
  if (ohneDetail) assert.equal(alsAngebot(ohneDetail).complete, false);
});

test("Lauf nur mit Indeed-Lesewerkzeugen, ohne API-Schlüssel und ohne Lebenslauf; nur mit ausdrücklicher Freigabe", async () => {
  const a = claudeArgumente(),
    erlaubt = a.slice(a.indexOf("--allowedTools") + 1, a.indexOf("--permission-mode"));
  assert.deepEqual([...erlaubt], ["ToolSearch", INDEED_SUCHE, INDEED_DETAIL]);
  assert.equal(a[a.indexOf("--tools") + 1], "ToolSearch", "Keine eingebauten Werkzeuge wie Web, Bash oder Dateien");
  assert.equal(a[a.indexOf("--model") + 1], "haiku");
  assert.equal(a[a.indexOf("--permission-mode") + 1], "dontAsk");
  assert(!a.join(" ").includes("get_resume"));
  const env = claudeUmgebung({ ANTHROPIC_API_KEY: "x", ANTHROPIC_AUTH_TOKEN: "y", CLAUDE_CODE_OAUTH_TOKEN: "z", PATH: "p" });
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.CLAUDE_CODE_OAUTH_TOKEN, undefined);
  assert.equal(env.PATH, "p");
  const auftrag = indeedAuftrag(["Werkstudent Data", "Praktikum Informatik"], "Gießen");
  assert(auftrag.includes('"Werkstudent Data"') && auftrag.includes('"Praktikum Informatik"') && auftrag.includes('location "Gießen"') && auftrag.includes('country_code "DE"'));
  // Öffentliche Fassung: ausdrücklich einzuschalten, nicht nur abschaltbar.
  assert.equal(indeedViaClaudeVerfuegbar({ JOBPILOT_CLAUDE_CLI: hier }), false, "Ohne JOBPILOT_INDEED_CLAUDE=1 aus");
  assert.equal(indeedViaClaudeVerfuegbar({ JOBPILOT_INDEED_CLAUDE: "0", JOBPILOT_CLAUDE_CLI: hier }), false);
  assert.equal(indeedViaClaudeVerfuegbar({ JOBPILOT_INDEED_CLAUDE: "1", JOBPILOT_CLAUDE_CLI: hier }), true);
  // Suchpfad auf macOS und Linux (ohne .exe) sowie Windows (nur claude.exe, kein .cmd über eine Shell).
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-claude-pfad-"));
  try {
    await writeFile(path.join(ordner, "claude"), "");
    const leer = path.join(ordner, "kein-heim");
    assert.equal(claudeProgramm({ PATH: ordner }, "linux", leer), path.join(ordner, "claude"));
    assert.equal(claudeProgramm({ PATH: ordner, APPDATA: ordner }, "win32", leer), null);
    assert.equal(claudeProgramm({ PATH: "" }, "linux", leer), null, "Ohne Claude Code bleibt Indeed ein Browserlink");
    await mkdir(path.join(ordner, "unter"));
    await writeFile(path.join(ordner, "unter", "claude.exe"), "");
    assert.equal(claudeProgramm({ PATH: path.join(ordner, "unter"), APPDATA: ordner }, "win32", leer), path.join(ordner, "unter", "claude.exe"));
  } finally {
    await rm(ordner, { recursive: true, force: true });
  }
});

test("Bericht: Teilabruf bei Erfolg, ehrlicher Fehler ohne Connector oder bei Abbruch", async () => {
  let auftrag;
  const ok = await scanIndeedViaClaude(["Werkstudent Data", "Werkstudent Data", " "], "Gießen", 100, async (a) => {
    auftrag = a;
    return stream;
  });
  assert.equal(ok.report.status, "partial");
  assert.equal(ok.report.found, ok.offers.length);
  assert(ok.report.limited);
  assert.equal(ok.report.keywords, "Werkstudent Data", "Doppelte und leere Begriffe entfallen");
  assert.equal((auftrag.match(/^- "/gm) || []).length, 1);
  const ohne = await scanIndeedViaClaude(["Werkstudent IT"], "Gießen", 100, async () => JSON.stringify({ type: "result", result: "Kein Indeed-Werkzeug" }));
  assert.equal(ohne.report.status, "error");
  assert.equal(ohne.offers.length, 0);
  assert.match(ohne.report.message, /Connectors/);
  const abbruch = await scanIndeedViaClaude(["Werkstudent IT"], "Gießen", 100, async () => {
    throw Error("Zeitüberschreitung nach 300 s.");
  });
  assert.equal(abbruch.report.status, "error");
  assert.match(abbruch.report.message, /Zeitüberschreitung/);
  const nichts = await scanIndeedViaClaude([], "Gießen", 100, async () => {
    throw Error("darf nicht laufen");
  });
  assert.equal(nichts.report.status, "error");
});

test("Dieselbe Anzeige aus zwei Suchen (andere Job-Id und Kurzlink) erscheint einmal, mit Beschreibung", async () => {
  const ev = (o) => JSON.stringify(o),
    antwort = (id, name, text) => [
      ev({ type: "assistant", message: { content: [{ type: "tool_use", id, name, input: {} }] } }),
      ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: JSON.stringify({ result: text }) }] }] } }),
    ];
  const karte = (jobId, url) => `**Job Title:** Werkstudent IT (m/w/d)\n **Job Id:** ${jobId}\n **Company:** ACME GmbH\n **Location:** Gießen\n **Posted on:** November 20, 2026\n **View Job URL:** ${url}`;
  const strom = [...antwort("a", INDEED_SUCHE, karte("JOBSEARCH_1", "https://to.indeed.com/aaa")), ...antwort("b", INDEED_SUCHE, karte("JOBSEARCH_2", "https://to.indeed.com/bbb")), ...antwort("c", INDEED_DETAIL, "### Werkstudent IT (m/w/d)\n **Job Id:** JOBSEARCH_2\n **Company:** ACME GmbH\n **Location:** Gießen\n\n " + "Python und SQL im Team. ".repeat(10))].join("\n");
  const r = await scanIndeedViaClaude(["Werkstudent IT", "Werkstudent Data"], "Gießen", 100, async () => strom);
  assert.equal(r.offers.length, 1);
  assert(r.offers[0].complete);
  assert.equal(r.report.found, 1);
  assert.equal(r.offers[0].publishedAt, "2026-11-20");
});

// Einbindung: nur der Knopf (indeedUeberClaude) fragt Indeed über Claude ab, einmal je Suchstart mit den fünf Begriffen
// der Indeed-Spur; ohne Freigabe am Server nie. Indeed-Treffer durchlaufen die Umkreisprüfung (Ort über Nominatim, gemockt).
test("Suche: Indeed über Claude nur auf Knopfdruck und mit Freigabe, einmal je Start, Umkreis wird geprüft", async () => {
  const ev = (o) => JSON.stringify(o),
    karte = (id, titel, firma, ort) => `**Job Title:** ${titel}\n **Job Id:** ${id}\n **Company:** ${firma}\n **Location:** ${ort}\n **Posted on:** November 20, 2026\n **View Job URL:** https://to.indeed.com/${id}`;
  const strom = [
    ev({ type: "assistant", message: { content: [{ type: "tool_use", id: "s", name: INDEED_SUCHE, input: {} }] } }),
    ev({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: "s", content: [{ type: "text", text: JSON.stringify({ result: karte("J1", "Werkstudent Data Engineering (m/w/d)", "Synthetische Datenwerk GmbH", "Gießen") + "\n\n" + karte("J2", "Werkstudent Data Analytics (m/w/d)", "Synthetische Analyse AG", "Berlin") }) }] }] } }),
  ].join("\n");
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-indeed-test-")),
    auftraege = [];
  const lauf = async (a) => {
    auftraege.push(a);
    return strom;
  };
  const server = erstelleServer({ datenordner: ordner, live: true, geokodierung: true, indeedClaude: { verfuegbar: true, lauf } });
  const ohneFreigabe = erstelleServer({ datenordner: ordner, live: true, geokodierung: true, indeedClaude: { verfuegbar: false, lauf } });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  await new Promise((r) => ohneFreigabe.listen(0, "127.0.0.1", r));
  const client = globalThis.fetch,
    abgerufen = [];
  globalThis.fetch = async (input, init) => {
    const u = String(input);
    abgerufen.push(u);
    if (u.startsWith("https://nominatim.openstreetmap.org/")) {
      assert.match(init.headers["User-Agent"], /^JobPilot\//);
      return Response.json(new URL(u).searchParams.get("q") === "Berlin" ? [{ lat: "52.52", lon: "13.405", addresstype: "city" }] : []);
    }
    return new Response("", { status: 403 });
  };
  const post = (basis, d) => client(basis + "/api/suche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }).then((r) => r.json());
  const basis = "http://127.0.0.1:" + server.address().port,
    basis2 = "http://127.0.0.1:" + ohneFreigabe.address().port;
  const auftrag = { live: true, quellen: ["indeed", "linkedin"], keywords: "Werkstudent Data", breit: false, city: "Gießen", radius: 100 };
  try {
    const knopf = await post(basis, { ...auftrag, indeedUeberClaude: true });
    assert.equal(auftraege.length, 1, "Ein Claude-Lauf je Suchstart");
    const begriffe = auftraege[0].match(/^- "(.*)"$/gm);
    assert.equal(begriffe.length, 5);
    assert.equal(new Set(begriffe).size, 5);
    assert(auftraege[0].includes('location "Gießen"'));
    assert(!abgerufen.some((u) => u.includes("indeed.com")), "Kein direkter Abruf von Indeed");
    const linkedin = knopf.zustand.berichte.filter((r) => r.source === "linkedin");
    assert.equal(linkedin.length, 5, "Eine Anfrage je Durchlauf");
    assert.equal(linkedin.filter((r) => r.skipped).length, 4, "Nach der Sperre keine weitere Anfrage");
    assert.equal(abgerufen.filter((u) => u.includes("linkedin.com")).length, 1);
    const bericht = knopf.zustand.berichte.filter((r) => r.source === "indeed");
    assert.equal(bericht.length, 1);
    assert.equal(bericht[0].status, "partial");
    assert.equal(bericht[0].inserted, 1, "Berlin liegt außerhalb des Umkreises");
    assert.equal(knopf.zustand.stellen.filter((s) => s.source === "indeed").length, 1);
    const cache = JSON.parse(await readFile(path.join(ordner, "geocache.json"), "utf8"));
    assert.deepEqual(cache.orte.berlin, { lat: 52.52, lon: 13.405 });
    auftraege.length = 0;
    abgerufen.length = 0;
    const ohneKnopf = await post(basis, auftrag);
    assert.equal(auftraege.length, 0, "Ohne Knopf kein Claude-Lauf");
    assert.equal(ohneKnopf.zustand.berichte.filter((r) => r.source === "indeed")[0].status, "blocked");
    assert(!abgerufen.some((u) => u.includes("indeed.com")), "Ohne Claude bleibt Indeed ohne Anfrage");
    await post(basis2, { ...auftrag, indeedUeberClaude: true });
    assert.equal(auftraege.length, 0, "Ohne Freigabe am Server nie");
    const status = await client(basis + "/api/status").then((r) => r.json());
    assert.equal(status.indeedClaude, true);
    assert.equal((await client(basis2 + "/api/status").then((r) => r.json())).indeedClaude, false);
  } finally {
    globalThis.fetch = client;
    await new Promise((r) => server.close(r));
    await new Promise((r) => ohneFreigabe.close(r));
    await rm(ordner, { recursive: true, force: true });
  }
});
