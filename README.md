# omegaseed.io — signierte Auslieferungen

Hier liegen die veröffentlichten Dateien von **omegaseed.io**, der
produktbegleitenden Bestückungshilfe zur **OmegaSeedphrase**, jeweils mit zwei
unabhängigen Signaturen.

**Das Werkzeug erzeugt keine Seedphrase.** Es zeigt, welches Titan-Plättchen in
welchen Slot der Metallplatte gehört. Die Seedphrase entsteht in Ihrer
Hardware-Wallet oder Wallet-Software.

---

## Wer hier veröffentlicht

| | |
|---|---|
| Anbieter | D & M Solution Dynamics GmbH, Warwitzstraße 9, 5023 Salzburg, Österreich |
| Firmenbuch | FN 664113 m, Landesgericht Salzburg · UID ATU82626106 |
| Impressum | <https://omegaseed.io/impressum.html> |
| Signatur-Identität | Omega Secure |

Die Signaturen tragen als vertrauenswürdigen Kommentar „Omega Secure,
D & M Solution Dynamics GmbH". Steht dort etwas anderes, stimmt etwas nicht.

---

## Warum es dieses Repository gibt

Eine Prüfsumme auf derselben Website zu veröffentlichen, von der die Datei
kommt, beweist nichts: Wer den Server übernimmt, ändert beides. Der Vergleich
fällt dann positiv aus, obwohl die Datei manipuliert ist.

Deshalb ist jede Auslieferung mit Schlüsseln signiert, die **nicht auf dem
Webserver liegen**, sondern auf einem netzgetrennten Rechner. Wer den Server
übernimmt, kann keine gültige Signatur erzeugen.

Es sind **zwei** Signaturen über dieselben Dateien — Ed25519 und ML-DSA-65
(FIPS 204, post-quantum). Warum beide und nicht nur eine, steht in
[SIGNATUREN.md](SIGNATUREN.md).

---

## Eine Datei prüfen

Zuerst die beiden Schlüssel besorgen (siehe unten), dann:

```bash
bash scripts/verify.sh 1.2.0
```

Einzeln, ohne diese Skripte:

```bash
minisign -Vm dist/1.2.0/SHA256SUMS.txt -p omegaseed.pub
python3 server/mldsa-verify.py omegaseed-mldsa.pub \
        dist/1.2.0/SHA256SUMS.txt dist/1.2.0/SHA256SUMS.txt.mldsa
cd dist/1.2.0 && shasum -a 256 -c SHA256SUMS.txt
```

### Die Schlüssel liegen bewusst nicht hier

Ein öffentlicher Schlüssel im selben Repository wie die Datei, die er absichert,
bringt wenig: Wer dieses Repository übernimmt, tauscht beides aus. Die Schlüssel
stehen deshalb an zwei anderen Stellen:

- <https://github.com/Omega-Secure/omegaseed-release>
- <https://omegaseed.io/omegaseed.pub> und <https://omegaseed.io/omegaseed-mldsa.pub>

**Holen Sie den Schlüssel aus beiden Quellen und vergleichen Sie sie Zeichen für
Zeichen.** Erst dann ist die Prüfung etwas wert.

---

## Aufbau

```
site/               die Website, wie sie ausgeliefert wird
dist/<VERSION>/     die veröffentlichten Pakete mit Signaturen
scripts/            signieren und prüfen, klassisch und post-quantum
server/             Selbstaktualisierung des Servers (prüft vor dem Umschalten)
SIGNATUREN.md       beide Verfahren im Detail
```

## Zum Quellstand — offen gesagt

Unter `site/` liegt die Website vollständig: jede HTML-Datei, das Stylesheet,
der Programmcode, die Schriften. Was der Browser ausführt, können Sie hier Zeile
für Zeile nachlesen, und Sie können `site/` gegen das Paket im Release halten —
beide sind byteweise identisch.

Was **nicht** hier liegt, ist die Erzeugungskette, die diese Dateien einmal aus
einer gemeinsamen Vorlage gebaut hat: deutsche und englische Fassung, die
Rechtstexte und die Offline-Einzeldateien wurden daraus in einem Durchgang
erzeugt. Diese Skripte sind verloren gegangen. Es gibt hier also keinen
Bauschritt, mit dem sich `site/` aus etwas anderem herleiten ließe — die Dateien
selbst sind der Stand.

Praktisch heißt das: Sie können prüfen, dass eine Auslieferung unverändert von
uns stammt, und Sie können den gesamten ausgelieferten Code lesen. Was Sie
derzeit nicht können, ist einen Build nachrechnen. Das wäre eine Zusage, die
dieses Verzeichnis nicht einlöst, und deshalb steht sie hier auch nicht.

---

## Lizenz und Marken

Siehe [LICENSE.md](LICENSE.md) und deckungsgleich die
[Nutzungsbedingungen](https://omegaseed.io/agb.html).

Die Marken, Logos und Produktbezeichnungen — insbesondere „Omega" und
„OmegaSeedphrase" — stehen **nicht im Eigentum** der D & M Solution Dynamics
GmbH. Sie werden mit Zustimmung der Rechteinhaber verwendet. An ihnen werden
**keine Rechte eingeräumt**, auch nicht durch die Veröffentlichung hier.

„OMDP39" bezeichnet einen technischen Standard; maßgeblich ist ausschließlich
die Veröffentlichung unter <https://www.omdp39.io>.
