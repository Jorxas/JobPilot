// Browserprüfung der gebauten Demo (npm run build vorher). Benötigt installierten Chrome oder Edge (BROWSER_PFAD).
// Die Demo wird wie auf GitHub Pages unter dem Pfad /JobPilot/ ausgeliefert. Es werden keine externen Anfragen erlaubt.
// Optional: --bild=<datei.png> schreibt die Aufnahme der Stellenübersicht (für README und Portfolio).
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const puppeteer = require("puppeteer-core");
const dist = path.resolve(__dirname, "../dist");
const bildArgument = process.argv.find(a => a.startsWith("--bild="))?.slice(7);
const typen = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".pdf": "application/pdf", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((anfrage, antwort) => {
  let pfad = decodeURIComponent(new URL(anfrage.url, "http://x").pathname).replace(/^\/JobPilot/, "") || "/";
  if (pfad.endsWith("/")) pfad += "index.html";
  const datei = path.join(dist, pfad);
  if (!datei.startsWith(dist) || !fs.existsSync(datei)) { antwort.statusCode = 404; return antwort.end("nicht gefunden"); }
  antwort.setHeader("Content-Type", typen[path.extname(datei)] || "application/octet-stream");
  antwort.end(fs.readFileSync(datei));
});
const browserPfad = process.env.BROWSER_PFAD || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(f => fs.existsSync(f));
if (!browserPfad) throw new Error("BROWSER_PFAD auf einen installierten Chrome oder Edge setzen.");
const zeilen = seite => seite.$$eval(".stellenzeile", e => e.length);
const warte = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const basis = `http://127.0.0.1:${server.address().port}/JobPilot/`;
  const browser = await puppeteer.launch({ executablePath: browserPfad, headless: true });
  const fehler = [], extern = [];
  try {
    const seite = await browser.newPage();
    seite.on("pageerror", e => fehler.push("Seitenfehler: " + e.message));
    seite.on("console", m => { if (m.type() === "error") fehler.push("Konsole: " + m.text()); });
    seite.on("request", r => { if (new URL(r.url()).hostname !== "127.0.0.1") extern.push(r.url()); });
    seite.on("dialog", d => d.accept());
    await seite.setViewport({ width: 1512, height: 1000 });
    await seite.goto(basis, { waitUntil: "networkidle0" });
    await seite.waitForSelector(".stellenzeile");

    assert.equal(await zeilen(seite), 4, "vier offene Stellen, eine je Firma");
    const erste = await seite.$eval(".stellenzeile", e => e.textContent);
    assert(erste.includes("Morgenrot") && erste.includes("Neu"), "neue Stelle mit Marker");
    assert((await seite.$eval(".kennzahlen", e => e.textContent)).includes("Heute 0 von 3"), "Tagesziel sichtbar");
    if (bildArgument) await seite.screenshot({ path: path.resolve(bildArgument) });

    await seite.click(".firma");
    await seite.waitForSelector("[role=dialog]");
    assert((await seite.$eval(".detail", e => e.textContent)).includes("Warum diese Stelle?"), "Gründe der Passung");
    await seite.keyboard.press("Escape");
    await seite.waitForSelector("[role=dialog]", { hidden: true });

    await seite.click(".listeninfo input");
    assert((await seite.$eval(".listeninfo", e => e.textContent)).includes("2 archivierte Zweitstellen einblenden"), "Zweitstellen benannt");
    assert.equal(await zeilen(seite), 4, "Zweitstellen bleiben ausgeblendet");
    await seite.click(".listeninfo label:nth-of-type(2) input");
    assert.equal(await zeilen(seite), 5, "Zweitstelle einer beworbenen Firma sichtbar auf Wunsch");
    await seite.click(".listeninfo label:nth-of-type(2) input");
    await seite.click(".listeninfo input");

    // Status pflegen: Morgenrot als versandt markieren
    await seite.click(".firma");
    await seite.waitForSelector("[role=dialog]");
    await seite.evaluate(() => [...document.querySelectorAll(".detail button")].find(b => b.textContent.trim() === "Versandt")?.click());
    await warte(400);
    await seite.keyboard.press("Escape");
    assert.equal(await zeilen(seite), 3, "nach dem Markieren bleiben drei offene Stellen");

    // Antworten
    await seite.$eval('nav a[href="/suivi#antworten"]', n => n.click());
    await seite.waitForSelector(".antwortzeile");
    assert.equal((await seite.$$(".antwortzeile")).length, 4, "vier Nachrichten");
    assert((await seite.$eval("main", e => e.textContent)).includes("Gespräch"), "Gespräch erkannt");

    // Nicht enthaltene Seite: Hinweis statt Ersatzseite
    await seite.$eval('nav a[href="/offres"]', n => n.click());
    await warte(300);
    assert((await seite.$eval("[data-demo-hinweis]", e => e.textContent)).includes("lokalen JobPilot"), "Hinweis statt Ersatzseite");
    assert(seite.url().startsWith(basis), "keine Navigation zu einer nicht vorhandenen Seite");

    // Handy
    await seite.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await seite.$eval('nav a[href="/suivi"]', n => n.click());
    await warte(300);
    assert(!(await seite.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "kein horizontaler Überlauf auf dem Handy");
  } finally { await browser.close(); server.close(); }
  assert.deepEqual(fehler, [], "keine Laufzeitfehler");
  assert.deepEqual(extern, [], "keine externen Anfragen");
  console.log("Browserprüfung der Demo bestanden: Stellenübersicht, Fiche, Zweitstellen, Status, Antworten, Hinweis, Handy; keine Fehler, keine externen Anfragen.");
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
