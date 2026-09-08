#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Post-quantum Signaturen einer Version pruefen (ML-DSA-65, FIPS 204).

    python3 scripts/verify-pq.py 1.2.0

Erwartet den oeffentlichen Schluessel als omegaseed-mldsa.pub im aktuellen
Verzeichnis oder unter $OMEGASEED_MLDSA_PUB.

Holen Sie den Schluessel aus zwei unabhaengigen Quellen und vergleichen Sie sie:
    https://omegaseed.io/omegaseed-mldsa.pub
    dieses Repository
Ein Schluessel, der nur dort steht, wo auch die Datei liegt, sichert nichts ab.
"""
import hashlib
import os
import pathlib
import sys

try:
    from cryptography.hazmat.primitives import serialization as ser
    from cryptography.hazmat.primitives.asymmetric import mldsa  # noqa: F401
except ImportError:
    sys.exit("Es fehlt das Paket 'cryptography' (Version 46 oder neuer):\n"
             "    python3 -m pip install --upgrade cryptography")

if len(sys.argv) != 2:
    sys.exit("Aufruf: python3 scripts/verify-pq.py <VERSION>   z. B. 1.2.0")
VERSION = sys.argv[1]

PUBKEY = pathlib.Path(os.environ.get("OMEGASEED_MLDSA_PUB", "omegaseed-mldsa.pub"))
DIR = pathlib.Path("dist") / VERSION

if not PUBKEY.exists():
    sys.exit(f"Oeffentlicher Schluessel nicht gefunden: {PUBKEY}")
if not DIR.is_dir():
    sys.exit(f"Verzeichnis {DIR} gibt es nicht.")

pk = ser.load_pem_public_key(PUBKEY.read_bytes())
fp = hashlib.sha256(PUBKEY.read_bytes()).hexdigest()[:32]
print(f"\n▸ Oeffentlicher Schluessel {PUBKEY}")
print(f"  SHA-256 der Schluesseldatei: {fp}…")
print("  Bitte gegen die zweite Quelle halten.\n")

sigs = sorted(DIR.glob("*.mldsa"))
if not sigs:
    sys.exit(f"In {DIR} liegen keine .mldsa-Signaturen.")

bad = 0
print("▸ Signaturen")
for s in sigs:
    target = s.with_suffix("")            # foo.txt.mldsa -> foo.txt
    if not target.exists():
        print(f"  {s.name:<50} zugehoerige Datei fehlt")
        bad += 1
        continue
    try:
        pk.verify(s.read_bytes(), target.read_bytes())
        print(f"  {target.name:<50} gueltig")
    except Exception:
        print(f"  {target.name:<50} UNGUELTIG")
        bad += 1

# Pruefsummen gegen die signierte Liste
sums = DIR / "SHA256SUMS.txt"
if sums.exists() and (DIR / "SHA256SUMS.txt.mldsa").exists() and bad == 0:
    print("\n▸ Pruefsummen gegen die signierte Liste")
    for line in sums.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split(None, 1)
        if len(parts) != 2:
            continue
        want, name = parts[0], parts[1].lstrip("*").strip()
        f = DIR / name
        if not f.exists():
            print(f"  {name:<50} Datei fehlt")
            bad += 1
            continue
        got = hashlib.sha256(f.read_bytes()).hexdigest()
        print(f"  {name:<50} {'OK' if got == want else 'ABWEICHUNG'}")
        if got != want:
            bad += 1

if bad:
    sys.exit(f"\n{bad} Beanstandung(en). Diese Dateien nicht verwenden.")
print("\nAlles geprueft: ML-DSA-Signaturen gueltig und Dateien unveraendert.")
