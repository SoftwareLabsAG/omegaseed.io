#!/usr/bin/env bash
# =============================================================================
#  Klassische Signatur (Ed25519 via minisign) fuer eine Version.
#  AUF DEM NETZGETRENNTEN RECHNER AUSFUEHREN.
#
#      bash scripts/sign.sh 1.3.0
#
#  Signiert wird, was in dist/<VERSION>/ liegt - nicht eine feste Liste.
#  Ein Release muss nicht immer dieselben Dateien enthalten: enthaelt eine
#  Version keine neue Offline-Datei, wird eben nur das Paket signiert.
#
#  Die post-quantum Signatur laeuft getrennt: python3 scripts/sign-pq.py <VERSION>
# =============================================================================
set -euo pipefail

VERSION="${1:-}"
[[ -n "$VERSION" ]] || { echo "Aufruf: bash scripts/sign.sh <VERSION>   z. B. 1.3.0"; exit 1; }

SECKEY="${MINISIGN_SECKEY:-$HOME/.omega-secure/omegaseed.key}"
DIR="dist/${VERSION}"

command -v minisign >/dev/null || {
  echo "minisign fehlt.  macOS: brew install minisign   ·   Debian: apt install minisign"; exit 1; }
[[ -d "$DIR" ]]    || { echo "Verzeichnis $DIR gibt es nicht."; exit 1; }
[[ -f "$SECKEY" ]] || { echo "Geheimer Schluessel nicht gefunden: $SECKEY"; exit 1; }

cd "$DIR"

# Alles ausser Signaturen, Pruefsummenliste und Notizen
# Kein 'mapfile' - macOS liefert bash 3.2 aus, das kennt es nicht.
FILES=()
while IFS= read -r _f; do
  if [ -n "$_f" ]; then FILES+=("$_f"); fi
done < <(ls -1 | grep -Ev '\.(minisig|mldsa)$|^SHA256SUMS\.txt$|^NOTES\.md$' | sort)
[[ ${#FILES[@]} -gt 0 ]] || { echo "In $DIR liegt nichts zu Signierendes."; exit 1; }

echo "-- Diese Dateien werden erfasst:"
printf '     %s\n' "${FILES[@]}"

echo
echo "-- Pruefsummen schreiben"
{
  echo "# OmegaSeedphrase ${VERSION}"
  echo "# Pruefen:  minisign -Vm SHA256SUMS.txt -p omegaseed.pub  &&  sha256sum -c SHA256SUMS.txt"
  echo
} > SHA256SUMS.txt
if command -v sha256sum >/dev/null; then
  sha256sum "${FILES[@]}" >> SHA256SUMS.txt
else
  shasum -a 256 "${FILES[@]}" >> SHA256SUMS.txt
fi
cat SHA256SUMS.txt

# Signiert werden die Pruefsummenliste und jede einzeln herunterladbare HTML-Datei
SIGN=(SHA256SUMS.txt)
for f in "${FILES[@]}"; do [[ "$f" == *.html ]] && SIGN+=("$f"); done

echo
echo "-- Signieren, Passwort wird EINMAL abgefragt"
minisign -S -s "$SECKEY" \
  -c "Omega Secure - OmegaSeedphrase ${VERSION}" \
  -t "OmegaSeedphrase ${VERSION} - Omega Secure, D & M Solution Dynamics GmbH" \
  -m "${SIGN[@]}"

cd - >/dev/null

# Die Gegenprobe prueft BEIDE Verfahren. Solange die post-quantum Signatur
# fehlt, wuerde sie zu Recht beanstanden - das ist dann kein Fehler, sondern
# ein noch nicht erledigter Schritt. Also erst danach aufrufen.
echo
if ls "$DIR"/*.mldsa >/dev/null 2>&1; then
  echo "-- Gegenprobe"
  bash scripts/verify.sh "$VERSION"
else
  echo "-- Klassische Signatur liegt vor. Die post-quantum Signatur fehlt noch."
  echo "   Als naechstes:"
  echo "       python3 scripts/sign-pq.py ${VERSION}"
  echo "       bash    scripts/verify.sh  ${VERSION}"
fi
