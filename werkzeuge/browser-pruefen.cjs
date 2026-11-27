// Browserprüfung der gebauten Oberfläche (npm run build vorher). Benötigt installierten Chrome oder Edge (BROWSER_PFAD).
// Teil 1, statische Demo: wie auf GitHub Pages unter dem Pfad /JobPilot/ ausgeliefert; keine externen Anfragen und keine
// Anfrage an eine Server-API. Teil 2, lokaler Server: dieselbe Oberfläche über dist/server.mjs mit Live-Freigabe und
// gemocktem Stellenmarkt (Suchknopf, Fortschritt, Plattform-Chips, Archivieren mit Firmenausschluss).
// Optional: --bild=<datei.png> schreibt die Aufnahme der Stellenübersicht (für README und Portfolio).
// Optional: --url=<https://...> prüft eine veröffentlichte Adresse (z. B. GitHub Pages) statt der lokal gebauten Demo;
//   dann sind Anfragen an genau diesen Host erlaubt.
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");
const dist = path.resolve(__dirname, "../dist");
const bildArgument = process.argv.find(a => a.startsWith("--bild="))?.slice(7);
const urlArgument = process.argv.find(a => a.startsWith("--url="))?.slice(6);
const typen = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".pdf": "application/pdf", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };
const server = http.createServer((anfrage, antwort) => {
  let pfad = decodeURIComponent(new URL(anfrage.url, "http://x").pathname).replace(/^\/JobPilot/, "") || "/";
  if (pfad.endsWith("/")) pfad += "index.html";
  const datei = path.join(dist, pfad);
  if (!datei.startsWith(dist) || !fs.existsSync(datei)) { antwort.statusCode = 404; return antwort.end("nicht gefunden"); }
  antwort.setHeader("Content-Type", typen[path.extname(datei)] || "application/octet-stream");
  antwort.end(fs.readFileSync(datei));
});
const beenden = () => { if (server.listening) server.close(); };
const browserPfad = process.env.BROWSER_PFAD || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(f => fs.existsSync(f));
if (!browserPfad) throw new Error("BROWSER_PFAD auf einen installierten Chrome oder Edge setzen.");
const zeilen = seite => seite.$$eval(".stellenzeile", e => e.length);
const firmen = seite => seite.$$eval(".stellenzeile strong", e => e.map(x => x.textContent));
const warte = ms => new Promise(r => setTimeout(r, ms));
const knopf = (seite, text, gruppe = ".filtergruppe") => seite.evaluate((text, gruppe) => { const k = [...document.querySelectorAll(gruppe + " button")].find(b => b.textContent.trim() === text); if (!k) return false; k.click(); return true; }, text, gruppe);
const reiter = (seite, text) => seite.evaluate(t => { const k = [...document.querySelectorAll(".tabs button")].find(b => b.textContent.startsWith(t)); if (!k) return false; k.click(); return true; }, text);
const auswahl = (seite, name, wert) => seite.select(`select[aria-label="${name}"]`, wert);
const zuruecksetzen = async seite => { assert(await knopf(seite, "Zurücksetzen", ".filterzeile"), "Zurücksetzen vorhanden"); await warte(100); };

// Zweiter Teil: dieselbe gebaute Oberfläche am lokalen Server (dist/server.mjs) mit Live-Freigabe. Ausgehende Anfragen des
// Servers sind gemockt (pruefungen/hilfen/stellenmarkt.mjs): die Arbeitsagentur liefert synthetische Treffer, jede andere
// Plattform antwortet mit 403. Der Browser spricht nur mit 127.0.0.1.
async function lokalPruefen(browser, beobachten, fehler, extern) {
  const { pathToFileURL } = require("node:url"), os = require("node:os");
  const { erstelleServer } = await import(pathToFileURL(path.join(dist, "server.mjs")).href);
  const { stellenmarkt, tor } = await import(pathToFileURL(path.resolve(__dirname, "../pruefungen/hilfen/stellenmarkt.mjs")).href);
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), "jobpilot-browser-lokal-")), ohneLive = fs.mkdtempSync(path.join(os.tmpdir(), "jobpilot-browser-aus-"));
  let liste = [
    { ref: "BP-1", titel: "Werkstudent Softwareentwicklung", firma: "Nordwerk Systeme GmbH" },
    { ref: "BP-2", titel: "Praktikum Data Engineering", firma: "Südlicht Daten AG" },
    { ref: "BP-3", titel: "Werkstudent Buchhaltung", firma: "Zahlenhaus GmbH" },
  ];
  let halt = tor();
  const echt = globalThis.fetch, markt = stellenmarkt(echt, { treffer: () => liste, tor: () => halt.warten() });
  globalThis.fetch = markt.abruf;
  const optionen = { geokodierung: false, wurzel: dist, indeedClaude: { verfuegbar: false }, indeedCodex: { verfuegbar: false } };
  const lokal = erstelleServer({ ...optionen, datenordner: ordner, live: true }), aus = erstelleServer({ ...optionen, datenordner: ohneLive, live: false });
  await new Promise(r => lokal.listen(0, "127.0.0.1", r));
  await new Promise(r => aus.listen(0, "127.0.0.1", r));
  const basis = `http://127.0.0.1:${lokal.address().port}/`, basisAus = `http://127.0.0.1:${aus.address().port}/`;
  const posts = [], patches = [];
  try {
    const seite = await browser.newPage();
    beobachten(seite, "Lokaler Server");
    seite.on("dialog", d => d.accept());
    seite.on("request", r => { if (r.method() === "POST" && r.url().endsWith("/api/suche")) posts.push(JSON.parse(r.postData() || "{}")); if (r.method() === "PATCH") patches.push(r.url()); });
    await seite.setViewport({ width: 1440, height: 1000 });
    await seite.goto(basis + "offres", { waitUntil: "networkidle0" });
    await seite.waitForSelector(".jobsuche");
    console.log('Lokaler Browser: Suchleiste geladen.');
    const text = sel => seite.$eval(sel, e => e.textContent);
    assert.equal(await seite.$('script[src*="demo.js"]'), null, "lokal: keine Demo-Daten");
    assert((await seite.title()).includes("Lokaler Server"), "lokal: Seitentitel");
    assert.equal(await text("main h1"), "Jobs finden");
    const knopfSuche = ".jobsuche-leiste button[type=submit]";
    assert.equal(await text(knopfSuche), "Suchen", "Neue gemeinsame Suchleiste");
    assert.equal(await seite.$eval(knopfSuche, e => e.disabled), false, "Suchleiste bereit; erst ein ausdrücklicher Klick validiert und startet");
    assert.equal(posts.length,0,"kein Start beim Laden");
    await seite.click("#suchdetails>summary");
    await seite.click("[data-suchprofil]>summary");
    assert.equal(await text("[data-stand]"), "Noch keine gespeicherte Suche.");
    assert.equal(await text("[data-zusammenfassung]"), "21 von 21 Plattformen bei jeder Suche abgefragt", "eine Zusammenfassungszeile");
    assert.equal(await seite.$(".plattform-achtung"), null, "vor der ersten Suche keine Problemquelle erfunden");
    await seite.click(".plattform-auswahl > summary");
    assert.equal(await seite.$$eval(".plattform-chip", e => e.length), 21, "21 Plattform-Chips");
    assert(await seite.$$eval(".plattform-chip .chip-status", e => e.every(x => x.textContent === "nicht abgefragt")), "Zustand nicht abgefragt statt erfunden");
    // Ein Klick wählt ab und speichert sofort.
    await seite.click('.plattform-chip[data-platform="jobvector"] input');
    await seite.waitForFunction(() => document.querySelector(".plattform-meldung").textContent.includes("Auswahl gespeichert"));
    assert.equal(await text("[data-zusammenfassung]"), "20 von 21 Plattformen bei jeder Suche abgefragt");
    assert.equal(await seite.$eval('.plattform-chip[data-platform="jobvector"]', e => e.dataset.aktiv), "false");
    assert.equal(await seite.$eval('.plattform-chip[data-platform="jobvector"] .chip-status', e => e.textContent), "aus");
    // Suchbegriffe: Katalog vorgewählt, eine Pastille entfernen, bestätigen und speichern.
    const anzahl = Number(await seite.$eval("[data-anzahl]", e => e.dataset.anzahl));
    assert(anzahl > 20, "Katalog vorgewählt");
    await seite.click('[data-chip="Abschlussarbeit Informatik"] button');
    assert.equal(Number(await seite.$eval("[data-anzahl]", e => e.dataset.anzahl)), anzahl - 1);
    await seite.click("[data-aktion=stichwoerter-speichern]");
    await seite.waitForFunction(() => document.querySelector(".stichwoerter-meldung").textContent.startsWith("Gespeichert"));
    await seite.waitForFunction(s => !document.querySelector(s).disabled, {}, knopfSuche);
    assert.equal((await (await fetch(basis+"api/status")).json()).zustand.auftrag.keywordList.length,anzahl-1,"Liste am Server gespeichert");
    assert.equal(posts.length, 0, "Speichern startet keine Suche");

    // Suchstart: ein Aufruf mit Anbieter auto, Fortschritt sichtbar, Knopf gesperrt, kein zweiter Start.
    console.log('Lokaler Browser: Kriterien und Plattformwahl geprüft.');
    await seite.click(knopfSuche);
    await seite.waitForSelector("[data-fortschritt]");
    assert.equal(posts.length, 1, "genau ein Suchstart");
    assert.equal(posts[0].indeedProvider, "auto");
    assert.equal(posts[0].live, true);
    assert.equal(posts[0].quellen.includes("jobvector"), false, "abgewählte Plattform nicht gefragt");
    assert.equal(posts[0].keywordList.length, anzahl - 1);
    assert.equal(await seite.$eval(knopfSuche, e => e.disabled), true, "Knopf während der Suche gesperrt");
    assert(["Suchen","Suche läuft …"].includes(await text(knopfSuche)), "Knopf bleibt im neuen Design gesperrt; der Fortschritt steht daneben");
    assert(/Suche läuft: \d von 5 Durchläufen abgeschlossen/.test(await text("[data-fortschritt]")), "Fortschrittszeile");
    await seite.evaluate(s => document.querySelector(s).closest("form").requestSubmit(), knopfSuche);
    await warte(300);
    assert.equal(posts.length, 1, "ein erneutes Absenden startet keine zweite Suche");
    halt.oeffnen();
    console.log('Lokaler Browser: ein Suchstart bestätigt; synthetischer Markt freigegeben.');
    await seite.waitForSelector("[data-suchergebnis]", { timeout: 30000 });
    const ergebnis = await text("[data-suchergebnis]");
    for (const teil of ["2 neue Stellen aufgenommen", "von 5 Durchläufen", "2 davon noch vorzubereiten", "Nicht alles abgedeckt:", "Teilabdeckung, keine vollständige Marktabdeckung."]) assert(ergebnis.includes(teil), "Ergebnis: " + teil);
    assert(!/vollständig abgedeckt|alle Anzeigen gefunden/i.test(ergebnis), "nie als vollständig dargestellt");
    assert.equal(await seite.$eval(knopfSuche, e => e.disabled), false, "nach dem Ende wieder bereit");
    assert((await text("[data-stand]")).includes("5 von 5 Durchläufen"));
    // Nur Problemquellen hervorgehoben (blockiert, nur Link, Fehler); die abgewählte Plattform nicht.
    const probleme = await seite.$$eval("[data-problem]", e => e.map(x => x.dataset.problem));
    assert(probleme.includes("indeed") && probleme.includes("stepstone") && !probleme.includes("jobvector") && !probleme.includes("bundesagentur"), "Problemquellen: " + probleme.join(","));
    assert((await text(".plattform-achtung h3")).includes("Plattformen brauchen den Browser"));
    assert.equal(await seite.$eval('.plattform-chip[data-platform="bundesagentur"] .chip-status', e => e.dataset.state), "gelesen");
    assert(await seite.$eval("[data-vorzubereiten]", e => e.textContent.startsWith("2 davon noch vorzubereiten")));
    const bildLokal = process.argv.find(a => a.startsWith("--bild-lokal="))?.slice(13);
    if (bildLokal) await seite.screenshot({ path: path.resolve(bildLokal), fullPage: true });

    // Stellenübersicht mit den gefundenen Stellen; Archivieren mit „Kein IT-Bezug“ schließt die Firma aus.
    await seite.click('[data-suchergebnis] a[href="/suivi"]');
    await seite.waitForSelector(".stellenzeile");
    assert.deepEqual((await firmen(seite)).sort(), ["Nordwerk Systeme GmbH", "Südlicht Daten AG"], "gefundene IT-Stellen, Buchhaltung entfällt");
    assert(await seite.$$eval(".stellenzeile .plattformmarke", e => e.length === 2 && e.every(x => x.textContent === "Arbeitsagentur")), "jede Stelle nennt ihre Plattform");
    assert((await text("[data-datenquelle]")).includes("daten/zustand.json"));
    assert((await text(".kopf .privat")).includes("Lokaler Server"));
    await seite.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")].find(b => b.textContent.includes("Nordwerk")).click());
    await seite.waitForSelector(".detail");
    // Das Dossier ist jetzt eine echte lokale Seite, mit eigener API und gezielten Unterlagen.
    await seite.click('.detail a[href^="/dossier/"]');
    await seite.waitForSelector('.formularseite fieldset');
    assert(new URL(seite.url()).pathname.startsWith('/dossier/'));
    await seite.goBack({waitUntil:'networkidle0'});await seite.waitForSelector('.stellenzeile');
    await seite.evaluate(()=>[...document.querySelectorAll('.stellenzeile .firma')].find(b=>b.textContent.includes('Nordwerk')).click());await seite.waitForSelector('.detail');
    await seite.evaluate(() => [...document.querySelectorAll(".detail .statusaktionen button")].find(b => b.textContent.trim() === "Archiviert").click());
    await seite.waitForSelector(".archivdialog");
    assert.equal(await seite.$$eval(".archivwahl", e => e.length), 3);
    await seite.click('.archivdialog input[value="not-it"]');
    await seite.click(".archivdialog button[type=submit]");
    await seite.waitForSelector(".archivdialog", { hidden: true });
    await seite.waitForFunction(() => document.querySelector('[role=status].hinweis')?.textContent.includes("dauerhaft ausgeschlossen"));
    assert.equal(patches.length, 1, "Archiv über die lokale API gespeichert");
    assert.deepEqual(await firmen(seite), ["Südlicht Daten AG"]);
    await seite.reload({ waitUntil: "networkidle0" });
    await seite.waitForSelector(".stellenzeile");
    assert.deepEqual(await firmen(seite), ["Südlicht Daten AG"], "Ausschluss bleibt nach dem Neuladen (JSON-Zustand des Servers)");
    assert(await reiter(seite, "Archiviert"));
    await seite.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")].find(b => b.textContent.includes("Nordwerk")).click());
    await seite.waitForSelector(".detail .archivhinweis");
    assert((await text(".archivhinweis")).includes("Kein IT-Bezug · Firma dauerhaft ausgeschlossen"));
    await seite.keyboard.press("Escape");

    // Zweite Suche: eine neue Anzeige der ausgeschlossenen Firma (Namensvariante) wird nicht übernommen.
    liste = [{ ref: "BP-4", titel: "Werkstudent Data", firma: "Nordwerk Systeme GmbH & Co. KG" }, { ref: "BP-5", titel: "Werkstudent IT-Support", firma: "Westwind IT GmbH" }];
    await seite.$eval('nav a[href="/offres"]', n => n.click());
    await seite.waitForSelector("[data-suchergebnis]");
    await seite.click(knopfSuche);
    await seite.waitForFunction(() => document.querySelector("[data-suchergebnis][data-frisch]"), { timeout: 30000 });
    const zweites = await text("[data-suchergebnis]");
    assert(zweites.includes("1 neue Stelle aufgenommen") && zweites.includes("1 Treffer dauerhaft ausgeschlossener Firmen nicht übernommen"), zweites);
    assert.equal(posts.length, 2);
    await seite.goto(basis + "suivi", { waitUntil: "networkidle0" });
    await seite.waitForSelector(".stellenzeile");
    assert.deepEqual((await firmen(seite)).sort(), ["Südlicht Daten AG", "Westwind IT GmbH"], "keine neue Fiche der ausgeschlossenen Firma");

    // Antworten: ehrlicher Hinweis, kein erfundener Posteingang.
    await seite.$eval('nav a[href="/suivi#antworten"]', n => n.click());
    await seite.waitForSelector("[data-posteingang-fehlt]");
    assert.equal(await seite.$eval(".postbanner .knopf", e => e.disabled), true);

    // Französisch und Handy.
    await seite.goto(basis + "offres?lang=fr", { waitUntil: "networkidle0" });
    await seite.waitForSelector(".jobsuche");
    assert.equal(await text(knopfSuche), "Suchen", "Suchleiste des gemeinsamen Designs");
    await seite.click("#suchdetails>summary");
    assert((await text("[data-zusammenfassung]")).includes("20 plateformes sur 21"));
    await seite.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await seite.goto(basis + "offres", { waitUntil: "networkidle0" });
    await seite.waitForSelector(".jobsuche");
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "lokal: kein horizontaler Überlauf auf dem Handy");
    await seite.close();

    // Ohne JOBPILOT_LIVE=1: die Seite erklärt das Einschalten und startet nichts.
    const ohne = await browser.newPage();
    beobachten(ohne, "Lokaler Server ohne Live");
    let ohnePost = 0;
    ohne.on("request", r => { if (r.method() === "POST") ohnePost++; });
    await ohne.goto(basisAus + "offres", { waitUntil: "networkidle0" });
    await ohne.waitForSelector("[data-live-aus]");
    assert((await ohne.$eval("[data-live-aus]", e => e.textContent)).includes("JOBPILOT_LIVE=1"), "Anleitung zum Einschalten");
    assert.equal(await ohne.$eval(knopfSuche, e => e.disabled), true);
    assert.equal(ohnePost, 0);
    await ohne.close();
  } finally {
    halt.oeffnen();
    await lokal.suchlauf();
    globalThis.fetch = echt;
    lokal.closeAllConnections();aus.closeAllConnections();
    await new Promise(r => lokal.close(r));
    await new Promise(r => aus.close(r));
    fs.rmSync(ordner, { recursive: true, force: true });
    fs.rmSync(ohneLive, { recursive: true, force: true });
  }
  // Der Server hat nur gemockte Adressen erreicht; technisch gesperrte Quellen erhielten nie eine Anfrage.
  assert(!markt.extern.some(u => /indeed\.com|jobvector\.de|heyjobs\.co|stwgi\.de|nominatim/.test(u)), "keine Anfrage an gesperrte Quellen oder den Ortsdienst");
  assert(markt.extern.some(u => u.startsWith("https://rest.arbeitsagentur.de/")), "gemockte Arbeitsagentur gefragt");
  void fehler; void extern;
}

(async () => {
  let basis;
  if (urlArgument) basis = urlArgument.endsWith("/") ? urlArgument : urlArgument + "/";
  else { await new Promise(r => server.listen(0, "127.0.0.1", r)); basis = `http://127.0.0.1:${server.address().port}/JobPilot/`; }
  const erlaubterHost = new URL(basis).hostname;
  const browser = await puppeteer.launch({ executablePath: browserPfad, headless: true });
  const fehler = [], extern = [], apiAnfragen = [];
  const beobachten = (seite, name) => {
    seite.on("pageerror", e => fehler.push(`Seitenfehler (${name}): ` + e.message));
    seite.on("console", m => { if (m.type() === "error") fehler.push(`Konsole (${name}): ` + m.text()); });
    seite.on("request", r => { if (!r.url().startsWith("data:") && new URL(r.url()).hostname !== erlaubterHost) extern.push(r.url()); if (!r.url().startsWith("data:") && new URL(r.url()).pathname.includes("/api/")) apiAnfragen.push(name + ": " + r.method() + " " + r.url()); });
  };
  try {
    const seite = await browser.newPage();
    beobachten(seite, "Demo");
    seite.on("dialog", d => d.accept());
    await seite.setViewport({ width: 1512, height: 1000 });
    await seite.goto(basis, { waitUntil: "networkidle0" });
    await seite.waitForSelector(".stellenzeile");

    // Ausgangslage: sieben offene Stellen, eine je Firma; die Stelle ohne IT-Bezug ("Nur Informatik") fehlt.
    assert.equal(await zeilen(seite), 7, "sieben offene Stellen, eine je Firma");
    assert.equal(await seite.evaluate(() => document.documentElement.lang), "de", "Deutsch ist der Standard");
    const erste = await seite.$eval(".stellenzeile", e => e.textContent);
    assert(erste.includes("Morgenrot") && erste.includes("Neu"), "neue Stelle mit Marker");
    assert(erste.includes("3 km"), "Entfernung in der Ortszeile");
    assert((await seite.$eval(".kennzahlen", e => e.textContent)).includes("Heute 0 von 3"), "Tagesziel sichtbar");
    assert(!(await seite.$eval("main", e => e.textContent)).includes("Federkiel"), "Stelle ohne IT-Bezug wird nicht gezeigt");
    // Kennzahlen: Noch offen, beworben, positive Antworten, Absagen (je Unternehmen die zuletzt entscheidende Antwort)
    const kacheln = await seite.$$eval(".kennzahl", e => e.map(k => ({ titel: k.querySelector("span").textContent, wert: k.querySelector("strong").textContent, text: k.textContent })));
    assert.deepEqual(kacheln.map(k => [k.titel, k.wert]), [["Noch offen", "8"], ["Unternehmen beworben", "6"], ["Positive Antworten", "1"], ["Absagen", "3"]], "vier Kennzahlen mit erwarteten Werten");
    assert(kacheln[0].text.includes("von 15 Unternehmen im Blick") && kacheln[2].text.includes("2 Gespräche bisher, 1 später abgesagt") && kacheln[3].text.includes("1 Zuordnungen prüfen"), "Unterzeilen der Kennzahlen");
    if (bildArgument) { // höhere Aufnahme, damit Filterzeile und Stellenliste sichtbar sind
      await seite.setViewport({ width: 1512, height: 1480 });
      await seite.screenshot({ path: path.resolve(bildArgument) });
      await seite.setViewport({ width: 1512, height: 1000 });
    }

    // Filterzeile: Art, Entfernung, Sortierung, zweites Kriterium, Zurücksetzen
    assert(await seite.$(".filterzeile"), "Filterzeile vorhanden");
    assert(!(await knopf(seite, "Zurücksetzen", ".filterzeile")), "Zurücksetzen erst bei aktivem Filter");
    assert.equal(await seite.$$eval(".filterzeile .filtergruppe .auswahl button", e => e.map(x => x.textContent).join("|")), "Alle|Stellen|Initiativ", "Art: dreiteilige Auswahl");
    assert.equal(await seite.$$eval(".filterzeile select", e => e.map(x => x.getAttribute("aria-label")).join("|")), "Höchstentfernung von Gießen|Sortieren", "Zeile 2: Entfernung und ein Sortierfeld; Ergebnis nur bei Versandt oder Alle");
    assert(!(await seite.$('select[aria-label="Reihenfolge"], select[aria-label="Zweites Sortierkriterium"]')), "Reihenfolge und Danach entfallen");
    assert.deepEqual(await seite.$$eval('select[aria-label="Höchstentfernung von Gießen"] option', e => e.map(x => x.textContent)), ["Beliebig", "bis 25 km", "bis 50 km", "bis 100 km", "bis 150 km"], "Entfernung: Beliebig, 25, 50, 100, 150");
    await knopf(seite, "Initiativ");
    assert.equal(await zeilen(seite), 3, "Initiativ zeigt nur Initiativstellen");
    const initiativ = await seite.$$eval(".stellenzeile", e => e.map(x => [x.querySelector("strong").textContent, !!x.querySelector(".artmarke")]));
    assert(initiativ.every(([, marke]) => marke), "jede Initiativstelle trägt die Marke");
    assert.deepEqual(initiativ.map(x => x[0]).sort(), ["Lindenhof Softwarewerkstatt GmbH", "Rotbuche Cloudsysteme GmbH", "Sternwarte Datenhaus AG"]);
    assert.equal(await seite.$eval('.filtergruppe button[aria-pressed="true"]', e => e.textContent), "Initiativ");
    await knopf(seite, "Stellen");
    assert.equal(await zeilen(seite), 4, "nur konkrete Stellen");
    assert.equal(await seite.$eval('.filtergruppe button[aria-pressed="true"]', e => e.textContent), "Stellen", "die Auswahl ist einfach");
    await knopf(seite, "Alle");
    assert.equal(await zeilen(seite), 7, "Alle zeigt alles");
    assert(!(await knopf(seite, "Zurücksetzen", ".filterzeile")), "Alle ist kein aktiver Filter");
    await knopf(seite, "Stellen");
    assert.equal(await seite.$$eval(".artmarke", e => e.length), 0, "keine Initiativmarke bei Stellen");
    await zuruecksetzen(seite);
    assert.equal(await zeilen(seite), 7, "Zurücksetzen stellt alle Stellen wieder her");
    assert(!(await knopf(seite, "Zurücksetzen", ".filterzeile")), "Zurücksetzen verschwindet nach dem Zurücksetzen");

    await auswahl(seite, "Sortieren", "weit");
    assert.deepEqual((await firmen(seite)).slice(0, 3), ["Sternwarte Datenhaus AG", "Rotbuche Cloudsysteme GmbH", "Flusswerk Daten AG"], "Weiteste zuerst");
    assert.equal((await firmen(seite)).at(-1), "Taktgeber Prozesse", "ohne bekannte Entfernung steht am Ende");
    assert((await seite.$eval(".listeninfo", e => e.textContent)).includes("1 ohne bekannte Entfernung"), "Hinweis auf fehlende Entfernung");
    await auswahl(seite, "Sortieren", "nah");
    assert.deepEqual((await firmen(seite)).slice(0, 3), ["Morgenrot Digital GmbH", "Lindenhof Softwarewerkstatt GmbH", "Bergtal Automation"], "Nächste zuerst; bei gleicher Entfernung (17 km) entscheidet die bessere Passung");
    assert.equal((await firmen(seite)).at(-1), "Taktgeber Prozesse", "auch aufsteigend am Ende");
    await zuruecksetzen(seite);

    await auswahl(seite, "Höchstentfernung von Gießen", "25");
    assert.deepEqual((await firmen(seite)).sort(), ["Bergtal Automation", "Lindenhof Softwarewerkstatt GmbH", "Morgenrot Digital GmbH"], "bis 25 km");
    await zuruecksetzen(seite);

    // Versandte Bewerbungen: Ergebnis (je Unternehmen die zuletzt entscheidende Antwort) und Bewerbungsdatum
    assert(await reiter(seite, "Versandt"), "Reiter Versandt");
    assert(await seite.$('select[aria-label="Ergebnis der Bewerbung"]'), "Ergebnis im Reiter Versandt sichtbar");
    assert(await reiter(seite, "Alle") && await seite.$('select[aria-label="Ergebnis der Bewerbung"]'), "Ergebnis im Reiter Alle sichtbar");
    assert(await reiter(seite, "Ungeklärt") && !(await seite.$('select[aria-label="Ergebnis der Bewerbung"]')), "Ergebnis in anderen Reitern nicht sichtbar");
    assert(await reiter(seite, "Versandt"), "Reiter Versandt");
    assert.deepEqual(await firmen(seite), ["Nordlicht Software GmbH", "Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Waldkante Software", "Quellwerk Systeme GmbH", "Silberdistel IT-Service"], "versandte Bewerbungen nach Passung");
    const marken = await seite.$$eval(".stellenzeile", e => Object.fromEntries(e.map(x => [x.querySelector(".firma strong").textContent.split(" ")[0], x.querySelectorAll(".antwortmarke").length + ":" + (x.querySelector(".antwortmarke")?.textContent || "") + "|" + (x.querySelector(".versanddatum")?.textContent || "")])));
    assert.deepEqual(Object.fromEntries(Object.entries(marken).map(([k, v]) => [k, v.split("|")[0]])), { Nordlicht: "1:Positiv", Eisvogel: "1:Absage", Blaupunkt: "1:Absage", Waldkante: "0:", Quellwerk: "1:Absage", Silberdistel: "1:Eingang bestätigt" }, "genau eine kleine Marke je Fiche: Ergebnis bei Absage und Positiv, sonst die letzte Antwort");
    assert(/^am \d\d\.\d\d\.\d{4}$/.test(marken.Nordlicht.split("|")[1]), "Bewerbungsdatum am TT.MM.JJJJ");
    assert.equal(marken.Waldkante.split("|")[1], "Datum unbekannt", "fehlendes Datum wird benannt");
    assert.equal(await seite.$$eval(".stellenzeile .status + .versanddatum", e => e.length), 6, "jede versandte Fiche zeigt ein Datum");
    await auswahl(seite, "Ergebnis der Bewerbung", "absage");
    assert.deepEqual(await firmen(seite), ["Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Quellwerk Systeme GmbH"], "Ergebnis Absage (auch nach früherer Einladung)");
    await auswahl(seite, "Ergebnis der Bewerbung", "positiv");
    assert.deepEqual(await firmen(seite), ["Nordlicht Software GmbH"], "Ergebnis Positiv");
    await auswahl(seite, "Ergebnis der Bewerbung", "wartet");
    assert.deepEqual(await firmen(seite), ["Waldkante Software", "Silberdistel IT-Service"], "Ergebnis Wartet auf Antwort");
    await auswahl(seite, "Ergebnis der Bewerbung", "alle");
    await auswahl(seite, "Sortieren", "neu");
    assert.deepEqual(await firmen(seite), ["Silberdistel IT-Service", "Nordlicht Software GmbH", "Quellwerk Systeme GmbH", "Blaupunkt Weblabor", "Eisvogel Datensysteme GmbH", "Waldkante Software"], "Zuletzt beworben zuerst, ohne Datum am Ende");
    await auswahl(seite, "Sortieren", "alt");
    assert.deepEqual(await firmen(seite), ["Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Quellwerk Systeme GmbH", "Nordlicht Software GmbH", "Silberdistel IT-Service", "Waldkante Software"], "Zuerst beworben zuerst, ohne Datum am Ende");
    await auswahl(seite, "Ergebnis der Bewerbung", "absage");
    assert.deepEqual(await firmen(seite), ["Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Quellwerk Systeme GmbH"], "Datumssortierung kombiniert mit Ergebnis");
    await zuruecksetzen(seite);
    assert.equal(await seite.$eval('select[aria-label="Ergebnis der Bewerbung"]', e => e.value), "alle", "Zurücksetzen setzt auch das Ergebnis zurück");
    assert.equal(await zeilen(seite), 6, "Zurücksetzen zeigt wieder alle versandten Bewerbungen");
    assert(await reiter(seite, "Vorbereiten"), "Reiter Vorbereiten");

    // Fiche: Assistent gesperrt, Unterlagen im Browser ansehen
    await seite.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")].find(b => b.textContent.includes("Lindenhof")).click());
    await seite.waitForSelector("[role=dialog]");
    const detail = await seite.$eval(".detail", e => e.textContent);
    assert(detail.includes("Warum diese Stelle?"), "Gründe der Passung");
    assert.equal(await seite.$eval('[data-demo-gesperrt="assistent-tab"]', e => e.getAttribute("aria-disabled")), "true", "Assistent (neuer Tab) gesperrt");
    assert(await seite.$eval('[data-demo-gesperrt="assistent-tab"]', e => e.textContent.includes("Mit Assistent öffnen (neuer Tab)") && !e.hasAttribute("href")), "Beschriftung wie im Original, ohne Ziel");
    assert(await seite.$eval('[data-demo-gesperrt="assistent-fenster"]', e => e.disabled && e.textContent.includes("Eigenes Assistentfenster (getrenntes Profil)")), "Eigenes Assistentfenster gesperrt");
    assert(detail.includes("füllt nichts aus"), "ehrlicher Hinweis, dass die Demo nichts ausfüllt");
    const dokumente = await seite.$$eval(".dokumente a", e => e.map(a => ({ href: a.getAttribute("href"), download: a.hasAttribute("download"), ziel: a.target })));
    assert.equal(dokumente.length, 2, "Lebenslauf und Anschreiben");
    assert(dokumente.every(d => !d.download && d.href.endsWith("?ansehen=1") && d.ziel === "_blank"), "Dokumente zum Ansehen, ohne download-Attribut");
    await seite.evaluate(() => { window.__geoeffnet = []; window.open = (...a) => { window.__geoeffnet.push(a); return null; }; });
    await seite.click(".dokumente a");
    const geoeffnet = await seite.evaluate(() => window.__geoeffnet);
    assert.equal(geoeffnet.length, 1, "Dokument öffnet sich als neuer Tab");
    assert(geoeffnet[0][0].endsWith("beispiel/lebenslauf-beispiel.pdf"), "erfundenes Beispieldokument");
    const kopf = await seite.evaluate(async u => { const r = await fetch(u); return [r.headers.get("content-type"), r.headers.get("content-disposition")]; }, geoeffnet[0][0]);
    assert.equal(kopf[0], "application/pdf", "PDF mit passendem Content-Type");
    assert(!/attachment/i.test(kopf[1] || ""), "kein Content-Disposition: attachment");
    await seite.keyboard.press("Escape");
    await seite.waitForSelector("[role=dialog]", { hidden: true });

    await seite.click(".firma");
    await seite.waitForSelector("[role=dialog]");
    assert((await seite.$eval(".detail", e => e.textContent)).includes("Warum diese Stelle?"), "Gründe der Passung");
    await seite.keyboard.press("Escape");
    await seite.waitForSelector("[role=dialog]", { hidden: true });

    assert.equal(await seite.$eval(".listeninfo .mehr", e => e.open), false, "Mehr ist eingeklappt");
    await seite.click(".mehr summary");
    assert.equal(await seite.$eval(".listeninfo .mehr", e => e.open), true, "Mehr lässt sich aufklappen");
    await seite.click(".mehrinhalt input");
    assert((await seite.$eval(".mehr summary", e => e.textContent)).includes("aktiv"), "Mehr nennt den aktiven Zustand");
    assert((await seite.$eval(".listeninfo", e => e.textContent)).includes("2 archivierte Zweitstellen einblenden"), "Zweitstellen benannt");
    assert.equal(await zeilen(seite), 7, "Zweitstellen bleiben ausgeblendet");
    assert(!(await seite.$eval("main", e => e.textContent)).includes("Federkiel"), "Stelle ohne IT-Bezug auch bei allen Einträgen verborgen");
    await seite.click(".mehrinhalt label:nth-of-type(2) input");
    assert.equal(await zeilen(seite), 8, "Zweitstelle einer beworbenen Firma sichtbar auf Wunsch");
    await seite.click(".mehrinhalt label:nth-of-type(2) input");
    await seite.click(".mehrinhalt input");
    await seite.click(".mehr summary");

    // Status pflegen: Morgenrot als versandt markieren
    await seite.click(".firma");
    await seite.waitForSelector("[role=dialog]");
    await seite.evaluate(() => [...document.querySelectorAll(".detail button")].find(b => b.textContent.trim() === "Versandt")?.click());
    await warte(400);
    await seite.keyboard.press("Escape");
    assert.equal(await zeilen(seite), 6, "nach dem Markieren bleiben sechs offene Stellen");

    // Antworten
    await seite.$eval('nav a[href="/suivi#antworten"]', n => n.click());
    await seite.waitForSelector(".antwortzeile");
    assert.equal((await seite.$$(".antwortzeile")).length, 9, "neun Nachrichten");
    const antwortText = await seite.$eval("main", e => e.textContent);
    assert(antwortText.includes("Gespräch") && antwortText.includes("Nur über Portal"), "Gespräch und Portalhinweis erkannt");
    assert.deepEqual(await seite.$$eval(".antwortzeile .antwortmarke", e => e.map(x => x.textContent).sort()), ["Absage", "Absage", "Absage", "Eingang bestätigt", "Eingang bestätigt", "Gespräch", "Gespräch", "Neue Antwort", "Nur über Portal"], "Arten der Antworten");
    assert.deepEqual(await seite.$$eval(".kennzahl strong", e => e.map(x => x.textContent)), ["7", "7", "1", "3"], "Portalhinweis zählt nicht; Morgenrot ist jetzt beworben");

    // Suchseite mit fiktiven Daten, ohne echte Quellen aufzurufen.
    await seite.$eval('nav a[href="/offres"]', n => n.click());
    await warte(300);
    assert.equal(await seite.$eval('h1',e=>e.textContent),'Jobs finden');
    assert(await seite.$('.jobsuche-demo'),'Fiktive Suchseite ist deutlich markiert');
    assert(seite.url().startsWith(basis), "keine Navigation zu einer nicht vorhandenen Seite");
    assert(!(await seite.$(".suche-hero")) && !(await seite.$('meta[name="jobpilot-modus"]')), "statische Demo: keine Suchseite, kein Suchknopf");

    // Französisch: Umschalter ohne Neuladen, danach direkter Aufruf mit ?lang=fr
    await seite.$eval('nav a[href="/suivi"]', n => n.click());
    await warte(200);
    await knopf(seite, "FR", ".sprachwahl");
    await warte(150);
    assert.equal(await seite.evaluate(() => document.documentElement.lang), "fr", "Umschalter setzt Französisch");
    assert.equal(new URL(seite.url()).searchParams.get("lang"), "fr", "?lang=fr in der Adresse");
    const franzoesisch = await seite.$eval("body", e => e.textContent);
    for (const wort of ["Spontanées", "Offres", "Trier", "Plus", "Encore ouvertes", "Réponses positives", "Refus", "entretiens jusqu'ici", "Démo publique", "Réponses"]) assert(franzoesisch.includes(wort), "französisch: " + wort);
    assert(await seite.$('select[aria-label="Distance maximale depuis Gießen"]'), "französische Bezeichnung der Höchstentfernung");
    for (const wort of ["Weniger suchen", "Sortieren", "Reihenfolge", "Danach", "Mehr", "Alle Einträge zeigen", "Pro Unternehmen", "Unternehmen im Blick", "Positive Antworten", "Absagen"]) assert(!franzoesisch.includes(wort), "kein deutscher Rest: " + wort);
    await knopf(seite, "Spontanées");
    assert.equal(await zeilen(seite), 3, "Filter wirkt auch auf Französisch");
    assert.deepEqual(await seite.$$eval(".artmarke", e => e.map(x => x.textContent)), ["Spontanée", "Spontanée", "Spontanée"], "Marke Spontanée");
    assert(await knopf(seite, "Réinitialiser", ".filterzeile"), "Réinitialiser");
    assert((await seite.$$eval(".kennzahl", e => e[2].textContent)).includes("2 entretiens jusqu'ici, 1 refus ensuite"), "Kachel Réponses positives auf Französisch");
    assert(await reiter(seite, "Envoyée"), "Reiter Envoyée");
    await auswahl(seite, "Résultat de la candidature", "absage");
    assert.equal(await zeilen(seite), 3, "Ergebnisfilter auf Französisch");
    assert.deepEqual(await seite.$$eval(".stellenzeile .antwortmarke", e => e.map(x => x.textContent)), ["Refus", "Refus", "Refus"], "Marke Refus");
    await auswahl(seite, "Résultat de la candidature", "alle");
    await auswahl(seite, "Trier", "neu");
    assert((await seite.$eval(".listeninfo", e => e.textContent)) && (await seite.$$eval(".versanddatum", e => e.some(x => /^le \d\d\/\d\d\/\d{4}$/.test(x.textContent)) && e.some(x => x.textContent === "Date inconnue"))), "Bewerbungsdatum auf Französisch");
    assert.equal(await seite.$eval('select[aria-label="Trier"] option[value="neu"]', e => e.textContent), "Candidature la plus récente d'abord", "Sortierung nach Datum auf Französisch");
    assert.equal(await seite.$eval(".mehr summary", e => e.textContent), "Plus", "Mehr auf Französisch");
    assert(await knopf(seite, "Réinitialiser", ".filterzeile"), "Réinitialiser");
    assert(await reiter(seite, "À préparer"), "Reiter À préparer");
    await seite.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")][0].click());
    await seite.waitForSelector("[role=dialog]");
    const franzDetail = await seite.$eval(".detail", e => e.textContent);
    assert(franzDetail.includes("bloqués") && franzDetail.includes("Ouvrir avec l'assistant (nouvel onglet)"), "Assistent auf Französisch gesperrt");
    await seite.keyboard.press("Escape");
    await knopf(seite, "DE", ".sprachwahl");
    await warte(150);
    assert.equal(await seite.evaluate(() => document.documentElement.lang), "de", "Zurück auf Deutsch");
    assert(!new URL(seite.url()).searchParams.has("lang"), "?lang entfernt");

    const fr = await browser.newPage();
    beobachten(fr, "fr");
    await fr.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await fr.goto(basis + "?lang=fr", { waitUntil: "networkidle0" });
    await fr.waitForSelector(".stellenzeile");
    assert.equal(await fr.evaluate(() => document.documentElement.lang), "fr", "?lang=fr startet auf Französisch");
    assert((await fr.title()).includes("Démo publique"), "Titel auf Französisch");
    assert((await fr.$eval("main", e => e.textContent)).includes("Moins chercher"), "Überschrift auf Französisch");
    assert(!(await fr.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein horizontaler Überlauf auf dem Handy (fr)");
    await fr.close();

    // Handy
    await seite.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await seite.$eval('nav a[href="/suivi"]', n => n.click());
    await warte(300);
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein horizontaler Überlauf auf dem Handy");
    await knopf(seite, "Initiativ");
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein Überlauf mit Filterzeile");
    await zuruecksetzen(seite);
    assert(await reiter(seite, "Versandt"), "Reiter Versandt (Handy)");
    await auswahl(seite, "Ergebnis der Bewerbung", "absage");
    await auswahl(seite, "Sortieren", "neu");
    assert.equal(await zeilen(seite), 3, "Ergebnisfilter auf dem Handy");
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein Überlauf mit Ergebnis und Datum");

    // Übungsformular: derselbe Feldmotor wie in der Erweiterung, erfundenes Profil, kein Versand
    const formular = await browser.newPage();
    beobachten(formular, "Formular");
    await formular.goto(basis + "formular/", { waitUntil: "networkidle0" });
    const wert = n => formular.$eval(`[name="${n}"]`, e => e.value);
    await formular.click("#lauf1");
    await formular.waitForFunction(() => /Felder ausgefüllt/.test(document.getElementById("status").textContent));
    assert.equal(await wert("fullName"), "Alex Beispiel", "Vor- & Nachname wird als Namensfeld erkannt und vollständig gefüllt");
    assert.equal(await wert("firstName"), "Alex");
    assert.equal(await wert("geburtstag"), "14.03.2001", "Geburtstag (TT.MM.JJJJ) wird als Geburtsdatum im verlangten Format gefüllt");
    assert.equal(await wert("bundesland"), "Hessen", "Bundesland wird aus der Auswahlliste gewählt");
    assert.equal(await wert("kontrolle"), "", "Köderfeld bleibt leer");
    assert.equal(await wert("geworben"), "Keine Empfehlung", "Empfehlung ohne Angabe: Keine Empfehlung");
    const status1 = await formular.$eval("#status", e => e.textContent);
    assert(!/Bitte lasse dieses Feld leer/.test(status1), "Köderfeld wird nie als offene Frage gezeigt");
    assert(/Offene Fragen: .*gehört/.test(status1), "unbekannte Quelle wird gefragt");
    await formular.click("#lauf2");
    await formular.waitForFunction(() => /gemerkt/.test(document.getElementById("status").textContent));
    assert.equal(await wert("quelle"), "StepStone", "gemerkte Antwort wird eingesetzt");
    await formular.click("#lauf3");
    await formular.waitForFunction(() => /Angehängt/.test(document.getElementById("status").textContent), { timeout: 10000 });
    const dateien = await formular.$eval('[name="unterlagen"]', e => [...e.files].map(f => f.name));
    assert.deepEqual(dateien, ["Lebenslauf_Alex_Beispiel.pdf", "Anschreiben_Alex_Beispiel.pdf"], "gemeinsames Dokumentenfeld erhält beide PDF");
    assert.equal(await wert("kontrolle"), "", "Köderfeld bleibt auch nach dem Anhängen leer");
    assert(!(await formular.$("form [type=submit], form button")), "Übungsformular hat keine Absenden-Schaltfläche");
    // Allgemeines Dateifeld ohne passende Beschriftung ("Datei") und Ablagefeld ohne Dateifeld
    await formular.click('[data-variante="datei"]');
    await formular.waitForFunction(() => /gewählt/.test(document.getElementById("status").textContent));
    await formular.click("#lauf3");
    await formular.waitForFunction(() => /Angehängt/.test(document.getElementById("status").textContent), { timeout: 10000 });
    assert.deepEqual(await formular.$eval('[name="datei"]', e => [...e.files].map(f => f.name)), ["Lebenslauf_Alex_Beispiel.pdf", "Anschreiben_Alex_Beispiel.pdf"], "allgemeines Feld Datei nimmt beide PDF");
    await formular.click('[data-variante="ablage"]');
    await formular.waitForFunction(() => /gewählt/.test(document.getElementById("status").textContent));
    assert(!(await formular.$('input[type=file]')), "Ablagefeld ohne Dateifeld");
    await formular.click("#lauf3");
    await formular.waitForFunction(() => /Angehängt/.test(document.getElementById("status").textContent), { timeout: 10000 });
    const abgelegt = await formular.$eval("#abgelegt", e => e.textContent);
    assert(abgelegt.includes("Lebenslauf_Alex_Beispiel.pdf") && abgelegt.includes("Anschreiben_Alex_Beispiel.pdf"), "Ablagefeld erhält beide PDF per Ziehen und Ablegen");
    await formular.close();

    // Archivieren in der statischen Demo: drei Gründe, „Kein IT-Bezug“ blendet die Firma aus, alles nur in diesem Fenster.
    const archiv = await browser.newPage();
    beobachten(archiv, "Archiv (Demo)");
    await archiv.setViewport({ width: 1440, height: 1000 });
    await archiv.goto(basis, { waitUntil: "networkidle0" });
    await archiv.waitForSelector(".stellenzeile");
    await archiv.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")].find(b => b.textContent.includes("Bergtal")).click());
    await archiv.waitForSelector(".detail");
    await archiv.evaluate(() => [...document.querySelectorAll(".detail .statusaktionen button")].find(b => b.textContent.trim() === "Archiviert").click());
    await archiv.waitForSelector(".archivdialog");
    assert.deepEqual(await archiv.$$eval(".archivwahl", e => e.map(x => x.textContent)), ["Angebot nicht verfügbar", "Kein IT-Bezug", "Sonstiges"], "Demo: genau drei Gründe");
    assert.equal(await archiv.$eval(".archivdialog button[type=submit]", e => e.disabled), true, "Demo: ohne Grund kein Archivieren");
    await archiv.click('.archivdialog input[value="not-it"]');
    assert((await archiv.$eval("[data-archivfolge]", e => e.textContent)).includes("dauerhaft ausgeschlossen"), "Demo: Folge des Grundes genannt");
    await archiv.click(".archivdialog button[type=submit]");
    await archiv.waitForSelector(".archivdialog", { hidden: true });
    assert(!(await firmen(archiv)).includes("Bergtal Automation"), "Demo: ausgeschlossene Firma verschwindet aus den offenen Stellen");
    assert(await reiter(archiv, "Archiviert"));
    assert((await firmen(archiv)).includes("Bergtal Automation"), "Demo: Eintrag bleibt im Archiv");
    await archiv.evaluate(() => [...document.querySelectorAll(".stellenzeile .firma")].find(b => b.textContent.includes("Bergtal")).click());
    await archiv.waitForSelector(".detail .archivhinweis");
    assert((await archiv.$eval(".archivhinweis", e => e.textContent)).includes("Kein IT-Bezug · Firma dauerhaft ausgeschlossen"), "Demo: Archivgrund in der Fiche");
    assert(await archiv.$$eval(".detail .statusaktionen button", e => e.every(b => b.disabled)), "Demo: Status der ausgeschlossenen Firma gesperrt");
    await archiv.reload({ waitUntil: "networkidle0" });
    await archiv.waitForSelector(".stellenzeile");
    assert((await firmen(archiv)).includes("Bergtal Automation"), "Demo: Neuladen setzt die erfundenen Daten zurück");
    await archiv.close();
    assert.deepEqual(apiAnfragen, [], "Demo: keine Anfrage an eine Server-API, alles bleibt im Browser");

    if (!urlArgument) await lokalPruefen(browser, beobachten, fehler, extern);
  } finally { await browser.close(); beenden(); }
  assert.deepEqual(fehler, [], "keine Laufzeitfehler");
  assert.deepEqual(extern, [], "keine externen Anfragen");
  console.log("Browserprüfung der Demo bestanden: Stellenübersicht, Filter (Art, Entfernung, ein Sortierfeld, Mehr, Zurücksetzen), Nur Informatik, Ergebnisfilter und Bewerbungsdatum, Fiche mit gesperrtem Assistenten, Unterlagen zum Ansehen, Zweitstellen, Status, Antworten, Hinweis, Französisch, Übungsformular (gemeinsames Feld, Datei, Ablagefeld), Handy, Archivieren mit drei Gründen nur im Browser; keine Fehler, keine externen Anfragen, keine Server-API.");
  if (!urlArgument) console.log("Browserprüfung am lokalen Server bestanden: Stellensuche mit Knopf (ein Suchstart, Anbieter auto, Fortschritt, Teilabdeckung), Suchbegriffe, Plattform-Chips mit Abwahl, Ergebnis in der Stellenübersicht, Archivieren mit Kein IT-Bezug schließt die Firma bei der nächsten Suche aus, Neuladen, Französisch, Handy, Hinweis ohne JOBPILOT_LIVE=1; ausgehende Anfragen gemockt.");
})().catch(e => { console.error(e); process.exitCode = 1; beenden(); });
