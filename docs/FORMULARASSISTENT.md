# Formularassistent

Der gemeinsame Motor `fields.js` wurde aus dem persönlichen JobPilot-Projekt übernommen. Seine bestehende API bleibt unverändert: `inspect`, `fill`, `run`, `scan`, `clean`, `attachFiles`.

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

## Grenzen

Vorhandene Werte werden erhalten. Unbekannte Daten und Einwilligungen werden nicht geraten; ausdrückliche gespeicherte Antworten können entsprechende Felder beantworten. Der Motor löst keine Captchas und umgeht keine Zugriffsregeln. Browser-/Portaländerungen können einzelne Erkennungen oder Dateizuordnungen verhindern. Externe Frames benötigen gegebenenfalls eine direkte Öffnung als eigene Seite. Die öffentliche Prüfung validiert das synthetische Übungsformular und den geteilten Feldmotor, nicht alle Arbeitgeberseiten oder eine erfolgreiche Installation auf allen Browsern.

Die Erweiterung besitzt `activeTab`, `scripting` und `storage`, keinen dauerhaften allgemeinen Hostzugriff. Ihre Ausführung ist eine ausdrückliche Benutzeraktion. Der Webdemo-Button verwendet denselben Motor ausschließlich im eigenen Übungsformular. Es wird kein Arbeitgeberformular durch die öffentlichen Tests ausgefüllt oder abgesendet.
