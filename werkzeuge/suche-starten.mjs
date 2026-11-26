// Ein manueller Suchstart aus dem Terminal oder aus einem Gespräch mit Claude Code oder Codex, nach dem Vorbild von
// scripts/jobpilot-suche-starten.cjs des Originals. Spricht ausschließlich mit dem eigenen lokalen JobPilot-Server.
// Nie zeitgesteuert starten. Je Aufruf genau ein Suchstart mit genau einem Indeed-Connector; keine automatische
// Wiederholung, auch nicht nach einem Fehler oder einer Unterbrechung.
//
//   node werkzeuge/suche-starten.mjs --run [--provider=auto|codex|claude] [--ort=Gießen] [--umkreis=50]
//        [--begriffe="Werkstudent Data; Praktikum Informatik"] [--plattformen=id,id] [--ohne=id,id] [--json]
//
// Ohne Kriterien wiederholt der Aufruf die Kriterien des letzten Live-Suchstarts dieses Servers.
import path from "node:path";
import { fileURLToPath } from "node:url";

const ERLAUBT = ["--run", "--json", "--provider=", "--ort=", "--umkreis=", "--begriffe=", "--plattformen=", "--ohne="];
const ANBIETER = ["auto", "codex", "claude"];
const stellen = (n) => `${n} ${n === 1 ? "neue Stelle" : "neue Stellen"}`;
const NAME = { codex: "ChatGPT/Codex", claude: "Claude", auto: "auto (ChatGPT/Codex bevorzugt, Claude nur bei Nichtverfügbarkeit vor jeder Anfrage)" };

class Abbruch extends Error {}
const abbrechen = (text) => { throw new Abbruch(text); };

function argumente(liste) {
  const werte = {};
  for (const a of liste) {
    const name = ERLAUBT.find((e) => (e.endsWith("=") ? a.startsWith(e) : a === e));
    if (a === "--probe") abbrechen("--probe gibt es nur im persönlichen Original (es liest dessen Datenbank). Öffentlich: --run mit Kriterien. Keine Suche gestartet.");
    if (!name) abbrechen(`Unbekannte Angabe ${JSON.stringify(a)}. Aufruf: node werkzeuge/suche-starten.mjs --run [--provider=auto|codex|claude] [--ort=…] [--umkreis=…] [--begriffe=…] [--plattformen=…] [--ohne=…] [--json]`);
    const schluessel = name.replace(/^--|=$/g, "");
    if (schluessel in werte) abbrechen(`${name} ist doppelt angegeben. Keine Suche gestartet.`);
    werte[schluessel] = name.endsWith("=") ? a.slice(name.length) : true;
  }
  if (werte.run !== true) abbrechen("Ohne ausdrückliches --run wird keine Suche gestartet.");
  const anbieter = werte.provider ?? "auto";
  if (!ANBIETER.includes(anbieter)) abbrechen("--provider muss auto, codex oder claude sein. Keine Suche gestartet.");
  let umkreis;
  if (werte.umkreis !== undefined) {
    umkreis = Number(werte.umkreis);
    if (!Number.isInteger(umkreis) || umkreis < 1 || umkreis > 200) abbrechen("--umkreis muss eine ganze Zahl von 1 bis 200 (Kilometer) sein. Keine Suche gestartet.");
  }
  const ort = werte.ort?.trim();
  if (werte.ort !== undefined && (!ort || ort.length > 100)) abbrechen("--ort muss 1 bis 100 Zeichen enthalten. Keine Suche gestartet.");
  const liste2 = (text) => text.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
  const begriffe = werte.begriffe !== undefined ? liste2(werte.begriffe) : undefined;
  if (begriffe && !begriffe.length) abbrechen("--begriffe enthält keinen Suchbegriff. Keine Suche gestartet.");
  return {
    anbieter, ort, umkreis, begriffe, json: werte.json === true,
    plattformen: werte.plattformen !== undefined ? liste2(werte.plattformen) : undefined,
    ohne: werte.ohne !== undefined ? liste2(werte.ohne) : [],
  };
}

function basisAdresse(env) {
  const port = env.PORT && /^\d{1,5}$/.test(env.PORT) ? env.PORT : "3037";
  let url;
  try { url = new URL(env.JOBPILOT_URL || `http://127.0.0.1:${port}/`); } catch { abbrechen("JOBPILOT_URL ist keine gültige Adresse. Keine Suche gestartet."); }
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    abbrechen("Suchkommando nur an den eigenen lokalen JobPilot-Server senden (http://127.0.0.1:<Port>/). Keine Suche gestartet.");
  return url;
}

async function anfrage(basis, pfad, optionen = {}) {
  const r = await fetch(new URL(pfad, basis), { ...optionen, redirect: "error", signal: AbortSignal.timeout(30_000), headers: { Accept: "application/json", ...optionen.headers } });
  let daten = {};
  try { daten = await r.json(); } catch { /* Kein JSON: Status allein zählt. */ }
  return { status: r.status, ok: r.ok, daten };
}

async function plattformzustaende(quellen, berichte) {
  try {
    const { platformStates, STATE_LABEL, PROBLEM_STATES } = await import(new URL("../dist/plattformstatus.mjs", import.meta.url).href);
    return { zustaende: platformStates(quellen, berichte), STATE_LABEL, PROBLEM_STATES };
  } catch {
    return null;
  }
}

export async function sucheStarten(liste, env = process.env, ausgabe = (t) => console.log(t), warten = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const a = argumente(liste), basis = basisAdresse(env);
  const melden = (t) => { if (!a.json) ausgabe(t); };
  const faehigkeit = await anfrage(basis, "/api/suche").catch(() => abbrechen(`JobPilot-Server unter ${basis.href} nicht erreichbar. Keine Suche gestartet.`));
  if (!faehigkeit.ok || faehigkeit.daten.manualSearchCommandVersion !== 1)
    abbrechen("Der laufende JobPilot-Server unterstützt die Anbieterwahl noch nicht (älterer Stand). npm run build ausführen und den Server neu starten. Keine Suche gestartet.");
  const f = faehigkeit.daten;
  if (!f.live) abbrechen("Live-Suche ist am Server nicht freigeschaltet (JOBPILOT_LIVE=1). Keine Suche gestartet.");
  if (a.anbieter === "codex" && !f.indeedConnectoren?.codex)
    abbrechen("Indeed über ChatGPT/Codex ist am Server nicht freigeschaltet (JOBPILOT_INDEED_CODEX=1 und installiertes Codex). Kein Wechsel zu Claude; keine Suche gestartet.");
  if (a.anbieter === "claude" && !f.indeedConnectoren?.claude)
    abbrechen("Indeed über Claude ist am Server nicht freigeschaltet (JOBPILOT_INDEED_CLAUDE=1 und installiertes Claude Code). Kein Wechsel zu ChatGPT/Codex; keine Suche gestartet.");
  const stand = await anfrage(basis, "/api/status");
  if (!stand.ok) abbrechen(`Suchstand nicht lesbar (HTTP ${stand.status}). Keine Suche gestartet.`);
  if (stand.daten.zustand?.lauf?.zustand === "laeuft") abbrechen("Eine Suche läuft bereits. Ihren Stand mit GET /api/status prüfen; keine weitere Suche gestartet.");
  const letzte = stand.daten.zustand?.auftrag;
  const bekannt = Array.isArray(f.plattformen) ? f.plattformen : [];
  const unbekannt = [...(a.plattformen || []), ...a.ohne].filter((id) => !bekannt.includes(id));
  if (unbekannt.length) abbrechen(`Unbekannte Plattform: ${unbekannt.join(", ")}. Erlaubt: ${bekannt.join(", ")}. Keine Suche gestartet.`);
  const kriterien = {
    city: a.ort ?? letzte?.city,
    radius: a.umkreis ?? letzte?.radius ?? 100,
    keywordList: a.begriffe ?? letzte?.keywordList,
    quellen: (a.plattformen ?? letzte?.quellen ?? bekannt).filter((id) => bekannt.includes(id) && !a.ohne.includes(id)),
    breit: letzte?.breit ?? true,
  };
  if (!kriterien.city || !Array.isArray(kriterien.keywordList) || !kriterien.keywordList.length)
    abbrechen("Noch keine Live-Suche gespeichert: --ort und --begriffe angeben. Keine Suche gestartet.");
  if (!kriterien.quellen.length) abbrechen("Mindestens eine Plattform muss gewählt bleiben. Keine Suche gestartet.");
  const ohneConnector = a.anbieter === "auto" && !f.indeedConnectoren?.codex && !f.indeedConnectoren?.claude;
  let start;
  try {
    start = await anfrage(basis, "/api/suche", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: basis.origin },
      body: JSON.stringify({ live: true, hintergrund: true, ...kriterien, keywords: kriterien.keywordList[0], indeedProvider: a.anbieter }),
    });
  } catch {
    abbrechen("Suchstart nicht bestätigt: keine Antwort des Servers. Vor einem neuen Versuch mit GET /api/status prüfen, ob die Suche läuft. Keine automatische Wiederholung.");
  }
  if (start.status === 409) abbrechen("Eine Suche läuft bereits; keine weitere gestartet.");
  if (start.status !== 202 || !start.daten.zustand?.lauf?.beginn)
    abbrechen(`Suchstart nicht bestätigt (HTTP ${start.status}${start.daten.fehler ? ": " + start.daten.fehler : ""}). Keine automatische Wiederholung.`);
  const beginn = start.daten.zustand.lauf.beginn;
  melden(`Suche gestartet: ${kriterien.city}, ${kriterien.radius} km, ${kriterien.keywordList.length} Suchbegriffe, ${kriterien.quellen.length} Plattformen, Indeed: ${NAME[a.anbieter]}.`);
  if (ohneConnector && kriterien.quellen.includes("indeed")) melden("Kein Indeed-Connector freigeschaltet: Indeed bleibt in diesem Suchstart ein Browserlink.");
  let z = start.daten.zustand, fehlversuche = 0, gemeldet = -1;
  while (z.lauf?.zustand === "laeuft") {
    if (z.lauf.abgeschlossen !== gemeldet && z.lauf.abgeschlossen > 0) melden(`Durchlauf ${z.lauf.abgeschlossen} von ${z.lauf.durchlaeufe} abgeschlossen, bisher ${stellen(z.lauf.neu)}.`);
    gemeldet = z.lauf.abgeschlossen;
    await warten(1000);
    try {
      const s = await anfrage(basis, "/api/status");
      if (!s.ok || s.daten.zustand?.lauf?.beginn !== beginn) throw Error();
      z = s.daten.zustand;
      fehlversuche = 0;
    } catch {
      if (++fehlversuche > 30) abbrechen("Der Server antwortet nicht mehr; das Ergebnis ist unbestätigt. Später GET /api/status prüfen. Keine automatische Wiederholung.");
    }
  }
  const l = z.lauf, berichte = Array.isArray(z.berichte) ? z.berichte : [];
  const plattformen = await plattformzustaende(kriterien.quellen, berichte);
  const indeed = berichte.filter((r) => r.source === "indeed");
  if (a.json) {
    ausgabe(JSON.stringify({ anbieter: a.anbieter, kriterien, lauf: l, plattformen: plattformen?.zustaende.map(({ id, label, state, found, inserted }) => ({ id, label, state, found, inserted })), indeed }));
  } else if (l.zustand === "fertig") {
    ausgabe(`Suchstart beendet: ${stellen(l.neu)} aus ${l.gefunden} gelesenen Treffern in ${l.abgeschlossen} von ${l.durchlaeufe} Durchläufen. Teilabdeckung, keine vollständige Marktabdeckung.${l.meldung ? " " + l.meldung : ""}`);
  } else {
    ausgabe(`Suchstart abgebrochen: ${l.meldung || "unbekannter Fehler"}. Bereits gelesene Stellen bleiben gespeichert. Keine automatische Wiederholung.`);
  }
  if (!a.json && plattformen) {
    const aktiv = plattformen.zustaende.filter((p) => p.state !== "aus");
    const zaehler = ["gelesen", "teilweise", "blockiert", "nur-link", "fehler", "offen"].map((s) => [s, aktiv.filter((p) => p.state === s).length]).filter(([, n]) => n);
    ausgabe(`Plattformen: ${aktiv.length} von ${plattformen.zustaende.length} abgefragt; ${zaehler.map(([s, n]) => `${plattformen.STATE_LABEL[s]} ${n}`).join(", ")}.`);
    const probleme = aktiv.filter((p) => plattformen.PROBLEM_STATES.includes(p.state));
    if (probleme.length) ausgabe(`Brauchen den Browser: ${probleme.map((p) => `${p.label} (${plattformen.STATE_LABEL[p.state]})`).join(", ")}.`);
  }
  if (!a.json && indeed.length) ausgabe(`Indeed: ${indeed.at(-1).message}`);
  return l.zustand === "fertig" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  sucheStarten(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { console.error(e instanceof Abbruch ? e.message : `Unerwarteter Fehler: ${e instanceof Error ? e.message : e}. Keine automatische Wiederholung.`); process.exitCode = 1; },
  );
}
