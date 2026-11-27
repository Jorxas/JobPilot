// Plattformkatalog, Suchadressen, Sperren, Umkreis und Zustandsableitung, übernommen aus der privaten
// Prüfung scripts/platforms.test.cjs (ohne die dortigen Datenbank- und Einstellungsfälle). Kein echtes Netz.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEIN_ABRUF,
  PLATFORMS,
  SOURCE_IDS,
  platformLabelOfOffer,
  platformSearchUrl,
  selectedPlatforms,
} from "../dist/plattformen.mjs";
import {
  allowedUrl,
  fetchPublicHtml,
  importPublicOffer,
  offerLinks,
  scanPublicSource,
  sourceOf,
  structuredOffers,
} from "../dist/quellen.mjs";
import { publicOfferScope } from "../dist/umkreis.mjs";
import {
  platformStates,
  PROBLEM_STATES,
  STATE_NOTE,
} from "../dist/plattformstatus.mjs";

const posting = (url, title = "Werkstudent Java") =>
  '<script type="application/ld+json">' +
  JSON.stringify({
    "@type": "JobPosting",
    title,
    url,
    hiringOrganization: { name: "Beispielfirma" },
    jobLocation: {
      address: { addressLocality: "Gießen", addressCountry: "DE" },
    },
    description: "Softwareentwicklung mit Java und SQL. ".repeat(10),
  }) +
  "</script>";
async function mitNetz(antwort, arbeit) {
  const original = globalThis.fetch;
  globalThis.fetch = antwort;
  try {
    return await arbeit();
  } finally {
    globalThis.fetch = original;
  }
}

test("Alle 18 lesbaren Plattformen stehen genau einmal im gemeinsamen Katalog; HeyJobs, Jobvector und Studierendenwerk sind entfernt", () => {
  assert.equal(PLATFORMS.length, 18);
  assert.equal(new Set(SOURCE_IDS).size, 18);
  for (const id of ["heyjobs", "jobvector", "stwgi"]) assert(!SOURCE_IDS.includes(id), id);
  for (const p of PLATFORMS) {
    assert.equal(sourceOf(p.home), p.id);
    const url = platformSearchUrl(p.id, "Werkstudent C++ & Daten", "Gießen", 75);
    assert.equal(sourceOf(url), p.id, p.id);
    assert(!url.includes("undefined"));
  }
  assert.equal(
    sourceOf(
      "https://th-mittelhessen.al.sites.jobware.net/Praktikum/Test.12345678.html",
    ),
    "thm",
  );
});

test("Andere Städte erhalten gültige Suchadressen; ortsgebundene Kennungen fallen ehrlich zurück", () => {
  for (const stadt of ["Köln", "Leipzig", "Musterstadt"])
    for (const p of PLATFORMS) {
      const url = platformSearchUrl(p.id, "Werkstudent IT", stadt, 50);
      assert.equal(sourceOf(url), p.id, p.id + " " + stadt);
      assert(!url.includes("undefined"), url);
    }
  assert.equal(
    new URL(platformSearchUrl("stellenanzeigen", "Werkstudent IT", "Köln", 100)).searchParams.get("locationIds"),
    null,
    "Ohne bekannte Ortskennung bundesweit; der Umkreis wird danach geprüft",
  );
  const jm = new URL(platformSearchUrl("jobmensa", "Werkstudent IT", "Köln", 50));
  assert.equal(jm.searchParams.get("latitude"), null);
  assert.equal(jm.searchParams.get("location"), "Köln");
  assert.equal(platformSearchUrl("get-in-it", "Werkstudent IT", "Köln", 50), "https://www.get-in-it.de/jobsuche");
  assert.equal(platformSearchUrl("stellenwerk", "Werkstudent IT", "Leipzig", 50), "https://www.stellenwerk.de/");
  assert.equal(platformSearchUrl("stellenwerk", "Werkstudent IT", "Hamburg", 50), "https://www.stellenwerk.de/hamburg?_q=IT");
  assert.equal(platformSearchUrl("workwise", "Werkstudent IT", "Köln", 50), "https://www.workwise.io/jobs/koeln");
  assert.equal(platformSearchUrl("jobteaser", "Werkstudent IT", "Köln", 50), "https://www.jobteaser.com/de/job-search/werkstudent-koln");
});

test("Alte Konfigurationen erhalten neue Quellen; neue ausdrückliche Abwahl bleibt gespeichert", () => {
  assert.equal(selectedPlatforms({ bundesagentur: true, linkedin: true, indeed: true, stepstone: true }).length, 18);
  assert.equal(selectedPlatforms(undefined).length, 18);
  assert.equal(selectedPlatforms({ platformCoverageVersion: 2, heyjobs: true, jobvector: true, stwgi: true, xing: true }).join(","), "xing", "Gespeicherte Auswahl entfernter Quellen wird ignoriert");
  assert.equal(selectedPlatforms({ platformCoverageVersion: 2, bundesagentur: true, studentjob: true }).join(","), "bundesagentur,studentjob");
  assert.equal(selectedPlatforms({ platformCoverageVersion: 2 }).length, 0);
});

test("Erweiterte URL-Freigabe schützt weiter vor lokalen Zielen, Zugangsdaten und ähnlichen Domains", () => {
  for (const u of [
    "https://127.0.0.1/",
    "https://www.jobmensa.de.evil.test/jobs",
    "https://evil-studentjob.de/",
    "https://user:pass@www.absolventa.de/jobs",
    "https://www.jobware.de:8443/",
    "http://www.jobmensa.de/jobs",
    "https://jobware.net/",
  ])
    assert.throws(() => allowedUrl(u));
});

test("Suchlinks erhalten Vertrag, Stichwörter, Unicode-Ort und unterstützte Umkreiswerte", () => {
  for (const [id, key, cityKey] of [
    ["unicum", "search", "job_geo_location"],
    ["thm", "jsjn", "jsjo"],
    ["jobmensa", "job-title", "location"],
  ]) {
    const u = new URL(platformSearchUrl(id, "Werkstudent C++", "Gießen", 75));
    assert.equal(u.searchParams.get(key), "Werkstudent C++");
    assert.equal(u.searchParams.get(cityKey), "Gießen");
  }
  const sj = new URL(platformSearchUrl("studentjob", "Werkstudent C++", "Gießen", 75));
  assert.equal(sj.searchParams.get("search[keywords_scope]"), "Werkstudent C++");
  assert.equal(sj.searchParams.get("search[zipcode_eq]"), "Gießen");
  assert.equal(sj.searchParams.get("search[geo_distance_eq]"), "100", "75 km wird auf die nächste Stufe aufgerundet");
  const sa = new URL(platformSearchUrl("stellenanzeigen", "Werkstudent IT", "Gießen", 100));
  assert.equal(sa.searchParams.get("locationIds"), "M-DE-7696");
  assert.equal(sa.searchParams.get("perimeterRadius"), "100");
  const a = new URL(platformSearchUrl("absolventa", "Werkstudent C++", "Gießen", 75));
  assert.equal(a.searchParams.get("text"), "C++", "Absolventa: Vertragswort entfällt");
  assert.equal(a.searchParams.get("positions[]"), "praktikum");
});

test("Detailauswahl priorisiert studentische IT; Links bleiben auf der richtigen Jobbörse", () => {
  const links = offerLinks(
    '<a href="/jobsuche/p123456">Senior Pflege</a><a href="/jobsuche/p222222">Werkstudent Softwareentwicklung</a><a href="https://www.studentjob.de/stellenangebote/333333">Werkstudent Java</a>',
    "https://www.get-in-it.de/jobsuche",
    "get-in-it",
  );
  assert.equal(links.length, 2);
  assert(links[0].endsWith("p222222"));
  const thm = offerLinks(
    '<a href="http://th-mittelhessen.al.sites.jobware.net/Praktikum/Werkstudent-IT.12345678.html">Werkstudent IT</a>',
    "https://th-mittelhessen.al.sites.jobware.net/",
    "thm",
  );
  assert.equal(thm.length, 1);
  assert(thm[0].startsWith("https:"));
});

test("Job-IDs im Query bleiben bei neuen Quellen erhalten; benannte HTML-Entitäten werden aufgelöst", () => {
  const a = structuredOffers(posting("/job/softwareentwicklung?id=123&utm_source=test"), "https://www.stellenanzeigen.de/", "stellenanzeigen")[0];
  const b = structuredOffers(posting("/job/softwareentwicklung?id=456"), "https://www.stellenanzeigen.de/", "stellenanzeigen")[0];
  assert(a.url.endsWith("?id=123"));
  assert.notEqual(a.externalRef, b.externalRef);
  const c = structuredOffers(posting("/job/x?id=789", "Werkstudent IT in K&ouml;ln &ndash; Gr&uuml;nder"), "https://www.stellenanzeigen.de/", "stellenanzeigen")[0];
  assert.equal(c.title, "Werkstudent IT in Köln – Gründer");
});

test("Öffentliche Liste folgt begrenzt echten Details, importiert keine Linktexte als Beschreibungen", async () => {
  const urls = [];
  const r = await mitNetz(
    async (url) => {
      urls.push(String(url));
      return new Response(
        String(url).includes("/stellenangebote/123456")
          ? posting("https://www.studentjob.de/stellenangebote/123456")
          : '<a href="/stellenangebote/123456">Werkstudent Java</a>',
      );
    },
    () => scanPublicSource("studentjob", "Werkstudent Java", "Gießen", 75),
  );
  assert.equal(urls.length, 2);
  assert.equal(r.offers.length, 1);
  assert(r.offers[0].complete);
  assert.equal(r.report.status, "partial");
  assert.equal(r.report.limited, true);
  assert(r.offers[0].description.includes("SQL"));
});

test("Blockiertes Detail stoppt weitere Versuche und wird als blockiert ausgewiesen", async () => {
  let calls = 0;
  const r = await mitNetz(
    async () =>
      ++calls === 1
        ? new Response('<a href="/stellenangebote/123456">Werkstudent Java</a><a href="/stellenangebote/987654">Werkstudent IT</a>')
        : new Response("", { status: 403 }),
    () => scanPublicSource("studentjob", "IT", "Gießen", 50),
  );
  assert.equal(calls, 2);
  assert.equal(r.report.status, "blocked");
  assert.equal(r.offers.length, 0);
});

test("Nicht auslesbare Übersicht bleibt Teilabdeckung und wird beim gleichen Link zwischengespeichert", async () => {
  let calls = 0;
  const r = await mitNetz(
    async () => {
      calls++;
      return new Response("<h1>Bitte Suche im Browser einstellen</h1>");
    },
    async () => {
      const erste = await scanPublicSource("jobteaser", "Werkstudent IT", "Gießen", 50);
      // JobTeaser kennt nur die Übersicht je Stadt: andere Begriffe ergeben denselben Link und keine zweite Anfrage.
      await scanPublicSource("jobteaser", "Studentische Mitarbeit Daten", "Gießen", 50);
      return erste;
    },
  );
  assert.equal(calls, 1);
  assert.equal(r.report.status, "partial");
  assert.equal(r.report.found, 0);
  assert.equal(r.report.limited, true);
});

test("Cloudflare-, AWS-WAF- und Anubis-Prüfseiten gelten als Sperre und werden nicht umgangen", async () => {
  for (const seite of [
    "<html><head><title>Just a moment...</title></head><script>window._cf_chl_opt={}</script></html>",
    '<html><script src="https://x.token.awswaf.com/challenge.js"></script>AwsWafIntegration</html>',
    "<html><body>Making sure you&#39;re not a bot! anubis_challenge</body></html>",
  ]) {
    let calls = 0;
    await mitNetz(
      async () => {
        calls++;
        return new Response(seite, { status: 200 });
      },
      () => assert.rejects(() => fetchPublicHtml("https://www.xing.com/jobs/search/ki?keywords=x"), (e) => e.blocked === true),
    );
    assert.equal(calls, 1, "Genau eine Anfrage, keine Wiederholung");
  }
});

test("Technisch gesperrte Quellen und Studierendenwerk: keine Anfrage, ehrlicher Zustand, Import nur als Text", async () => {
  let calls = 0;
  await mitNetz(
    async () => {
      calls++;
      return new Response('<a href="/x">x</a>');
    },
    async () => {
      const r = await scanPublicSource("indeed", "Werkstudent Data", "Gießen", 100);
      assert.equal(r.report.status, "blocked");
      assert.equal(r.report.found, 0);
      assert(r.report.message.includes("Keine Anfrage gesendet"));
      assert.equal(Object.keys(KEIN_ABRUF).join(), "indeed", "Nur Indeed bleibt ohne direkten Abruf");
      await assert.rejects(() => importPublicOffer("https://de.indeed.com/viewjob?jk=abc123"), /manuell importieren/);
      for (const u of ["https://www.jobvector.de/job/informatiker-4d91939541924332/", "https://www.heyjobs.co/de-de/jobs/abc", "https://www.stwgi.de/jobboerse-studierende/"])
        await assert.rejects(() => importPublicOffer(u));
    },
  );
  assert.equal(calls, 0, "Keine einzige Anfrage");
  // robots.txt allein sperrt nicht (Entscheidung des Originals): XING, THM und Mittelhessen werden gelesen.
  for (const id of ["xing", "thm", "mittelhessen"]) assert.equal(KEIN_ABRUF[id], undefined, id);
  for (const s of platformStates(["unicum"], [{ source: "unicum", status: "partial", found: 0 }]))
    if (s.state !== "aus") assert.equal(s.state, "nur-link", s.id);
  assert.equal(platformStates(["unicum"], [{ source: "unicum", status: "ok", found: 0 }]).find((s) => s.id === "unicum").state, "gelesen", "Ausdrücklich leere Trefferliste gilt als gelesen");
});

test("THM-Anzeige: Titel, Ort und Firma aus dem Seitentitel, Beschreibung aus dem iframe desselben Hosts", async () => {
  const urls = [],
    seite = '<title>Werkstudent Software-Entwicklung (m/w/d), Wetzlar, Beispieltechnik</title><iframe src="https://th-mittelhessen.al.sites.jobware.net/jobsearch/embed/job/1/2/3/index.html" class="x"></iframe>';
  const o = await mitNetz(
    async (url) => {
      urls.push(String(url));
      return new Response(urls.length === 1 ? seite : "<html><head><title>KOPF</title></head><body><p>" + "Software f&uuml;r Sensorik entwickeln. ".repeat(10) + "</p></body></html>");
    },
    () => importPublicOffer("https://th-mittelhessen.al.sites.jobware.net/Praktikum/Werkstudent-Software-Entwicklung-m-w-d.2071657965.html", "thm"),
  );
  assert.equal(o.title, "Werkstudent Software-Entwicklung (m/w/d)");
  assert.equal(o.company, "Beispieltechnik");
  assert.equal(o.location, "Wetzlar");
  assert(o.complete);
  assert(o.description.includes("für Sensorik"));
  assert(!o.description.includes("KOPF"), "Kopfbereich des iframe nicht übernommen");
  assert.equal(urls.length, 2);
  await mitNetz(
    async () => new Response('<title>A, B, C</title><iframe src="https://example.test/jobsearch/embed/job/1/index.html"></iframe>'),
    () => assert.rejects(() => importPublicOffer("https://th-mittelhessen.al.sites.jobware.net/Praktikum/X.12345678.html", "thm")),
  );
});

test("Umkreis: neue Listen vergrößern weder den Umkreis noch den fachlichen Bereich", () => {
  const offer = { title: "Werkstudent Java", description: "Java Softwareentwicklung", location: "Gießen" };
  assert.equal(publicOfferScope(offer, "Gießen", 25, {}), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Berlin" }, "Gießen", 100, { berlin: { lat: 52.52, lon: 13.405 } }), "outside");
  assert.equal(publicOfferScope({ ...offer, location: "Unbekannter Ort" }, "Gießen", 100, {}), "unknown");
  assert.equal(publicOfferScope({ ...offer, title: "Werkstudent Verkauf" }, "Gießen", 100, {}), "role");
  assert.equal(publicOfferScope({ ...offer, title: "Senior Java" }, "Gießen", 100, {}), "role");
  assert.equal(publicOfferScope({ ...offer, location: "Frankfurt am Main" }, "Gießen", 75, { "frankfurt am main": { lat: 50.11, lon: 8.68 } }), "ok");
  // Andere Mittelpunkte funktionieren über denselben Cache (Postleitzahl oder Ortsname).
  const geo = { "koln": { lat: 50.94, lon: 6.96 }, "53111": { lat: 50.74, lon: 7.1 }, "dortmund": { lat: 51.51, lon: 7.47 } };
  assert.equal(publicOfferScope({ ...offer, location: "53111 Bonn" }, "Köln", 30, geo), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Dortmund" }, "Köln", 30, geo), "outside");
});

test("Mehrere Einsatzorte: ein Ort im Umkreis genügt; Bundesland, Land, Schrägstrich und Gedankenstrich", () => {
  const offer = { title: "Werkstudent Data", description: "", location: "Würzburg, Frankfurt am Main" },
    geo = { "würzburg": { lat: 49.79, lon: 9.95 }, "frankfurt am main": { lat: 50.11, lon: 8.68 }, berlin: { lat: 52.52, lon: 13.405 }, hessen: { lat: 50.6, lon: 9.0 }, marburg: { lat: 50.81, lon: 8.77 } };
  assert.equal(publicOfferScope(offer, "Gießen", 75, geo), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Würzburg" }, "Gießen", 75, geo), "outside");
  assert.equal(publicOfferScope({ ...offer, location: "Berlin, Hessen" }, "Gießen", 100, geo), "outside", "„Hessen“ ist kein Einsatzort");
  assert.equal(publicOfferScope({ ...offer, location: "35390 Gießen, Hessen" }, "Gießen", 25, geo), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Marburg/Gießen" }, "Gießen", 10, geo), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Gießen - Frankfurt" }, "Gießen", 10, geo), "ok");
  assert.equal(publicOfferScope({ ...offer, location: "Wetzlar-Dutenhofen" }, "Gießen", 10, {}), "unknown", "Bindestrich im Ortsnamen trennt nicht");
});

test("Zustand je Plattform stammt aus Suchberichten und bekannten Sperren, nie erfunden", () => {
  const r = (source, status, found = 0) => ({ source, status, found, inserted: 0 });
  const by = (list, id) => list.find((s) => s.id === id);
  const list = platformStates(SOURCE_IDS, [r("bundesagentur", "ok", 4), r("indeed", "ok", 3), r("indeed", "blocked"), r("linkedin", "partial", 2), r("stellenwerk", "partial"), r("stellenwerk", "partial"), r("xing", "error"), r("jobware", "ok"), r("jobware", "partial", 1)], { results: [{ id: "thm", report: r("thm", "blocked") }, { id: "unicum", report: r("unicum", "partial", 2) }, { id: "indeed", report: r("indeed", "ok", 9) }] });
  assert.equal(list.length, 18);
  assert.equal(by(list, "bundesagentur").state, "gelesen");
  assert.equal(by(list, "indeed").state, "blockiert");
  assert.equal(by(list, "indeed").origin, "suche", "Suchbericht geht der Prüfung vor");
  assert.equal(by(list, "linkedin").state, "teilweise");
  assert.equal(by(list, "stellenwerk").state, "nur-link");
  assert.equal(by(list, "xing").state, "fehler");
  assert.equal(by(list, "jobware").state, "teilweise");
  assert.equal(by(list, "thm").state, "blockiert");
  assert.equal(by(list, "thm").origin, "pruefung");
  assert.equal(by(list, "jobmensa").state, "offen", "Ohne Bericht: nicht abgefragt");
  const off = platformStates(["bundesagentur"], [r("xing", "blocked")]);
  assert.equal(by(off, "xing").state, "aus", "Abgewählte Plattform wird nie als aktiv gezeigt");
  assert.equal(off.filter((s) => s.state !== "aus").length, 1);
  assert.equal(PROBLEM_STATES.join(), "blockiert,nur-link,fehler");
  for (const s of PROBLEM_STATES) assert(STATE_NOTE[s].length > 20);
});

test("Herkunft einer Stelle: gespeicherte Quelle, sonst Plattform der Anzeigenadresse", () => {
  assert.equal(platformLabelOfOffer("stepstone", "https://beispiel.de/x"), "StepStone");
  assert.equal(platformLabelOfOffer(undefined, "https://www.arbeitsagentur.de/jobsuche/jobdetail/123"), "Arbeitsagentur");
  assert.equal(platformLabelOfOffer("constructor", "nicht-gueltig"), undefined);
  assert.equal(platformLabelOfOffer(undefined, "https://firma.example/karriere"), undefined);
});
