#!/usr/bin/env bash
# =============================================================================
#  Klassische Signatur (Ed25519 via minisign) fuer eine Version.
#
#  AUF DEM NETZGETRENNTEN RECHNER AUSFUEHREN.
#
#      bash scripts/sign.sh 1.2.0
#
#  Erwartet in dist/<VERSION>/ die drei Auslieferungsdateien.
#  Erzeugt SHA256SUMS.txt und je eine .minisig.
#
#  Die post-quantum Signatur laeuft getrennt:  python3 scripts/sign-pq.py <VERSION>
# =============================================================================
set -euo pipefail

VERSION="${1:-}"
[[ -n "$VERSION" ]] || { echo "Aufruf: bash scripts/sign.sh <VERSION>   z. B. 1.2.0"; exit 1; }

SECKEY="${MINISIGN_SECKEY:-$HOME/.omega-secure/omegaseed.key}"
DIR="dist/${VERSION}"

command -v minisign >/dev/null || {
  echo "minisign fehlt.  macOS: brew install minisign   ·   Debian: apt install minisign"; exit 1; }
[[ -d "$DIR" ]]    || { echo "Verzeichnis $DIR gibt es nicht."; exit 1; }
[[ -f "$SECKEY" ]] || { echo "Geheimer Schluessel nicht gefunden: $SECKEY"; exit 1; }

FILES=(
  "omegaseedphrase-deploy-v${VERSION}.zip"
  "omegaseedphrase-offline-v${VERSION}.html"
  "omegaseedphrase-offline-en-v${VERSION}.html"
)

cd "$DIR"
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "Datei fehlt: $DIR/$f"; exit 1; }
done

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

echo
echo "-- Signieren, Passwort wird EINMAL abgefragt"
# minisign nimmt mehrere -m Dateien in einem Aufruf.
minisign -S -s "$SECKEY" \
  -c "Omega Secure - OmegaSeedphrase ${VERSION}" \
  -t "OmegaSeedphrase ${VERSION} - Omega Secure, D & M Solution Dynamics GmbH" \
  -m SHA256SUMS.txt \
     "omegaseedphrase-offline-v${VERSION}.html" \
     "omegaseedphrase-offline-en-v${VERSION}.html"

echo
echo "-- Gegenprobe"
cd - >/dev/null
bash scripts/verify.sh "$VERSION"
