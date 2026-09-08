#!/usr/bin/env bash
# =============================================================================
#  Prueft eine Version: klassisch (minisign) und post-quantum (ML-DSA-65).
#
#      bash scripts/verify.sh 1.2.0
#
#  Erwartet omegaseed.pub und omegaseed-mldsa.pub im Wurzelverzeichnis.
#  Holen Sie beide Schluessel aus zwei unabhaengigen Quellen und vergleichen Sie:
#      https://omegaseed.io/omegaseed.pub  ·  https://omegaseed.io/omegaseed-mldsa.pub
#      dieses Repository
# =============================================================================
set -euo pipefail

VERSION="${1:-}"
[[ -n "$VERSION" ]] || { echo "Aufruf: bash scripts/verify.sh <VERSION>   z. B. 1.2.0"; exit 1; }
DIR="dist/${VERSION}"
[[ -d "$DIR" ]] || { echo "Verzeichnis $DIR gibt es nicht."; exit 1; }

FAIL=0

echo "== 1/3  Klassisch: Ed25519 (minisign)"
if command -v minisign >/dev/null && [[ -f omegaseed.pub ]]; then
  PUB="$(pwd)/omegaseed.pub"
  ( cd "$DIR"
    minisign -Vm SHA256SUMS.txt -p "$PUB"
    for f in *.html; do
      [[ -f "$f.minisig" ]] || continue
      printf '  %-46s ' "$f"; minisign -QVm "$f" -p "$PUB" && echo "gueltig"
    done ) || FAIL=1
else
  echo "  uebersprungen (minisign oder omegaseed.pub fehlt)"
fi

echo
echo "== 2/3  Post-quantum: ML-DSA-65 (FIPS 204)"
if [[ -f omegaseed-mldsa.pub ]]; then
  # PYTHON=... erlaubt einen eigenen Interpreter, z. B. aus einer venv.
  "${PYTHON:-python3}" scripts/verify-pq.py "$VERSION" || FAIL=1
else
  echo "  uebersprungen (omegaseed-mldsa.pub fehlt)"
fi

echo
echo "== 3/3  Pruefsummen"
( cd "$DIR"
  if command -v sha256sum >/dev/null; then sha256sum -c SHA256SUMS.txt
  else shasum -a 256 -c SHA256SUMS.txt; fi ) || FAIL=1

echo
if [[ $FAIL -eq 0 ]]; then
  echo "Alles geprueft: beide Signaturen gueltig, Dateien unveraendert."
else
  echo "BEANSTANDUNGEN. Diese Dateien nicht verwenden."; exit 1
fi
