# Selbstaktualisierung auf dem Droplet einrichten

Einmalig, als root auf `104.248.44.15`. Danach holt sich der Server neue
Versionen selbst — aber **nur**, wenn beide Signaturen gegen die hier fest
hinterlegten Schlüssel passen.

GitHub bekommt keinen Zugang zum Server. Wird GitHub oder das Konto übernommen,
lehnt der Server ab.

## 1 — Pakete

```bash
ssh root@104.248.44.15 'apt-get update -qq && apt-get install -y -qq minisign unzip rsync curl python3-venv'
```

## 2 — Schlüssel fest hinterlegen

Die beiden öffentlichen Schlüssel kommen **von Ihrem Rechner**, nicht aus dem
Netz — aus dem Schlüssel-Repository `omegaseed-release`. Das ist der Kern:
Sie liegen danach lokal und lassen sich von niemandem über GitHub austauschen.

```bash
ssh root@104.248.44.15 'mkdir -p /etc/omega-secure && chmod 755 /etc/omega-secure'
scp ~/omegastack/omegaseed-release/omegaseed.pub \
    ~/omegastack/omegaseed-release/omegaseed-mldsa.pub \
    root@104.248.44.15:/etc/omega-secure/
ssh root@104.248.44.15 'chmod 644 /etc/omega-secure/*.pub && ls -l /etc/omega-secure'
```

## 3 — Prüfumgebung für ML-DSA

Das System-Python kennt ML-DSA nicht. Eine eigene Umgebung, einmal angelegt:

```bash
ssh root@104.248.44.15 'python3 -m venv /opt/omega-secure/venv && /opt/omega-secure/venv/bin/pip install -q --upgrade pip cryptography'
ssh root@104.248.44.15 '/opt/omega-secure/venv/bin/python -c "from cryptography.hazmat.primitives.asymmetric import mldsa; print(\"ML-DSA vorhanden\")"'
```

## 4 — Skripte einspielen

```bash
scp server/omega-update.sh server/mldsa-verify.py root@104.248.44.15:/opt/omega-secure/
scp server/omega-update.service server/omega-update.timer root@104.248.44.15:/etc/systemd/system/
ssh root@104.248.44.15 'chmod 755 /opt/omega-secure/omega-update.sh && chmod 644 /opt/omega-secure/mldsa-verify.py'
```

## 5 — Trockenlauf

Prüft alles, schaltet nichts um:

```bash
ssh root@104.248.44.15 '/opt/omega-secure/omega-update.sh --dry-run'
```

Erwartet, wenn die installierte Version die neueste ist:

```
nichts zu tun (installiert 1.2.0, angeboten 1.2.0)
```

Erst wenn dieser Lauf sauber durchgeht, den Zeitgeber einschalten.

## 6 — Zeitgeber einschalten

```bash
ssh root@104.248.44.15 'systemctl daemon-reload && systemctl enable --now omega-update.timer && systemctl list-timers omega-update.timer'
```

## Laufender Betrieb

```bash
# Wann lief es zuletzt, was kam dabei heraus?
ssh root@104.248.44.15 'journalctl -u omega-update.service -n 40 --no-pager'

# Einmal von Hand anstoßen
ssh root@104.248.44.15 'systemctl start omega-update.service'
```

Eine neue Version geht so live: lokal bauen, **netzgetrennt signieren**,
Release auf GitHub anlegen — der Server zieht innerhalb einer Stunde nach.
Kein Schlüssel und kein Serverzugang liegt dabei bei GitHub.

## Was der Server prüft, bevor er umschaltet

1. Ed25519-Signatur über `SHA256SUMS.txt` gegen `/etc/omega-secure/omegaseed.pub`
2. ML-DSA-65-Signatur über dieselbe Datei gegen `omegaseed-mldsa.pub`
3. Prüfsumme des Pakets gegen die signierte Liste
4. Prüfsummen aller Dateien **im** Paket
5. Version im Paket gleich der Version des Releases
6. Keine Rückstufung auf eine ältere Version

Schlägt einer der Punkte fehl, bricht der Lauf ab und der Webroot bleibt
unverändert. Getestet wurde jeder dieser Fälle einzeln.

## Grenzen

Ein Angreifer mit Ihrem **Signierschlüssel** kommt durch — deshalb bleibt der
auf dem netzgetrennten Rechner. Ein Angreifer mit **root auf dem Droplet**
kommt ebenfalls durch, indem er die hinterlegten Schlüssel austauscht; dagegen
hilft nur, dass Besucher die Offline-Datei selbst prüfen. Die Automatisierung
schützt gegen den Weg über GitHub, nicht gegen alles.
