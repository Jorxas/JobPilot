// Browserprüfung der gebauten Demo (npm run build vorher). Benötigt installierten Chrome oder Edge (BROWSER_PFAD).
// Die Demo wird wie auf GitHub Pages unter dem Pfad /JobPilot/ ausgeliefert. Es werden keine externen Anfragen erlaubt.
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

(async () => {
  let basis;
  if (urlArgument) basis = urlArgument.endsWith("/") ? urlArgument : urlArgument + "/";
  else { await new Promise(r => server.listen(0, "127.0.0.1", r)); basis = `http://127.0.0.1:${server.address().port}/JobPilot/`; }
  const erlaubterHost = new URL(basis).hostname;
  const browser = await puppeteer.launch({ executablePath: browserPfad, headless: true });
  const fehler = [], extern = [];
  const beobachten = (seite, name) => {
    seite.on("pageerror", e => fehler.push(`Seitenfehler (${name}): ` + e.message));
    seite.on("console", m => { if (m.type() === "error") fehler.push(`Konsole (${name}): ` + m.text()); });
    seite.on("request", r => { if (!r.url().startsWith("data:") && new URL(r.url()).hostname !== erlaubterHost) extern.push(r.url()); });
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
    await knopf(seite, "Initiativbewerbung");
    assert.equal(await zeilen(seite), 3, "Initiativbewerbung zeigt nur Initiativstellen");
    const initiativ = await seite.$$eval(".stellenzeile", e => e.map(x => [x.querySelector("strong").textContent, !!x.querySelector(".artmarke")]));
    assert(initiativ.every(([, marke]) => marke), "jede Initiativstelle trägt die Marke");
    assert.deepEqual(initiativ.map(x => x[0]).sort(), ["Lindenhof Softwarewerkstatt GmbH", "Rotbuche Cloudsysteme GmbH", "Sternwarte Datenhaus AG"]);
    assert.equal(await seite.$eval('.filtergruppe button[aria-pressed="true"]', e => e.textContent), "Initiativbewerbung");
    await knopf(seite, "Echte Bewerbung");
    assert.equal(await zeilen(seite), 7, "beide Schalter zusammen zeigen alles");
    await knopf(seite, "Initiativbewerbung");
    assert.equal(await zeilen(seite), 4, "nur echte Bewerbungen");
    assert.equal(await seite.$$eval(".artmarke", e => e.length), 0, "keine Initiativmarke bei echten Bewerbungen");
    await zuruecksetzen(seite);
    assert.equal(await zeilen(seite), 7, "Zurücksetzen stellt alle Stellen wieder her");
    assert(!(await knopf(seite, "Zurücksetzen", ".filterzeile")), "Zurücksetzen verschwindet nach dem Zurücksetzen");

    await auswahl(seite, "Sortieren nach", "distanz");
    assert.deepEqual((await firmen(seite)).slice(0, 3), ["Sternwarte Datenhaus AG", "Rotbuche Cloudsysteme GmbH", "Flusswerk Daten AG"], "Entfernung: am weitesten zuerst");
    assert.equal((await firmen(seite)).at(-1), "Taktgeber Prozesse", "ohne bekannte Entfernung steht am Ende");
    assert((await seite.$eval(".listeninfo", e => e.textContent)).includes("1 ohne bekannte Entfernung"), "Hinweis auf fehlende Entfernung");
    await auswahl(seite, "Reihenfolge", "auf");
    assert.deepEqual((await firmen(seite)).slice(0, 3), ["Morgenrot Digital GmbH", "Lindenhof Softwarewerkstatt GmbH", "Bergtal Automation"], "Entfernung: am nächsten zuerst");
    assert.equal((await firmen(seite)).at(-1), "Taktgeber Prozesse", "auch aufsteigend am Ende");
    await zuruecksetzen(seite);

    // Zweites Kriterium: bei gleicher Passung (66 %) entscheidet die Entfernung
    assert.deepEqual((await firmen(seite)).slice(1, 3), ["Flusswerk Daten AG", "Lindenhof Softwarewerkstatt GmbH"], "gleiche Passung: Ausgangsreihenfolge");
    await auswahl(seite, "Zweites Sortierkriterium", "distanz");
    assert.deepEqual((await firmen(seite)).slice(1, 3), ["Lindenhof Softwarewerkstatt GmbH", "Flusswerk Daten AG"], "Danach: Entfernung, nächste zuerst");
    await auswahl(seite, "Reihenfolge", "auf");
    assert.equal((await firmen(seite))[0], "Taktgeber Prozesse", "schwächste Passung zuerst");
    await zuruecksetzen(seite);

    await auswahl(seite, "Höchstentfernung von Gießen", "25");
    assert.deepEqual((await firmen(seite)).sort(), ["Bergtal Automation", "Lindenhof Softwarewerkstatt GmbH", "Morgenrot Digital GmbH"], "bis 25 km");
    await zuruecksetzen(seite);

    // Versandte Bewerbungen: Ergebnis (je Unternehmen die zuletzt entscheidende Antwort) und Bewerbungsdatum
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
    await auswahl(seite, "Sortieren nach", "datum");
    assert.deepEqual(await firmen(seite), ["Silberdistel IT-Service", "Nordlicht Software GmbH", "Quellwerk Systeme GmbH", "Blaupunkt Weblabor", "Eisvogel Datensysteme GmbH", "Waldkante Software"], "Zuletzt beworben zuerst, ohne Datum am Ende");
    await auswahl(seite, "Reihenfolge", "auf");
    assert.deepEqual(await firmen(seite), ["Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Quellwerk Systeme GmbH", "Nordlicht Software GmbH", "Silberdistel IT-Service", "Waldkante Software"], "Zuerst beworben zuerst, ohne Datum am Ende");
    await auswahl(seite, "Ergebnis der Bewerbung", "absage");
    assert.deepEqual(await firmen(seite), ["Eisvogel Datensysteme GmbH", "Blaupunkt Weblabor", "Quellwerk Systeme GmbH"], "Datumssortierung kombiniert mit Ergebnis");
    await zuruecksetzen(seite);
    assert.equal(await seite.$eval('select[aria-label="Ergebnis der Bewerbung"]', e => e.value), "alle", "Zurücksetzen setzt auch das Ergebnis zurück");
    assert.equal(await zeilen(seite), 6, "Zurücksetzen zeigt wieder alle versandten Bewerbungen");
    await auswahl(seite, "Sortieren nach", "distanz");
    assert(await seite.$('select[aria-label="Zweites Sortierkriterium"] option[value="datum"]'), "Bewerbungsdatum auch als Danach");
    await auswahl(seite, "Zweites Sortierkriterium", "datum");
    await zuruecksetzen(seite);
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

    await seite.click(".listeninfo input");
    assert((await seite.$eval(".listeninfo", e => e.textContent)).includes("2 archivierte Zweitstellen einblenden"), "Zweitstellen benannt");
    assert.equal(await zeilen(seite), 7, "Zweitstellen bleiben ausgeblendet");
    assert(!(await seite.$eval("main", e => e.textContent)).includes("Federkiel"), "Stelle ohne IT-Bezug auch bei allen Einträgen verborgen");
    await seite.click(".listeninfo label:nth-of-type(2) input");
    assert.equal(await zeilen(seite), 8, "Zweitstelle einer beworbenen Firma sichtbar auf Wunsch");
    await seite.click(".listeninfo label:nth-of-type(2) input");
    await seite.click(".listeninfo input");

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

    // Nicht enthaltene Seite: Hinweis statt Ersatzseite
    await seite.$eval('nav a[href="/offres"]', n => n.click());
    await warte(300);
    assert((await seite.$eval("[data-demo-hinweis]", e => e.textContent)).includes("lokalen JobPilot"), "Hinweis statt Ersatzseite");
    assert(seite.url().startsWith(basis), "keine Navigation zu einer nicht vorhandenen Seite");

    // Französisch: Umschalter ohne Neuladen, danach direkter Aufruf mit ?lang=fr
    await seite.$eval('nav a[href="/suivi"]', n => n.click());
    await warte(200);
    await knopf(seite, "FR", ".sprachwahl");
    await warte(150);
    assert.equal(await seite.evaluate(() => document.documentElement.lang), "fr", "Umschalter setzt Französisch");
    assert.equal(new URL(seite.url()).searchParams.get("lang"), "fr", "?lang=fr in der Adresse");
    const franzoesisch = await seite.$eval("body", e => e.textContent);
    for (const wort of ["Candidature spontanée", "Trier par", "Ordre", "Ensuite", "Encore ouvertes", "Réponses positives", "Refus", "entretiens jusqu'ici", "Démo publique", "Réponses"]) assert(franzoesisch.includes(wort), "französisch: " + wort);
    assert(await seite.$('select[aria-label="Distance maximale depuis Gießen"]'), "französische Bezeichnung der Höchstentfernung");
    for (const wort of ["Weniger suchen", "Sortieren nach", "Alle Einträge zeigen", "Pro Unternehmen", "Unternehmen im Blick", "Positive Antworten", "Absagen"]) assert(!franzoesisch.includes(wort), "kein deutscher Rest: " + wort);
    await knopf(seite, "Candidature spontanée");
    assert.equal(await zeilen(seite), 3, "Filter wirkt auch auf Französisch");
    assert.deepEqual(await seite.$$eval(".artmarke", e => e.map(x => x.textContent)), ["Spontanée", "Spontanée", "Spontanée"], "Marke Spontanée");
    assert(await knopf(seite, "Réinitialiser", ".filterzeile"), "Réinitialiser");
    assert((await seite.$$eval(".kennzahl", e => e[2].textContent)).includes("2 entretiens jusqu'ici, 1 refus ensuite"), "Kachel Réponses positives auf Französisch");
    assert(await reiter(seite, "Envoyée"), "Reiter Envoyée");
    await auswahl(seite, "Résultat de la candidature", "absage");
    assert.equal(await zeilen(seite), 3, "Ergebnisfilter auf Französisch");
    assert.deepEqual(await seite.$$eval(".stellenzeile .antwortmarke", e => e.map(x => x.textContent)), ["Refus", "Refus", "Refus"], "Marke Refus");
    await auswahl(seite, "Ergebnis der Bewerbung".replace("Ergebnis der Bewerbung", "Résultat de la candidature"), "alle");
    await auswahl(seite, "Trier par", "datum");
    assert((await seite.$eval(".listeninfo", e => e.textContent)) && (await seite.$$eval(".versanddatum", e => e.some(x => /^le \d\d\/\d\d\/\d{4}$/.test(x.textContent)) && e.some(x => x.textContent === "Date inconnue"))), "Bewerbungsdatum auf Französisch");
    assert.equal(await seite.$$eval('select[aria-label="Ordre"] option', e => e[0].textContent), "Candidature la plus récente d'abord", "Reihenfolge Datum auf Französisch");
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
    await knopf(seite, "Initiativbewerbung");
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein Überlauf mit Filterzeile");
    await zuruecksetzen(seite);
    assert(await reiter(seite, "Versandt"), "Reiter Versandt (Handy)");
    await auswahl(seite, "Ergebnis der Bewerbung", "absage");
    await auswahl(seite, "Sortieren nach", "datum");
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
  } finally { await browser.close(); beenden(); }
  assert.deepEqual(fehler, [], "keine Laufzeitfehler");
  assert.deepEqual(extern, [], "keine externen Anfragen");
  console.log("Browserprüfung der Demo bestanden: Stellenübersicht, Filter (Art, Entfernung, Sortierung, Zweitkriterium, Zurücksetzen), Nur Informatik, Ergebnisfilter und Bewerbungsdatum, Fiche mit gesperrtem Assistenten, Unterlagen zum Ansehen, Zweitstellen, Status, Antworten, Hinweis, Französisch, Übungsformular (gemeinsames Feld, Datei, Ablagefeld), Handy; keine Fehler, keine externen Anfragen.");
})().catch(e => { console.error(e); process.exitCode = 1; beenden(); });
