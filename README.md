# JobPilot

**Stellen suchen, Anforderungen verstehen und den nächsten Schritt vorbereiten.**

[Interaktive Demo](https://jorxas.github.io/JobPilot/) · [Portfolio von Jordan Freddy](https://jorxas.github.io/Portfolio/)

JobPilot ist aus einem tatsächlich verwendeten persönlichen Werkzeug zur Jobsuche entstanden. Diese öffentliche Fassung übernimmt ausgewählte Such-, Bewertungs- und Formularmodule, ergänzt eine eigenständige deutsche Oberfläche und verwendet ausschließlich synthetische Beispieldaten. Das persönliche Original und seine Bewerbungsdaten bleiben privat. Die zusätzliche öffentliche Fassung wurde mit KI-Unterstützung entwickelt und geprüft.

![Stellenübersicht der öffentlichen JobPilot-Demo](docs/stellenuebersicht.png)

## Was sich ausprobieren lässt

- **Stellenübersicht:** Angebote nach Titel, Unternehmen, Technologie, Quelle und Status filtern; eine Firma pro sichtbarer Option; Originaldatensätze bleiben erhalten.
- **Nachvollziehbarer Vergleich:** Profilbegriffe, belegte Kenntnisse und Vertragsart bilden einen regelbasierten Wert. Der Wert ist keine Einstellungswahrscheinlichkeit und sagt keine berufliche Beherrschung einer Technologie aus.
- **Suchmechanik:** 24 Technikfamilien, aufgeteilt auf sechs Pläne mit vier Familien; Varianten für Werkstudentenstellen und Praktika. Fehlende Profilkenntnisse entfernen keine Technikfamilie aus der Suche.
- **Dubletten und Historie:** Gleichartige Angebote unterschiedlicher Quellen zusammenführen. Beworbene oder archivierte Unternehmen bleiben in der Historie; eine neue Suche setzt deren Entscheidungen nicht zurück.
- **Manueller Import und Export:** Eine Anzeige ohne automatischen Abruf aufnehmen; den eigenen lokalen Demostand als JSON herunterladen.
- **Formularassistent:** Der echte gemeinsame Feldmotor erkennt bekannte Felder, lässt offene Fragen sichtbar, verwendet ausdrückliche Antworten erneut und erhält vorhandene Eingaben. Ein Übungsformular zeigt den Ablauf ohne Arbeitgeberkontakt.

Die Browser-Demo simuliert Quellenzustände und benutzt erfundene Unternehmen. Bewertung, Suchplan, Gruppierung und Formularerkennung laufen tatsächlich. Sie besitzt kein gehostetes Suchbackend und versendet keine E-Mails. Links zu Suchportalen werden erst durch den Besucher geöffnet.

## Lokal starten

Node.js ab 22.12 und npm werden benötigt.

```sh
git clone https://github.com/Jorxas/JobPilot.git
cd JobPilot
npm ci
npm run dev
```

Öffnen: `http://127.0.0.1:3037/`. Die Oberfläche beginnt mit synthetischen Daten. Browseränderungen bleiben im lokalen Browserspeicher. Der optionale Server speichert seinen eigenen Arbeitsstand unter `daten/zustand.json`, einem ignorierten Laufzeitordner. `PORT` und `JOBPILOT_DATEN` können Port bzw. Datenverzeichnis ändern. Es werden keine Zugangsdaten oder persönlichen Profile mitgeliefert.

## Optionale echte Quellenzugriffe

Der lokale Server enthält Adapter für **Bundesagentur**, **LinkedIn**, **Indeed**, **StepStone** und konfigurierte **Arbeitgeberseiten**. Live-Zugriffe sind standardmäßig aus und erfordern eine ausdrückliche Aktivierung:

```powershell
npm run build
$env:JOBPILOT_LIVE = '1'
npm start
```

Anschließend unter **Aufbau & Grenzen** den lokalen Live-Modus wählen und die Suche starten. Eine Suchanfrage liest höchstens zwei Suchvarianten mit jeweils zwei Bundesagentur-Seiten. Ein gespeicherter Abfrageindex setzt den Plan fort; die nächste Themenrunde beginnt erst nach allen Varianten dieses Plans. Öffentliche Quellen liefern ihre jeweiligen Zustände `ok`, `partial`, `blocked` oder `error`. Bis zu zwölf unvollständige Bundesagentur-Beschreibungen werden anschließend über den Detailadapter angereichert. Fehlgeschlagene Versuche bleiben als unvollständig erkennbar und werden frühestens nach sechs Stunden erneut versucht. Anzeigen können auch manuell ergänzt werden.

Für eigene Arbeitgeberquellen kann eine lokale Datei `daten/arbeitgeber.json` angelegt werden:

```json
[{ "name": "Eigener freigegebener Arbeitgeber", "url": "https://karriere.example.test/jobs" }]
```

Die Adresse ist ein Platzhalter und muss durch eine tatsächliche öffentliche Karriereseite ersetzt werden. Pro Aufruf werden höchstens fünf konfigurierte Arbeitgeberseiten gelesen. Unterstützt werden strukturierte `JobPosting`-Daten derselben Domain; Weiterleitungen, Anmeldung und Captchas werden nicht umgangen. Die JSON-LD-Lesbarkeit einer Seite beweist keine Annahme von Bewerbungen per E-Mail.

Externe Quellen sind nicht garantiert verfügbar. Die automatischen Tests ersetzen externe Antworten durch Fixtures und kontrollieren Fehler-/Blockadefälle. **Sie belegen keinen erfolgreichen Live-Zugriff auf alle Anbieter.** Betrieb nur lokal vorgesehen; keine Mehrbenutzerfreigabe ohne eigene Authentifizierung und Betriebsprüfung.

## Browser-Erweiterung

Unter `public/erweiterung/` liegt eine Chrome-/Edge-Erweiterung nach Manifest V3. Den Ordner über die Entwickleransicht als entpackte Erweiterung laden. Sie enthält kein Profil. Eigene bestätigte Angaben werden lokal gespeichert; offene Antworten lassen sich ausdrücklich ergänzen. Lebenslauf und Anschreiben müssen für die jeweilige Bewerbung ausgewählt werden. Dateien werden nicht versendet. [Bedienung und Grenzen](docs/FORMULARASSISTENT.md).

## Prüfen

```sh
npm test
npm run pruefen:typen
npm run pruefen:privat
```

Die Tests behandeln Themenabdeckung, Vergleich, Dubletten, Historie, URL-Grenzen, JSON-LD, blockierte Quellen, Arbeitgeberseiten, lokale Persistenz und Suchsperren. Sie kontaktieren keinen echten Arbeitgeber und keinen E-Mail-Dienst.

Für Browserprüfungen ist zusätzlich Playwright mit Chromium erforderlich. `PLAYWRIGHT_MODUL` kann auf eine vorhandene Installation zeigen:

```sh
node werkzeuge/browser-pruefen.cjs http://127.0.0.1:3037/
```

Der Browserlauf prüft Filter, Suchwiederholung, Statuspersistenz, Import/Export, alle sechs Suchpläne, den Formularmotor samt Antwortbank und die vier mobilen Ansichten. Berichte bleiben unter `.nachweise/` lokal. Der Datenschutzprüfer erkennt typische Privatdateien und Zugangsdatenmuster; er ergänzt die manuelle Positivliste und ist keine allgemeine Garantie gegen alle Geheimnisse.

## Aufbau und Herkunft

```text
src/kern/                übernommene, teilweise sprachlich angepasste Suchmodule
src/ablauf.ts            portable Import-, Bewertungs- und Gruppenlogik
src/arbeitgeber.ts       konfigurierbare öffentliche Arbeitgeberquellen
src/server.ts            optionaler lokaler Server, JSON-Persistenz und Suchsperre
src/app.tsx + stil.css   eigenständige öffentliche React-Oberfläche
src/beispiele.ts         vollständig synthetische Stellen und Beispielprofil
public/erweiterung/     gemeinsamer Feldmotor und deutsche Erweiterungsoberfläche
public/formular/        synthetisches Übungsformular ohne Absenden
pruefungen/              deterministische Tests ohne reale Konten
```

[Architektur und Unterschiede zum persönlichen Original](docs/ARCHITEKTUR.md) · [Anforderungen und Abnahme](docs/ABNAHME.md) · [Übernommene Module und Prüfsummen](HERKUNFT.json).

Die Suchintegration enthält unter MIT lizenzierte Ansätze aus JobScout. Die ursprünglichen Hinweise und Lizenztexte bleiben unter [NOTICE](src/kern/NOTICE.md) und [LICENSE.JobScout](src/kern/LICENSE.JobScout) erhalten. Die Herkunftsangaben unterscheiden diese Drittanteile vom eigenen Anwendungscode und von der neuen öffentlichen Oberfläche.

## Statische Veröffentlichung

Die öffentliche Demo wird auf GitHub Pages aus dem Branch `gh-pages` bereitgestellt. Er enthält nur den geprüften Browserexport, während `main` die wartbaren Quellen enthält. Nach einem erneuten Build werden `dist/index.html`, `dist/assets/`, `dist/formular/`, `dist/erweiterung/`, `.nojekyll` sowie `LICENSE.JobScout` und `NOTICE.JobScout.md` in diesen Veröffentlichungsbranch übernommen. Der Node-Server läuft dadurch nicht auf GitHub Pages.

Unter `docs/github-actions.vorlage.yml` liegt eine optionale Vorlage für spätere automatische Prüfungen und Bereitstellungen. Sie ist bewusst kein aktiver Workflow: Die zur Erstveröffentlichung verwendete GitHub-Verbindung darf keine neuen Workflow-Dateien schreiben. Die dokumentierten lokalen Prüfungen wurden trotzdem tatsächlich ausgeführt; eine spätere CI-Aktivierung erfordert entsprechend berechtigten Repositoryzugriff.
