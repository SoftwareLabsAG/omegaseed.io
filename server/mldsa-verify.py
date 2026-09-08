#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eine ML-DSA-65 Signatur pruefen (FIPS 204).

    mldsa-verify.py <oeffentlicher-schluessel.pem> <datei> <signatur>

Exitcode 0 = gueltig, 1 = ungueltig oder Fehler. Gibt nichts aus ausser im
Fehlerfall — gedacht zum Einbau in Skripte.
"""
import sys

if len(sys.argv) != 4:
    sys.exit("Aufruf: mldsa-verify.py <pubkey.pem> <datei> <signatur>")

try:
    from cryptography.hazmat.primitives import serialization as ser
    from cryptography.hazmat.primitives.asymmetric import mldsa  # noqa: F401
except ImportError:
    sys.exit("FEHLER: Paket 'cryptography' (46 oder neuer) fehlt.")

pub, data_file, sig_file = sys.argv[1:4]

try:
    key = ser.load_pem_public_key(open(pub, "rb").read())
except Exception as e:
    sys.exit(f"FEHLER: oeffentlicher Schluessel nicht lesbar: {e}")

if not isinstance(key, mldsa.MLDSA65PublicKey):
    sys.exit(f"FEHLER: {pub} ist kein ML-DSA-65 Schluessel.")

try:
    key.verify(open(sig_file, "rb").read(), open(data_file, "rb").read())
except Exception:
    sys.exit(f"FEHLER: Signatur ungueltig fuer {data_file}")
