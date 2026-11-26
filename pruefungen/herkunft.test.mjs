import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const herkunft = JSON.parse(await readFile(new URL("../HERKUNFT.json", import.meta.url), "utf8"));
const summe = async (datei) =>
  createHash("sha256")
    .update((await readFile(new URL("../" + datei, import.meta.url), "utf8")).replace(/\r\n/g, "\n"))
    .digest("hex");

test("Öffentliche Prüfsummen in HERKUNFT.json stimmen mit den Dateien überein", async () => {
  assert(herkunft.dateien.length > 0);
  for (const eintrag of herkunft.dateien)
    assert.equal(await summe(eintrag.datei), eintrag.oeffentlichSha256, eintrag.datei);
});

test("Die Erweiterung der Demo enthält Symbole und Manifest mit Symbolen", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/erweiterung/manifest.json", import.meta.url), "utf8"));
  for (const groesse of ["16", "32", "48", "128"]) {
    assert.equal(manifest.icons[groesse], `icons/icon-${groesse}.png`);
    assert.equal(manifest.action.default_icon[groesse], `icons/icon-${groesse}.png`);
    const png = await readFile(new URL("../public/erweiterung/" + manifest.icons[groesse], import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG", "gültige PNG-Datei " + groesse);
  }
});
