# MehrdistanzNative (echte iPadOS-App, kein WebView)

Unterordner mit nativer SwiftUI-App fuer Xcode 16.2:

- `MehrdistanzNative.xcodeproj`
- `MehrdistanzNative/*.swift`

## Was enthalten ist

- Native Sidebar-Navigation (iPad):
  `Uebersicht`, `Eintragen`, `Mitgliederliste`, `Rangliste`
- Lokale Persistenz (JSON in Application Support)
- Seed-Mitgliederliste (deine komplette Liste)
- Monatsslots (Mai 2026 bis Mai 2027) + "12 weitere Monate anhaengen"
- Regel-Engine zentral in:
  - `MehrdistanzNative/BDSMehrdistanzRuleEngine.swift`
- Eintragen mit:
  - Gesamt-Ringe Fertigkeit
  - Gesamt-Ringe Parcours
  - Parcourszeit
  - Status (gueltig/Abbruch/DQ)
  - bearbeitbare Historie (Eintrag bleibt erhalten)
- Detailseite pro Schuetze mit 3 Diagrammen (Swift Charts):
  - Gesamtergebnis
  - Nur Ringe
  - Nur Zeit
- Zeitraum-Dropdowns (All Time / Monat / benutzerdefiniert)
- Rangliste (All Time / Monat / benutzerdefiniert)

## In Xcode 16.2 starten

1. `ios-native-app/MehrdistanzNative.xcodeproj` oeffnen.
2. Target `MehrdistanzNative` waehlen.
3. Unter `Signing & Capabilities`:
   - Team auswaehlen
   - Bundle Identifier auf etwas Eindeutiges setzen
     (z. B. `de.deinname.mehrdistanznative`)
4. iPad als Ziel waehlen.
5. Run.

## Wichtig

- Diese App ist nativ.
- Die Regellogik ist zentral und anpassbar in `BDSMehrdistanzRuleEngine.swift`.
- Keine erfundene Strafformel: Bei fehlenden Detaildaten fuer Verfahrensabzuege gibt es Warnhinweis + manuelle Korrekturmoeglichkeit.

