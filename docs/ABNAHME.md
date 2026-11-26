# Anforderungen und Abnahme

| Anforderung | Umsetzung | Prüfung |
|---|---|---|
| Breite Suche über Technikfelder | Übernommener Generator, 25 Familien / 5 Durchläufe, Spurplan je Plattform | Kernprüfung und Browseransicht |
| Gleiche 21 Plattformen wie im Original | Übernommener Plattformkatalog, ein Trefferlistenleser je Plattform, Detailergänzung | Gekürzte echte Trefferlisten, gemockter Suchstart über alle 21 Plattformen |
| Keine Umgehung technischer Sperren | `KEIN_ABRUF` ohne Anfrage; Cloudflare, AWS-WAF und Anubis als Sperre; Pause je Suchstart | Gemockte Prüfseiten, Zählung der Anfragen |
| Umkreis auch außerhalb Mittelhessens | Nominatim mit Takt, Kontingent und Zwischenspeicher | Gemockte Ortsdienste und Umkreisfälle für andere Städte |
| Indeed nur über den offiziellen Connector | Optionaler Claude-Code-Lauf, nur Lesewerkzeuge, nur per Knopf | Gekürzter echter Ereignisstrom, ersetzter Lauf |
| Unterschied zwischen leer, unvollständig und blockiert | Quellenberichte mit vier Zuständen | Gemockte HTTP-Blockade, JSON-LD-Fälle |
| Kein Zurücksetzen bereits beworbener Firmen | Historienpriorität und idempotenter Import | Wiederholter Import und Browser-Neuladen |
| Verständliche Bewertung | Gemeinsame deterministische Heuristik | Profilvergleich mit/ohne bekannte Begriffe |
| Suchgrenzen und Arbeitgeberquellen | HTTPS-Grenzen, Zeit-/Größenlimits, manuelle Alternative | URL-/DNS-/Parserprüfungen ohne echte Arbeitgeber |
| Speichern und Wiederaufnehmen | JSON-Datei, Seitencursor, Planindex, Suchsperre | Lokaler Serverlauf mit temporärem Datenordner |
| Formularfragen wiederverwenden | Gemeinsamer Motor und ausdrückliche Antwortbank | Zwei Durchläufe, Neuladen, bestehender Wert und leere Einwilligung |
| Keine persönlichen Daten veröffentlichen | Positivliste, synthetische Daten, privater Laufzeitordner | Quellenprüfung, Herkunftsprotokoll und Musterscanner |
| Gute öffentliche Bedienung | Vier responsive Ansichten, Filter, Export, kompakte Plattformübersicht mit Abwahl | Browserprüfung am Desktop und bei 390 Pixeln |

## Reproduzierbare Kommandos

```sh
npm ci
npm test
npm run pruefen:typen
npm run pruefen:privat
npm start
node werkzeuge/browser-pruefen.cjs http://127.0.0.1:3037/
```

Die lokale Abnahme enthält keine reale Bewerbung, keine Mailübermittlung und keine private Datenbank. Externe Quellen, Ortsdienst und Claude werden in den automatischen Prüfungen gemockt. Ein grüner Build belegt keinen dauerhaft verfügbaren Portalzugang und keinen Produktbetrieb über mehrere Benutzer. Die Erweiterungsoberfläche muss im eigenen Browser ausdrücklich geladen und auf dem jeweiligen Formular kontrolliert werden.
