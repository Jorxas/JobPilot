import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { erstelleServer } from "../dist/server.mjs";
test("Lokaler Ablauf speichert idempotent, sperrt Live-Zugriff und schützt parallele Suchen", async () => {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-test-"));
  const server = erstelleServer({ datenordner: ordner });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port;
  const post = (pfad, inhalt = {}, extra = {}) =>
    fetch(basis + pfad, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: JSON.stringify(inhalt),
    });
  try {
    assert.equal(
      (await fetch(basis + "/api/status").then((r) => r.json())).live,
      false,
    );
    const a = await post("/api/suche").then((r) => r.json());
    assert(a.neu > 0);
    assert.equal(a.modus, "synthetisch");
    // Simulierte Plattformzustände für alle 18 Quellen; gesperrte Quellen wie im echten Betrieb.
    assert.equal(a.zustand.berichte.length, 18);
    assert(a.zustand.berichte.every((r) => /Simulierter Quellenzustand/.test(r.message)));
    assert.equal(a.zustand.berichte.find((r) => r.source === "indeed").status, "blocked");
    const auswahl = await post("/api/suche", { quellen: ["xing", "bundesagentur", "unbekannt"] }).then((r) => r.json());
    assert.deepEqual(auswahl.zustand.berichte.map((r) => r.source), ["bundesagentur", "xing"]);
    const b = await post("/api/suche").then((r) => r.json());
    assert.equal(b.neu, 0);
    assert.equal(a.zustand.stellen.length, b.zustand.stellen.length);
    assert.equal(
      b.zustand.stellen.find((s) => s.id === "A01").status,
      "applied",
    );
    assert.equal((await post("/api/suche", { live: true })).status, 403);
    assert.equal(
      (await post("/api/suche", {}, { Origin: "https://fremd.example.test" }))
        .status,
      403,
    );
    await writeFile(path.join(ordner, "suche.sperre"), "anderer-arbeiter");
    assert.equal((await post("/api/suche")).status, 409);
    assert.match(
      await readFile(path.join(ordner, "zustand.json"), "utf8"),
      /Morgenrot/,
    );
    assert.equal((await fetch(basis + "/server.mjs")).status, 404);
    // Die echte Oberfläche öffnet Beispielunterlagen im Browser und lädt eigene Schriften: passende Typen nötig.
    assert.equal((await fetch(basis + "/beispiel/lebenslauf-beispiel.pdf")).headers.get("content-type"), "application/pdf");
    assert.equal((await fetch(basis + "/schriften/dm-sans.woff2")).headers.get("content-type"), "font/woff2");
  } finally {
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  }
});
