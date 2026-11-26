# Formularassistent

Der gemeinsame Motor `fields.js` wurde aus dem persönlichen JobPilot-Projekt übernommen. Seine bestehende API bleibt unverändert: `inspect`, `fill`, `run`, `scan`, `clean`, `attachFiles`. Stand der Übernahme: 23. November 2026 (Prüfsumme in `HERKUNFT.json`).

## Lokaler Ablauf

1. In Chrome oder Edge die Erweiterungsseite öffnen, Entwicklermodus aktivieren und `public/erweiterung/` als entpackte Erweiterung laden.
2. Ein Arbeitgeberformular öffnen und nur eigene bestätigte Angaben als Profil speichern. Es wird kein persönliches Profil ausgeliefert.
3. Mit **Nur prüfen** den Vorschlag lesen, dann gezielt **Felder ausfüllen** wählen.
4. Offene Fragen selbst beantworten. **Antwort merken & erneut füllen** speichert die Antwort in der lokalen Erweiterungsbank.
5. Bei Bedarf den Lebenslauf und das Anschreiben genau dieser Bewerbung als PDF auswählen. Der Motor ordnet sie passenden freien Dateifeldern zu. Dateien bleiben nur im geöffneten Popup und werden nicht als Profil gespeichert.
6. Alle sichtbaren Angaben und Dateien prüfen. Die Person betätigt eine tatsächliche Weiter-/Absenden-Schaltfläche selbst.

Profilbeispiel ohne echte Person:

```json
{"firstName":"Alex","lastName":"Beispiel","email":"alex@example.test","city":"Musterstadt"}
```

## Verhalten des Feldmotors (Stand 23. November 2026)

- „Vor- & Nachname“, „Vorname und Nachname“ und ähnliche Felder gelten als ein Namensfeld und erhalten Vor- und Nachnamen vollständig.
- Köderfelder („Bitte lasse dieses Feld leer“, „leave this field empty“) werden nie gefüllt und nie als offene Frage gezeigt.
- „Ich wurde geworben von“ und ähnliche Empfehlungsfelder erhalten „Keine Empfehlung“, solange der Nutzer nichts anderes hinterlegt hat; als offene Frage erscheinen sie nur, solange sie ausdrücklich Pflicht sind und nichts eingetragen wurde.
- Ein gemeinsames Dokumentenfeld („Anschreiben, Lebenslauf, Anlagen“, „Bewerbungsmappe“) erhält die Mappe oder beide PDF; getrennte Felder erhalten je ihr Dokument. Fotos und Zeugnisse bleiben unberührt.
- „Geburtstag (TT.MM.JJJJ)“ gilt als Geburtsdatum und wird im verlangten Format eingetragen. „Bundesland“ (Profilschlüssel `state`) wird in einer Auswahlliste gewählt oder als Text gefüllt.
- Dateifelder ohne passende Beschriftung („Datei“, „Anhang“) nehmen die noch fehlenden PDF der Reihe nach (ein Mehrfachfeld beide); bereits belegte Felder bleiben unberührt. Seiten mit einem Ablagefeld statt eines Dateifelds („Dateien hierher ziehen“) erhalten die PDF durch nachgebildetes Ziehen und Ablegen. Fehlt jedes Feld, meldet der Motor das, statt still zu scheitern.
- „Felder ausfüllen“ hängt die gewählten PDF der jeweiligen Bewerbung automatisch an, nie einen allgemeinen Lebenslauf. Es gibt keinen Versand.

Die private Erweiterung (Version 0.8) kann außerdem Seiten füllen, die nicht über JobPilot gestartet wurden: Im Popup steht „Remplir cette page avec mes données JobPilot“. Dabei werden Profil und gespeicherte Antworten aus einem geöffneten JobPilot-Tab geholt, es werden keine PDF angehängt, nichts wird abgesendet, LinkedIn und Indeed sind ausgenommen, und die frühere Seitenbestätigung entfällt. Service-Worker, JobPilot-Brücke und Blase gehören zum privaten Werkzeug; die öffentliche Demo-Erweiterung enthält nur den gemeinsamen Feldmotor und ihr eigenes Profil-Popup.

Das Übungsformular unter `/formular/` enthält dafür ein Namensfeld, ein Köderfeld, ein Empfehlungsfeld, ein Geburtstagsfeld, eine Bundesland-Auswahl und ein gemeinsames Dokumentenfeld. Drei Schaltflächen tauschen dieses Dokumentenfeld gegen ein allgemeines Feld „Datei“ oder ein Ablagefeld ohne Dateifeld. Die Schaltflächen darunter starten denselben Motor mit einem erfundenen Profil (Geburtsdatum 14.03.2001, Bundesland Hessen) und den zwei erfundenen Beispiel-PDF. Der Browserlauf `werkzeuge/browser-pruefen.cjs` prüft das Ergebnis.

Die Erweiterung hat ein Symbol (blaues, abgerundetes Quadrat mit weißem „JP“) in vier Größen unter `public/erweiterung/icons/`. Die JP-Blase im Arbeitgeber-Tab und die Verbindung zu einer laufenden JobPilot-Seite gehören zur privaten Erweiterung und sind in der öffentlichen Demo nicht enthalten; dort sind die zugehörigen Schaltflächen gesperrt.

## Grenzen

Vorhandene Werte werden erhalten. Unbekannte Daten und Einwilligungen werden nicht geraten; ausdrückliche gespeicherte Antworten können entsprechende Felder beantworten. Der Motor löst keine Captchas und umgeht keine Zugriffsregeln. Browser-/Portaländerungen können einzelne Erkennungen oder Dateizuordnungen verhindern. Externe Frames benötigen gegebenenfalls eine direkte Öffnung als eigene Seite. Die öffentliche Prüfung validiert das synthetische Übungsformular und den geteilten Feldmotor, nicht alle Arbeitgeberseiten oder eine erfolgreiche Installation auf allen Browsern.

Die Erweiterung besitzt `activeTab`, `scripting` und `storage`, keinen dauerhaften allgemeinen Hostzugriff. Ihre Ausführung ist eine ausdrückliche Benutzeraktion. Der Webdemo-Button verwendet denselben Motor ausschließlich im eigenen Übungsformular. Es wird kein Arbeitgeberformular durch die öffentlichen Tests ausgefüllt oder abgesendet.
