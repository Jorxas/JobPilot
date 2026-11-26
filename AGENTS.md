# Hinweise für Entwicklungsassistenten

Diese öffentliche Fassung läuft im Gleichschritt mit dem persönlichen Original, aus dem sie entstanden ist. Beide sollen sich bei der Stellensuche gleich verhalten. Änderungen an Plattformen, Parsern (`src/kern/karten-*.ts`), Sperrregeln (`KEIN_ABRUF` in `src/kern/platforms.ts`), Suchplan, Umkreisprüfung, IT-Eignung oder Indeed-Connectoren werden deshalb in beiden Fassungen umgesetzt; übernommene Dateien stehen mit SHA-256 in `HERKUNFT.json` und werden dort nachgeführt.

Zulässige Unterschiede zum Original: keine persönlichen Daten (Profil, Dokumente, Ortszwischenspeicher, Zugangsdaten, Pfade), Ortsauflösung über OpenStreetMap Nominatim mit lokalem Cache unter `daten/`, Einstellungen im Browser statt Datenbank, Live-Abrufe nur mit `JOBPILOT_LIVE=1`, Indeed über Claude nur mit `JOBPILOT_INDEED_CLAUDE=1` und dem eigenen claude.ai-Konto. Indeed über ChatGPT/Codex ist im Original vorhanden und hier noch nicht übernommen.

Regeln:

- Technische Sperren (Cloudflare, AWS WAF, Anubis, Captcha, Anmeldung) nie umgehen: keine geänderte Browserkennung, keine Lösung von Aufgaben, keine Wiederholung. Indeed, Jobvector und HeyJobs erhalten keine Anfrage.
- robots.txt allein ist für diese private Stellensuche kein Ausschlussgrund; die betroffenen Quellen nennt die README, jede Plattform bleibt abwählbar.
- Connectoren (Indeed über Claude) nur bei einem ausdrücklich gestarteten Suchlauf, nie zeitgesteuert.
- Eine Trefferliste ist nie eine vollständige Marktabdeckung; Teilergebnisse und Fehler ehrlich melden.
- Die Browser-Demo bleibt vollständig synthetisch und stellt keine echten Anfragen.

Prüfen vor jeder Übernahme: `npm test`, `npm run pruefen:typen`, `npm run pruefen:privat` und die Browserprüfung (`werkzeuge/browser-pruefen.cjs`). Neue Plattform oder geänderte Seite: Parser plus gekürzte echte Trefferliste als Fixture in `pruefungen/fixtures/`.
