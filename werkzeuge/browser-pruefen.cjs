const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODUL || "playwright");
const basis = process.argv[2];
if (
  !basis ||
  !/^https?:\/\/(?:127\.0\.0\.1:\d+\/|jorxas\.github\.io\/JobPilot\/)$/.test(
    basis,
  )
)
  throw Error(
    "Explizite JobPilot-Vorschau- oder öffentliche URL erforderlich.",
  );
const ziel = path.resolve(__dirname, "../.nachweise");
fs.mkdirSync(ziel, { recursive: true });
const bericht = {
  beginn: new Date().toISOString(),
  basis,
  erfolgreich: false,
  pruefungen: [],
  laufzeitfehler: [],
  externeAnfragen: [],
};
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const seite = await browser.newPage({
      viewport: { width: 1500, height: 1080 },
      locale: "de-DE",
    });
    seite.setDefaultTimeout(12000);
    seite.on("pageerror", (e) => bericht.laufzeitfehler.push(e.message));
    seite.on("request", (r) => {
      if (new URL(r.url()).origin !== new URL(basis).origin)
        bericht.externeAnfragen.push(r.url());
    });
    await seite.goto(basis, { waitUntil: "networkidle" });
    await seite
      .getByRole("button", { name: "Demo zurücksetzen", exact: true })
      .click();
    assert.equal(await seite.locator(".stellenzeile").count(), 8);
    // Plattformen: Zusammenfassung, nur Problemquellen hervorgehoben, Abwahl je Plattform.
    assert.match(
      await seite.locator("#plattformen-titel").textContent(),
      /^21 von 21 Plattformen bei jeder Suche abgefragt$/,
    );
    const probleme = await seite.locator(".plattformprobleme > li").allTextContents();
    assert.equal(probleme.length, 4);
    for (const name of ["Indeed", "Jobvector", "HeyJobs", "Studierendenwerk"])
      assert(probleme.some((t) => t.includes(name)), name);
    assert.equal(await seite.locator(".plattformchip").count(), 21);
    await seite.screenshot({
      path: path.join(ziel, "stellen-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await seite
      .getByRole("button", { name: "Demodurchlauf starten", exact: true })
      .click();
    assert.match(await seite.getByRole("status").textContent(), /0 neu/);
    assert.equal(await seite.locator(".stellenzeile").count(), 8);
    assert.match(
      await seite.locator(".plattformkopf").textContent(),
      /Zustände simuliert/,
    );
    await seite.getByText("Plattformen anzeigen oder abwählen").click();
    assert.match(
      await seite.locator(".plattformwahl > summary").textContent(),
      /1 gelesen · 16 teilweise · 3 blockiert · 1 nur Link/,
    );
    await seite.locator('.plattformchip[data-platform="jobmensa"] input').uncheck();
    assert.match(
      await seite.locator("#plattformen-titel").textContent(),
      /^20 von 21/,
    );
    await seite.reload({ waitUntil: "networkidle" });
    assert.match(
      await seite.locator("#plattformen-titel").textContent(),
      /^20 von 21/,
    );
    await seite.getByText("Plattformen anzeigen oder abwählen").click();
    await seite.locator('.plattformchip[data-platform="jobmensa"] input').check();
    assert.match(
      await seite.locator("#plattformen-titel").textContent(),
      /^21 von 21/,
    );
    bericht.pruefungen.push(
      "21 Plattformen: simulierte Zustände, Problemquellen, Abwahl und Persistenz",
    );
    bericht.pruefungen.push(
      "Suchwiederholung ohne Dubletten oder zurückgesetzte Historie",
    );
    await seite
      .getByRole("searchbox", { name: "Stellen durchsuchen" })
      .fill("Nordlicht");
    assert.equal(await seite.locator(".stellenzeile").count(), 1);
    await seite.getByLabel("Lokaler Demostatus").selectOption("applied");
    await seite.getByRole("searchbox").fill("");
    await seite
      .getByLabel("Bewerbungsstatus", { exact: true })
      .selectOption("applied");
    assert.equal(await seite.locator(".stellenzeile").count(), 2);
    await seite.reload({ waitUntil: "networkidle" });
    await seite
      .getByLabel("Bewerbungsstatus", { exact: true })
      .selectOption("applied");
    assert.equal(await seite.locator(".stellenzeile").count(), 2);
    await seite
      .getByLabel("Bewerbungsstatus", { exact: true })
      .selectOption("alle");
    bericht.pruefungen.push("Suche, Statusfilter und Browserpersistenz");
    await seite
      .getByRole("button", { name: "Manuell importieren", exact: true })
      .click();
    await seite
      .getByRole("button", { name: "Anzeige übernehmen", exact: true })
      .click();
    assert.equal(await seite.locator(".stellenzeile").count(), 9);
    bericht.pruefungen.push(
      "Manueller Import mit echter Zulassungs- und Dublettenprüfung",
    );
    await seite.getByRole('button',{name:'Stelle öffnen: Wolkenfeld IT',exact:true}).click();
    await seite.getByText('Beschreibung ergänzen',{exact:true}).click();
    await seite.getByLabel('Vollständige Anzeigenbeschreibung',{exact:true}).fill('Docker, Kubernetes und Linux. '.repeat(8));
    await seite.getByRole('button',{name:'Beschreibung speichern',exact:true}).click();
    assert.equal(await seite.getByText('Beschreibung ergänzen',{exact:true}).count(),0);
    bericht.pruefungen.push('Unvollständige Anzeige manuell ergänzen, ohne Firmenhistorie zu verlieren');
    const [download] = await Promise.all([
      seite.waitForEvent("download"),
      seite
        .getByRole("button", { name: "Demostand exportieren", exact: true })
        .click(),
    ]);
    assert.equal(download.suggestedFilename(), "jobpilot-demostand.json");
    bericht.pruefungen.push("Lokaler JSON-Export");
    await seite
      .getByRole("button", { name: "Suchmechanik", exact: true })
      .click();
    assert.equal(await seite.locator(".familienraster>div").count(), 25);
    await seite
      .getByRole("group", { name: "Durchlauf auswählen" })
      .getByRole("button", { name: "5", exact: true })
      .click();
    assert.equal(await seite.locator(".familienraster>.aktiv").count(), 5);
    assert(
      (await seite.locator(".planzeile.verteilung").count()) >= 1,
      "Spurplan je Plattform sichtbar",
    );
    assert.equal(await seite.locator(".quellenlinks>a").count(), 21);
    assert.match(
      await seite.locator(".planblock.familienplan").textContent(),
      /Game Development|Wissenschaftliche Programmierung/,
    );
    for (const a of await seite.locator(".quellenlinks>a").all())
      assert.match(await a.getAttribute("href"), /^https:/);
    await seite.screenshot({
      path: path.join(ziel, "suchmechanik-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    bericht.pruefungen.push(
      "25 Themen, fünf Durchläufe, Spurplan und 21 Quellenlinks",
    );
    await seite
      .getByRole("button", { name: "Formularassistent", exact: true })
      .click();
    const rahmen = seite.frameLocator("iframe");
    await seite
      .getByRole("button", { name: "1. Beispielprofil eintragen", exact: true })
      .click();
    await rahmen.getByLabel("Vorname", { exact: true }).waitFor();
    assert.equal(
      await rahmen.getByLabel("Vorname", { exact: true }).inputValue(),
      "Alex",
    );
    assert.equal(
      await rahmen
        .getByLabel("Wie haben Sie von uns gehört?", { exact: true })
        .inputValue(),
      "",
    );
    await rahmen.getByLabel("Vorname", { exact: true }).fill("Mira");
    await seite
      .getByRole("button", {
        name: "2. „StepStone“ merken & erneut füllen",
        exact: true,
      })
      .click();
    assert.equal(
      await rahmen.getByLabel("Vorname", { exact: true }).inputValue(),
      "Mira",
    );
    assert.equal(
      await rahmen
        .getByLabel("Wie haben Sie von uns gehört?", { exact: true })
        .inputValue(),
      "StepStone",
    );
    assert.equal(await rahmen.getByRole("checkbox").isChecked(), false);
    await seite.screenshot({
      path: path.join(ziel, "formular-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    bericht.pruefungen.push(
      "Originalfeldmotor: Profil, offene Frage, Antwortbank, bestehende Werte und leere Einwilligung",
    );
    await seite.reload({ waitUntil: "networkidle" });
    await seite
      .getByRole("button", { name: "Formularassistent", exact: true })
      .click();
    await seite
      .getByRole("button", { name: "1. Beispielprofil eintragen", exact: true })
      .click();
    assert.equal(
      await seite
        .frameLocator("iframe")
        .getByLabel("Wie haben Sie von uns gehört?", { exact: true })
        .inputValue(),
      "StepStone",
    );
    bericht.pruefungen.push("Antwortbank nach Neuladen wiederverwendet");
    await seite.setViewportSize({ width: 390, height: 844 });
    for (const name of [
      "Stellenübersicht",
      "Suchmechanik",
      "Formularassistent",
      "Aufbau & Grenzen",
    ]) {
      await seite
        .getByRole("button", { name: "Navigation öffnen", exact: true })
        .click();
      await seite
        .getByRole("button", { name, exact: name !== "Stellenübersicht" })
        .click();
      assert(
        await seite.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        "Mobile Überbreite " + name,
      );
      await seite.screenshot({
        path: path.join(ziel, name.replace(/[^a-z]/gi, "-") + "-mobil.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    bericht.pruefungen.push(
      "Vier mobile Ansichten ohne horizontales Überlaufen",
    );
    assert.deepEqual(bericht.laufzeitfehler, []);
    assert.deepEqual(bericht.externeAnfragen, []);
    bericht.erfolgreich = true;
    console.log(
      JSON.stringify({
        erfolgreich: true,
        pruefungen: bericht.pruefungen.length,
      }),
    );
  } catch (e) {
    bericht.fehler = e.stack;
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    await browser.close();
    bericht.ende = new Date().toISOString();
    fs.writeFileSync(
      path.join(ziel, "browserbericht.json"),
      JSON.stringify(bericht, null, 2) + "\n",
    );
  }
})();
