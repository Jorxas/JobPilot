# Formularassistent

Der gemeinsame Motor `fields.js` wurde aus dem persönlichen JobPilot-Projekt übernommen. Seine bestehende API bleibt unverändert: `inspect`, `fill`, `run`, `scan`, `clean`, `attachFiles`. Stand der Übernahme: 26. November 2026 (Prüfsumme in `HERKUNFT.json`).

## Installation und Betriebsarten (Version 1.3.0)

Die öffentliche Erweiterung enthält jetzt dieselben profilfreien Dateien wie das persönliche Werkzeug: Motor, Popup, Dienstskript, JobPilot-Inhaltsskript und JP-Blase. Das Manifest verwendet den eigenen lokalen JobPilot auf Port 3037 und enthält keine private Adresse.

In Edge `edge://extensions`, in Chrome `chrome://extensions` öffnen, Entwicklermodus einschalten und `public/erweiterung/` als entpackte Erweiterung laden. Nach Änderungen die Erweiterung, JobPilot und offene Arbeitgeberseiten neu laden. Keine automatische Installation. Ein eigener Profil-Export kann im Popup importiert werden; keine Daten des Erstellers werden mitgeliefert.

### Mit laufendem JobPilot

1. Unter `/profile` die eigenen bestätigten Angaben speichern. Diese Seite zeigt auch die Einrichtung und den Import/Export von Profil und Antworten.
2. In der echten Suchseite `/offres` bei einer Stelle „Unterlagen vorbereiten“ öffnen. In `/dossier/<id>` gezielten Lebenslauf und Anschreiben oder eine fertige Mappe auswählen, ansehen und speichern. Nur bei ausdrücklich gespeichertem „Portal verlangt kein Anschreiben“ genügt dort der gezielte CV.
3. „Mit Assistent öffnen (neuer Tab)“ öffnet die Arbeitgeberseite im bisherigen Fenster. Die JP-Blase füllt nach Klick bekannte Felder und ordnet die eigenen Bewerbungs-PDF zu. Unvollständige, bereits versandte, archivierte oder ausgeschlossene Bewerbungen beziehungsweise bereits beworbene Firmen werden serverseitig gesperrt.
4. Offene Fragen in der Blase beantworten und ausdrücklich merken. Die Antwortbank wird im eigenen lokalen JobPilot gespeichert. Profil, Antworten und PDF werden je Aktion über den geöffneten JobPilot-Tab frisch abgefragt; sie werden nicht in den Erweiterungsspeicher kopiert.
5. Für eine anderswo gefundene Seite im Popup „Remplir cette page avec mes données JobPilot“ wählen. Das verwendet dieselbe Antwortbank und Blase, ohne PDF, weil keine Bewerbung zugeordnet ist.

### Eigenständig ohne JobPilot

Im Popup unter „Mon profil“ eigene Angaben speichern oder einen eigenen Export importieren. „Remplir automatiquement“ füllt und zeigt offene Fragen; Antworten lassen sich ausdrücklich merken und erneut verwenden. CV und Brief dieser Bewerbung können im Popup ausgewählt werden. Dafür ist weder Server noch JobPilot-Tab erforderlich. Das Popup verwendet seine eigene lokale Ablage; Profil und Antworten lassen sich per Export/Import zwischen beiden Modi übertragen.

Die Person kontrolliert alle Felder und Dateien und klickt selbst auf Weiter oder Absenden. Ein isolierter Browser prüft beide Betriebsarten ausschließlich an synthetischen Formularen: `node werkzeuge/erweiterung-browser-pruefen.cjs`.

## Verhalten des Feldmotors (Stand 23. November 2026)

- „Vor- & Nachname“, „Vorname und Nachname“ und ähnliche Felder gelten als ein Namensfeld und erhalten Vor- und Nachnamen vollständig.
- Köderfelder („Bitte lasse dieses Feld leer“, „leave this field empty“) werden nie gefüllt und nie als offene Frage gezeigt.
- „Ich wurde geworben von“ und ähnliche Empfehlungsfelder erhalten „Keine Empfehlung“, solange der Nutzer nichts anderes hinterlegt hat; als offene Frage erscheinen sie nur, solange sie ausdrücklich Pflicht sind und nichts eingetragen wurde.
- Ein gemeinsames Dokumentenfeld („Anschreiben, Lebenslauf, Anlagen“, „Bewerbungsmappe“) erhält die Mappe oder beide PDF; getrennte Felder erhalten je ihr Dokument. Fotos und Zeugnisse bleiben unberührt.
- „Geburtstag (TT.MM.JJJJ)“ gilt als Geburtsdatum und wird im verlangten Format eingetragen. „Bundesland“ (Profilschlüssel `state`) wird in einer Auswahlliste gewählt oder als Text gefüllt.
- Dateifelder ohne passende Beschriftung („Datei“, „Anhang“) nehmen die noch fehlenden PDF der Reihe nach (ein Mehrfachfeld beide); bereits belegte Felder bleiben unberührt. Seiten mit einem Ablagefeld statt eines Dateifelds („Dateien hierher ziehen“) erhalten die PDF durch nachgebildetes Ziehen und Ablegen. Fehlt jedes Feld, meldet der Motor das, statt still zu scheitern.
- „Felder ausfüllen“ hängt die gewählten PDF der jeweiligen Bewerbung automatisch an, nie einen allgemeinen Lebenslauf. Es gibt keinen Versand.

Das Übungsformular unter `/formular/` enthält dafür ein Namensfeld, ein Köderfeld, ein Empfehlungsfeld, ein Geburtstagsfeld, eine Bundesland-Auswahl und ein gemeinsames Dokumentenfeld. Drei Schaltflächen tauschen dieses Dokumentenfeld gegen ein allgemeines Feld „Datei“ oder ein Ablagefeld ohne Dateifeld. Die Schaltflächen darunter starten denselben Motor mit einem erfundenen Profil (Geburtsdatum 14.03.2001, Bundesland Hessen) und den zwei erfundenen Beispiel-PDF. Der Browserlauf `werkzeuge/browser-pruefen.cjs` prüft das Ergebnis.

Die Erweiterung hat ein blaues JP-Symbol in vier Größen. Die statische Online-Demo besitzt weiterhin keine echten Assistentaktionen; die vollständige Erweiterung wird auf dem eigenen PC installiert.

## Grenzen

Vorhandene Werte werden erhalten. Unbekannte Daten und Einwilligungen werden nicht geraten; ausdrückliche gespeicherte Antworten können entsprechende Felder beantworten. Der Motor löst keine Captchas und umgeht keine Zugriffsregeln. Browser-/Portaländerungen können einzelne Erkennungen oder Dateizuordnungen verhindern. Externe Frames benötigen gegebenenfalls eine direkte Öffnung als eigene Seite. Die öffentliche Prüfung validiert das synthetische Übungsformular und den geteilten Feldmotor, nicht alle Arbeitgeberseiten oder eine erfolgreiche Installation auf allen Browsern.

Die Erweiterung verwendet `activeTab`, `scripting` und `storage`, einen Dienstworker sowie HTTPS-Hostzugriff, damit die JP-Blase in ausdrücklich geöffneten Arbeitgeber-Tabs eingesetzt werden kann. Das Inhaltsskript läuft nur auf `localhost:3037` und `127.0.0.1:3037`. Kein `cookies`-, `debugger`- oder allgemeiner HTTP-Zugriff. Bei einem anderen Port die beiden Manifest-Einträge anpassen. Profil und Unterlagen liegen im ignorierten eigenen Datenordner (`formularprofil.json`, `bewerbungsunterlagen.json`), nie im öffentlichen Export. Der Server bindet nur an Loopback; fremde Origins und Hostnamen werden abgewiesen. Kein öffentliches Mehrbenutzerhosting dieser persönlichen Ablage.
