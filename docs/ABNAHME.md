# Anforderungen und Abnahme

| Anforderung | Umsetzung | Prüfung |
|---|---|---|
| Breite Suche über Technikfelder | Übernommener Generator, 24 Familien / 6 Pläne | Kernprüfung und Browseransicht |
| Unterschied zwischen leer, unvollständig und blockiert | Quellenberichte mit vier Zuständen | Gemockte HTTP-Blockade, JSON-LD-Fälle |
| Kein Zurücksetzen bereits beworbener Firmen | Historienpriorität und idempotenter Import | Wiederholter Import und Browser-Neuladen |
| Verständliche Bewertung | Gemeinsame deterministische Heuristik | Profilvergleich mit/ohne bekannte Begriffe |
| Suchgrenzen und Arbeitgeberquellen | HTTPS-Grenzen, Zeit-/Größenlimits, manuelle Alternative | URL-/DNS-/Parserprüfungen ohne echte Arbeitgeber |
| Speichern und Wiederaufnehmen | JSON-Datei, Seitencursor, Planindex, Suchsperre | Lokaler Serverlauf mit temporärem Datenordner |
| Formularfragen wiederverwenden | Gemeinsamer Motor und ausdrückliche Antwortbank | Zwei Durchläufe, Neuladen, bestehender Wert und leere Einwilligung |
| Keine persönlichen Daten veröffentlichen | Positivliste, synthetische Daten, privater Laufzeitordner | Quellenprüfung, Herkunftsprotokoll und Musterscanner |
| Gute öffentliche Bedienung | Vier responsive Ansichten, Filter und Export | Browserprüfung am Desktop und bei 390 Pixeln |

## Reproduzierbare Kommandos

```sh
npm ci
npm test
npm run pruefen:typen
npm run pruefen:privat
npm start
node werkzeuge/browser-pruefen.cjs http://127.0.0.1:3037/
```

Die lokale Abnahme enthält keine reale Bewerbung, keine Mailübermittlung und keine private Datenbank. Externe Quellen werden in den automatischen Prüfungen gemockt. Ein grüner Build belegt keinen dauerhaft verfügbaren Portalzugang und keinen Produktbetrieb über mehrere Benutzer. Die Erweiterungsoberfläche muss im eigenen Browser ausdrücklich geladen und auf dem jeweiligen Formular kontrolliert werden.
