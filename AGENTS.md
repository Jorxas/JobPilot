# Hinweise für Entwicklungsassistenten

Diese öffentliche Fassung läuft im Gleichschritt mit dem persönlichen Original, aus dem sie entstanden ist. Beide sollen sich bei der Stellensuche gleich verhalten. Änderungen an Plattformen, Parsern (`src/kern/karten-*.ts`), Sperrregeln (`KEIN_ABRUF` in `src/kern/platforms.ts`), Suchplan, Umkreisprüfung, IT-Eignung oder Indeed-Connectoren werden deshalb in beiden Fassungen umgesetzt; übernommene Dateien stehen mit SHA-256 in `HERKUNFT.json` und werden dort nachgeführt.

Zulässige Unterschiede zum Original: keine persönlichen Daten (Profil, Dokumente, Ortszwischenspeicher, Zugangsdaten, Pfade), Ortsauflösung über OpenStreetMap Nominatim mit lokalem Cache unter `daten/`, Suchkriterien je Suchstart (Werkzeug `werkzeuge/suche-starten.mjs` oder lokale API) statt Datenbank, die Demo-Oberfläche ohne Suchseite, Live-Abrufe nur mit `JOBPILOT_LIVE=1`, Indeed über ChatGPT/Codex nur mit `JOBPILOT_INDEED_CODEX=1` und dem eigenen ChatGPT-Konto samt eigener Indeed-App, Indeed über Claude nur mit `JOBPILOT_INDEED_CLAUDE=1` und dem eigenen claude.ai-Konto. Die Anbieterwahl (`src/kern/indeed-connectors.ts`) folgt sonst genau dem Original.

Regeln:

- Technische Sperren (Cloudflare, AWS WAF, Anubis, Captcha, Anmeldung) nie umgehen: keine geänderte Browserkennung, keine Lösung von Aufgaben, keine Wiederholung. Indeed, Jobvector und HeyJobs erhalten keine Anfrage.
- robots.txt allein ist für diese private Stellensuche kein Ausschlussgrund; die betroffenen Quellen nennt die README, jede Plattform bleibt abwählbar.
- Connectoren (Indeed über ChatGPT/Codex oder Claude) nur bei einem ausdrücklich gestarteten Suchlauf mit Anbieterwahl, nie zeitgesteuert. Je Suchstart genau ein Connector: `auto` bevorzugt Codex, Claude nur, wenn Codex vor jeder Anfrage nicht verfügbar ist; nach einer gesendeten Anfrage kein Wechsel und keine Wiederholung. Aus einem Gespräch genau einen Befehl `node werkzeuge/suche-starten.mjs --run --provider=codex` oder `--provider=claude` ausführen, nie beide.
- Eine Trefferliste ist nie eine vollständige Marktabdeckung; Teilergebnisse und Fehler ehrlich melden.
- Die Browser-Demo bleibt vollständig synthetisch und stellt keine echten Anfragen.

Prüfen vor jeder Übernahme: `npm test`, `npm run pruefen:typen`, `npm run pruefen:privat` und die Browserprüfung (`werkzeuge/browser-pruefen.cjs`). Neue Plattform oder geänderte Seite: Parser plus gekürzte echte Trefferliste als Fixture in `pruefungen/fixtures/`.
