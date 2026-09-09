#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kandidatenliste gegen den ML-DSA-Schluessel durchprobieren.

    python3 scripts/find-pq-pass.py ~/kandidaten.txt

Fuer den Fall, dass Sie mehrere moegliche Passwoerter im Kopf haben und nicht
jedes einzeln eintippen wollen.

WAS DIESES SKRIPT TUT
  Es liest Zeile fuer Zeile, probiert jede als Passwort und meldet, WELCHE
  ZEILE gepasst hat. Es gibt das Passwort selbst nicht aus. Es signiert
  nichts, veraendert den Schluessel nicht, schreibt keine Datei.

WAS SIE BEACHTEN MUESSEN
  Die Kandidatendatei enthaelt Passwoerter im Klartext. Sie darf nicht in ein
  Repository geraten und sollte hinterher geloescht werden. Das Skript
  verweigert deshalb den Dienst, wenn die Datei innerhalb dieses Repos liegt.

  Fehlversuche schaden dem Schluessel nicht. Es gibt keine Sperre.
"""
import pathlib
import sys
import time

try:
    from cryptography.hazmat.primitives import serialization as ser
except ImportError:
    sys.exit("Es fehlt das Paket 'cryptography' (46 oder neuer).")

if len(sys.argv) != 2:
    sys.exit(__doc__)

LIST = pathlib.Path(sys.argv[1]).expanduser().resolve()
REPO = pathlib.Path(__file__).resolve().parent.parent
SECKEY = pathlib.Path.home() / ".omega-secure" / "omegaseed-mldsa.key"
PUBKEY = REPO / "omegaseed-mldsa.pub"

if not LIST.is_file():
    sys.exit(f"Kandidatendatei nicht gefunden: {LIST}")
if REPO in LIST.parents:
    sys.exit(f"Diese Datei liegt im Repository ({LIST}).\n"
             "Passwoerter im Klartext haben dort nichts verloren - ein 'git add -A'\n"
             "wuerde sie mitnehmen. Bitte nach ~/kandidaten.txt verschieben.")
if not SECKEY.exists():
    sys.exit(f"Geheimer Schluessel nicht gefunden: {SECKEY}")

raw = SECKEY.read_bytes()
pub_expected = PUBKEY.read_bytes() if PUBKEY.exists() else None


def variants(line):
    """Kleine, plausible Abwandlungen - keine Brute-Force-Suche.

    Die Grundformen und die Gross-/Kleinschreibung des ersten Zeichens werden
    KOMBINIERT. Sonst faende man ein 'Zaunkoenig...' nicht, wenn 'yaunkoenig...'
    in der Liste steht - also genau den Fall, fuer den das hier gedacht ist.
    """
    bases = [("wie eingegeben", line)]
    s = line.strip()
    if s != line:
        bases.append(("ohne Leerzeichen am Rand", s))
    # QWERTZ/QWERTY: die haeufigste Vertauschung ueberhaupt
    swapped = s.translate(str.maketrans("yzYZ", "zyZY"))
    if swapped != s:
        bases.append(("y und z vertauscht", swapped))

    seen = []
    for label, value in bases:
        forms = [("", value)]
        if value[:1].isalpha():
            forms.append((", erster Buchstabe gross", value[0].upper() + value[1:]))
            forms.append((", erster Buchstabe klein", value[0].lower() + value[1:]))
        for suffix, form in forms:
            if form and all(form != v for _, v in seen):
                seen.append((label + suffix, form))
    return seen


lines = []
for i, raw_line in enumerate(LIST.read_text(encoding="utf-8").splitlines(), 1):
    if not raw_line.strip() or raw_line.lstrip().startswith("#"):
        continue
    lines.append((i, raw_line))

if not lines:
    sys.exit("Die Kandidatendatei enthaelt keine Zeilen.")

total = sum(len(variants(l)) for _, l in lines)
print(f"\n{len(lines)} Kandidaten, {total} Versuche insgesamt.")
print("Abbruch jederzeit mit Strg-C. Es wird nichts veraendert.\n")

t0 = time.time()
done = 0
for lineno, cand in lines:
    for label, value in variants(cand):
        done += 1
        try:
            sk = ser.load_pem_private_key(raw, password=value.encode())
        except Exception:
            print(f"  [{done}/{total}] Zeile {lineno} ({label}) — passt nicht")
            continue

        print(f"\n  GEFUNDEN: Zeile {lineno} der Kandidatendatei, Variante \"{label}\".")
        if pub_expected is not None:
            got = sk.public_key().public_bytes(
                ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo)
            if got == pub_expected:
                print("  Der Schluessel gehoert zum veroeffentlichten omegaseed-mldsa.pub.")
            else:
                print("  ACHTUNG: er gehoert NICHT zu omegaseed-mldsa.pub. Nicht verwenden.")
        print(f"""
  Weiter mit:
      python3 scripts/sign-pq.py 1.3.0

  Bitte jetzt sofort:
    1. Passwort in den Passwortmanager, getrennt von der Schluesseldatei.
    2. Kandidatendatei loeschen:  rm -P {LIST}
""")
        sys.exit(0)

print(f"\nKeiner der {total} Versuche hat gepasst ({time.time() - t0:.0f} s).")
print(f"Kandidatendatei bitte trotzdem loeschen:  rm -P {LIST}")
sys.exit(1)
