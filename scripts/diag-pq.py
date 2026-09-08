#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eingrenzung, warum sich der ML-DSA-Schluessel nicht laden laesst.

    python3 scripts/diag-pq.py

Fragt KEIN Passwort ab und gibt kein Schluesselmaterial aus. Nur die Fakten,
die man braucht, um zwischen "falsches Passwort" und "anderer Grund" zu
unterscheiden.
"""
import pathlib
import sys

SECKEY = pathlib.Path.home() / ".omega-secure" / "omegaseed-mldsa.key"
PUBKEY = pathlib.Path("omegaseed-mldsa.pub")

print(f"\n▸ Geheimer Schluessel  {SECKEY}")
if not SECKEY.exists():
    sys.exit("  existiert nicht. Dann wurde er nie erzeugt oder liegt woanders.")

raw = SECKEY.read_bytes()
first = raw.split(b"\n", 1)[0].decode("ascii", "replace").strip()
print(f"  Groesse   {len(raw)} Bytes")
print(f"  Rechte    {oct(SECKEY.stat().st_mode & 0o777)}")
print(f"  Kopfzeile {first}")

if b"ENCRYPTED PRIVATE KEY" in raw:
    print("  -> passwortverschluesselt (PKCS#8). Ein Passwort ist noetig und richtig.")
    verdict = "pw"
elif b"BEGIN PRIVATE KEY" in raw:
    print("  -> NICHT verschluesselt. Ein eingegebenes Passwort fuehrt hier zum")
    print("     Fehler 'Password was given but private key is not encrypted'.")
    verdict = "plain"
else:
    print("  -> kein erkennbares PKCS#8-PEM. Datei vermutlich beschaedigt oder vertauscht.")
    verdict = "broken"

try:
    from cryptography.hazmat.primitives import serialization as ser
    from cryptography.hazmat.primitives.asymmetric import mldsa
    import cryptography
except ImportError as e:
    sys.exit(f"\n'cryptography' fehlt oder ist zu alt: {e}")

print(f"\n▸ Bibliothek  cryptography {cryptography.__version__}")
print(f"  ML-DSA-65 vorhanden: {hasattr(mldsa, 'MLDSA65PrivateKey')}")

print(f"\n▸ Oeffentlicher Schluessel  {PUBKEY}")
if not PUBKEY.exists():
    print("  fehlt im aktuellen Verzeichnis.")
else:
    try:
        pk = ser.load_pem_public_key(PUBKEY.read_bytes())
        print(f"  lesbar, Typ {type(pk).__name__}")
    except Exception as e:
        print(f"  nicht lesbar: {type(e).__name__}: {e}")

if verdict == "plain":
    try:
        ser.load_pem_private_key(raw, password=None)
        print("\n  Der Schluessel laesst sich OHNE Passwort laden. Bei der Abfrage")
        print("  in sign-pq.py bitte einfach Enter druecken.")
    except Exception as e:
        print(f"\n  Laden ohne Passwort schlaegt trotzdem fehl: {type(e).__name__}: {e}")

print("""
Wenn oben "passwortverschluesselt" steht und die Bibliothek passt, bleibt als
Ursache tatsaechlich nur das Passwort. Es ist ein anderes als das von minisign:
beide Schluessel wurden getrennt erzeugt und getrennt vergeben.
""")
