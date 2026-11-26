# Hinweise für Entwicklungsassistenten

Diese öffentliche Fassung läuft im Gleichschritt mit dem persönlichen Original, aus dem sie entstanden ist. Beide sollen sich bei der Stellensuche gleich verhalten. Änderungen an Plattformen, Parsern (`src/kern/karten-*.ts`), Sperrregeln (`KEIN_ABRUF` in `src/kern/platforms.ts`), Suchplan, Umkreisprüfung, IT-Eignung oder Indeed-Connectoren werden deshalb in beiden Fassungen umgesetzt; übernommene Dateien stehen mit SHA-256 in `HERKUNFT.json` und werden dort nachgeführt.

Zulässige Unterschiede zum Original: keine persönlichen Daten (Profil, Dokumente, Ortszwischenspeicher, Zugangsdaten, Pfade), Ortsauflösung über OpenStreetMap Nominatim mit lokalem Cache unter `daten/`, Suchkriterien je Suchstart (Werkzeug `werkzeuge/suche-starten.mjs` oder lokale API) statt Datenbank, die synthetische Demo mit gekennzeichneter Suchansicht und die echte lokale Suchseite `/offres`, Live-Abrufe nur mit `JOBPILOT_LIVE=1`, Indeed über ChatGPT/Codex nur mit `JOBPILOT_INDEED_CODEX=1` und dem eigenen ChatGPT-Konto samt eigener Indeed-App, Indeed über Claude nur mit `JOBPILOT_INDEED_CLAUDE=1` und dem eigenen claude.ai-Konto. Die Anbieterwahl (`src/kern/indeed-connectors.ts`) folgt sonst genau dem Original.

Regeln:

- Vorrangiger neuer Benutzerauftrag: kostenlose manuelle Indeed-Suche zuerst mit ts-jobspy, danach nur offene Begriffe über Codex und Claude; Einzelheiten in `docs/indeed-suchwege.md`. Keine Proxys/Challenge-Lösung, keine direkten Wiederholungen nach Fehler, erfolgreiche Leerlisten abschließen.
- Technische Sperren (Cloudflare, AWS WAF, Anubis, Captcha, Anmeldung) nie umgehen: keine geänderte Browserkennung, keine Lösung von Aufgaben, keine Wiederholung. Die HTML-Leser senden an Indeed, Jobvector und HeyJobs keine Anfrage. Der gesonderte Indeed-Erstabruf folgt dem obigen Auftrag.
- robots.txt allein ist für diese private Stellensuche kein Ausschlussgrund; die betroffenen Quellen nennt die README, jede Plattform bleibt abwählbar.
- Offizielle Indeed-Connectoren nur bei manuellem Suchstart und eigener Freigabe. Erst ts-jobspy, dann bevorzugter offizieller Ersatz, bei Fehler der andere. Nur offene Begriffe übernehmen. Genau einen Suchstart auslösen, nie zwei Gesprächsbefehle für denselben Auftrag.
- Eine Trefferliste ist nie eine vollständige Marktabdeckung; Teilergebnisse und Fehler ehrlich melden.
- Die Browser-Demo bleibt vollständig synthetisch und stellt keine echten Anfragen.

Prüfen vor jeder Übernahme: `npm test`, `npm run pruefen:typen`, `npm run pruefen:privat` und die Browserprüfung (`werkzeuge/browser-pruefen.cjs`). Neue Plattform oder geänderte Seite: Parser plus gekürzte echte Trefferliste als Fixture in `pruefungen/fixtures/`.

Seit dem bestätigten UI-Auftrag vom 26. November: Suchfenster in `src/oberflaeche/suche-arbeitsraum.tsx` unverändert aus dem Original übernommen; öffentlicher Adapter `stellensuche.tsx`. `/offres` auf dem lokalen Server benutzt dessen echte Such-API; `/index.html` und GitHub Pages bleiben synthetisch. Neue Browserprüfung zusätzlich: `node werkzeuge/suche-browser-pruefen.cjs`. Keine automatische Suche beim Laden und keine Wiederholung eines unbestätigten POST.
