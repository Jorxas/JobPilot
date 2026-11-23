import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aufnehmen,
  bewerten,
  firmenansicht,
  searchPlan,
  TECH_FAMILIES,
  pruefeManuellenImport,
} from "../dist/ablauf.mjs";
import {
  allowedUrl,
  structuredOffers,
  scanPublicSource,
} from "../dist/quellen.mjs";
const profil = {
  skills: ["Java", "SQL", "React"],
  anchoredSkills: ["Java"],
  keywords: "Werkstudent Java",
  englishBasic: true,
};
const angebot = (id, extra = {}) => ({
  source: "linkedin",
  externalRef: id,
  title: "Werkstudent Java",
  company: "Musterwerk GmbH",
  location: "Gießen",
  description: "Java, SQL und React. ".repeat(12),
  url: "https://www.linkedin.com/jobs/view/1234567890",
  complete: true,
  ...extra,
});
test("24 Themenfelder sind über sechs Pläne abgedeckt; Kenntnisse begrenzen den Suchraum nicht", () => {
  const felder = new Set();
  for (let r = 0; r < 6; r++)
    for (const q of searchPlan("Werkstudent Java", true, r))
      felder.add(q.family);
  assert.equal(TECH_FAMILIES.length, 24);
  for (const f of TECH_FAMILIES) assert(felder.has(f.id));
});
test("Reihenfolge und Wiederholung erhalten eine beworbene Firmenhistorie", () => {
  const alt = { ...angebot("alt"), id: "alt", status: "applied", score: 10 };
  const r = aufnehmen(
    [alt],
    [angebot("neu", { source: "stepstone", company: "Musterwerk" })],
    profil,
  );
  assert.equal(r.neu, 0);
  assert.equal(r.doppelt, 1);
  assert.equal(r.stellen[0].status, "applied");
  assert.equal(
    aufnehmen(r.stellen, [angebot("neu")], profil).stellen.length,
    1,
  );
});
test("Senior- und fachfremde Angebote werden abgewiesen; andere Technologien bleiben", () => {
  const r = aufnehmen(
    [],
    [
      angebot("1", { title: "Senior Java Developer" }),
      angebot("2", { title: "Werkstudent Verkauf" }),
      angebot("3", {
        title: "Werkstudent C++ Embedded",
        description: "C++ und Mikrocontroller",
      }),
    ],
    profil,
  );
  assert.equal(r.ausgeschlossen, 2);
  assert.equal(r.neu, 1);
  assert.equal(r.stellen[0].title, "Werkstudent C++ Embedded");
});
test("Nur Informatik: Titel ohne IT-Bezug entfallen, Redaktion für Websites und Initiativbewerbung bleiben", () => {
  const titel = [
    ["Werkstudent Buchhaltung", false],
    ["Werkstudent Verwaltung und Empfang", false],
    ["Praktikum Fertigung und Montage", false],
    ["Werkstudent Softwareentwicklung", true],
    ["Praktikum IT-Support", true],
    ["Werkstudent Website-Redaktion (CMS)", true],
    ["Initiativbewerbung Werkstudent", true],
  ];
  const r = aufnehmen(
    [],
    titel.map(([t], i) =>
      angebot(String(i), { title: t, company: "Firma " + String.fromCharCode(65 + i) + " GmbH" }),
    ),
    profil,
  );
  assert.deepEqual(
    r.stellen.map((s) => s.title),
    titel.filter(([, bleibt]) => bleibt).map(([t]) => t),
  );
  assert.equal(r.ausgeschlossen, titel.filter(([, bleibt]) => !bleibt).length);
});
test("Fachlich identische Stellen in unterschiedlichen Orten bleiben als Datensätze erhalten", () => {
  const r = aufnehmen(
    [],
    [angebot("1"), angebot("2", { location: "Marburg" })],
    profil,
  );
  assert.equal(r.neu, 2);
  assert.equal(firmenansicht(r.stellen).length, 1);
});
test("Die Heuristik reagiert auf Profiländerungen; fehlende Beschreibung bleibt erkennbar", () => {
  const r = aufnehmen([], [angebot("1", { complete: false })], profil);
  const a = bewerten(r.stellen, profil),
    b = bewerten(r.stellen, { ...profil, skills: [] });
  assert(a[0].score > b[0].score);
  assert(a[0].warnings.length > 0);
});
test("Manueller Import akzeptiert HTTPS und lehnt Skripte, Zugangsdaten und fehlende Titel ab", () => {
  const d = angebot("1");
  assert.equal(pruefeManuellenImport(d).complete, true);
  for (const url of [
    "javascript:alert(1)",
    "http://example.test",
    "https://user:password@example.test",
  ])
    assert.throws(() => pruefeManuellenImport({ ...d, url }));
  assert.throws(() => pruefeManuellenImport({ ...d, title: "" }));
});
test("Öffentlicher URL-Import bleibt auf erlaubte HTTPS-Quellen begrenzt", () => {
  for (const u of [
    "http://de.indeed.com/jobs",
    "https://127.0.0.1",
    "https://de.indeed.com.evil.test",
    "https://user:password@de.indeed.com/jobs",
    "https://de.indeed.com:8443/jobs",
  ])
    assert.throws(() => allowedUrl(u));
});
test("JSON-LD-Import trennt gültige, abgelaufene und ausländische Ausschreibungen", () => {
  const job = {
    ...angebot("1"),
    "@type": "JobPosting",
    hiringOrganization: { name: "Musterwerk" },
    jobLocation: {
      address: { addressLocality: "Gießen", addressCountry: "DE" },
    },
  };
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@graph": [
        job,
        { ...job, validThrough: "2000-01-01" },
        { ...job, jobLocation: { address: { addressCountry: "US" } } },
      ],
    }) +
    "</script>";
  const r = structuredOffers(html, job.url, "linkedin");
  assert.equal(r.length, 1);
  assert.equal(r[0].company, "Musterwerk");
});
test("HTTP-Blockade wird sichtbar und innerhalb des Quellencaches nicht wiederholt", async () => {
  const original = globalThis.fetch;
  let aufrufe = 0;
  globalThis.fetch = async () => {
    aufrufe++;
    return new Response("", { status: 403 });
  };
  try {
    const a = await scanPublicSource(
        "indeed",
        "synthetischer-test",
        "Musterstadt",
        25,
      ),
      b = await scanPublicSource(
        "indeed",
        "synthetischer-test",
        "Musterstadt",
        25,
      );
    assert.equal(a.report.status, "blocked");
    assert.equal(b.report.status, "blocked");
    assert.equal(aufrufe, 1);
  } finally {
    globalThis.fetch = original;
  }
});
