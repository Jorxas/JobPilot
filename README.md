# JobPilot

**Stellen suchen, Anforderungen verstehen und den nächsten Schritt vorbereiten.**

[Interaktive Demo](https://jorxas.github.io/JobPilot/) · [Portfolio von Jordan Freddy](https://jorxas.github.io/Portfolio/)

JobPilot ist aus einem tatsächlich verwendeten persönlichen Werkzeug zur Jobsuche entstanden. Die Demo zeigt die echte Oberfläche des Bewerbungsraums (Stellenübersicht und Antworten) mit ausschließlich erfundenen Unternehmen, Personen und Nachrichten. Das persönliche Original und seine Bewerbungsdaten bleiben privat. Die zusätzliche öffentliche Fassung wurde mit KI-Unterstützung entwickelt und geprüft.

![Stellenübersicht der öffentlichen JobPilot-Demo](docs/stellenuebersicht.png)

## Was die Demo zeigt

Konkrete Fälle statt Erklärtexte, alles mit Beispieldaten:

- **Stellenübersicht:** offene Stellen mit Passung, neue Anzeigen mit Marker, Tagesziel und eine Fiche je Firma. Die zweite Anzeige einer Firma, an die schon eine Bewerbung ging, bleibt archiviert und ist gesperrt.
- **Kennzahlen:** „Noch offen“ (von N Unternehmen im Blick), „Unternehmen beworben“ mit Tagesziel, „Positive Antworten“ (Einladungen und Zusagen) und „Absagen“. Je Unternehmen zählt die zuletzt eingegangene entscheidende Antwort; Eingangsbestätigungen, Rückfragen nach Unterlagen und Portalhinweise („Nur über Portal“) zählen nicht. Die Kachel „Positive Antworten“ nennt auch bisherige Gespräche und spätere Absagen.
- **Filterzeile:** Zeile 2 hat nur wenige Elemente: „Art“ als dreiteilige Auswahl (Alle, Stellen, Initiativ), „Ergebnis“ (Alle, Wartet, Absage, Positiv; nur im Reiter Versandt oder Alle sichtbar), „Entfernung“ (Beliebig, 25, 50, 100, 150 km von Gießen) und ein Feld „Sortieren“ (Beste Passung zuerst als Standard, Nächste zuerst, Weiteste zuerst, Zuletzt beworben zuerst, Zuerst beworben zuerst; ohne Entfernung oder Datum am Ende, bei Gleichstand entscheidet die Passung). „Zurücksetzen“ erscheint nur bei aktiven Filtern und setzt auch das Ergebnis zurück. Die Schalter für alle Einträge und archivierte Zweitstellen stehen eingeklappt unter „Mehr“. Das Ergebnis je Unternehmen ist die zuletzt eingegangene entscheidende Antwort; jede Fiche zeigt genau eine kleine Marke. Versandte Fichen nennen „am TT.MM.JJJJ“ oder „Datum unbekannt“. Die Entfernung steht in Kilometern in der Ortszeile, Initiativbewerbungen tragen eine Marke. Orte, Entfernungen und Firmen sind erfunden.
- **Nur Informatik:** Stellen, deren Titel keinen IT-Bezug hat (im Beispiel eine Buchhaltungsstelle), erscheinen nirgends. Ausnahmen sind Initiativbewerbungen, Redaktions- und Content-Stellen für Websites sowie archivierte, versandte, gewählte und fertig vorbereitete Fichen. Die Regel stammt aus dem geteilten Kern (`src/kern/company-catalogue.ts`).
- **Fiche im Detail:** Gründe für die Passung, Hinweise, vorhandene Unterlagen und der Hinweis, wenn nur ein allgemeiner Lebenslauf vorliegt. Die zwei erfundenen Beispieldokumente öffnen sich zum Ansehen im Browser, ohne Download. „Mit Assistent öffnen (neuer Tab)“ und „Eigenes Assistentfenster“ sind sichtbar, aber gesperrt: Die Demo besitzt keinen Browserassistenten und füllt nichts aus.
- **Zweisprachig:** Deutsch ist der Standard; der Umschalter DE | FR oder `?lang=fr` wechselt die Oberfläche auf Französisch. Mailtexte und Stellentitel der erfundenen Beispiele bleiben deutsch, wie sie ein deutscher Arbeitgeber schickt.
- **Status pflegen und archivieren:** Versandt markieren oder archivieren; die Änderung gilt bis zum Neuladen. Archivieren fragt wie im Original nach genau einem von drei Gründen: „Angebot nicht verfügbar“, „Kein IT-Bezug“ oder „Sonstiges“ (mit optionaler Anmerkung). Nur „Kein IT-Bezug“ schließt die Firma dauerhaft aus; ihre offenen Stellen verschwinden aus der Übersicht, ihr Status lässt sich nicht mehr ändern. Die anderen Gründe archivieren nur dieses Angebot. Der Reiter „Archiviert“ zeigt alle archivierten Einträge mit ihrem Grund.
- **Antworten:** Eingangsbestätigung, Einladung zum Gespräch und Absage werden der jeweiligen Bewerbung zugeordnet; eine mehrdeutige Nachricht lässt sich manuell zuordnen.

Die Demo besitzt kein Backend, versendet nichts und öffnet keinen Browser für den Formularassistenten. Seiten, die Serverdaten brauchen (Stellensuche, Profil, Einstellungen, Dossier), erscheinen als kurzer Hinweis statt als nachgebaute Ersatzseite. Die Stellensuche mit echtem Suchknopf gibt es nur am eigenen lokalen Server (siehe unten); auf GitHub Pages bleibt sie ein Hinweis.

Daneben liegen als geprüfte Module der Suchkern, die Arbeitgeberadapter, der optionale lokale Server und die Formularerkennung. Ein Übungsformular ohne Absenden steht unter `/formular/`. Es enthält ein Namensfeld „Vor- & Nachname“, ein Köderfeld („Bitte lasse dieses Feld leer“), ein Empfehlungsfeld, ein Feld „Geburtstag (TT.MM.JJJJ)“, eine Auswahl „Bundesland“, ein gemeinsames Dokumentenfeld („Anschreiben, Lebenslauf, Anlagen“), wahlweise ein allgemeines Feld „Datei“ oder ein Ablagefeld ohne Dateifeld, und lässt den Feldmotor mit einem erfundenen Profil laufen.

## Lokal starten

Node.js ab 22.12 und npm werden benötigt.

```sh
git clone https://github.com/Jorxas/JobPilot.git
cd JobPilot
npm ci
npm run dev
```

Öffnen: `http://127.0.0.1:3037/`. Am lokalen Server zeigt dieselbe Oberfläche die Daten des Servers statt der Browser-Demo: Der Server liefert die gebaute Seite ohne `demo.js` und mit der Kennzeichnung „Lokaler Server“ aus. Bis zur ersten Live-Suche stehen dort erfundene Beispieleinträge des Servers; Statusänderungen und Archiventscheidungen werden in `daten/zustand.json` gespeichert (ignorierter Laufzeitordner; `PORT` und `JOBPILOT_DATEN` setzen Port und Datenverzeichnis) und bleiben nach dem Neuladen erhalten. Der Posteingang (Antworten aus Gmail), Profil, Einstellungen und Dossier gehören zum persönlichen Original; die Oberfläche nennt das, statt etwas vorzutäuschen. Es werden keine Zugangsdaten oder persönlichen Profile mitgeliefert.

## Echte Stellensuche auf dem eigenen PC

Der lokale Server fragt dieselben 21 Plattformen wie das persönliche Original ab: Arbeitsagentur, LinkedIn Jobs, Indeed, StepStone, Stellenanzeigen.de, meinestadt.de, XING Jobs, HeyJobs, Jobware, Workwise, JobTeaser, Stellenwerk, StudentJob, Jobmensa, Absolventa, get in IT, Jobvector, UNICUM Karrierezentrum, Jobs in Mittelhessen, THM Jobportal und Studierendenwerk Gießen. Dazu kommen optional konfigurierte **Arbeitgeberseiten**. Live-Zugriffe sind standardmäßig aus und erfordern eine ausdrückliche Aktivierung:

```powershell
npm run build
$env:JOBPILOT_LIVE = '1'
npm start
```

Unter macOS oder Linux entsprechend `JOBPILOT_LIVE=1 npm start`. Danach `http://127.0.0.1:3037/offres` öffnen. Die Stellensuche ist wie `/offres` im Original aufgebaut:

- **Knopf „Neue Stellen suchen“** mit dem Stand der letzten Suche in einer Zeile und kurzen Fakten (Ort und Umkreis, Zahl der Suchbegriffe, gewählte Plattformen, „Nur Informatik“, neue und noch vorzubereitende Stellen). Ein Klick startet genau einen Suchstart über `POST /api/suche` mit dem Indeed-Anbieter `auto` im Hintergrund; eine Fortschrittszeile verfolgt ihn über `GET /api/status`. Solange eine Suche läuft, ist der Knopf gesperrt, und es startet keine zweite, auch nicht aus einem zweiten Fenster oder während einer Suche aus dem Gespräch. Danach nennt die Seite die Zahl der neuen Stellen, wie viele davon noch vorzubereiten sind, nicht übernommene Treffer ausgeschlossener Firmen und jede eingeschränkte Plattform. Das Ergebnis heißt immer Teilabdeckung, nie vollständige Marktabdeckung.
- **Suchbegriffe:** Der IT-Katalog ist vorgewählt (Pastillen mit Kreuz, gruppiert nach Bereichen), eigene Begriffe kommen über das Eingabefeld dazu. Erst „Auswahl bestätigen und speichern“ macht die Liste zur gültigen Suchliste; vorher startet der Knopf keine Suche. Der Suchplan zeigt die Verteilung auf fünf Durchläufe.
- **Plattformen:** eine Zusammenfassungszeile, nur Problemquellen (blockiert, nur Link, Fehler) hervorgehoben, darunter einklappbar alle 21 Chips mit Zustandspastille. Ein Klick wählt eine Plattform ab oder wieder an und speichert sofort. Die Zustände stammen ausschließlich aus den Berichten der letzten Live-Suche, sonst „nicht abgefragt“.
- **Ort, Umkreis und Art der Suche** sowie die **Suchdetails** (Bericht je Anfrage) sind eingeklappt.

Ohne `JOBPILOT_LIVE=1` erklärt die Seite, wie die Live-Suche einzuschalten ist, und der Knopf bleibt gesperrt; es wird nichts abgefragt und kein Ergebnis vorgetäuscht. Suchbegriffe, Plattformwahl, Ort und Umkreis speichert der Server über `POST /api/kriterien` (mit Prüfung jeder Angabe) als Feld `auftrag` in `daten/zustand.json`.

Denselben Suchstart löst auch das Werkzeug `werkzeuge/suche-starten.mjs` in einem zweiten Terminal oder aus einem Gespräch aus. Ohne Angaben verwendet es die in der Oberfläche gespeicherten Kriterien und sendet dieselbe Anfrage wie der Knopf:

```sh
node werkzeuge/suche-starten.mjs --run --ort=Gießen --umkreis=50 --begriffe="Werkstudent Informatik; Praktikum Data"
```

Weitere Angaben: `--ohne=` wählt Plattformen ab, `--plattformen=` fragt nur die genannten (Kennungen wie `bundesagentur,linkedin,xing`; `GET /api/suche` nennt alle 21), `--provider=` wählt den Indeed-Anbieter (siehe unten), `--json` gibt das Ergebnis als JSON aus. Ohne Ort und Begriffe gelten die gespeicherten Kriterien: in der Stellensuche bestätigt oder beim letzten Live-Suchstart verwendet. Angaben beim Aufruf werden zu den neuen gespeicherten Kriterien. Es meldet jeden abgeschlossenen Durchlauf und am Ende eine Zusammenfassung: neue Stellen, wie viele Plattformen gelesen, teilweise gelesen oder blockiert wurden, und welche Plattformen den Browser brauchen. Die gefundenen Stellen liegen in `daten/zustand.json` und sind über `GET /api/status` abrufbar. Direkt über die API: `POST /api/suche` mit `live: true`, Ort (`city`), Umkreis (`radius`), Suchbegriffen (`keywordList`), optional der Plattformliste (`quellen`) und dem Indeed-Anbieter (`indeedProvider`); mit `hintergrund: true` läuft der Suchstart im Hintergrund weiter.

So läuft ein Suchstart ab, wie im Original:

- **Fünf Durchläufe, eine Anfrage je Plattform und Durchlauf.** Der Spurplan verteilt die Suchbegriffe so, dass verschiedene Plattformen im selben Durchlauf verschiedene Begriffe erhalten und über mehrere Suchstarte alle Begriffe drankommen. Die Rotation wird gespeichert; ein anderer Ort oder Umkreis beginnt sie neu, ohne Stellen oder Historie zu löschen.
- **Arbeitsagentur:** zwei Ergebnisseiten je Anfrage über die öffentliche Schnittstelle; der Seitenstand je Suchbegriff wird gespeichert. Bis zu zwölf unvollständige Beschreibungen werden danach ergänzt, Fehlversuche frühestens nach sechs Stunden erneut.
- **Übrige Plattformen:** Je Plattform liest ein eigener Trefferlistenleser Titel, Firma, Ort und Anzeigenlink; höchstens drei Detailseiten je Liste ergänzen Beschreibungen. Ein Listenausschnitt ist immer eine **Teilabdeckung** und wird so ausgewiesen.
- **Blockierte Quellen pausieren:** Meldet eine Plattform eine Sperre, wird sie im selben Suchstart nicht erneut gefragt; die übersprungenen Anfragen stehen als blockiert im Bericht.
- **Ehrliche Zustände:** gelesen, teilweise, blockiert, nur Link, Abruf fehlgeschlagen oder nicht abgefragt. Kein Treffer und kein Zugriff sind unterschiedliche Ergebnisse; eine Suche wird nie als vollständige Marktabdeckung dargestellt.
- **Laufzeit:** Ein Suchstart dauert je nach Plattformen einige Minuten (UNICUM verlangt laut robots.txt zehn Sekunden Abstand, die Ortsauflösung höchstens eine Anfrage je Sekunde). Der Server arbeitet im Hintergrund weiter und speichert nach jeder Anfrage; `GET /api/status` zeigt den Fortschritt und mit `suchAktiv`, ob der Lauf in diesem Serverprozess wirklich läuft. Ein als laufend gespeicherter Lauf ohne aktiven Prozess gilt als unterbrochen; Knopf und Werkzeug dürfen dann neu starten. Während eines Suchstarts sind andere Änderungen gesperrt (Archivieren und Speichern der Kriterien antworten mit 409).
- **Firmenausschluss:** Anzeigen einer Firma, die mit „Kein IT-Bezug“ archiviert wurde, übernimmt kein Suchstart, auch nicht unter Namensvarianten wie „GmbH & Co. KG“. Der Bericht nennt die Zahl.

## Archivieren und Firmenausschluss

Wie im Original (Regel vom 23. November 2026) gibt es genau drei Archivgründe: `unavailable` („Angebot nicht verfügbar“), `not-it` („Kein IT-Bezug“) und `other` („Sonstiges“, mit optionaler Anmerkung bis 500 Zeichen). Nur `not-it` schließt die Firma dauerhaft aus (`companyExcluded: true`, `archiveScope: "company"`); die beiden anderen archivieren nur das Angebot (`archiveScope: "offer"`), andere Stellen der Firma bleiben möglich. Eine bereits versandte Bewerbung behält Status und Datum, wenn ihre Firma ausgeschlossen wird.

Am lokalen Server speichert die Oberfläche die Entscheidung über `PATCH /api/tracker/<id>/state` (`status: "archived"`, `revision`, `archiveReasonCode`, `archiveNote`). Der Server prüft Status, Revision, Datum, Grund und Anmerkung und speichert nichts bei einem Fehler (400, 404, 409 mit der aktuellen Fiche). Der Ausschluss gilt danach für jeden Suchstart, den manuellen Import, Statusänderungen (eine ausgeschlossene Firma lässt sich nicht wieder öffnen oder als versandt markieren) und den Wechsel zwischen Beispiel- und Live-Daten; auch `POST /api/zuruecksetzen` behält Archiventscheidungen und Ausschlüsse. Kein Ablauf entfernt das Flag. In der statischen Demo gilt dieselbe Regel nur im Browserfenster bis zum Neuladen.

Ortsgebundene Suchadressen des Originals (interne Ortskennungen von Stellenanzeigen.de, get in IT und JobTeaser, Koordinaten für Jobmensa, Stellenwerk-Portale) sind nur für einige Städte hinterlegt. Für andere Orte verwenden diese Plattformen ihre allgemeine Suche oder Übersicht; die Entfernung wird danach geprüft. Jobs in Mittelhessen, THM Jobportal und Studierendenwerk Gießen sind regionale Quellen und außerhalb Mittelhessens kaum nützlich; sie lassen sich abwählen.

Für eigene Arbeitgeberquellen kann eine lokale Datei `daten/arbeitgeber.json` angelegt werden:

```json
[{ "name": "Eigener freigegebener Arbeitgeber", "url": "https://karriere.example.test/jobs" }]
```

Die Adresse ist ein Platzhalter und muss durch eine tatsächliche öffentliche Karriereseite ersetzt werden. Pro Suchstart werden höchstens fünf konfigurierte Arbeitgeberseiten gelesen. Unterstützt werden strukturierte `JobPosting`-Daten derselben Domain; Weiterleitungen, Anmeldung und Captchas werden nicht umgangen. Die JSON-LD-Lesbarkeit einer Seite beweist keine Annahme von Bewerbungen per E-Mail.

Externe Quellen sind nicht garantiert verfügbar und ändern ihre Seiten. Die automatischen Tests ersetzen externe Antworten durch Fixtures und kontrollieren Fehler- und Blockadefälle. **Sie belegen keinen erfolgreichen Live-Zugriff auf alle Anbieter.** Betrieb nur lokal vorgesehen; keine Mehrbenutzerfreigabe ohne eigene Authentifizierung und Betriebsprüfung.

## robots.txt und technische Sperren

Der Server ruft Seiten mit der ehrlichen Kennung `Mozilla/5.0 (compatible; JobAssistant public offer reader)` ab, gibt sich also nicht als gewöhnlicher Browser aus. Er stellt wenige Anfragen je Suchstart (eine Liste und höchstens drei Detailseiten je Plattform und Durchlauf), speichert Antworten fünf Minuten zwischen und hält verlangte Abstände ein.

Wie im persönlichen Original gilt für diese private Stellensuche ein Verbot in robots.txt allein **nicht** als Ausschlussgrund. Das betrifft nach der Prüfung des Originals vom 26. November 2026 folgende Quellen:

- **XING Jobs:** robots.txt untersagt `/jobs/search` allen Programmen außer namentlich genannten Crawlern; gelesen wird die Suchseite `/jobs/search/ki`.
- **THM Jobportal:** robots.txt `Disallow: /`; gelesen werden Trefferliste, Anzeige und deren eingebetteter Anzeigentext.
- **Jobs in Mittelhessen:** robots.txt untersagt allgemeinen Programmen jeden Pfad; gelesen werden die Stadtlisten `/werkstudent/<ort>` und `/praktikum/<ort>` sowie Anzeigenseiten.
- **StudentJob:** robots.txt untersagt kombinierte Filter (`Disallow: /*&search*`); die Suche verbindet Stichwort, Ort und Umkreis.
- **Stellenanzeigen.de:** Die Ortskennung stammt aus einem laut robots.txt gesperrten Auflöser; sie ist für wenige Städte fest hinterlegt und wird mit dem Stichwort kombiniert. Der Auflöser selbst wird nicht aufgerufen.

Wer das nicht möchte, wählt diese Plattformen beim Suchstart ab, zum Beispiel mit `--ohne=xing,thm,mittelhessen,studentjob,stellenanzeigen` im Werkzeug oder über die Plattformliste `quellen` der API; ohne Angabe fragt der Server alle 21.

**Technische Sperren werden nie umgangen.** Cloudflare-Prüfungen, AWS-WAF-Aufgaben, Anubis, Captchas und Anmeldungen gelten als Sperre: kein Wiederholen, keine geänderte Browserkennung, keine Lösung von Aufgaben. Indeed, Jobvector und HeyJobs sperren automatische Abrufe technisch und erhalten deshalb **keine einzige Anfrage**; das Studierendenwerk Gießen nennt weder Firma noch eigenen Anzeigenlink. Diese Quellen bleiben als Suchlink und manueller Import nutzbar.

## Umkreis und Ortsdaten

Viele Plattformen liefern bundesweite Treffer oder kennen keinen Umkreis. Deshalb prüft der Server bei allen Quellen außer Arbeitsagentur, LinkedIn und StepStone (die selbst nach Umkreis filtern) die Entfernung zwischen Suchort und Einsatzort. Nennt eine Anzeige mehrere Einsatzorte, genügt einer im Umkreis; Bundesländer, „Remote“ oder „bundesweit“ zählen nicht als Ort. Eine ungeklärte Entfernung wird nie geraten: Solche Treffer werden nicht übernommen und im Bericht gezählt.

Das Original nutzt dafür einen persönlichen Ortscache, der nicht veröffentlicht wird. Die öffentliche Fassung löst unbekannte Orte einzeln über [OpenStreetMap Nominatim](https://nominatim.org/) auf: zuerst die Postleitzahl, sonst den Ortsnamen, beschränkt auf Deutschland und auf Siedlungen. Dabei gelten die Regeln der Nominatim-Nutzungsrichtlinie: eigene Kennung `JobPilot/1.0 (lokale private Stellensuche; +https://github.com/Jorxas/JobPilot)`, höchstens eine Anfrage je Sekunde, höchstens 60 neue Orte je Suchstart und kein erneuter Versuch nach einer Sperre im selben Suchstart. Ergebnisse liegen unter `daten/geocache.json` (ignoriert) und werden nicht erneut gefragt; nicht gefundene Orte frühestens nach 30 Tagen. Übertragen werden nur Ortsnamen oder Postleitzahlen, keine Profile oder Suchbegriffe.

Gewählt wurde Nominatim statt eines mitgelieferten Postleitzahlendatensatzes, weil Anzeigen oft nur einen Ortsnamen oder Ortsteil nennen und ein offener Dienst mit Zwischenspeicher für einzelne Personen ohne zusätzliche Lizenzpflege und Datenpflege auskommt. Geodaten © OpenStreetMap-Mitwirkende, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). Mit `JOBPILOT_GEOKODIERUNG=0` entfällt jede Ortsabfrage; dann gelten nur der Zwischenspeicher und ein exakt gleicher Ortsname.

## Indeed über Claude (optional)

Indeed sperrt automatische Abrufe technisch. Wer Claude Code nutzt, kann Indeed wie im Original über den offiziellen Indeed-Connector von Claude einbinden. Ohne diese Einrichtung bleibt Indeed ein Browserlink mit manuellem Import.

Einrichtung:

1. Claude Code nach der Anleitung von Anthropic installieren und mit dem **eigenen claude.ai-Konto** anmelden (`claude`, dann `/login`). Ein API-Schlüssel genügt nicht: Connectoren laden nur mit der claude.ai-Anmeldung.
2. Auf claude.ai unter Einstellungen → Connectors den **Indeed**-Connector mit dem eigenen Indeed-Konto verbinden.
3. Den Server mit Live-Suche und ausdrücklicher Freigabe starten:

```powershell
$env:JOBPILOT_LIVE = '1'
$env:JOBPILOT_INDEED_CLAUDE = '1'
npm start
```

JobPilot sucht Claude Code über `JOBPILOT_CLAUDE_CLI`, die npm-Installation unter Windows, `~/.local/bin` und den Suchpfad (`claude.exe` unter Windows, `claude` unter macOS und Linux). Die Startmeldung nennt, ob Indeed über Claude freigeschaltet ist.

Ablauf und Grenzen: Nur ein ausdrücklicher Suchstart mit Anbieterwahl (Werkzeug `suche-starten.mjs` oder API mit `indeedProvider`) löst einmal je Suchstart höchstens einen Lauf `claude -p` aus; welcher Connector läuft, regelt die Anbieterwahl weiter unten. Es gibt keine zeitgesteuerten Läufe. Claude läuft im temporären Ordner mit dem Modell Haiku und darf ausschließlich ToolSearch sowie die Lesewerkzeuge `search_jobs` und `get_job_details` des Connectors verwenden: keine eingebauten Werkzeuge, kein Web, keine Dateien, kein Lebenslauf (`get_resume`). `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` und `CLAUDE_CODE_OAUTH_TOKEN` werden für diesen Lauf entfernt. Gesucht werden die fünf Begriffe der Indeed-Spur am eingestellten Ort, danach höchstens 15 Detailabrufe. JobPilot liest die Werkzeugantworten roh aus `stream-json`; Claude schreibt keine Stellendaten ab. Der Connector kennt keinen Umkreis, deshalb durchlaufen Indeed-Treffer dieselbe Umkreis-, IT- und Dublettenprüfung. Suchbegriffe und Ort gehen dabei an Anthropic und Indeed unter den eigenen Konten; die Läufe zählen zum eigenen Claude-Abonnement. Der Connector ist ein Angebot von Anthropic und Indeed und kann sich ändern; dann meldet der Bericht einen Fehler statt eines Erfolgs.

## Indeed über ChatGPT/Codex (optional)

Wie im Original lässt sich Indeed auch über die offizielle App „Indeed Job Search“ des eigenen ChatGPT-Kontos einbinden. JobPilot spricht dazu das lokale Programm Codex von OpenAI an. Ohne diese Einrichtung und ohne Claude bleibt Indeed ein Browserlink mit manuellem Import.

Einrichtung:

1. Codex nach der Anleitung von OpenAI installieren (zum Beispiel `npm install -g @openai/codex`) und mit dem **eigenen ChatGPT-Konto** anmelden (`codex login`, Anmeldung mit ChatGPT). Eine Anmeldung mit API-Schlüssel genügt nicht: JobPilot prüft die Kontoart und bricht sonst ohne Suche ab.
2. In ChatGPT die App [Indeed Job Search](https://chatgpt.com/plugins/plugin_asdk_app_6982856578088191a6cf4a963662adf0) hinzufügen und mit dem eigenen Konto verbinden. Vor jeder Suche prüft JobPilot über Codex, dass genau diese App installiert, freigegeben und aufrufbar ist.
3. Den Server mit Live-Suche und ausdrücklicher Freigabe starten:

```powershell
$env:JOBPILOT_LIVE = '1'
$env:JOBPILOT_INDEED_CODEX = '1'
npm start
```

Unter macOS oder Linux entsprechend `JOBPILOT_LIVE=1 JOBPILOT_INDEED_CODEX=1 npm start`. Die Startmeldung nennt, ob Indeed über ChatGPT/Codex freigeschaltet ist.

JobPilot startet Codex nie über eine Shell und sucht es in dieser Reihenfolge: `JOBPILOT_CODEX_CLI` (absoluter Pfad zur ausführbaren Datei oder zu `codex.js`; `.cmd`, `.bat` und `.ps1` werden nicht gestartet), unter Windows die native Datei der npm-Installation, der Suchpfad (`codex.exe` unter Windows, `codex` unter macOS und Linux), `~/.local/bin` und zuletzt der npm-Starter `codex.js` über Node (unter Windows in `%APPDATA%\npm`, unter macOS und Linux neben der laufenden Node-Installation).

Ablauf und Grenzen: Je Suchstart startet JobPilot einmal `codex app-server` im temporären Ordner und spricht dessen Protokoll direkt. Es gibt **keinen Modellzug** und keinen Auftragstext. Abgefragt werden nur Kontoart, installierte Apps und die Werkzeugliste; danach ruft JobPilot ausschließlich das Werkzeug `search_jobs` der Indeed-App auf. Die App wird an ihrer festen Kennung erkannt, das Werkzeug muss als lesend gekennzeichnet sein und das erwartete Schema haben, sonst bricht JobPilot ohne Suche ab. Kein Lebenslauf, keine Firmenwerkzeuge, keine Dateien, keine Shell; Rückfragen und Freigabewünsche von Codex werden abgelehnt. API-Schlüssel, Zugangsdaten und Passwörter aus der Umgebung werden für diesen Prozess entfernt. Gesucht werden die fünf Begriffe der Indeed-Spur am eingestellten Ort in Deutschland, je Begriff eine Anfrage in derselben Sitzung. Die App rechnet in Meilen: JobPilot rundet den Umkreis auf ganze Meilen auf und prüft danach selbst den genauen Umkreis in Kilometern, zusammen mit IT-Eignung und Dubletten. Beschreibungen und Daten stammen aus den strukturierten Antworten; fehlt eine Beschreibung, bleibt sie leer. Bricht eine Suche ab, bleiben die bereits gelesenen Treffer erhalten, der Bericht nennt die Zahl der bestätigten Suchen, und nichts wird automatisch wiederholt. Suchbegriffe und Ort gehen dabei unter den eigenen Konten an OpenAI und Indeed. Das App-Server-Protokoll von Codex gilt als experimentell; ändern sich Methoden, Rechte oder Schema, meldet der Bericht einen Fehler statt eines Erfolgs.

## Anbieterwahl: ein Connector je Suchstart

Sind beide Wege eingerichtet, gilt dieselbe Regel wie im Original: Ein Suchstart verwendet genau einen Indeed-Connector, nie beide.

- `auto` (Standard des Werkzeugs): ChatGPT/Codex zuerst. Claude übernimmt nur, wenn Codex **vor jeder Suchanfrage** eindeutig nicht verfügbar ist (nicht freigeschaltet, nicht gefunden, nicht mit ChatGPT angemeldet oder Indeed-App fehlt). Wurde eine Anfrage an Indeed gesendet, wechselt JobPilot nicht mehr, auch nicht nach einem Fehler.
- `codex` oder `claude`: nur dieser Weg, ohne Ausweichen. Ist er am Server nicht freigeschaltet, startet das Werkzeug keine Suche; die API meldet für Indeed einen Fehler ohne Anfrage.
- `JOBPILOT_INDEED_PROVIDER=codex` oder `claude` am Server legt fest, was `auto` bedeutet.
- Ist kein Connector freigeschaltet, bleibt Indeed bei `auto` ein Browserlink. Ohne Anbieterwahl (API ohne `indeedProvider`) startet nie ein Connector, und es gibt keine zeitgesteuerten Läufe.

```sh
node werkzeuge/suche-starten.mjs --run --provider=codex
node werkzeuge/suche-starten.mjs --run --provider=claude
```

**Suchstart aus einem Gespräch:** Wer Claude Code oder Codex im Projektordner nutzt, kann um die heutige Suche bitten. Der Assistent führt dann genau einen der beiden Befehle aus, passend zu sich selbst, nie beide für denselben Auftrag. Ohne Ort und Begriffe gelten die gespeicherten Kriterien (Stellensuche der Oberfläche oder letzter Live-Suchstart); der Knopf „Neue Stellen suchen“ und dieses Werkzeug starten damit dieselbe Suche über dieselbe API. Das Werkzeug spricht nur mit dem eigenen lokalen Server (`http://127.0.0.1:<Port>/`; `PORT` oder `JOBPILOT_URL` ändern die Adresse). Es prüft zuerst lesend über `GET /api/suche`, ob der laufende Server die Anbieterwahl kennt und der gewählte Weg freigeschaltet ist, und startet erst dann. Läuft bereits eine Suche, startet es keine zweite. Bricht die Verbindung ab, zuerst mit `GET /api/status` nachsehen, ob die Suche weiterläuft; das Werkzeug wiederholt nichts automatisch. Die Leseprüfung `--probe` des Originals liest dessen private Datenbank und ist öffentlich nicht enthalten.

## Browser-Erweiterung

Unter `public/erweiterung/` liegt eine Chrome-/Edge-Erweiterung nach Manifest V3. Den Ordner über die Entwickleransicht als entpackte Erweiterung laden. Sie enthält kein Profil und besitzt ein Symbol (blaues Quadrat mit „JP“). Eigene bestätigte Angaben werden lokal gespeichert; offene Antworten lassen sich ausdrücklich ergänzen. Lebenslauf und Anschreiben müssen für die jeweilige Bewerbung ausgewählt werden; „Felder ausfüllen“ hängt sie dann automatisch an, nie ein allgemeiner Lebenslauf. Dateien werden nicht versendet. Die private Erweiterung (Version 0.8) füllt auch Seiten, die nicht über JobPilot gestartet wurden („Remplir cette page avec mes données JobPilot“ im Popup, ohne PDF, ohne Absenden, LinkedIn und Indeed ausgenommen, ohne Seitenbestätigung); diese Teile (Service-Worker, JobPilot-Brücke, Blase) sind nicht Teil der öffentlichen Demo, nur der gemeinsame Feldmotor. [Bedienung und Grenzen](docs/FORMULARASSISTENT.md).

## Prüfen

```sh
npm test
npm run pruefen:typen
npm run pruefen:privat
```

Die Tests behandeln Herkunftsprüfsummen, Archivgründe und Firmenausschluss (Regeln wie im Original, Archiv-Endpunkt mit Prüfung, Ausschluss über wiederholte Suchen, Datenwechsel und Zurücksetzen), den Suchknopf der Oberfläche (ein Suchstart mit Anbieter `auto`, Fortschritt, keine zweite Suche, Teilabdeckung, Unterbrechung, dieselbe Anfrage wie das Werkzeug), die Auslieferung der Oberfläche am lokalen Server ohne `demo.js`, die Regel „Nur Informatik“, Plattformkatalog und Suchadressen für Gießen und andere Städte, die Trefferlistenleser aller Plattformen anhand gekürzter echter Trefferlisten (Kontaktpersonen, Telefonnummern und E-Mail-Adressen darin ersetzt), Spurplan und fünf Durchläufe, Sperrerkennung (Cloudflare, AWS-WAF, Anubis), technisch gesperrte Quellen ohne Anfrage, Umkreis mit mehreren Einsatzorten, Ortsauflösung mit Takt, Kontingent und Zwischenspeicher, Indeed über Claude mit gekürztem echtem Ereignisstrom, Indeed über ChatGPT/Codex mit synthetischem App-Server (Protokoll, Vorprüfungen, Freigabe, Programmsuche unter Windows, macOS und Linux), die Anbieterwahl mit genau einem Connector je Suchstart, das Werkzeug `suche-starten.mjs`, Vergleich, Dubletten, Historie, URL-Grenzen, JSON-LD, Arbeitgeberseiten, lokale Persistenz, Hintergrundlauf und Suchsperren. Sie kontaktieren keinen echten Arbeitgeber, keine Jobbörse, keinen Ortsdienst, kein Claude, kein Codex und keinen E-Mail-Dienst.

Für die Browserprüfung wird ein installierter Chrome oder Edge benötigt (`BROWSER_PFAD` setzt den Pfad):

```sh
npm run build
node werkzeuge/browser-pruefen.cjs
```

Der Browserlauf prüft beide Betriebsarten. Zuerst öffnet er die gebaute Demo unter einem Veröffentlichungspfad wie auf GitHub Pages und prüft Stellenübersicht, Filterzeile (Art, Ergebnis nur bei Versandt oder Alle, Entfernung, ein Sortierfeld mit Gleichstand nach Passung, „Mehr“, Zurücksetzen), die Regel „Nur Informatik“, Fiche mit gesperrtem Assistenten und Dokumenten zum Ansehen, Archiv und Zweitstellen, Antworten, nicht enthaltene Seiten, Französisch (Umschalter und `?lang=fr`), das Übungsformular, die Handyansicht Archivieren mit drei Gründen nur im Browser sowie das Ausbleiben von Laufzeitfehlern, externen Anfragen und Anfragen an eine Server-API. Danach startet er `dist/server.mjs` mit Live-Freigabe in einem temporären Datenordner, ersetzt jede ausgehende Anfrage des Servers durch einen gemockten Stellenmarkt (Arbeitsagentur mit erfundenen Treffern, alle anderen Plattformen gesperrt) und prüft Stellensuche, Suchbegriffe, Plattform-Chips mit Abwahl, genau einen Suchstart mit Anbieter `auto`, Fortschritt und gesperrten Knopf, das Ergebnis mit Teilabdeckung, die gefundenen Stellen in der Übersicht, Archivieren mit „Kein IT-Bezug“ samt Neuladen, den Ausschluss bei der nächsten Suche, Französisch, Handyansicht und den Hinweis ohne `JOBPILOT_LIVE=1`. Mit `--url=<Adresse>` läuft nur der erste Teil gegen die veröffentlichte Demo. Der Datenschutzprüfer erkennt typische Privatdateien und Zugangsdatenmuster; er ergänzt die manuelle Positivliste und ist keine allgemeine Garantie gegen alle Geheimnisse. Als PDF sind nur die zwei erfundenen Beispielunterlagen erlaubt.

## Aufbau und Herkunft

```text
src/kern/                übernommene, teilweise sprachlich angepasste Suchmodule
src/kern/platforms.ts    Katalog der 21 Plattformen, Suchadressen, Quellen ohne Abruf
src/kern/karten-*.ts     ein Trefferlistenleser je Plattform
src/kern/indeed-claude.ts  optionaler Indeed-Zugang über Claude Code
src/kern/indeed-codex.ts   optionaler Indeed-Zugang über ChatGPT/Codex
src/kern/indeed-connectors.ts  Anbieterwahl: ein Connector je Suchstart
src/suche.ts             Suchstart mit fünf Durchläufen nach dem Vorbild des Originals
src/geokodierung.ts      Ortsauflösung über Nominatim mit lokalem Zwischenspeicher
src/ablauf.ts            portable Import-, Bewertungs- und Gruppenlogik, Firmenausschluss beim Import
src/archiv.ts            Archivgründe, Firmenausschluss und Firmensperre (für Server und Demo)
src/bewerbungsraum.ts    Fichen, Suchkriterien und Seitenauslieferung der Oberfläche am lokalen Server
src/arbeitgeber.ts       konfigurierbare öffentliche Arbeitgeberquellen
src/server.ts            optionaler lokaler Server, JSON-Persistenz und Suchsperre
src/oberflaeche/        Oberfläche des Bewerbungsraums (React), Sprachen DE/FR (sprache.ts) und Demo-Daten (demo-start.ts)
src/oberflaeche/stellensuche.tsx  Stellensuche am lokalen Server; Ablauf des Knopfs in suchablauf.ts
src/beispiele.ts         vollständig synthetische Stellen, Beispielprofil und simulierte Quellenberichte des Servers
public/erweiterung/     gemeinsamer Feldmotor, deutsche Erweiterungsoberfläche und Symbole
public/formular/        synthetisches Übungsformular ohne Absenden und Übungslauf (uebung.js)
public/beispiel/        zwei erfundene Beispielunterlagen für die Demo
pruefungen/              deterministische Tests ohne reale Konten
werkzeuge/suche-starten.mjs  manueller Suchstart aus Terminal oder Gespräch
```

[Architektur und Unterschiede zum persönlichen Original](docs/ARCHITEKTUR.md) · [Anforderungen und Abnahme](docs/ABNAHME.md) · [Übernommene Module und Prüfsummen](HERKUNFT.json).

Die Suchintegration enthält unter MIT lizenzierte Ansätze aus JobScout. Die ursprünglichen Hinweise und Lizenztexte bleiben unter [NOTICE](src/kern/NOTICE.md) und [LICENSE.JobScout](src/kern/LICENSE.JobScout) erhalten. Die Herkunftsangaben unterscheiden diese Drittanteile vom eigenen Anwendungscode und von der neuen öffentlichen Oberfläche.

## Statische Veröffentlichung

Die öffentliche Demo wird auf GitHub Pages aus dem Branch `gh-pages` bereitgestellt. Er enthält nur den geprüften Browserexport, während `main` die wartbaren Quellen enthält. Dieselbe `index.html` lädt dort `demo.js` mit erfundenen Daten; nur der lokale Server liefert sie ohne `demo.js` aus, die Datei selbst bleibt dabei unverändert. Nach einem erneuten Build werden `dist/index.html`, `dist/assets/`, `dist/schriften/`, `dist/beispiel/`, `dist/favicon.svg`, `dist/formular/`, `dist/erweiterung/`, `.nojekyll` sowie `LICENSE.JobScout` und `NOTICE.JobScout.md` in diesen Veröffentlichungsbranch übernommen. Der Node-Server läuft dadurch nicht auf GitHub Pages.

Unter `docs/github-actions.vorlage.yml` liegt eine optionale Vorlage für spätere automatische Prüfungen und Bereitstellungen. Sie ist bewusst kein aktiver Workflow: Die zur Erstveröffentlichung verwendete GitHub-Verbindung darf keine neuen Workflow-Dateien schreiben. Die dokumentierten lokalen Prüfungen wurden trotzdem tatsächlich ausgeführt; eine spätere CI-Aktivierung erfordert entsprechend berechtigten Repositoryzugriff.

## Lizenz / Licence

Nicht kommerziell frei nutzbar (PolyForm Noncommercial 1.0.0, siehe [LICENSE](LICENSE)). Für jede kommerzielle Nutzung
ist vorher eine Vereinbarung mit Umsatzbeteiligung nötig, siehe [COMMERCIAL.md](COMMERCIAL.md).
Libre pour un usage non commercial. Tout usage commercial exige un accord préalable avec partage des revenus.
