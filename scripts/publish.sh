#!/usr/bin/env bash
# =============================================================================
#  publish.sh — eine signierte Version veroeffentlichen, auf zwei Repositories
#  verteilt.
#
#      bash scripts/publish.sh 1.3.1
#
#  Paket      -> SoftwareLabsAG/omegaseed.io       (nur das .zip)
#  Signaturen -> Omega-Secure/omegaseed-release    (Liste + .minisig + .mldsa)
#
#  REIHENFOLGE IST NICHT BELIEBIG. Zuerst das Paket, dann die Signaturen. Der
#  Server richtet sich nach der Signaturseite: sobald dort ein Tag steht, holt
#  er das Paket unter demselben Tag. Stehen die Signaturen zuerst, laeuft er in
#  einen Abbruch, weil es das Paket noch nicht gibt.
#
#  Das Skript prueft vorher selbst und veroeffentlicht nichts Unsigniertes.
# =============================================================================
set -euo pipefail

VERSION=""; LATEST="--latest"
while [[ $# -gt 0 ]]; do
  case "$1" in
    # Fuer das Nachtragen aelterer Versionen: darf NICHT als neueste gelten,
    # sonst wuerde der Server auf die alte Version zurueckgewiesen.
    --backfill) LATEST="--latest=false"; shift ;;
    -*) echo "Unbekannte Option: $1"; exit 2 ;;
    *)  VERSION="$1"; shift ;;
  esac
done
[[ -n "$VERSION" ]] || { echo "Aufruf: bash scripts/publish.sh [--backfill] <VERSION>   z. B. 1.3.1"; exit 1; }

PKGREPO="${OMEGA_PKGREPO:-SoftwareLabsAG/omegaseed.io}"
SIGREPO="${OMEGA_SIGREPO:-Omega-Secure/omegaseed-release}"
TAG="v${VERSION}"
DIR="dist/${VERSION}"
ZIP="omegaseedphrase-deploy-v${VERSION}.zip"

command -v gh >/dev/null || { echo "gh fehlt (brew install gh)"; exit 1; }
[[ -d "$DIR" ]] || { echo "Verzeichnis $DIR gibt es nicht."; exit 1; }

for f in "$ZIP" SHA256SUMS.txt SHA256SUMS.txt.minisig SHA256SUMS.txt.mldsa; do
  [[ -s "$DIR/$f" ]] || { echo "Es fehlt: $DIR/$f
Erst signieren:  bash scripts/sign.sh $VERSION  und  python3 scripts/sign-pq.py $VERSION"; exit 1; }
done

echo "== Gegenprobe vor der Veroeffentlichung"
bash scripts/verify.sh "$VERSION" || { echo "
Die Gegenprobe ist nicht sauber durchgelaufen. Es wird nichts veroeffentlicht."; exit 1; }

# Signaturdateien = alles, was signiert wurde, plus die Liste selbst
SIGS=("$DIR/SHA256SUMS.txt")
while IFS= read -r _f; do
  if [ -n "$_f" ]; then SIGS+=("$_f"); fi
done < <(ls -1 "$DIR"/*.minisig "$DIR"/*.mldsa 2>/dev/null | sort)

publish() {  # repo, tag, titel, dateien...
  local repo="$1" tag="$2" title="$3"; shift 3
  if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
    echo "   Release $tag existiert in $repo — Dateien werden ersetzt"
    gh release upload "$tag" "$@" --repo "$repo" --clobber
  else
    gh release create "$tag" "$@" --repo "$repo" --title "$title" \
       --notes "Siehe https://github.com/$PKGREPO fuer Quellstand und Pruefanleitung." \
       $LATEST
  fi
}

echo
echo "== 1/2  Paket -> $PKGREPO"
publish "$PKGREPO" "$TAG" "OmegaSeedphrase $VERSION" "$DIR/$ZIP"

echo
echo "== 2/2  Signaturen -> $SIGREPO"
printf '   %s\n' "${SIGS[@]}"
publish "$SIGREPO" "$TAG" "Signaturen $VERSION" "${SIGS[@]}"

echo "
Fertig. Kontrolle:

    gh release view $TAG --repo $PKGREPO --json assets --jq '[.assets[].name]'
    gh release view $TAG --repo $SIGREPO --json assets --jq '[.assets[].name]'
    ssh root@104.248.44.15 'systemctl start omega-update.service; journalctl -u omega-update.service -n 30 --no-pager'
"
