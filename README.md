# ROMA Stadtbau

Desktop-Sandbox im Browser mit TypeScript, Vite und Canvas 2D. Keine Wirtschaft,
Versorgungssimulation oder mobilen Bedienelemente. Die Grafiken sind Platzhalter.

## Start

Node.js ab 22.18 (fuer die nativen TypeScript-Tests) und npm:

```sh
npm install
npm run dev -- --host 127.0.0.1
```

Die URL steht im Terminal, normalerweise http://127.0.0.1:5173/.
Es sind keine globalen Pakete oder Root-Installationen notwendig.

```sh
npm test
npm run build
npm run preview
```

Der Ordner `dist` kann auf einem statischen Webhost veroeffentlicht werden.
Es gibt keinen Server fuer Konten oder gemeinsame Spielstaende.

## Bedienung

- Objekt im Baukatalog waehlen, dann mit Linksklick platzieren.
- Strassen und Aquaedukte mit gedrueckter linker Maustaste ziehen.
- Gruene Vorschau: freier Standort; rote Vorschau: Standort belegt oder ausserhalb.
- Rechtsklick auf ein Gebaeude: drehen; bei ausgewaehlten Objekten die Auswahl drehen.
- Rechtsklick auf freien Boden beim Bauen: Bauvorschau drehen.
- Drehsymbol oder R: Bauvorschau bzw. ausgewaehlte Gebaeude drehen.
- Pfeilwerkzeug: Gebaeude anklicken und durch Ziehen gemeinsam verschieben.
- Shift-Klick: Objekt zur Auswahl hinzufuegen oder aus ihr entfernen.
- Im Auswahlwerkzeug auf freiem Boden ziehen: Auswahlrahmen; Shift erweitert die Auswahl.
- Shift-Klick funktioniert auch aus dem Bauwerkzeug heraus und aktiviert die Auswahl.
- Blaue Umrandung: ausgewaehlt; gruene/rote Ziehvorschau: gueltiges/blockiertes Ziel.
- Entf entfernt die Auswahl; Strg+A auf der Karte waehlt alle Objekte aus.
- Radierersymbol oder E/Entf: Abriss; Ziehen entfernt mehrere Objekte.
- Mittlere Maustaste oder Leertaste + Ziehen: Karte verschieben.
- Handwerkzeug: Verschieben mit linker Maustaste.
- Mausrad: am Mauszeiger zoomen. Kamerawerkzeuge: Zoom und gesamte Karte.
- Escape beendet Bauen und hebt die Auswahl auf.
- Strg+Z: rueckgaengig; Strg+Umschalt+Z oder Strg+Y: wiederholen.
- Strg+S: lokal speichern. Werkzeugsymbole haben beschreibende Tooltips.

Jeder Bau-/Abrissstrich, Gruppenversatz und Drehvorgang zaehlt als ein
Verlaufsschritt (maximal 100 Schritte). Ungueltige Gruppenaktionen veraendern
keines der Gebaeude. Eine Gruppendrehung dreht jedes Objekt an seinem eigenen
Standort, nicht die Anordnung um einen gemeinsamen Mittelpunkt.
Verlauf und Kamera werden nicht gespeichert.

## Beispielstadt

Das Kartensymbol oben laedt nach Bestaetigung eine roemische Beispielstadt:
rechtwinkliges Strassennetz, Forum und Tempel im Zentrum, Wohnquartiere, Markt,
Therme, Lagerhaeuser, Gaerten, Brunnen und ein Aquaedukt. Die Stadt ist frei
bearbeitbar. Das Laden ersetzt den aktuellen Spielstand und kann rueckgaengig
gemacht werden; wichtige eigene Staedte vorher exportieren.

## Spielstaende

Aenderungen werden automatisch im lokalen Browserspeicher gesichert und beim
Start wieder geladen. Speichern und Laden verwenden denselben Spielstand.
Dieser Speicher ist an Browser und Webadresse gebunden; das Laden stellt daher
keinen separaten manuellen Sicherungsstand wieder her.

Export erstellt eine JSON-Datei fuer dauerhafte Sicherungen oder andere Browser.
Import prueft Version, Kartengroesse, Gebaeudetypen und Ueberschneidungen, bevor
die aktuelle Stadt ersetzt wird. Neue Stadt, Laden und Import fragen nach einer
Bestaetigung; Ersetzen kann waehrend der Sitzung rueckgaengig gemacht werden.
Bei Speicherfehlern bitte exportieren. Importlimit: 2 MB; Karten: 8 bis 128 Felder
pro Seite. Die Standardkarte hat 48 x 36 Felder.

## Erweiterung

- `src/city.ts`: Baukatalog, Stadtzustand, Baupruefung, Dateiformat und Verlauf.
- `src/render.ts`: Kamera, Koordinatenumrechnung und Canvas-Zeichnung.
- `src/preset.ts`: Bauplan der roemischen Beispielstadt.
- `src/app.ts`: Werkzeuge, Eingabe, Oberflaeche und lokale Speicherung.
- `src/app.css`: bewusst kleine Desktop-Oberflaeche.
- `tests/city.test.ts`: native Node-Tests der Stadtlogik und Kamera.

Neue Gebaeude im Katalog eintragen und bei Bedarf deren Zeichnung ergaenzen.
Versorgung und Zufriedenheit spaeter als Auswertung des Stadtzustands ergaenzen,
nicht in die Eingabe- oder Zeichenlogik einbauen.

Die Schrift wird optional von Google Fonts geladen. Ohne Internet greift eine
lokale Ersatzschrift; Spiellogik, Grafiken und Icons funktionieren lokal.