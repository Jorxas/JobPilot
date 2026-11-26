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
| Oberfläche | Neue deutsche React-Oberfläche | Dieselbe Oberfläche | Next.js / React und persönliche Ansichten |
| Stellen | Erfundenes Fixture | 21 Plattformen nach Freigabe | 21 Plattformen, individuell konfiguriert |
| Plattformzustände | Ausdrücklich simuliert | Aus den Berichten des letzten Suchstarts | Aus Suchberichten und Leseprüfung |
| Umkreisprüfung | Entfällt | Nominatim mit Zwischenspeicher unter `daten/` | Persönlicher Ortscache |
| Indeed | Nur Link | Optional über Claude Code (`JOBPILOT_INDEED_CLAUDE=1`) | Über Claude Code, abschaltbar |
| Vergleich / Themenplan | Tatsächlicher gemeinsamer Kern | Gemeinsamer Kern | Gemeinsamer Kern |
| Speicherung | localStorage | Atomare JSON-Datei, Abfrageindex, Seitencursor | PostgreSQL / Prisma |
| Suchkoordination | Expliziter einzelner Demoklick | Lokale exklusive Dateisperre, nach jeder Anfrage erneuert; Hintergrundlauf | Persistenter Datenbank-Bail |
| Beschreibungsanreicherung | Feste, gekennzeichnete Beispiele | Bis zu 12 BA-Details je Aufruf, URL-Import oder manueller Text | Nachgelagerte BA-Anreicherung |
| Formulare | Echter Motor am Übungsformular | Entpackte Browser-Erweiterung | Gemeinsamer Feldmotor |
| PDF / Kontakte / Versand | Nicht enthalten | Nicht enthalten | Private, kontogebundene Funktionen |

Die öffentliche Version ist eine eigenständige portable Fassung des Such- und Vorbereitungswerkzeugs. Sie ist kein vollständiger Export der privaten Next.js-Anwendung. Private Kontaktkataloge, Profile, Dokumente, Zugangsdaten und reale Versandhistorie wurden nicht übernommen. Der ursprüngliche private Git-Verlauf bleibt privat; der öffentliche Verlauf beginnt mit der tatsächlich veröffentlichten Fassung.

## Such- und Quellenlogik

`catalog.ts` entspricht dem Original: Ein Suchstart hat fünf Durchläufe, je Durchlauf fünf der 25 Themenfamilien. `batchPlan` gibt jeder gewählten Plattform (Spur) je Durchlauf genau eine Anfrage und je Suchstart fünf verschiedene Begriffe; die Plattform mit Index L liest die Begriffsliste ab Position (Los + L) × 5, sodass verschiedene Plattformen gleichzeitig verschiedene Begriffe erhalten. Weniger als fünf Begriffe werden mit Themenfamilien beziehungsweise Vertragsvarianten aufgefüllt. Der Browser zeigt diesen echten Generator; die dabei angezeigten Plattformzustände sind synthetisch.

`src/suche.ts` bildet `runMultiSourceSearch` des Originals auf der JSON-Datei nach: fünf Durchläufe in einem Aufruf, Seitenstand der Arbeitsagentur je Suchbegriff, eine gesperrte Plattform wird im selben Suchstart übersprungen, jeder Zwischenstand wird gespeichert. Ein geänderter Ort oder Umkreis setzt Rotation und Seitenstand zurück, löscht aber nicht die Firmenhistorie. `platforms.ts`, `public.ts` und die Leser `karten-<plattform>.ts` beachten feste URL-Grenzen (nur HTTPS-Adressen der 21 Plattformen), Größen- und Zeitlimits, den Crawl-delay von UNICUM und erkennen Cloudflare-, AWS-WAF- und Anubis-Prüfseiten als Sperre. Indeed, Jobvector, HeyJobs und das Studierendenwerk Gießen erhalten keine Anfrage (`KEIN_ABRUF`).

Unterschiede zum Original, bewusst: Die Umkreisprüfung nutzt statt des persönlichen Ortscaches OpenStreetMap Nominatim (Takt, Kontingent, Zwischenspeicher). Indeed über Claude ist ausdrücklich einzuschalten statt nur abschaltbar, weil die Läufe das eigene Claude-Abonnement nutzen; Claude Code wird zusätzlich unter macOS und Linux gefunden. Die Plattformauswahl liegt im Browserspeicher und wird mit jeder Suche gesendet (Original: Datenbankfeld mit `platformCoverageVersion: 2`). Validierte Stichwortlisten mit Katalogpastillen, Firmenausschluss über Archivgründe, Leseprüfung und Datenbankausfall gibt es öffentlich nicht; eine Stichwortliste lässt sich als Text eingeben, und der IT-Katalog ist übernehmbar.

Der Arbeitgeberadapter liest ausschließlich konfigurierte HTTPS-Seiten, prüft DNS-Adressen vor dem Abruf und folgt keinen Weiterleitungen. Diese Vorprüfung stellt keine Netzwerkisolation oder DNS-Pinning-Garantie dar; der Dienst ist ausschließlich für den eigenen lokalen Betrieb gedacht.

## Doppelungen und Entscheidungen

Der Import vergleicht Quellenreferenzen und normalisierte Firma/Titel/Ort. Unterschiedliche Orte dürfen als Datensätze erhalten bleiben. Die sichtbare Firmenansicht wählt einen Repräsentanten; beworbene Historie hat Vorrang vor neuen Leads. Archivierung bleibt erhalten, bis die Entscheidung ausdrücklich geändert wird. Der Vergleichswert ist eine Heuristik und keine Wahrscheinlichkeit, Qualifikation oder Zusage.

## Speicherung und Wiederaufnahme

Die Serverdatei wird zunächst unter einem zufälligen temporären Namen geschrieben und anschließend umbenannt. Die Suchsperre wird exklusiv erzeugt und nur vom passenden Token freigegeben. Ein abgestürzter Prozess hinterlässt eine Sperre, die nach zehn Minuten als veraltet behandelt werden kann. Das ist eine lokale Koordination, keine verteilte Datenbanktransaktion. Für Netzlaufwerke oder mehrere Server ist diese Architektur nicht vorgesehen.

Die Browser-Demo und der Serverzustand sind getrennte Speicherbereiche. Das Zurücksetzen der Demo verändert keine persönlichen Originaldaten. Auf GitHub Pages läuft ausschließlich der statische Browserteil. Kein Scheduler erzeugt Bewerbungen oder behauptete menschliche Arbeitszeiten.
