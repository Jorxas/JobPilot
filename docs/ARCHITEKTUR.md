# Architektur und fachlicher Ablauf

```mermaid
flowchart LR
  Q[Spurplan: 5 Durchläufe, eigene Begriffe + 25 Themen] --> S[21 Plattformen + Arbeitgeberseiten]
  S --> K[Trefferlistenleser je Plattform, bis zu 3 Detailseiten]
  K --> R[Quellenbericht: ok / partial / blocked / error]
  R --> U2[Umkreis: Ortsauflösung über Nominatim, Zwischenspeicher]
  U2 --> I[Zulässige IT-Rolle und vollständige Felder prüfen]
  I --> D[Referenz- und Firmen-/Titel-/Ortsvergleich]
  D --> H[Historie bewahren]
  H --> B[Regelbasierter Profilvergleich]
  B --> U[Übersicht und manuelle Entscheidung]
  U --> F[Felder erkennen, fragen und ausdrückliche Antworten merken]
```

## Drei klar getrennte Betriebsarten

| Bereich | Öffentliche Browser-Demo | Optionaler lokaler Server | Persönliches Original |
|---|---|---|---|
| Oberfläche | Echte Oberfläche des Bewerbungsraums (Stellenübersicht, Antworten) mit erfundenen Daten; `/offres` ist ein Hinweis | Dieselbe gebaute Oberfläche ohne `demo.js`, mit Serverdaten und der Stellensuche (`/offres`) wie im Original | Next.js / React und persönliche Ansichten |
| Stellen | Erfundene Fichen (`demo-start.ts`) | 21 Plattformen nach Freigabe, gespeichert in `daten/zustand.json`, über `GET /api/tracker` in der Übersicht | 21 Plattformen, individuell konfiguriert |
| Plattformzustände | Nicht Teil der Demo | Kompakt auf der Stellensuche: Zusammenfassung, Problemquellen, Chips mit Abwahl; nur aus Berichten der letzten Live-Suche (`platform-status.ts`) | Aus Suchberichten und Leseprüfung, kompakt auf der Suchseite |
| Archivieren | Drei Gründe, Firmenausschluss nur im Browserfenster | Drei Gründe über `PATCH /api/tracker/<id>/state`, Ausschluss dauerhaft in `daten/zustand.json` | Drei Gründe, Ausschluss in der Datenbank (`companyExcluded`) |
| Umkreisprüfung | Entfällt | Nominatim mit Zwischenspeicher unter `daten/` | Persönlicher Ortscache |
| Indeed | Nur Link | Optional über ChatGPT/Codex (`JOBPILOT_INDEED_CODEX=1`) oder Claude Code (`JOBPILOT_INDEED_CLAUDE=1`), je Suchstart genau ein Connector | Über ChatGPT/Codex oder Claude Code, je Suchstart genau einer, beide abschaltbar |
| Vergleich / Themenplan | Tatsächlicher gemeinsamer Kern | Gemeinsamer Kern | Gemeinsamer Kern |
| Speicherung | Nur im Browserfenster bis zum Neuladen | Atomare JSON-Datei, Rotationsstand, Seitencursor | PostgreSQL / Prisma |
| Suchkoordination | Keine Suche | Lokale exklusive Dateisperre, nach jeder Anfrage erneuert; Hintergrundlauf; Start per Knopf „Neue Stellen suchen“ oder `werkzeuge/suche-starten.mjs`, beide über `POST /api/suche` | Persistenter Datenbank-Bail; Start per Knopf oder `scripts/jobpilot-suche-starten.cjs` |
| Beschreibungsanreicherung | Feste, gekennzeichnete Beispiele | Bis zu 12 BA-Details je Aufruf, URL-Import oder manueller Text | Nachgelagerte BA-Anreicherung |
| Formulare | Echter Motor am Übungsformular; Assistent-Schaltflächen gesperrt | Entpackte Browser-Erweiterung | Gemeinsamer Feldmotor, Erweiterung mit JP-Blase im Arbeitgeber-Tab |
| Sprache | Deutsch (Standard) und Französisch, `?lang=fr` oder Umschalter | Dieselbe Oberfläche | Deutsch |
| PDF / Kontakte / Versand | Nicht enthalten | Nicht enthalten | Private, kontogebundene Funktionen |

Die öffentliche Version ist eine eigenständige portable Fassung des Such- und Vorbereitungswerkzeugs. Sie ist kein vollständiger Export der privaten Next.js-Anwendung. Private Kontaktkataloge, Profile, Dokumente, Zugangsdaten und reale Versandhistorie wurden nicht übernommen. Der ursprüngliche private Git-Verlauf bleibt privat; der öffentliche Verlauf beginnt mit der tatsächlich veröffentlichten Fassung.

## Such- und Quellenlogik

`catalog.ts` entspricht dem Original: Ein Suchstart hat fünf Durchläufe, je Durchlauf fünf der 25 Themenfamilien. `batchPlan` gibt jeder gewählten Plattform (Spur) je Durchlauf genau eine Anfrage und je Suchstart fünf verschiedene Begriffe; die Plattform mit Index L liest die Begriffsliste ab Position (Los + L) × 5, sodass verschiedene Plattformen gleichzeitig verschiedene Begriffe erhalten. Weniger als fünf Begriffe werden mit Themenfamilien beziehungsweise Vertragsvarianten aufgefüllt. Die Stellensuche am lokalen Server zeigt den Plan des nächsten Suchlaufs unter „Suchplan anzeigen“; ein Suchstart im Vordergrund liefert den tatsächlichen Plan in seiner Antwort (`plan`).

`src/suche.ts` bildet `runMultiSourceSearch` des Originals auf der JSON-Datei nach: fünf Durchläufe in einem Aufruf, Seitenstand der Arbeitsagentur je Suchbegriff, eine gesperrte Plattform wird im selben Suchstart übersprungen, jeder Zwischenstand wird gespeichert. Ein geänderter Ort oder Umkreis setzt Rotation und Seitenstand zurück, löscht aber nicht die Firmenhistorie. `platforms.ts`, `public.ts` und die Leser `karten-<plattform>.ts` beachten feste URL-Grenzen (nur HTTPS-Adressen der 21 Plattformen), Größen- und Zeitlimits, den Crawl-delay von UNICUM und erkennen Cloudflare-, AWS-WAF- und Anubis-Prüfseiten als Sperre. Indeed, Jobvector, HeyJobs und das Studierendenwerk Gießen erhalten keine Anfrage (`KEIN_ABRUF`).

Unterschiede zum Original, bewusst: Die Umkreisprüfung nutzt statt des persönlichen Ortscaches OpenStreetMap Nominatim (Takt, Kontingent, Zwischenspeicher). Indeed über ChatGPT/Codex und über Claude sind ausdrücklich einzuschalten statt nur abschaltbar, weil die Läufe die eigenen Konten nutzen; Codex und Claude Code werden zusätzlich unter macOS und Linux gefunden. Bei ausdrücklicher Wahl von Claude ohne Freigabe meldet die öffentliche Anbieterwahl einen Fehler ohne Anfrage, statt Claude Code zu starten. Die Plattformauswahl wird als Liste `quellen` in den gespeicherten Kriterien und mit jedem Suchstart gesendet (Original: Datenbankfeld mit `platformCoverageVersion: 2`). Die öffentliche Leseprüfung (`--probe`, Datenbank des Originals) und der Hinweis bei Datenbankausfall entfallen; ohne Suchbericht heißt jede Plattform „nicht abgefragt“. Die Stellensuche bietet keinen Anzeigenimport per Formular (der lokale Server kennt `POST /api/import`) und keine täglich geprüften Firmenseiten.

## Stellensuche am lokalen Server

Der lokale Server liefert für `/`, `/suivi` und `/offres` dieselbe gebaute `index.html` wie GitHub Pages, entfernt dabei nur das Skript `demo.js` und ergänzt `<meta name="jobpilot-modus" content="lokal">` (`lokaleSeite` in `src/bewerbungsraum.ts`; die Datei auf der Festplatte bleibt unverändert). Ohne diese Kennzeichnung, also auf GitHub Pages, rendert die Oberfläche keine Suchseite, und `demo.js` beantwortet alle `/api/`-Aufrufe im Browser. Mit Kennzeichnung liest die Übersicht `GET /api/tracker` (Fichen aus `daten/zustand.json` mit Revision, Quelle, Archivgrund und Ausschluss), der Posteingang meldet ehrlich, dass er zum Original gehört, und `/offres` rendert `src/oberflaeche/stellensuche.tsx`.

Die Seite folgt `src/app/offres/suche-inhalt.tsx` des Originals: Knopf und Stand oben, dann Suchbegriffe (`KeywordPicker`), dann die Plattformübersicht (`PlatformCoverage` und `PlatformChips`), Ort, Umkreis und Suchdetails eingeklappt; Texte und Stil (`suche.css`, Ausschnitt aus `jobpilot-seiten.css`) wie im Original, zusätzlich auf Französisch. Statt Server-Actions spricht sie mit der lokalen API: `GET /api/suche` (Live-Freigabe), `GET /api/status` (gespeicherte Kriterien, Lauf, Berichte, `suchAktiv`), `POST /api/kriterien` (Suchbegriffe, Fachgebiet, Plattformen, Ort, Umkreis, Art; jede Angabe geprüft, unter der Suchsperre gespeichert) und `POST /api/suche`.

Der Ablauf des Knopfs steht ohne React in `src/oberflaeche/suchablauf.ts` (`suchsteuerung`): Er liest zuerst den Stand; läuft eine Suche (`lauf.zustand` „laeuft“ und `suchAktiv`), verfolgt er nur deren Fortschritt. Sonst sendet er genau eine Anfrage `suchkoerper(auftrag)` mit `live`, `hintergrund`, den gespeicherten Kriterien und `indeedProvider: "auto"` und fragt danach `GET /api/status` ab, bis der Lauf endet. Ein zweiter Klick während eines Starts sendet nichts, der Server lehnt einen zweiten Suchstart mit 409 ab, und nichts wird automatisch wiederholt. `ergebnisDaten` und `luecken` (wie im Original) fassen das Ende zusammen: neue Stellen, gefundene Anzeigen, Durchläufe, noch vorzubereitende Stellen (`ohneUnterlagen` des Kerns), nicht übernommene Treffer ausgeschlossener Firmen und eingeschränkte Plattformen. Die Oberfläche nennt das Ergebnis immer Teilabdeckung. Das Werkzeug `werkzeuge/suche-starten.mjs` sendet ohne Angaben dieselbe Anfrage (geprüft in `pruefungen/suchknopf.test.mjs`); beide werten einen gespeicherten laufenden Lauf ohne aktiven Prozess als unterbrochen.

Weil die Fortschrittsabfrage die Zustandsdatei liest, während der Lauf sie ersetzt, wiederholt `speichern` das Umbenennen unter Windows kurz, wenn die Datei gerade geöffnet ist (EPERM, EACCES, EBUSY), statt einen Zwischenstand zu verlieren.

## Archivgründe und Firmenausschluss

`src/kern/company-catalogue.ts` ist unverändert aus dem Original übernommen (`ARCHIVE_REASONS`, `excludedCompanyRecord`, `appliedForCompany`, `knownCompanyRecord`, `selectCompanyOptions`, `missingDossierParts`, `ohneUnterlagen`). `src/archiv.ts` bildet `src/lib/tracker-archive.ts` und `src/lib/company-guard.ts` auf einer Liste nach: `archivieren` prüft Grund, Anmerkung (höchstens 500 Zeichen), Eintrag, Revision und bei „Kein IT-Bezug“ einen bekannten Firmennamen, bevor es etwas ändert; es setzt `archiveReasonCode`, `archiveReason`, `archiveNote`, `archiveScope`, `archivedAt` und bei `not-it` `companyExcluded` samt Zeitpunkt, erhöht die Revision und lässt eine versandte Bewerbung versandt. `statusSetzen` lehnt jede andere Statusänderung einer ausgeschlossenen Firma und eine zweite Bewerbung an dieselbe Firma ab (`firmenSperre`). Der Server nutzt beides im Endpunkt `PATCH /api/tracker/<id>/state` und in der älteren Route `POST /api/status-aendern`; die Demo nutzt `archivieren` im Browser.

`aufnehmen` in `src/ablauf.ts` ist Import und Synchronisierung zugleich (`saveDiscoveredOffer` und `syncJobToTracker` des Originals): nach IT-Prüfung und Dublettenvergleich übernimmt es keine Anzeige einer ausgeschlossenen Firma und zählt sie (`firmaAusgeschlossen`, im Lauf je Anzeige einmal). Das gilt für Live-Suche, synthetische Suche und manuellen Import. Der Wechsel zwischen Beispiel- und Live-Daten und `POST /api/zuruecksetzen` behalten jede Fiche mit Archiventscheidung oder Ausschluss (`entscheidungen`); keine Funktion entfernt `companyExcluded`. Neue Fichen erhalten Revision, Datum (`addedAt`) und Fundzeit (`gefundenAm`) für „Neu“ und die Zahl der noch vorzubereitenden Stellen. Der manuelle Statusabgleich alter lokaler Änderungen läuft über dieselbe Route und kann einen Ausschluss deshalb nicht aufheben.

Der Arbeitgeberadapter liest ausschließlich konfigurierte HTTPS-Seiten, prüft DNS-Adressen vor dem Abruf und folgt keinen Weiterleitungen. Diese Vorprüfung stellt keine Netzwerkisolation oder DNS-Pinning-Garantie dar; der Dienst ist ausschließlich für den eigenen lokalen Betrieb gedacht.

## Indeed-Connectoren und Anbieterwahl

Indeed erhält nie eine direkte Anfrage (`KEIN_ABRUF`). Ein ausdrücklicher Suchstart mit `indeedProvider` sammelt die fünf Begriffe der Indeed-Spur aus den fünf Durchläufen und übergibt sie danach einmal an `scanIndeedViaConnector` (`src/kern/indeed-connectors.ts`, übernommen). `auto` bevorzugt ChatGPT/Codex; Claude übernimmt nur, wenn Codex vor jeder Suchanfrage ausdrücklich nicht verfügbar ist. Nach einer gesendeten Anfrage wechselt der Weg nicht mehr. `JOBPILOT_INDEED_PROVIDER` legt fest, was `auto` bedeutet; ein ungültiger Wert wird vor dem Suchstart abgewiesen. Ohne `indeedProvider` startet kein Connector, und mit `auto` ohne freigeschalteten Connector bleibt Indeed ein Browserlink.

`src/kern/indeed-codex.ts` (übernommen) startet `codex app-server` ohne Shell im temporären Ordner und sendet nur benannte Protokolloperationen: `initialize`, `account/read` (nur ChatGPT-Anmeldung), `app/installed` (feste Kennung der App „Indeed Job Search“, freigegeben und aufrufbar), `thread/start` (flüchtig, nur lesend, ohne Freigaben und Shell), `mcpServerStatus/list` (genau ein lesendes Werkzeug `search_jobs` mit erwartetem Schema) und `mcpServer/tool/call`. Ein Modellzug (`turn/start`) wird nie gesendet; Anfragen des App-Servers werden abgelehnt. Der Umkreis geht aufgerundet in Meilen an Indeed; danach prüft `src/suche.ts` wie bei allen Quellen ohne eigenen Umkreis den genauen Abstand in Kilometern. Der Claude-Weg (`src/kern/indeed-claude.ts`) bleibt unverändert. Beide Wege melden Teilabrufe als `partial` und Fehler ehrlich, ohne Wiederholung.

`werkzeuge/suche-starten.mjs` entspricht `scripts/jobpilot-suche-starten.cjs` des Originals: Es prüft lesend `GET /api/suche` (`manualSearchCommandVersion: 1`, freigeschaltete Connectoren, Plattformkennungen), lehnt eine Wahl ohne Freigabe vor dem Start ab, startet über `POST /api/suche` genau einen Suchlauf im Hintergrund und verfolgt ihn über `GET /api/status`. Es spricht nur mit `http`-Adressen auf dem eigenen Rechner. Weil die öffentliche Fassung keine Datenbank hat, übernimmt es Kriterien als Angaben oder aus dem letzten Live-Suchstart (`auftrag` in `daten/zustand.json`). Die Leseprüfung `--probe` des Originals liest dessen Datenbank und entfällt.

## Regel „Nur Informatik“, Filter und Entfernung

`eligibleRole` (`src/kern/company-catalogue.ts`, übernommen) verlangt einen IT-Begriff im Titel. Ausgenommen sind ausdrückliche Initiativbewerbungen sowie Redaktions- und Content-Stellen, die oft die Pflege von Websites meinen. Archivierte, versandte, vom Nutzer gewählte und fertig vorbereitete Fichen bleiben sichtbar; die Oberfläche wendet dieselbe Regel auch bei „Alle Einträge zeigen“ an. Die Filterzeile arbeitet rein im Browser auf den geladenen Fichen: Art (Alle, Stellen, Initiativ; Initiativ erkennt `opportunityType: initiative` oder den Titel), Ergebnis (nur sichtbar, wenn der Reiter Versandt oder Alle aktiv ist), Höchstentfernung und ein einziges Sortierfeld. Gleichstand entscheidet die Passung; „Reihenfolge“ und „Danach“ gibt es nicht. Die Schalter für alle Einträge und Zweitstellen liegen in einem eingeklappten „Mehr“. Die Entfernung ist ein Zahlenfeld `distanceKm` (Luftlinie von Gießen); Fichen ohne Wert stehen am Ende und werden benannt. In der Demo sind Orte und Werte erfunden.

## Kennzahlen und Antworten

Die vier Kacheln werden im Browser aus den geladenen Fichen und Antworten berechnet. Je Unternehmen zählt die zuletzt eingegangene entscheidende Antwort (Absage, Einladung, Zusage); Eingangsbestätigung, Rückfrage nach Unterlagen und Portalhinweis zählen nicht. Dieselbe Zuordnung liefert den Ergebnisfilter (wartet, Absage, Positiv) und die Marke je Fiche; die Kachel „Positive Antworten“ nennt zusätzlich bisherige Gespräche und spätere Absagen. Das Bewerbungsdatum (`sentAt`) steuert die Sortierung; Fichen ohne Datum stehen am Ende. Die Erkennungsregeln des Originals (`antwortEinordnen`) sind Kernlogik des persönlichen Werkzeugs und nicht Teil der Demo: Die erfundenen Antworten tragen ihre Art fest.

## Zweisprachige Oberfläche

`src/oberflaeche/sprache.ts` hält die Sprache in `document.documentElement.lang`, damit Demo-Daten und Oberfläche (getrennte Bündel) dieselbe Sprache sehen. `t(deutsch, französisch)` wird beim Rendern ausgewertet; der Umschalter setzt die Sprache, `?lang=fr` und den Seitentitel ohne Neuladen. Erklärende Texte des Werkzeugs sind übersetzt, Mailinhalte und Stellentitel der Beispiele nicht.

## Doppelungen und Entscheidungen

Der Import vergleicht Quellenreferenzen und normalisierte Firma/Titel/Ort. Unterschiedliche Orte dürfen als Datensätze erhalten bleiben. Die sichtbare Firmenansicht wählt einen Repräsentanten; beworbene Historie hat Vorrang vor neuen Leads, offene Stellen einer ausgeschlossenen Firma erscheinen nicht. Der Reiter „Archiviert“ zeigt alle archivierten Einträge wie im Original. Archivierung bleibt erhalten, bis die Entscheidung ausdrücklich geändert wird; ein Firmenausschluss bleibt dauerhaft. Der Vergleichswert ist eine Heuristik und keine Wahrscheinlichkeit, Qualifikation oder Zusage.

## Speicherung und Wiederaufnahme

Die Serverdatei wird zunächst unter einem zufälligen temporären Namen geschrieben und anschließend umbenannt. Die Suchsperre wird exklusiv erzeugt und nur vom passenden Token freigegeben. Ein abgestürzter Prozess hinterlässt eine Sperre, die nach zehn Minuten als veraltet behandelt werden kann. Das ist eine lokale Koordination, keine verteilte Datenbanktransaktion. Für Netzlaufwerke oder mehrere Server ist diese Architektur nicht vorgesehen.

Die Browser-Demo und der Serverzustand sind getrennte Speicherbereiche. Das Zurücksetzen der Demo verändert keine persönlichen Originaldaten. Auf GitHub Pages läuft ausschließlich der statische Browserteil. Kein Scheduler erzeugt Bewerbungen oder behauptete menschliche Arbeitszeiten.
