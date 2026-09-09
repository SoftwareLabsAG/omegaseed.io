#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ML-DSA-65 Schluesselpaar erzeugen (FIPS 204, post-quantum).

    python3 scripts/keygen-pq.py            erstmalig
    python3 scripts/keygen-pq.py --rotate   bestehenden Schluessel ersetzen

AUF DEM NETZGETRENNTEN RECHNER AUSFUEHREN. Legt an:

    ~/.omega-secure/omegaseed-mldsa.key   geheim, passwortverschluesselt (PKCS#8)
    ./omegaseed-mldsa.pub                 oeffentlich (SubjectPublicKeyInfo)

Beide Dateien sind Standard-PEM. Der oeffentliche Schluessel laesst sich damit
auch mit OpenSSL 3.5 oder neuer pruefen, nicht nur mit diesen Skripten.

Mit --rotate wird der alte geheime Schluessel NICHT geloescht, sondern nach
~/.omega-secure/retired/ verschoben, und der alte oeffentliche Schluessel nach
keys/retired/ im Repository kopiert. Beides bleibt erhalten, damit sich alte
Signaturen im Nachhinein noch zuordnen lassen.
"""
import datetime
import getpass
import hashlib
import pathlib
import shutil
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

ROTATE = False
for arg in sys.argv[1:]:
    if arg == "--rotate":
        ROTATE = True
    else:
        sys.exit(f"Unbekannte Option: {arg}\n{__doc__}")

REPO = pathlib.Path(__file__).resolve().parent.parent
SECDIR = pathlib.Path.home() / ".omega-secure"
SECKEY = SECDIR / "omegaseed-mldsa.key"
PUBKEY = REPO / "omegaseed-mldsa.pub"
STAMP = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

# ---------------------------------------------------------------- Vorbedingung
if SECKEY.exists() and not ROTATE:
    sys.exit(f"""Es gibt bereits einen Schluessel: {SECKEY}

Wenn Sie ihn wirklich ersetzen wollen:

    python3 scripts/keygen-pq.py --rotate

Was das bedeutet: alle bisher mit dem alten Schluessel erzeugten
ML-DSA-Signaturen sind gegen den neuen oeffentlichen Schluessel NICHT
pruefbar. Sie muessen sie mit dem neuen Schluessel nachsignieren, den neuen
oeffentlichen Schluessel an allen Veroeffentlichungsstellen austauschen und
ihn auf dem Server unter /etc/omega-secure/ hinterlegen. Solange das nicht
geschehen ist, verweigert der Server jedes Update - korrekterweise.""")

if ROTATE:
    if not SECKEY.exists():
        sys.exit(f"--rotate, aber es gibt keinen Schluessel unter {SECKEY}.\n"
                 "Dann bitte ohne --rotate aufrufen.")
    print(f"""
▸ SCHLUESSELWECHSEL

  alt   {SECKEY}
  neu   wird gleich erzeugt

  Der alte geheime Schluessel wird nicht geloescht, sondern verschoben nach
      {SECDIR / 'retired' / f'omegaseed-mldsa-{STAMP}.key'}
  Der alte oeffentliche Schluessel wird kopiert nach
      {REPO / 'keys' / 'retired' / f'omegaseed-mldsa-{STAMP}.pub'}

  Danach ist jede bisherige ML-DSA-Signatur gegen den neuen Schluessel
  ungueltig, bis Sie sie nachsignieren.
""")
    if input('  Zum Fortfahren bitte WECHSELN eingeben: ').strip() != "WECHSELN":
        sys.exit("Abgebrochen. Nichts veraendert.")

# ------------------------------------------------------------------- Passwort
print("""
▸ PASSWORT

  Mindestens 12 Zeichen. Es wird dreimal abgefragt: zweimal zum Festlegen und
  ein drittes Mal, nachdem Sie es abgelegt haben. Das dritte Mal ist keine
  Schikane, sondern der Punkt, an dem es beim letzten Schluessel gefehlt hat -
  ein Passwort, das nur im Kopf war, ist nach ein paar Wochen weg.
""")
pw1 = getpass.getpass("  Passwort: ")
pw2 = getpass.getpass("  Passwort wiederholen: ")
if pw1 != pw2:
    sys.exit("Die Passwoerter stimmen nicht ueberein. Nichts veraendert.")
if len(pw1) < 12:
    sys.exit("Bitte mindestens 12 Zeichen. Dieser Schluessel signiert Software,\n"
             "mit der Menschen ihre Seedphrase sichern. Nichts veraendert.")

print("""
  Legen Sie das Passwort JETZT ab - Passwortmanager, nicht dieselbe Stelle wie
  die Schluesseldatei. Es gibt keine Wiederherstellung; ohne das Passwort ist
  der Schluessel unbrauchbar.
""")
pw3 = getpass.getpass("  Zur Bestaetigung noch einmal aus Ihrer Ablage eintippen: ")
if pw3 != pw1:
    sys.exit("Stimmt nicht mit dem eben Festgelegten ueberein.\n"
             "Nichts veraendert - bitte von vorn.")

# ----------------------------------------------------------- Altbestand sichern
if ROTATE:
    (SECDIR / "retired").mkdir(mode=0o700, parents=True, exist_ok=True)
    moved_sec = SECDIR / "retired" / f"omegaseed-mldsa-{STAMP}.key"
    shutil.move(str(SECKEY), str(moved_sec))
    print(f"\n  alter geheimer Schluessel  -> {moved_sec}")
    if PUBKEY.exists():
        retired_dir = REPO / "keys" / "retired"
        retired_dir.mkdir(parents=True, exist_ok=True)
        moved_pub = retired_dir / f"omegaseed-mldsa-{STAMP}.pub"
        shutil.copy2(str(PUBKEY), str(moved_pub))
        print(f"  alter oeffentlicher Schl.  -> {moved_pub}")

# --------------------------------------------------------------------- Erzeugen
sk = mldsa.MLDSA65PrivateKey.generate()

SECDIR.mkdir(mode=0o700, exist_ok=True)
SECKEY.write_bytes(sk.private_bytes(
    ser.Encoding.PEM, ser.PrivateFormat.PKCS8,
    ser.BestAvailableEncryption(pw1.encode())))
SECKEY.chmod(0o600)

PUBKEY.write_bytes(sk.public_key().public_bytes(
    ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo))

# ------------------------------------------------------------- Selbstkontrolle
# Nicht darauf verlassen, dass das Schreiben stimmt: von der Platte neu laden,
# mit dem Passwort oeffnen, Zugehoerigkeit pruefen und einmal wirklich
# signieren und verifizieren. Sonst faellt ein Fehler erst beim Release auf.
print("\n▸ SELBSTKONTROLLE")
try:
    reloaded = ser.load_pem_private_key(SECKEY.read_bytes(), password=pw1.encode())
except Exception as e:
    sys.exit(f"  Der geschriebene Schluessel laesst sich NICHT mit dem Passwort\n"
             f"  oeffnen: {type(e).__name__}: {e}\n"
             f"  Bitte {SECKEY} pruefen, bevor Sie irgendetwas signieren.")
print("  Schluessel von der Platte gelesen und mit dem Passwort geoeffnet")

pub_bytes = PUBKEY.read_bytes()
if reloaded.public_key().public_bytes(
        ser.Encoding.PEM, ser.PublicFormat.SubjectPublicKeyInfo) != pub_bytes:
    sys.exit("  Der oeffentliche Schluessel gehoert nicht zum geheimen. Abbruch.")
print("  oeffentlicher Schluessel gehoert zum geheimen")

probe = b"omegaseed keygen self-test"
ser.load_pem_public_key(pub_bytes).verify(reloaded.sign(probe), probe)
print("  Testsignatur erzeugt und geprueft")

fp = hashlib.sha256(pub_bytes).hexdigest()

print(f"""
▸ FERTIG

  geheim      {SECKEY}   (Rechte 600)
  oeffentlich {PUBKEY}

  SHA-256 des oeffentlichen Schluessels
      {fp}

  Diesen Wert brauchen Sie, um an allen Veroeffentlichungsstellen zu pruefen,
  dass dort derselbe Schluessel liegt.

  Der geheime Schluessel bleibt auf diesem Rechner. Niemals kopieren, niemals
  hochladen, niemals in eine CI-Pipeline. Legen Sie eine verschluesselte
  Sicherung an und bewahren Sie das Passwort getrennt davon auf.
""")
if ROTATE:
    print("""  Weiter mit dem Nachsignieren - siehe SIGNATUREN.md, Abschnitt
  "Schluesselwechsel".
""")
