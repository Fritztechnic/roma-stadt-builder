# ROMA Stadtbau

Desktop-Sandbox im Browser mit TypeScript, Vite und Canvas 2D. Keine Wirtschaft,
Versorgungssimulation oder mobilen Bedienelemente. Die Grafiken sind Platzhalter.

## Ansichten

Die Leiste oben links auf der Karte schaltet zwischen Draufsicht und Isometrie
um. Die Ansicht wird lokal gespeichert;
beim Umschalten wird die Karte eingepasst. Stadt, Auswahl und Undo-Verlauf
bleiben erhalten. Waehrend eines Bau-/Verschiebestrichs ist der Schalter gesperrt.

Die Isometrie zeigt rautenfoermige Felder, geneigte Ziegeldaecher, schattierte
Fassaden mit Fenstern, Saeulengaenge, Aquaeduktboegen, Baeume und Bodenschatten.
Arenen besitzen gerundete Arkaden und abgestufte Raenge, Villen offene Innenhoefe,
Mauern plastische Zinnen und Steinlagen. Marktstaende, Thermenhof, Brueckenboegen,
Baeckereischornstein und Getreidehalme unterscheiden weitere Bausteine.
Alles wird mit Canvas 2D gezeichnet, ohne 3D-Modelle oder zusaetzliche Pakete.
Die Draufsicht bleibt als flache, uebersichtliche Alternative verfuegbar.

Bauen nutzt die Grundflaeche auf dem Boden; Auswahl, Rechtsklick und einzelner
Abriss treffen auch sichtbare Daecher und Waende. Der Auswahlrahmen folgt dem
Stadtraster und erscheint in Isometrie deshalb als Raute. Die Bau-, Verlaufs- und
Speicherlogik bleibt unveraendert; bestehende Spielstaende sind kompatibel.
Die Gebaeude sind geometrische Platzhalter, keine ausgearbeiteten Sprites.

Die unveraenderte Stadtansicht wird als Canvas-Ebene zwischengespeichert;
Vorschau, Hover und Auswahl werden darueber gezeichnet. Kamera-, Karten- und
Gebaeudeaenderungen erneuern den Cache. Sortierreihenfolgen werden wiederverwendet,
Gebaeude ausserhalb des sichtbaren Ausschnitts nicht gezeichnet und UI-Updates
auf einen Aufruf pro Animationsframe gebuendelt.
Gebaeudemodelle werden je Typ, Drehung, Ansicht und Pixeldichte als Canvas-Sprites
wiederverwendet; der Spritecache ist auf 96 Eintraege begrenzt. Wassergraben und
Bruecken bleiben dynamisch und nutzen beim Zeichnen eine Rastertabelle fuer Nachbarn.

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

## GitHub Pages

Die Website wird unter https://fritztechnic.github.io/roma-stadt-builder/ bereitgestellt.
Der Workflow `.github/workflows/pages.yml` testet und baut jeden Push auf `main`
mit Node.js 24 und veroeffentlicht `dist` auf GitHub Pages. Er kann auch manuell
ueber GitHub Actions gestartet werden. Relative Asset-Pfade im Build erlauben
den Betrieb unter dem Repository-Unterpfad. Spielstaende auf der Pages-Adresse
sind vom lokalen Entwicklungsserver getrennt; fuer die Uebernahme JSON exportieren
und auf der Website importieren.

## Bedienung

- Objekt im Baukatalog waehlen, dann mit Linksklick platzieren.
- Beim Darueberfahren zeigt ein Tooltip den Gebaeudenamen und die Grundflaeche,
	auch im Bauwerkzeug. Beim Ziehen wird der Tooltip ausgeblendet.
- Das Erweiterungssymbol oben verdoppelt die Kartengroesse bis maximal 128 x 128.
	Vorhandene Gebaeude bleiben stehen; die Erweiterung ist rueckgaengig machbar.
- Strassen, Aquaedukte, Stadtmauern und Wassergraben mit gedrueckter linker Maustaste ziehen.
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

Der Baukatalog enthaelt 29 Module: Infrastruktur, Wohnen, oeffentliche Gebaeude,
Unterhaltung, Wirtschaft, Landwirtschaft, Befestigung und Freiraum. Neu sind
Stadtmauer, Stadttor, Wachturm, Bruecke, Reservoir, Villa, Basilika, Schule,
Bibliothek, Theater, Amphitheater, Baeckerei, Werkstatt, Feld, Obstgarten,
Statue und Wassergraben. Alle Objekte sind frei platzierbar, drehbar, verschiebbar und in
beiden Ansichten verfuegbar. Es gibt weiterhin keine Produktions- oder
Versorgungseffekte. Wassergraben verbindet benachbarte Segmente automatisch,
auch um Ecken. Bruecken zeigen Wasser unter dem mittleren Bogen; alle Bausteine
belegen weiterhin getrennte Rasterflaechen und lassen sich nicht ueberlagern.
Das Feld verwendet intern weiterhin `farm`, damit alte Spielstaende lesbar bleiben.

Das Kartensymbol oben laedt nach Bestaetigung eine roemische Beispielstadt:
Der kompakte Stadtplan nutzt die gesamten 48 x 36 Felder, ohne unbelegte Flaechen.
Mauer, Wachtuerme, Wassergraben und vier Stadttore umschliessen dichte Quartiere.
Ein Kanal mit fuenf Bruecken trennt die Stadthaelften; Ringstrasse, Hauptstrassen
und schmale Gassen bilden ein zusammenhaengendes Wegenetz. Jedes groessere
Gebaeude hat Strassenzugang. Forum, Tempel und Basilika bilden das Zentrum,
mit Arenen im Westen, Villen und Wasserversorgung im Nordosten sowie
Werkstaetten, Feldern und Obstgaerten im Suedwesten. Alle 29 Module sind vertreten.
Die Stadt ist frei bearbeitbar. Das Laden ersetzt den aktuellen Spielstand und
kann rueckgaengig gemacht werden; wichtige eigene Staedte vorher exportieren.

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
pro Seite. Neue leere Karten haben 96 x 72 Felder. Bestehende Spielstaende behalten
ihre Abmessungen und koennen ueber das Erweiterungssymbol vergroessert werden.
Das kompakte Preset bleibt 48 x 36 Felder gross und ist ebenfalls erweiterbar.

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