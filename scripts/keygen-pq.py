#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ML-DSA-65 Schluesselpaar erzeugen (FIPS 204, post-quantum).

    python3 scripts/keygen-pq.py

AUF DEM NETZGETRENNTEN RECHNER AUSFUEHREN. Legt an:

    ~/.omega-secure/omegaseed-mldsa.key   geheim, passwortverschluesselt (PKCS#8)
    ./omegaseed-mldsa.pub                 oeffentlich (SubjectPublicKeyInfo)

Beide Dateien sind Standard-PEM. Der oeffentliche Schluessel laesst sich damit
auch mit OpenSSL 3.5 oder neuer pruefen, nicht nur mit diesen Skripten.
"""
import getpass
import pathlib
import sys

try:
    from cryptography.hazmat.primitives import serialization as ser
    from cryptography.hazmat.primitives.asymmetric import mldsa
except ImportError:
    sys.exit("Es fehlt das Paket 'cryptography' (Version 46 oder neuer):\n"
             "    python3 -m pip install --upgrade cryptography")

if not hasattr(mldsa, "MLDSA65PrivateKey"):
    sys.exit("Diese Fassung von 'cryptography' kennt ML-DSA noch nicht.\n"
             "    python3 -m pip install --upgrade cryptography")

SECDIR = pathlib.Path.home() / ".omega-secure"
SECKEY = SECDIR / "omegaseed-mldsa.key"
PUBKEY = pathlib.Path("omegaseed-mldsa.pub")

if SECKEY.exists():
    sys.exit(f"Es gibt bereits einen Schluessel: {SECKEY}\n"
             "Zum Ersetzen zuerst von Hand wegsichern und loeschen. Ein neuer\n"
             "Schluessel bedeutet: alle bisherigen Signaturen sind nicht mehr\n"
             "gegen den neuen pruefbar.")

pw1 = getpass.getpass("Passwort fuer den geheimen Schluessel: ")
pw2 = getpass.getpass("Passwort wiederholen: ")
if pw1 != pw2:
    sys.exit("Die Passwoerter stimmen nicht ueberein.")
if len(pw1) < 12:
    sys.exit("Bitte mindestens 12 Zeichen. Dieser Schluessel signiert Software,\n"
             "mit der Menschen ihre Seedphrase sichern.")

sk = mldsa.MLDSA65PrivateKey.generate()

SECDIR.mkdir(mode=0o700, exist_ok=True)
SECKEY.write_bytes(sk.private_bytes(
    ser.Encoding.PEM, ser.PrivateFormat.PKCS8,
    ser.BestAvailableEncryption(pw1.encode())))
SECKEY.chmod(0o600)

PUBKEY.write_bytes(sk.public_key().public_bytes(
    ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo))

print(f"""
Fertig.

  geheim      {SECKEY}   (Rechte 600)
  oeffentlich {PUBKEY.resolve()}

Der geheime Schluessel bleibt auf diesem Rechner. Niemals kopieren, niemals
hochladen, niemals in eine CI-Pipeline. Legen Sie eine verschluesselte
Sicherung an und bewahren Sie das Passwort getrennt davon auf.

Der oeffentliche Schluessel gehoert ins Repository und auf die Website.
""")
