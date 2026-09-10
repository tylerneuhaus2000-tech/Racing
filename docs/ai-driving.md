# KI-Fahrverhalten und Prüfstand

Die Gegner verwenden einen regelbasierten Fahrer (`AIDriver`), kein neuronales Netz.
Die Fahrregler wurden mit der tatsächlichen `Car.step`-Physik kalibriert. Es werden
keine trainierten Modellgewichte vorgetäuscht und keine zusätzlichen Gripkräfte
oder Teleports für die KI verwendet.

## Änderungen

- Pure Pursuit rechnet den gewünschten Radwinkel mit Radstand und derselben
  geschwindigkeitsabhängigen Lenkübersetzung wie die Fahrzeugphysik um. Die
  Gierdämpfung korrigiert die Abweichung zur gewünschten Drehrate.
- Karts erhalten einen kürzeren Vorausblick. Beim Start beginnt die geglättete
  Ziellinie an der tatsächlichen Startposition, damit nebeneinander startende
  Autos nicht zuerst beide zur Streckenmitte ziehen.
- Bremswege verwenden die tatsächlichen Abstände zwischen importierten
  Streckenpunkten. Die durchschnittliche Segmentlänge war insbesondere an
  Shanghais enger Kurve unzuverlässig. Aktuelle Kurven und die erreichbare
  Lenkung werden ebenfalls berücksichtigt; Bergab-Reserve wirkt tatsächlich.
- Die Gripkalibrierung steigt von 0,42 auf 0,55. Eine künstliche Mindestkrümmung
  begrenzt nicht länger das Tempo auf jeder Geraden.
- Überholen braucht eine freie Spur und ausreichenden Abstand. Der Fahrer hält
  seine Spur neben einem anderen Auto und wartet, bis er vollständig vorbei ist.
  Überhol- und Windschattenboni dürfen Sicherheitslimits nicht mehr erhöhen.
- Persönlichkeitsfehler reduzieren das Tempo, statt Lenkung wegzunehmen oder
  trotz kritischer Situation zusätzlich Gas zu geben. Warten im Verkehr löst
  kein Rückwärts-Befreiungsmanöver aus.
- Sehr schmale Strecken erhalten eine einreihige Startaufstellung. Der
  Streckencache unterscheidet auch Strecken mit gleicher Sample-Anzahl.

## Reproduzieren

Der Prüfstand braucht Node.js und dieselbe Three.js-Version wie das Spiel (r128).
Die Datei wird separat geladen; es wird kein Paket oder Browser benötigt:

```sh
curl -fsSL https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js -o /tmp/gridline-three-r128.cjs
node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs
AI_MIXED=1 node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs '' 1200 4
AI_MIXED=1 node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs monza 750 50
AI_MIXED=1 node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs stadtring 350 50
AI_WEATHER=wet AI_CLASS=hypercar node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs sachsenring
AI_CLASS=formula node tools/ai-drive-audit.cjs /tmp/gridline-three-r128.cjs monza
```

Argumente: Three.js-Datei, optional Strecken-ID, maximale Simulationssekunden,
Anzahl Autos. Ohne Strecken-ID werden alle 23 aktuell geladenen Definitionen
inklusive der zusätzlichen Mesh-Strecken gefahren. Kartstrecken verwenden Karts.
`AI_MIXED=1` mischt Fahrerpersönlichkeiten und verwendet einen zweispaltigen Start,
sofern die Strecke breit genug ist. `AI_GRIP` erlaubt Kalibrierungsvergleiche,
`AI_REPORT` speichert JSON und `AI_HTML` erlaubt Tests eines vorherigen Spielstands.
`AI_DIFFICULTY` setzt die Stärke (Standard 92). `AI_SELF_TEST=1` führt nur die
schnellen Regressionstests für Lenkung, Bremsdistanz, Stau und Cachewechsel aus.
Der Zufallsseed ist 12345; die Physik läuft mit 120 Hz und echter Startphase.

Es werden mindestens drei vollständig gefahrene Runden je Auto verlangt.
Rückwärtsfahrt zieht Fortschritt ab; ein Sprung über Start/Ziel zählt nicht
allein als Runde. Exitcode 1 bedeutet: fehlende Runden, über 1 % Streckenrand-
überschreitung, mehr als fünf Sekunden Stillstand oder irgendein Auto-/Wandkontakt.
`offPct` zählt die Zeit, in der die angenommene Fahrzeughalbbreite (1 m bzw.
0,6 m beim Kart) über den Asphalt reicht; `grassPct` zählt das Gras unter der
Fahrzeugmitte. Kontakte verwenden das reale Kollisionsmodell und simulierte Zeit.
Ab 20 Fahrzeugen gilt für eine wartende Schlange ein Stillstandslimit von zehn
statt fünf Sekunden. Rückwärts-Befreiung bleibt auf korrekt ausgerichteter
Fahrbahn gesperrt, damit kein Auto in den Verkehr zurücksetzt.

`ai-bench.js` bleibt als Browser-Prüfstand verfügbar. `AIBench.alleStrecken()`
fährt nun tatsächlich jede Strecke. Temporäre Autos und Wetter-/Zeitänderungen
werden auch bei Fehlern aufgeräumt.

## Grenzen

Die Tests ersetzen ausschließlich Mesh-Erstellung und Animation durch leere
Renderfunktionen. Streckenspline, Abfragen, Reifen, Antrieb, Schäden, Lenken,
Bremsen und Auto-Kollisionen kommen aus dem Spielcode. Die Rendergeometrie wird
nicht geprüft. Die Standardmatrix verwendet ein repräsentatives Auto pro Klasse,
Stärke 92 und deaktivierte Boxenstopps/Reifenabnutzung. Sie beweist nicht sämtliche
Fahrzeuge, Setups, Regenverläufe, Boxenstrategien oder beliebige menschliche Manöver.

## Messergebnisse (9. September 2026)

Einzelprüfung: **23/23 Strecken, 69 vollständige Runden**, überall 0 %
Randüberschreitung, 0 % Gras, keine Wandkontakte und kein Festfahren.

| Strecke | Zeit für 3 Runden inkl. Start | Höchstgeschwindigkeit |
|---|---:|---:|
| custom_1782743640261 | 684 s | 227 km/h |
| custom_1782746264191 | 550 s | 235 km/h |
| bahrain-custom | 550 s | 235 km/h |
| veloce | 378 s | 237 km/h |
| alpen | 306 s | 194 km/h |
| flat | 259 s | 247 km/h |
| hockenheim-alt | 573 s | 251 km/h |
| lemans-long | 621 s | 250 km/h |
| silberpfeil | 349 s | 247 km/h |
| superspeedway | 247 s | 242 km/h |
| inselring | 350 s | 243 km/h |
| highspeed-pro | 278 s | 248 km/h |
| oasis | 399 s | 250 km/h |
| bergkristall | 406 s | 255 km/h |
| riviera | 426 s | 206 km/h |
| norisring | 236 s | 221 km/h |
| stadtring | 171 s | 198 km/h |
| custom_1782749661475 | 581 s | 199 km/h |
| kartbahn-lider | 176 s | 48 km/h |
| silverstone-gp | 665 s | 221 km/h |
| redbullring-custom | 442 s | 240 km/h |
| monza | 478 s | 241 km/h |
| sachsenring | 421 s | 202 km/h |

Monza: vorher 497 s, 214 km/h Spitze und sechs Wandkontakte; jetzt 478 s,
241 km/h Spitze und keine Wandkontakte. Der frühere Kart-Randwert im
Baseline-JSON verwendet noch 1 m Fahrzeughalbbreite, die neue Kartprüfung 0,6 m.
Die Baseline endet nach maximal 600 s; längere Strecken sind dort unvollständig.

Zusatzprüfungen: Formel in Monza (286 km/h), LMP2 in Monza (280 km/h),
Hypercar im Regen am Sachsenring: jeweils drei Runden ohne Ausritte oder
Kontakte. Shanghai besteht zusätzlich bei Stärke 100.

Die JSON-Protokolle liegen unter `docs/ai-validation/`.

50er-Grid-Prüfung: Monza und Stadtring wurden mit je 50 Autos und vier
wechselnden Fahrertypen über drei Runden pro Auto gefahren. Das sind pro Strecke
150 absolvierte Runden. Beide Läufe endeten mit 0 Kontakten, 0 Wandtreffern und
0 % Randüberschreitung. Monza benötigte 569 Simulationssekunden; der enge
Stadtring 217 Sekunden. Dort wartete das hintere Feld in der engsten Passage
maximal 5,6 Sekunden, fuhr danach aber selbstständig weiter. Die Protokolle sind
`grid50-monza.json` und `grid50-stadtring.json`.

## Vergleich mit Cloud-Weltrekorden

`tools/fetch-world-records.mjs` liest die öffentlich sichtbaren Klassenrekorde
aus Firestore. `tools/compare-ai-world-records.mjs` fährt Stärke 100 mit exakt
dem Fahrzeug des jeweiligen Rekords und vergleicht die beste von drei
vollständigen Runden. Der Stand vom 9. September 2026 enthält 38 vergleichbare
Rekorde auf 20 Strecken; einen alten Eintrag mit Klasse `unknown` ignoriert der
Vergleich.

Vor der Pace-Korrektur lag die KI in allen 38 Fällen mehr als drei Prozent
zurück; der Median betrug 40,5 %. Danach schlägt sie acht Rekorde, liegt bei neun
Rekorden innerhalb von drei Prozent und bei 16 innerhalb von zehn Prozent. Der
Medianrückstand sinkt auf 11,2 %. Beispiele: Kartbahn −11,5 %, Shanghai GT3
−1,1 %, Hockenheim Hypercar +2,1 %, Le Mans GT3 +4,7 %.

Nicht jede Cloudzeit ist eine belastbare Zielzeit für den aktuellen Build.
Track-IDs wurden bei Strecken- und Physikänderungen beibehalten. Einige Rekorde
stammen aus älteren Versionen; beispielsweise wurden die Red-Bull-Ring-Zeiten
am 30. Juni gespeichert. Silverstones GT3-Rekord vom 9. September besitzt ein
gültiges Replay. `tools/train-ai-from-world-record.mjs` projiziert dessen Linie
und Geschwindigkeitsprofil auf die Strecken-Samples; das generierte Profil liegt
in `assets/tracks/silverstone-gp-ai.js`. Stärke 100 erhält dort in kleinen
Feldern zusätzlich eine auf das Replay abgestimmte Grip- und Leistungskorrektur.
Der Test beginnt als fliegende Runde mit warmen Reifen und 62 m/s statt aus dem
Stand. Alle neun GT3-Modelle bleiben unter 1:59; ihre Bestzeiten liegen zwischen
1:54,508 und 1:54,817. Über jeweils drei Runden gab es 0 Grasfahrten,
0 Wandkontakte und 0 Stillstand. Nur beim Dacia lagen 0,04 % der Physik-Samples
am äußeren Streckenrand, alle anderen Modelle blieben vollständig innerhalb.

Ein früher 180-Sekunden-Stresstest in Silverstone mit 50 gemischten
GT3-Fahrzeugen bei Stärke 92 diente als sichere Ausgangsbasis für die
Vollfeld-Kalibrierung.

Seit der Vollfeld-Kalibrierung gilt das Replay-Profil in Silverstone auch für
50er-Felder ab Stärke 92. Nach der 18-sekündigen Startformation werden Leistung,
Grip und Linie eingeblendet. Isolierte fliegende Runden mit dem Verhalten eines
50er-Feldes ergeben 1:54,642 für GT3, 1:46,650 für LMP2 und 1:42,217 für
Hypercars. Die Startaufstellung bleibt nach Hypercar, LMP2 und GT3 sortiert.

Die hohe WR-Kalibrierung wird erst oberhalb Stärke 90 eingeblendet und erreicht
nur bei Stärke 100 den vollen Wert. Übliche 50er-Grids bei Stärke 92 behalten
mehr Verkehrsreserve. Norisring und Bahrain erhalten streckenspezifische
Sicherheitsreserven, weil die schnellere Abstimmung dort Randkontakte erzeugte.
