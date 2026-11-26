# Indeed: kostenloser Erstabruf mit offiziellen Ersatzwegen

Stand: 26. November 2026. Auf ausdrücklichen Auftrag wird bei einer manuell gestarteten Suche zuerst **ts-jobspy 3.0.1** benutzt. Danach folgen bei Fehlern **ChatGPT/Codex**, anschließend **Claude**. `--provider=claude` bevorzugt Claude als Ersatz, `--provider=codex` Codex; der kostenlose Erstabruf bleibt in beiden Fällen zuerst. Die Voreinstellung `auto` bevorzugt Codex, weil dessen offizielles Lesewerkzeug ohne Modellzug verwendet werden kann.

## Derselbe Suchstart

Die öffentliche Fassung startet eine echte Suche über `node werkzeuge/suche-starten.mjs --run` oder die lokale API mit `indeedProvider: "auto"`. Beim ersten Start Ort und Suchbegriffe angeben; siehe README. Die Browser-Demo besitzt keinen echten Suchknopf. Das persönliche Original benutzt seinen vorhandenen Knopf für dieselbe Strategie. Es bleibt bei fünf Suchdurchläufen über die ausgewählten Quellen aus dem Katalog mit 21 Plattformen. Die fünf Indeed-Begriffe werden gesammelt und einmal an die gemeinsame Strategie in `indeed-connectors.ts` übergeben. Eine ausdrückliche Abwahl von Indeed wird beachtet. Aufrufe ohne manuelle Option starten diese Strategie nicht.

Erfolgreiche Begriffe, auch echte Leerlisten, werden nicht über einen weiteren Weg abgefragt. Nur fehlgeschlagene beziehungsweise nicht bestätigte Begriffe gehen an den Ersatz. Teilergebnisse bleiben erhalten; Dubletten werden zusammengeführt und die längere Originalbeschreibung bleibt. Der Bericht nennt bestätigte Suchen, tatsächlich benutzte Wege und offene Begriffe. Teilabruf bedeutet niemals vollständige Marktabdeckung.

Alle Treffer gehen durch die bestehenden Prüfungen für studentische IT-Stellen, den eingestellten genauen Umkreis, Dubletten und bereits vorhandene Historie. Es werden weder Unterlagen erstellt noch Bewerbungen versandt. Die zusätzlichen Archiv- und Firmenausschlussregeln des persönlichen Originals sind keine neue Funktion dieser öffentlichen Fassung.

## Verbesserung gegenüber dem unveränderten Paket

- Exakte Abhängigkeit `ts-jobspy@3.0.1`, MIT-Lizenz; ausschließlich Indeed, Deutschland, gespeicherter Ort und Umkreis (Kilometer nach Meilen aufgerundet).
- Eigener begrenzter Node-Prozess ohne Kontozugang, API-Schlüssel, Datenbankzugang, Proxyvariablen oder zusätzliche Node-Startoptionen.
- Höchstens ein HTTPS-POST an `apis.indeed.com/graphql` je Begriff und höchstens 20 Karten; Folgeanfragen und fremde Hosts werden vor dem Versand verweigert. Keine Detailseiten, keine Proxys, keine Challenge-Lösung.
- 20 Sekunden Netzwerkzeitlimit, 30 Sekunden Gesamtzeitlimit je Prozess, begrenzter Speicher und höchstens 2 MB Antwort.
- Strenge Kartenprüfung: HTTPS-Indeed-Links ohne eingebettete Zugangsdaten, begrenzte Felder, Originalbeschreibung und belastbares Datum. Einzelne unbrauchbare Karten werden verworfen; ausschließlich unbrauchbare Karten gelten als Fehler.
- Erfolgreiche Antworten einschließlich Leerlisten höchstens zehn Minuten im Arbeitsspeicher zwischengespeichert, höchstens 100 Einträge. Nach einem Fehler eine Stunde keine neue direkte Anfrage. Ein Neustart leert diesen Prozessspeicher.
- `JOBPILOT_INDEED_TS_JOBSPY=0` schaltet neue direkte Abrufe ab. Dann folgen nur die offiziellen Ersatzwege.

ts-jobspy verwendet den internen mobilen Indeed-Zugang mit den im Projekt enthaltenen App-Headern. Es ist kein offizieller Indeed-Connector; MIT erlaubt die Nutzung des Codes und erteilt keine Zugriffsberechtigung für den Indeed-Dienst. HTTP 200 belegt Funktion, keine garantierte Dauerverfügbarkeit. Die bestehende Sperre für Indeed-HTML bleibt erhalten. Diese gesonderte Integration folgt dem ausdrücklichen neuen Benutzerauftrag; keine der übrigen gesperrten Plattformen wird anders abgefragt. Keine kostenpflichtigen Scrapingdienste erforderlich.

## Hintergrundbetrieb und Konten

ChatGPT/Codex nutzt die installierte offizielle Indeed-App über `codex app-server`: ChatGPT-Anmeldung, App-ID und lesendes Werkzeug werden geprüft, anschließend wird nur `search_jobs` direkt aufgerufen, ohne Modellzug und ohne API-Schlüssel. Claude nutzt `claude -p` mit Haiku und ausschließlich ToolSearch sowie `search_jobs`/`get_job_details`; die Rohantworten werden gelesen. Kein CV-Zugriff, keine eingebauten Web-/Dateiwerkzeuge.

Beide Wege starten ohne offene ChatGPT- oder Claude-Fenster. Erforderlich bleiben ein erreichbarer laufender JobPilot-PC, installierte CLIs und die vorher eingerichteten eigenen Kontoverbindungen. Eine fehlende oder abgelaufene Anmeldung wird gemeldet. Claude zählt zum eigenen Abonnement und kann dessen Kontingent verbrauchen; der Erstabruf braucht kein solches Abonnement. Für die öffentliche Fassung werden offizielle Konten zusätzlich nur mit `JOBPILOT_INDEED_CODEX=1` beziehungsweise `JOBPILOT_INDEED_CLAUDE=1` benutzt.

## Prüfungen am 26. November

Drei einzelne echte Leseproben ohne Import: ts-jobspy 19 verwertbare Karten mit Beschreibung aus einer HTTP-Anfrage (eine Karte ohne Firma verworfen), Codex-Ersatz 10 Karten mit Beschreibung, Claude-Ersatz eine Karte mit Beschreibung. Die Ersatzproben simulierten die Nichtverfügbarkeit der jeweils vorherigen Wege, führten den letzten Weg aber wirklich aus. Keine dieser Proben beweist die vollständige Abdeckung oder unbegrenzte künftige Verfügbarkeit.

Automatische Prüfungen: `pruefungen/indeed-prioritaet.test.mjs`, bestehende Codex-/Claude- und Plattformtests sowie Typprüfung, Datenschutzprüfung und synthetische Browserprüfung. Das persönliche Original hat entsprechende zusätzliche Prüfungen. Geprüft werden insbesondere Leerlisten ohne Ersatz, nur unerledigte Begriffe im Ersatz, Teilerhalt, Fehler, Ruhepause, Cacheablauf und die Anfragebegrenzung.

Quellen: [ts-jobspy](https://github.com/alpharomercoma/ts-jobspy), [offizielle Indeed-App](https://chatgpt.com/plugins/plugin_asdk_app_6982856578088191a6cf4a963662adf0), [Codex App Server](https://learn.chatgpt.com/docs/app-server). Der gezielte Datenbank-Lesetest des persönlichen Originals ist in dieser öffentlichen Fassung nicht enthalten.
