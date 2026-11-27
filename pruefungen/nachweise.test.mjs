// Verlangte Nachweise aus dem Anzeigentext, gleich dem Original (scripts/nachweise.test.cjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verlangteNachweise as v } from "../dist/nachweise.mjs";

test("Ausdrücklich verlangte Nachweise werden erkannt", () => {
  assert.deepEqual(v("Bitte sende uns Lebenslauf, Anschreiben, aktuelle Immatrikulationsbescheinigung und Notenspiegel."), ["enrollment", "transcript"]);
  assert.deepEqual(v("Deine Bewerbung mit Lebenslauf und Zeugnissen über unser Portal."), ["certificates"]);
  assert.deepEqual(v("Please attach your CV, transcript of records and certificate of enrollment."), ["enrollment", "transcript"]);
  assert.deepEqual(v("Aussagekräftige Unterlagen inkl. Studienbescheinigung und Leistungsübersicht"), ["enrollment", "transcript"]);
});
test("Verneinte oder fehlende Nennungen lösen nichts aus", () => {
  assert.deepEqual(v("Bewerbung ohne Anschreiben und Zeugnisse möglich, nur Lebenslauf."), []);
  assert.deepEqual(v("Zeugnisse sind nicht erforderlich."), []);
  assert.deepEqual(v("Wir suchen eine Werkstudentin oder einen Werkstudenten für unsere IT."), []);
  assert.deepEqual(v(""), []);
  assert.deepEqual(v(null), []);
});
