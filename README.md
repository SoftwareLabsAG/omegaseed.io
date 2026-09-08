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

```bash
bash scripts/verify.sh 1.2.0
```

Einzeln, ohne diese Skripte:

```bash
minisign -Vm dist/1.2.0/SHA256SUMS.txt -p omegaseed.pub
cd dist/1.2.0 && shasum -a 256 -c SHA256SUMS.txt
```

**Holen Sie den öffentlichen Schlüssel aus zwei unabhängigen Quellen** und
vergleichen Sie sie Zeichen für Zeichen — aus diesem Repository und von
<https://omegaseed.io/>. Ein Schlüssel, der nur dort liegt, wo auch die Datei
liegt, sichert nichts ab.

---

## Aufbau

```
dist/<VERSION>/     die veröffentlichten Dateien mit Signaturen
scripts/            signieren und prüfen, klassisch und post-quantum
omegaseed.pub       öffentlicher Ed25519-Schlüssel (minisign)
SIGNATUREN.md       beide Verfahren im Detail
```

## Was hier (noch) nicht liegt

Der **Quellcode der Website** ist derzeit nicht enthalten. Solange er fehlt,
können Sie prüfen, dass eine Datei unverändert von uns stammt — aber nicht
nachrechnen, dass sie aus einem bestimmten Quellstand entsteht. Der Build ist
bitgenau reproduzierbar; die Quellen sollen hier nachgereicht werden.

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
