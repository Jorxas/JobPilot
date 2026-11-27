# Automatische Bewerbungsunterlagen

Stand: 27. November 2026. Gilt für den lokalen Server; die statische Demo auf GitHub Pages bleibt synthetisch und erstellt nichts.

## Was automatisch passiert

Nach jedem Live-Suchlauf erhält jede neue, geeignete Stelle ohne Klick einen **gezielten Lebenslauf** und ein **Anschreiben** als PDF. Geeignet heißt: offen (`pending`), Informatikbezug (`eligibleRole`), Firma weder ausgeschlossen noch schon beworben, eine Stelle je Firma wie in der Übersicht (`selectCompanyOptions`), noch keine vollständigen Unterlagen. Die Erstellung läuft im Hintergrund nacheinander; die Suche wartet nicht darauf und scheitert nie daran. Danach zählt der Server „noch vorzubereiten“ des Suchlaufs mit den tatsächlich gespeicherten Dokumenten neu.

Zusätzlich:

- **Dossier öffnen** (`/dossier/<id>`) ohne Unterlagen: Erstellung im Hintergrund, die Seite zeigt den Fortschritt.
- **Profil speichern**: gescheiterte Versuche und heutige Funde ohne Unterlagen werden erneut eingeplant.
- **„Mit aktuellem Profil neu erstellen“** im Dossier: ersetzt nur frühere automatische Dokumente, nie eigene Uploads.

Nie automatisch: Versand, Absenden eines Formulars, Status „beworben“, Archivieren. Ohne Name, E-Mail und mindestens Ausbildung, Erfahrung oder ein Projekt wird nichts erstellt und nichts geschrieben; die Stelle nennt dann, was im Profil fehlt.

Ein erstelltes Paar gilt als gezielte Mappe (`missingDossierParts` ist leer). Der eigene allgemeine Lebenslauf ist nie Anhang. Die Dokumente tragen `erzeugt: {am, anbieter}` und heißen im Dossier „automatisch erstellt“; bitte vor dem Absenden lesen. Das Datum im Anschreiben ist der Erstellungstag; ist es älter, weist das Dossier darauf hin.

## Profil (`/profile`, Abschnitt „Lebenslauf, Anschreiben und Nachweise“)

- **Nachweise (optional, empfohlen):** Immatrikulationsbescheinigung, Leistungsübersicht, Zeugnisse als PDF (je höchstens 5 MiB). Die Seite zeigt, wie viele offene Anzeigen sie verlangen.
- **Grundlage des Lebenslaufs:**
  - *JobPilot-Struktur*: eine Seite, Überschriften mit Akzentlinie, Studium, Berufserfahrung, Projekte als kurze Stichpunkte, Kompetenzen nach Kategorien, Sprachen, Weiterbildung. Zur Anzeige passende Projekte und Kenntnisse stehen vorn; bei Platzmangel werden Stichpunkte und Projekte gekürzt, nie ergänzt.
  - *Eigene Angaben*: schlichte Gestaltung, Kurzprofil, alle Einträge in eigener Reihenfolge, Projekte nur nach Bezug sortiert, höchstens zwei Seiten.
- **Anschreiben:**
  - *JobPilot-Vorlage*: Absenderblock rechts, „Ort, den Datum“, Betreff „Bewerbung als <Stelle>“ (Initiativ: „Initiativbewerbung bei <Firma>“), Anrede (eine in der Anzeige genannte Ansprechperson, sonst „Sehr geehrte Damen und Herren,“), fünf Absätze: Interesse an Stelle und Firma, Studium mit passenden Kenntnissen und Projekten, Arbeitsweise (eigener Text möglich), Ziel, Verfügbarkeit laut Profil.
  - *Eigener Text* mit Platzhaltern `{Firma}`, `{Stelle}`, `{Ort}`, `{Bereich}`, `{Kenntnisse}`; Absätze durch Leerzeilen.
- **Vorschau** öffnet beide Dokumente für eine erfundene Beispielstelle (nur Vorlage, keine Anfrage).

Schreibregeln in Vorlage und Prüfung: echte Umlaute und ß, keine Gedankenstriche als Satzverbindung, keine sichtbaren Adressen (Projektname, „Portfolio“, „GitHub“, „LinkedIn“ sind anklickbar), Firma und Stelle genannt, heutiges Datum. Die Vorlage enthält keine Angaben oder Texte des Projektinhabers.

## Von der Anzeige verlangte Nachweise

`verlangteNachweise` (`src/kern/nachweise.ts`) erkennt ausdrückliche Nennungen. Vorhandene Dateien sind der Bewerbung beigelegt: Dossier und Übersicht verlinken sie, `/api/tracker` setzt die Flags `enrollment`, `transcript`, `certificates` aus der Anzeige (für `applicationAttachmentKinds`) und führt die Datei als Dokument mit `isShared: true`; die Erweiterung erhält sie bei „Dateien“ und „Ausfüllen“. Fehlt eine verlangte Datei, steht in der Stellensuche zum Beispiel „Zeugnisse (in der Anzeige verlangt, keine Datei im Profil hinterlegt)“ und im Dossier „Zeugnisse verlangt, keine Datei im Profil hinterlegt“. Grenze: Der gemeinsame Feldmotor `fields.js` ordnet bisher nur Lebenslauf, Anschreiben und Mappe Dateifeldern zu; Nachweise im Arbeitgeberformular selbst auswählen.

## Erstellung: Vorlage und freiwillige KI-Wege

Standard ist die **JobPilot-Vorlage**: kostenlos, ohne Netz, ohne Schlüssel. KI-Wege sind wie die Indeed-Ersatzwege ausdrücklich einzuschalten:

| `JOBPILOT_UNTERLAGEN_ANBIETER` | Reihenfolge je Stelle |
| --- | --- |
| `vorlage` (Standard) | nur Vorlage |
| `auto` | `ANTHROPIC_API_KEY` (Claude API), `OPENAI_API_KEY` (OpenAI API), dann Claude Code, Codex, Gemini CLI, soweit installiert, zuletzt Vorlage |
| `api` | nur die beiden Schlüssel, dann Vorlage |
| `claude`, `codex`, `gemini` | nur dieses Programm, dann Vorlage |

- **API-Schlüssel:** direkter `fetch`, kein SDK. Claude: `POST /v1/messages`, Modell `claude-opus-5-5` (`JOBPILOT_UNTERLAGEN_ANTHROPIC_MODELL`), strukturierte Ausgabe `output_config.format` mit JSON-Schema, Aufwand `medium`, serverseitiger Ersatz bei Ablehnung (`fallbacks: "default"`, abschaltbar mit `JOBPILOT_UNTERLAGEN_ANTHROPIC_FALLBACKS=0`). OpenAI: Chat Completions mit striktem `json_schema`, Modell `gpt-5-mini` (`JOBPILOT_UNTERLAGEN_OPENAI_MODELL`).
- **Programme mit eigenem Abonnement**, ohne Shell im leeren temporären Ordner, Auftrag auf stdin, hartes Zeitlimit (`JOBPILOT_UNTERLAGEN_ZEITLIMIT` in Sekunden, Standard 180): `claude -p` mit leerer Werkzeugliste und ohne MCP-Server, `codex exec` nur lesend ohne Shell, `gemini` mit JSON-Ausgabe. API-Schlüssel und Tokens werden für Claude Code und Codex entfernt. Programmsuche wie bei Indeed (`JOBPILOT_UNTERLAGEN_CLAUDE_CLI` oder `JOBPILOT_CLAUDE_CLI`, `JOBPILOT_CODEX_CLI`, `JOBPILOT_GEMINI_CLI`, npm-Installation, Suchpfad).
- **Gesendet** werden nur Stellentext und fachliche Profildaten (Ausbildung, Erfahrung, Projekte, Kenntnisse, Sprachen, Verfügbarkeit), nie Name, Adresse, E-Mail oder Telefon.
- **Prüfung vor Verwendung:** Projekte und Kenntnisse müssen wörtlich im Profil stehen (die KI wählt und sortiert nur), Anrede nur allgemein oder mit einer in der Anzeige genannten Person, drei bis sechs Absätze mit 400 bis 2600 Zeichen, Firma genannt, keine Adressen, keine Platzhalter, keine Umlaute als ae/oe/ue; Gedankenstriche werden zu Kommas. Jede Verletzung, jeder Fehler und jedes Zeitlimit führt zum nächsten Weg und zuletzt zur Vorlage. Ein Weg mit Zugangsfehler wird im selben Durchgang nicht erneut gefragt; je Durchgang höchstens 20 KI-Erstellungen, danach Vorlage. Ein eigener Brieftext wird nie umgeschrieben.
- Das Protokoll nennt den tatsächlichen Weg und die übersprungenen Versuche; die Startmeldung des Servers nennt die Einstellung.

## Format

PDF aus einem eingebauten Schreiber (`src/unterlagen-pdf.ts`): Standardschriften Helvetica ohne Einbettung, WinAnsi-Kodierung, Zeilenumbruch nach Schriftmetrik, Verweise auf Wörtern. Es wird weder Browser noch Zusatzpaket gebraucht. Zeichen außerhalb von WinAnsi (zum Beispiel kyrillische Schrift) werden durch den Grundbuchstaben oder „?“ ersetzt.

## Daten und Schnittstellen

Im ignorierten Datenordner (`daten/` oder `JOBPILOT_DATEN`):

| Datei | Inhalt |
| --- | --- |
| `unterlagenprofil.json` | Lebenslaufdaten, Grundlage, Anschreibenvorlage, Metadaten der Nachweise |
| `nachweise/<art>.pdf` | hochgeladene Nachweise (`enrollment`, `transcript`, `certificates`) |
| `bewerbungsunterlagen.json` | Mappe je Bewerbung; automatische Dokumente mit `erzeugt` |
| `unterlagen-erzeugt.json` | Protokoll je Bewerbung: Zustand, Zeitpunkt, Anbieter, Grundlage, Vorlage, Versuche, Profilstand |

| Route | Zweck |
| --- | --- |
| `GET/POST /api/unterlagen/profil` | Lebenslaufdaten und Vorlagenwahl; Antwort mit fehlenden Angaben, Erstellungskette und Zahl verlangter Nachweise |
| `POST /api/unterlagen/nachweis` | `{art, name, base64}` speichern oder `{art, entfernen: true}` |
| `GET /api/unterlagen/nachweis/<art>` | eigenen Nachweis ansehen |
| `GET /api/unterlagen/vorschau/<cv\|letter>` | Vorschau mit Beispielstelle |
| `POST /api/unterlagen/erstellen` | `{id}` neu erstellen (202, plant nur ein) |
| `GET /api/tracker/<id>/documents/<cv\|letter\|bundle\|enrollment\|transcript\|certificates>` | Dokument oder beigelegter Nachweis |

`GET /api/bewerbung?id=` liefert zusätzlich `erzeugung` (Zustand `fertig`, `wartet`, `laeuft`, `profil-fehlt`, `fehler`, `nicht-noetig`, `gesperrt`, `offen`), `nachweise` und `heute`. `POST /api/suche` meldet `unterlagenEingeplant`.

## Prüfung

`node --test pruefungen/unterlagen.test.mjs`: Vorlage und PDF-Aufbau, Schreibregeln, eine Seite, keine Daten des Originals, Profilprüfung, Anrede, Nachweise, beide API-Wege und alle drei Programme ausschließlich gemockt (Rückfall, Zugangssperre, keine Kontaktdaten), Ablauf am lokalen Server nach gemockter Suche (eine Stelle je Firma, Nachweis beigelegt oder benannt, nichts versandt, eigene Uploads bleiben, Erstellung beim Öffnen, Vorschau). Die Kommandozeilen von Claude Code, Codex und Gemini CLI sind nicht gegen echte Installationen geprüft; ändern sich ihre Optionen, meldet das Protokoll einen Fehler und die Vorlage übernimmt.
