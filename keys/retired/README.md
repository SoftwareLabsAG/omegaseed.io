# Ausser Dienst gestellte oeffentliche Schluessel

Hier liegen oeffentliche Schluessel, die **nicht mehr** zum Pruefen aktueller
Auslieferungen verwendet werden. Sie stehen aus einem einzigen Grund hier: wer
eine alte Signaturdatei aufgehoben hat, soll nachvollziehen koennen, womit sie
erzeugt wurde.

**Zum Pruefen einer heruntergeladenen Datei nehmen Sie immer den Schluessel aus
der Wurzel dieses Repositories** (`omegaseed-mldsa.pub`), nicht die Dateien
hier.

Es handelt sich ausschliesslich um oeffentliche Schluessel. Geheimes
Schluesselmaterial liegt in diesem Repository nirgends.

## Bestand

| Datei | ausser Dienst seit | Grund |
|---|---|---|
| `omegaseed-mldsa-<Zeitstempel>.pub` | 09.09.2026 | Das Passwort des zugehoerigen geheimen Schluessels war nicht mehr verfuegbar. Der Schluessel konnte damit nicht mehr signieren. |

Die mit diesem Schluessel erzeugten ML-DSA-Signaturen der Version 1.2.0 wurden
mit dem Nachfolgeschluessel neu erzeugt und im Release ersetzt. Die
Auslieferungsdateien selbst blieben dabei unveraendert - nachweisbar an den
Ed25519-Signaturen von 1.2.0, die aus der urspruenglichen Veroeffentlichung
stammen und nicht angefasst wurden.
