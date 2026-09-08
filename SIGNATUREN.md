# Signaturen

Jede veroeffentlichte Version traegt **zwei** Signaturen ueber dieselben Dateien:

| | Verfahren | Datei | Werkzeug |
|---|---|---|---|
| klassisch | Ed25519 | `*.minisig` | [minisign](https://jedisct1.github.io/minisign/) |
| post-quantum | ML-DSA-65 (FIPS 204) | `*.mldsa` | `scripts/verify-pq.py` oder OpenSSL 3.5+ |

## Warum zwei

Ed25519 ist heute sicher, schnell und mit einem winzigen, weit verbreiteten
Werkzeug pruefbar. Gegen einen ausreichend grossen Quantenrechner ist es das
nicht — und ein Backup fuer eine Seedphrase soll Jahrzehnte halten. Wer die
Datei heute herunterlaedt und in zehn Jahren prueft, ob sie noch die
Originaldatei ist, hat mit ML-DSA eine Antwort, die auch dann noch traegt.

ML-DSA allein waere ebenfalls falsch: Das Verfahren ist jung, die
Werkzeuglandschaft duenn, und ein Fehler in einer frischen Implementierung ist
wahrscheinlicher als ein Quantenrechner in naher Zukunft. **Beide zusammen sind
staerker als jedes einzeln:** Eine Faelschung muesste gegen beide bestehen.

Beide Schluessel liegen auf demselben netzgetrennten Rechner und werden nie
kopiert. Wer den Webserver uebernimmt, kann keine der beiden Signaturen
erzeugen.

## Pruefen

```bash
# beides auf einmal
bash scripts/verify.sh 1.2.0
```

Einzeln:

```bash
# klassisch
minisign -Vm dist/1.2.0/SHA256SUMS.txt -p omegaseed.pub

# post-quantum
python3 -m pip install --upgrade cryptography     # Version 46 oder neuer
python3 scripts/verify-pq.py 1.2.0

# post-quantum mit OpenSSL 3.5 oder neuer, ohne diese Skripte
openssl pkeyutl -verify -rawin -in dist/1.2.0/SHA256SUMS.txt \
    -pubin -inkey omegaseed-mldsa.pub -sigfile dist/1.2.0/SHA256SUMS.txt.mldsa
```

Danach die Pruefsummen gegen die signierte Liste halten:

```bash
cd dist/1.2.0 && sha256sum -c SHA256SUMS.txt      # macOS: shasum -a 256 -c
```

**Holen Sie beide oeffentlichen Schluessel aus zwei unabhaengigen Quellen** und
vergleichen Sie sie Zeichen fuer Zeichen: aus diesem Repository und von
`https://omegaseed.io/`. Ein Schluessel, der nur dort liegt, wo auch die Datei
liegt, sichert nichts ab.

## Groessenordnungen

| | oeffentlicher Schluessel | Signatur |
|---|---|---|
| Ed25519 | 32 Byte (eine Zeile) | 64 Byte |
| ML-DSA-65 | 1952 Byte (2726 Byte als PEM) | 3309 Byte |

Die post-quantum Signatur ist rund fuenfzigmal so gross. Bei einer Handvoll
Dateien pro Version faellt das nicht ins Gewicht.

## Schluessel erzeugen (einmalig, netzgetrennt)

```bash
python3 scripts/keygen-pq.py                                   # ML-DSA-65
minisign -G -s ~/.omega-secure/omegaseed.key -p omegaseed.pub  # Ed25519
```

Beide geheimen Schluessel liegen danach in `~/.omega-secure/` und bleiben dort.
Verschluesselte Sicherung anlegen, Passwoerter getrennt davon aufbewahren.
