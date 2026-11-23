# JobPilot

**Stellen suchen, Anforderungen verstehen und den nächsten Schritt vorbereiten.**

[Interaktive Demo](https://jorxas.github.io/JobPilot/) · [Portfolio von Jordan Freddy](https://jorxas.github.io/Portfolio/)

JobPilot ist aus einem tatsächlich verwendeten persönlichen Werkzeug zur Jobsuche entstanden. Die Demo zeigt die echte Oberfläche des Bewerbungsraums (Stellenübersicht und Antworten) mit ausschließlich erfundenen Unternehmen, Personen und Nachrichten. Das persönliche Original und seine Bewerbungsdaten bleiben privat. Die zusätzliche öffentliche Fassung wurde mit KI-Unterstützung entwickelt und geprüft.

![Stellenübersicht der öffentlichen JobPilot-Demo](docs/stellenuebersicht.png)

## Was die Demo zeigt

Konkrete Fälle statt Erklärtexte, alles mit Beispieldaten:

- **Stellenübersicht:** offene Stellen mit Passung, neue Anzeigen mit Marker, Tagesziel und eine Fiche je Firma. Die zweite Anzeige einer Firma, an die schon eine Bewerbung ging, bleibt archiviert und ist gesperrt.
- **Kennzahlen:** „Noch offen“ (von N Unternehmen im Blick), „Unternehmen beworben“ mit Tagesziel, „Positive Antworten“ (Einladungen und Zusagen) und „Absagen“. Je Unternehmen zählt die zuletzt eingegangene entscheidende Antwort; Eingangsbestätigungen, Rückfragen nach Unterlagen und Portalhinweise („Nur über Portal“) zählen nicht.
- **Filterzeile:** Schalter „Echte Bewerbung“ und „Initiativbewerbung“ (kombinierbar), Höchstentfernung von Gießen, Sortierung nach Passung oder Entfernung (auf- und absteigend), ein zweites Kriterium für gleiche Werte und „Zurücksetzen“. Die Entfernung steht in Kilometern in der Ortszeile, Initiativbewerbungen tragen eine Marke. Orte, Entfernungen und Firmen sind erfunden.
- **Nur Informatik:** Stellen, deren Titel keinen IT-Bezug hat (im Beispiel eine Buchhaltungsstelle), erscheinen nirgends. Ausnahmen sind Initiativbewerbungen, Redaktions- und Content-Stellen für Websites sowie archivierte, versandte, gewählte und fertig vorbereitete Fichen. Die Regel stammt aus dem geteilten Kern (`src/kern/company-catalogue.ts`).
- **Fiche im Detail:** Gründe für die Passung, Hinweise, vorhandene Unterlagen und der Hinweis, wenn nur ein allgemeiner Lebenslauf vorliegt. Die zwei erfundenen Beispieldokumente öffnen sich zum Ansehen im Browser, ohne Download. „Mit Assistent öffnen (neuer Tab)“ und „Eigenes Assistentfenster“ sind sichtbar, aber gesperrt: Die Demo besitzt keinen Browserassistenten und füllt nichts aus.
- **Zweisprachig:** Deutsch ist der Standard; der Umschalter DE | FR oder `?lang=fr` wechselt die Oberfläche auf Französisch. Mailtexte und Stellentitel der erfundenen Beispiele bleiben deutsch, wie sie ein deutscher Arbeitgeber schickt.
- **Status pflegen:** Versandt oder archiviert markieren; die Änderung gilt bis zum Neuladen.
- **Antworten:** Eingangsbestätigung, Einladung zum Gespräch und Absage werden der jeweiligen Bewerbung zugeordnet; eine mehrdeutige Nachricht lässt sich manuell zuordnen.

Die Demo besitzt kein Backend, versendet nichts und öffnet keinen Browser für den Formularassistenten. Seiten, die im lokalen JobPilot Serverdaten brauchen (Stellensuche, Profil, Einstellungen, Dossier), erscheinen als kurzer Hinweis statt als nachgebaute Ersatzseite.

Daneben liegen als geprüfte Module der Suchkern, die Arbeitgeberadapter, der optionale lokale Server und die Formularerkennung. Ein Übungsformular ohne Absenden steht unter `/formular/`. Es enthält ein Namensfeld „Vor- & Nachname“, ein Köderfeld („Bitte lasse dieses Feld leer“), ein Empfehlungsfeld, ein Feld „Geburtstag (TT.MM.JJJJ)“, eine Auswahl „Bundesland“, ein gemeinsames Dokumentenfeld („Anschreiben, Lebenslauf, Anlagen“) und lässt den Feldmotor mit einem erfundenen Profil laufen.

## Lokal starten

Node.js ab 22.12 und npm werden benötigt.

```sh
git clone https://github.com/Jorxas/JobPilot.git
cd JobPilot
npm ci
npm run dev
```

Öffnen: `http://127.0.0.1:3037/`. Die Oberfläche beginnt mit erfundenen Daten und setzt sich beim Neuladen zurück. Der optionale Server (`daten/zustand.json` in einem ignorierten Laufzeitordner, `PORT` und `JOBPILOT_DATEN` für Port und Datenverzeichnis) stellt die API der Module bereit. Es werden keine Zugangsdaten oder persönlichen Profile mitgeliefert.

## Optionale echte Quellenzugriffe

Der lokale Server enthält Adapter für **Bundesagentur**, **LinkedIn**, **Indeed**, **StepStone** und konfigurierte **Arbeitgeberseiten**. Live-Zugriffe sind standardmäßig aus und erfordern eine ausdrückliche Aktivierung:

```powershell
npm run build
$env:JOBPILOT_LIVE = '1'
npm start
```

Die API des Servers startet dann Live-Suchen (die Demo-Oberfläche selbst ist nicht an Live-Quellen angeschlossen). Eine Suchanfrage liest höchstens zwei Suchvarianten mit jeweils zwei Bundesagentur-Seiten. Ein gespeicherter Abfrageindex setzt den Plan fort; die nächste Themenrunde beginnt erst nach allen Varianten dieses Plans. Öffentliche Quellen liefern ihre jeweiligen Zustände `ok`, `partial`, `blocked` oder `error`. Bis zu zwölf unvollständige Bundesagentur-Beschreibungen werden anschließend über den Detailadapter angereichert. Fehlgeschlagene Versuche bleiben als unvollständig erkennbar und werden frühestens nach sechs Stunden erneut versucht. Anzeigen können auch manuell ergänzt werden.

Für eigene Arbeitgeberquellen kann eine lokale Datei `daten/arbeitgeber.json` angelegt werden:

```json
[{ "name": "Eigener freigegebener Arbeitgeber", "url": "https://karriere.example.test/jobs" }]
```

Die Adresse ist ein Platzhalter und muss durch eine tatsächliche öffentliche Karriereseite ersetzt werden. Pro Aufruf werden höchstens fünf konfigurierte Arbeitgeberseiten gelesen. Unterstützt werden strukturierte `JobPosting`-Daten derselben Domain; Weiterleitungen, Anmeldung und Captchas werden nicht umgangen. Die JSON-LD-Lesbarkeit einer Seite beweist keine Annahme von Bewerbungen per E-Mail.

Externe Quellen sind nicht garantiert verfügbar. Die automatischen Tests ersetzen externe Antworten durch Fixtures und kontrollieren Fehler-/Blockadefälle. **Sie belegen keinen erfolgreichen Live-Zugriff auf alle Anbieter.** Betrieb nur lokal vorgesehen; keine Mehrbenutzerfreigabe ohne eigene Authentifizierung und Betriebsprüfung.

## Browser-Erweiterung

Unter `public/erweiterung/` liegt eine Chrome-/Edge-Erweiterung nach Manifest V3. Den Ordner über die Entwickleransicht als entpackte Erweiterung laden. Sie enthält kein Profil und besitzt ein Symbol (blaues Quadrat mit „JP“). Eigene bestätigte Angaben werden lokal gespeichert; offene Antworten lassen sich ausdrücklich ergänzen. Lebenslauf und Anschreiben müssen für die jeweilige Bewerbung ausgewählt werden; „Felder ausfüllen“ hängt sie dann automatisch an, nie ein allgemeiner Lebenslauf. Dateien werden nicht versendet. [Bedienung und Grenzen](docs/FORMULARASSISTENT.md).

## Prüfen

```sh
npm test
npm run pruefen:typen
npm run pruefen:privat
```

Die Tests behandeln Themenabdeckung, Vergleich, Dubletten, Historie, URL-Grenzen, JSON-LD, blockierte Quellen, Arbeitgeberseiten, lokale Persistenz und Suchsperren. Sie kontaktieren keinen echten Arbeitgeber und keinen E-Mail-Dienst.

Für die Browserprüfung der Demo wird ein installierter Chrome oder Edge benötigt (`BROWSER_PFAD` setzt den Pfad):

```sh
npm run build
node werkzeuge/browser-pruefen.cjs
```

Der Browserlauf öffnet die gebaute Demo unter einem Veröffentlichungspfad, prüft Stellenübersicht, Filterzeile (Initiativ, Entfernung auf- und absteigend, zweites Kriterium, Zurücksetzen), die Regel „Nur Informatik“, Fiche mit gesperrtem Assistenten und Dokumenten zum Ansehen, Archiv und Zweitstellen, Antworten, nicht enthaltene Seiten, Französisch (Umschalter und `?lang=fr`), das Übungsformular, die Handyansicht sowie das Ausbleiben von Laufzeitfehlern und externen Anfragen. Mit `--url=<Adresse>` läuft dieselbe Prüfung gegen die veröffentlichte Demo. Der Datenschutzprüfer erkennt typische Privatdateien und Zugangsdatenmuster; er ergänzt die manuelle Positivliste und ist keine allgemeine Garantie gegen alle Geheimnisse. Als PDF sind nur die zwei erfundenen Beispielunterlagen erlaubt.

## Aufbau und Herkunft

```text
src/kern/                übernommene, teilweise sprachlich angepasste Suchmodule
src/ablauf.ts            portable Import-, Bewertungs- und Gruppenlogik
src/arbeitgeber.ts       konfigurierbare öffentliche Arbeitgeberquellen
src/server.ts            optionaler lokaler Server, JSON-Persistenz und Suchsperre
src/oberflaeche/        Oberfläche des Bewerbungsraums (React), Sprachen DE/FR (sprache.ts) und Demo-Daten (demo-start.ts)
src/beispiele.ts         vollständig synthetische Stellen und Beispielprofil
public/erweiterung/     gemeinsamer Feldmotor, deutsche Erweiterungsoberfläche und Symbole
public/formular/        synthetisches Übungsformular ohne Absenden und Übungslauf (uebung.js)
public/beispiel/        zwei erfundene Beispielunterlagen für die Demo
pruefungen/              deterministische Tests ohne reale Konten
```

[Architektur und Unterschiede zum persönlichen Original](docs/ARCHITEKTUR.md) · [Anforderungen und Abnahme](docs/ABNAHME.md) · [Übernommene Module und Prüfsummen](HERKUNFT.json).

Die Suchintegration enthält unter MIT lizenzierte Ansätze aus JobScout. Die ursprünglichen Hinweise und Lizenztexte bleiben unter [NOTICE](src/kern/NOTICE.md) und [LICENSE.JobScout](src/kern/LICENSE.JobScout) erhalten. Die Herkunftsangaben unterscheiden diese Drittanteile vom eigenen Anwendungscode und von der neuen öffentlichen Oberfläche.

## Statische Veröffentlichung

Die öffentliche Demo wird auf GitHub Pages aus dem Branch `gh-pages` bereitgestellt. Er enthält nur den geprüften Browserexport, während `main` die wartbaren Quellen enthält. Nach einem erneuten Build werden `dist/index.html`, `dist/assets/`, `dist/schriften/`, `dist/beispiel/`, `dist/favicon.svg`, `dist/formular/`, `dist/erweiterung/`, `.nojekyll` sowie `LICENSE.JobScout` und `NOTICE.JobScout.md` in diesen Veröffentlichungsbranch übernommen. Der Node-Server läuft dadurch nicht auf GitHub Pages.

Unter `docs/github-actions.vorlage.yml` liegt eine optionale Vorlage für spätere automatische Prüfungen und Bereitstellungen. Sie ist bewusst kein aktiver Workflow: Die zur Erstveröffentlichung verwendete GitHub-Verbindung darf keine neuen Workflow-Dateien schreiben. Die dokumentierten lokalen Prüfungen wurden trotzdem tatsächlich ausgeführt; eine spätere CI-Aktivierung erfordert entsprechend berechtigten Repositoryzugriff.
