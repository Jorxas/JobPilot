# Anforderungen und Abnahme

| Anforderung | Umsetzung | Prüfung |
|---|---|---|
| Breite Suche über Technikfelder | Übernommener Generator, 25 Familien / 5 Durchläufe, Spurplan je Plattform | Kern- und Plattformprüfung, gemockter Suchstart über den lokalen Server |
| Gleiche 21 Plattformen wie im Original | Übernommener Plattformkatalog, ein Trefferlistenleser je Plattform, Detailergänzung | Gekürzte echte Trefferlisten, gemockter Suchstart über alle 21 Plattformen |
| Keine Umgehung technischer Sperren | `KEIN_ABRUF` ohne Anfrage; Cloudflare, AWS-WAF und Anubis als Sperre; Pause je Suchstart | Gemockte Prüfseiten, Zählung der Anfragen |
| Umkreis auch außerhalb Mittelhessens | Nominatim mit Takt, Kontingent und Zwischenspeicher | Gemockte Ortsdienste und Umkreisfälle für andere Städte |
| Indeed nur über offizielle Connectoren | Optional ChatGPT/Codex (App-Server-Protokoll ohne Modellzug, nur `search_jobs`) oder Claude Code (nur Lesewerkzeuge), jeweils nur mit eigener Freigabe und nur bei ausdrücklichem Suchstart | Synthetischer App-Server mit Fehlerfällen (fehlende oder falsche App, Schreibrechte, API-Schlüssel, geändertes Schema, Protokollfehler), gekürzter echter Claude-Ereignisstrom, ersetzter Lauf |
| Ein Connector je Suchstart | `auto` bevorzugt Codex, Claude nur bei Nichtverfügbarkeit vor jeder Anfrage; `codex` und `claude` ohne Ausweichen; ohne Wahl kein Connector | Anbieterwahl einzeln und am lokalen Server: Abbruch nach gesendeter Anfrage ohne Wechsel, ungültige Wahl ohne Suchstart, Wahl ohne Freigabe ohne Anfrage |
| Suchstart aus Terminal oder Gespräch | `werkzeuge/suche-starten.mjs` mit lesender Fähigkeitsabfrage, nur an den eigenen Rechner, keine Wiederholung | Werkzeug gegen einen Testserver: gesperrter Anbieter, fehlende Kriterien, unbekannte Plattform, Suchstart mit Zusammenfassung, Wiederholung gespeicherter Kriterien |
| Unterschied zwischen leer, unvollständig und blockiert | Quellenberichte mit vier Zuständen | Gemockte HTTP-Blockade, JSON-LD-Fälle |
| Kein Zurücksetzen bereits beworbener Firmen | Historienpriorität und idempotenter Import | Wiederholter Import und Browser-Neuladen |
| Verständliche Bewertung | Gemeinsame deterministische Heuristik | Profilvergleich mit/ohne bekannte Begriffe |
| Suchgrenzen und Arbeitgeberquellen | HTTPS-Grenzen, Zeit-/Größenlimits, manuelle Alternative | URL-/DNS-/Parserprüfungen ohne echte Arbeitgeber |
| Speichern und Wiederaufnehmen | JSON-Datei, Seitencursor, Planindex, Suchsperre | Lokaler Serverlauf mit temporärem Datenordner |
| Formularfragen wiederverwenden | Gemeinsamer Motor und ausdrückliche Antwortbank | Zwei Durchläufe, Neuladen, bestehender Wert und leere Einwilligung |
| Keine persönlichen Daten veröffentlichen | Positivliste, synthetische Daten, privater Laufzeitordner | Quellenprüfung, Herkunftsprotokoll und Musterscanner |
| Gute öffentliche Bedienung | Vier responsive Ansichten, Filter und Export | Browserprüfung am Desktop und bei 390 Pixeln |
| Kennzahlen | Noch offen, beworben, positive Antworten, Absagen; je Unternehmen zählt die letzte entscheidende Antwort, Portalhinweise und Eingangsbestätigungen nicht | Browserlauf: Werte und Unterzeilen vor und nach dem Markieren einer Fiche, Antwortarten, beide Sprachen |
| Stellen filtern und ordnen | Filterzeile: Art (Alle / Stellen / Initiativ), Ergebnis (Wartet, Absage, Positiv; nur im Reiter Versandt oder Alle), Entfernung (25 bis 150 km), ein Sortierfeld (Passung, nächste, weiteste, zuletzt oder zuerst beworben) mit Passung als Gleichstand, „Mehr“ für alle Einträge und Zweitstellen, Zurücksetzen nur bei aktiven Filtern | Browserlauf: Art-Auswahl, Entfernung, Sortierung nach Entfernung und Datum (ohne Wert am Ende), Gleichstand nach Passung, Ergebnis nur bei Versandt/Alle und kombiniert mit Datum, „Mehr“ eingeklappt, Zurücksetzen, Französisch, Handyansicht |
| Ergebnis je Fiche | Genau eine kleine Marke (Absage / Positiv, sonst letzte Antwort), Bewerbungsdatum oder „Datum unbekannt“, Kachel „Positive Antworten“ mit bisherigen Gesprächen und späteren Absagen | Browserlauf mit Absage nach früherer Einladung, Portalhinweis und Eingangsbestätigung; Französisch und Handyansicht |
| Nur Informatik | `eligibleRole` im geteilten Kern; Ausnahmen für Initiativbewerbungen und Redaktion/Content für Websites | Kernprüfung mit Beispieltiteln; Browserlauf: Stelle ohne IT-Bezug erscheint nirgends |
| Unterlagen ansehen | Beispieldokumente öffnen sich als PDF im Browser, ohne `download`-Attribut und ohne `attachment` | Browserlauf prüft Link, Ziel und Content-Type |
| Gesperrter Assistent | „Mit Assistent öffnen (neuer Tab)“ und „Eigenes Assistentfenster“ sichtbar, gesperrt, mit Hinweis | Browserlauf prüft Sperre und Hinweistext |
| Zweisprachigkeit | Deutsch als Standard, Französisch über Umschalter oder `?lang=fr`, alle Texte der neuen Elemente in beiden Sprachen | Browserlauf: Umschalten, Direktaufruf, keine deutschen Reste in der Oberfläche |
| Formularassistent | Namensfeld, Köderfeld, Empfehlungsfeld, Geburtstag (TT.MM.JJJJ), Bundesland, gemeinsames Dokumentenfeld, allgemeines Feld „Datei“ und Ablagefeld im Übungsformular | Browserlauf am Übungsformular, Prüfsummen der übernommenen Dateien |

## Reproduzierbare Kommandos

```sh
npm ci
npm test
npm run pruefen:typen
npm run pruefen:privat
npm start
node werkzeuge/browser-pruefen.cjs
node werkzeuge/browser-pruefen.cjs --url=https://jorxas.github.io/JobPilot/   # veröffentlichte Demo
```

Die lokale Abnahme enthält keine reale Bewerbung, keine Mailübermittlung und keine private Datenbank. Externe Quellen, Ortsdienst, Claude und Codex werden in den automatischen Prüfungen gemockt; ein grüner Lauf belegt keinen erfolgreichen echten Indeed-Abruf. Ein grüner Build belegt keinen dauerhaft verfügbaren Portalzugang und keinen Produktbetrieb über mehrere Benutzer. Die Erweiterungsoberfläche muss im eigenen Browser ausdrücklich geladen und auf dem jeweiligen Formular kontrolliert werden. Der Assistent ist in der öffentlichen Demo bewusst gesperrt; geprüft wird nur der Feldmotor am Übungsformular. Mailinhalte und Stellentitel der erfundenen Beispiele sind nicht übersetzt.
