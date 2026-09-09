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

## Zwei Repositories

Paket und Signatur werden getrennt veroeffentlicht:

| | Repository | Inhalt |
|---|---|---|
| Paket | `SoftwareLabsAG/omegaseed.io` | nur `omegaseedphrase-deploy-v<VERSION>.zip` |
| Signaturen | `Omega-Secure/omegaseed-release` | `SHA256SUMS.txt`, alle `.minisig` und `.mldsa`, dazu die oeffentlichen Schluessel |

Pruefmaterial soll nicht dort liegen, wo auch das Geprueft liegt. Zusaetzlichen
Schutz gegen Faelschungen bringt das nicht - wer eines der Repositories
uebernimmt, kann ohnehin nichts unterschieben, weil ihm die geheimen
Schluessel fehlen. Der Gewinn liegt in der Nachvollziehbarkeit und darin, dass
zwei getrennt verwaltete Stellen zusammenpassen muessen.

**Die Signaturseite sagt, welche Version die neueste ist.** `omega-update.sh`
fragt `Omega-Secure/omegaseed-release` nach dem letzten Release und holt das
Paket unter demselben Tag aus dem Projekt-Repository.

### Veroeffentlichen

```bash
bash scripts/publish.sh 1.3.1
```

Das Skript prueft zuerst selbst und veroeffentlicht nichts Unsigniertes. Es
haelt die Reihenfolge ein: **erst das Paket, dann die Signaturen.** Andersherum
sieht der Server einen Tag, zu dem es noch kein Paket gibt, und bricht ab.

Aeltere Versionen nachtragen - `--backfill` sorgt dafuer, dass sie nicht als
neueste gelten und der Server nicht zurueckfaellt:

```bash
bash scripts/publish.sh --backfill 1.2.0
```

## Schluesselwechsel

Ein Schluessel wird gewechselt, wenn er kompromittiert sein koennte oder wenn
er nicht mehr benutzbar ist. Der zweite Fall ist am 09.09.2026 eingetreten: das
Passwort des ML-DSA-Schluessels war nicht mehr verfuegbar. Der Schluessel war
damit nicht gestohlen, aber unbrauchbar - signieren ging nicht mehr.

Der Ed25519-Schluessel war davon nicht betroffen und wurde nicht gewechselt.

### Ablauf

```bash
python3 scripts/keygen-pq.py --rotate      # netzgetrennt
python3 scripts/sign-pq.py 1.2.0           # Altbestand nachsignieren
python3 scripts/sign-pq.py 1.3.0
bash    scripts/verify.sh  1.2.0
bash    scripts/verify.sh  1.3.0
```

`--rotate` loescht den alten geheimen Schluessel nicht, sondern verschiebt ihn
nach `~/.omega-secure/retired/`, und legt den alten oeffentlichen Schluessel
unter `keys/retired/` ab. Anschliessend prueft das Skript selbst, ob sich der
neue Schluessel von der Platte mit dem Passwort oeffnen laesst, ob er zum
geschriebenen oeffentlichen Schluessel gehoert und ob eine Testsignatur
verifiziert - erst dann meldet es Erfolg.

### Was danach noch getauscht werden muss

Der neue oeffentliche Schluessel muss an **allen** Stellen liegen, sonst
schlaegt entweder die Pruefung durch Dritte oder das automatische Update fehl:

1. dieses Repository (`omegaseed-mldsa.pub`)
2. `Omega-Secure/omegaseed-release`
3. `https://omegaseed.io/omegaseed-mldsa.pub` (im Webroot, nicht im Paket)
4. `/etc/omega-secure/omegaseed-mldsa.pub` auf dem Server

Punkt 4 zuerst, sonst verweigert der Server das naechste Update - was richtig
waere, aber unnoetig Verwirrung stiftet. Der SHA-256 des Schluessels, den
`keygen-pq.py` ausgibt, ist der Wert, gegen den Sie alle vier Stellen halten.

### Zum Nachsignieren des Altbestands

`sign-pq.py` fasst `SHA256SUMS.txt` und die `.minisig` nicht an, sondern
schreibt nur die `.mldsa` neu. Die Auslieferungsdateien bleiben byteidentisch,
ihre veroeffentlichten Pruefsummen bleiben gueltig, und die Ed25519-Signaturen
aus der urspruenglichen Veroeffentlichung bleiben unveraendert. Genau die sind
der unabhaengige Beleg dafuer, dass beim Nachsignieren an den Dateien nichts
geaendert wurde.

Die ersetzten Signaturen kommen mit `--clobber` in das bestehende Release:

```bash
gh release upload v1.2.0 dist/1.2.0/*.mldsa --clobber
```
