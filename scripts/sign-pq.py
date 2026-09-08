#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Post-quantum Signatur (ML-DSA-65, FIPS 204) fuer eine Version.

    python3 scripts/sign-pq.py 1.2.0

AUF DEM NETZGETRENNTEN RECHNER AUSFUEHREN.

Signiert in dist/<VERSION>/ die Pruefsummenliste und beide Offline-Dateien und
prueft anschliessend selbst gegen den oeffentlichen Schluessel. Das Passwort
wird einmal abgefragt.
"""
import getpass
import pathlib
import sys

try:
    from cryptography.hazmat.primitives import serialization as ser
    from cryptography.hazmat.primitives.asymmetric import mldsa  # noqa: F401
except ImportError:
    sys.exit("Es fehlt das Paket 'cryptography' (Version 46 oder neuer):\n"
             "    python3 -m pip install --upgrade cryptography")

if len(sys.argv) != 2:
    sys.exit("Aufruf: python3 scripts/sign-pq.py <VERSION>   z. B. 1.2.0")
VERSION = sys.argv[1]

SECKEY = pathlib.Path.home() / ".omega-secure" / "omegaseed-mldsa.key"
PUBKEY = pathlib.Path("omegaseed-mldsa.pub")
DIR = pathlib.Path("dist") / VERSION

TARGETS = [
    DIR / "SHA256SUMS.txt",
    DIR / f"omegaseedphrase-offline-v{VERSION}.html",
    DIR / f"omegaseedphrase-offline-en-v{VERSION}.html",
]

if not SECKEY.exists():
    sys.exit(f"Geheimer Schluessel nicht gefunden: {SECKEY}\n"
             "Zuerst 'python3 scripts/keygen-pq.py' auf diesem Rechner ausfuehren.")
if not PUBKEY.exists():
    sys.exit(f"Oeffentlicher Schluessel nicht gefunden: {PUBKEY.resolve()}")
missing = [str(t) for t in TARGETS if not t.exists()]
if missing:
    sys.exit("Diese Dateien fehlen:\n  " + "\n  ".join(missing))

pw = getpass.getpass("Passwort des geheimen Schluessels: ")
try:
    sk = ser.load_pem_private_key(SECKEY.read_bytes(), password=pw.encode())
except Exception:
    sys.exit("Der Schluessel liess sich nicht entschluesseln — falsches Passwort?")

pk = ser.load_pem_public_key(PUBKEY.read_bytes())
if sk.public_key().public_bytes(
        ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo) != PUBKEY.read_bytes():
    sys.exit(f"{PUBKEY} gehoert nicht zu {SECKEY}. Abbruch — sonst signieren Sie\n"
             "gegen einen Schluessel, den niemand pruefen kann.")

print(f"\n▸ ML-DSA-65 signieren — Version {VERSION}\n")
for t in TARGETS:
    data = t.read_bytes()
    sig = sk.sign(data)
    out = t.with_suffix(t.suffix + ".mldsa")
    out.write_bytes(sig)
    pk.verify(sig, data)                       # sofortige Gegenprobe
    print(f"  {t.name:<46} {len(sig)} Bytes  geprueft")

print(f"""
Fertig. Zusaetzlich zu den klassischen .minisig liegen jetzt .mldsa vor.

Gegenprobe auf dem Arbeitsrechner:
    python3 scripts/verify-pq.py {VERSION}

Mit OpenSSL 3.5 oder neuer geht auch:
    openssl pkeyutl -verify -rawin -in dist/{VERSION}/SHA256SUMS.txt \\
        -pubin -inkey omegaseed-mldsa.pub -sigfile dist/{VERSION}/SHA256SUMS.txt.mldsa
""")
