#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Passwort des ML-DSA-Schluessels ausprobieren - ohne etwas zu veraendern.

    python3 scripts/try-pq-pass.py

Signiert nichts, schreibt nichts, loescht nichts. Sagt nur, ob sich der
Schluessel oeffnen laesst und ob er zum veroeffentlichten oeffentlichen
Schluessel gehoert. Beliebig oft wiederholbar; leere Eingabe beendet.

Es gibt keine Begrenzung der Versuche und keine Sperre - der Schluessel nimmt
durch Fehlversuche keinen Schaden.
"""
import getpass
import pathlib
import sys

try:
    from cryptography.hazmat.primitives import serialization as ser
except ImportError:
    sys.exit("Es fehlt das Paket 'cryptography'.")

SECKEY = pathlib.Path.home() / ".omega-secure" / "omegaseed-mldsa.key"
PUBKEY = pathlib.Path("omegaseed-mldsa.pub")

if not SECKEY.exists():
    sys.exit(f"Nicht gefunden: {SECKEY}")

raw = SECKEY.read_bytes()
pub_expected = PUBKEY.read_bytes() if PUBKEY.exists() else None

print(f"\nSchluessel {SECKEY}")
print("Leere Eingabe beendet. Es wird nichts geschrieben.\n")

n = 0
while True:
    pw = getpass.getpass(f"Versuch {n + 1} — Passwort: ")
    if pw == "":
        print("\nAbgebrochen. Nichts veraendert.")
        break
    n += 1
    try:
        sk = ser.load_pem_private_key(raw, password=pw.encode())
    except Exception as e:
        print(f"  passt nicht  ({type(e).__name__})\n")
        continue

    print("\n  RICHTIG — der Schluessel laesst sich oeffnen.")
    if pub_expected is not None:
        got = sk.public_key().public_bytes(
            ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo)
        if got == pub_expected:
            print("  Und er gehoert zum veroeffentlichten omegaseed-mldsa.pub.")
        else:
            print("  ABER er gehoert NICHT zu omegaseed-mldsa.pub. Damit koennten")
            print("  Sie signieren, aber niemand koennte es pruefen. Nicht verwenden.")
    print("\n  Weiter mit:  python3 scripts/sign-pq.py 1.3.0")
    print("  Und bitte notieren Sie das Passwort jetzt sicher.\n")
    break
