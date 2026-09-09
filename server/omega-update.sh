#!/usr/bin/env bash
# =============================================================================
#  omega-update.sh — holt eine neue Version und schaltet sie live, aber nur
#  wenn BEIDE Signaturen gegen die fest hinterlegten Schluessel passen.
#
#  Zwei getrennte Quellen:
#
#    Signaturen   Omega-Secure/omegaseed-release
#                 Pruefsummenliste und beide Signaturen. Diese Seite sagt
#                 auch, welche Version die neueste ist - die Ankuendigung
#                 kommt damit von der vertrauensrelevanten Stelle.
#
#    Paket        SoftwareLabsAG/omegaseed.io
#                 nur das Auslieferungspaket, unter demselben Tag.
#
#  Der Server vertraut keiner der beiden. GitHub ist nur Transportweg; die
#  Entscheidung faellt hier, gegen Schluessel, die lokal liegen und die kein
#  Angreifer mit GitHub-Zugang austauschen kann.
#
#      omega-update.sh              regulaerer Lauf (per Timer)
#      omega-update.sh --dry-run    alles pruefen, nichts umschalten
#      omega-update.sh --source DIR statt GitHub ein lokales Verzeichnis
# =============================================================================
set -euo pipefail

SIGREPO="${OMEGA_SIGREPO:-Omega-Secure/omegaseed-release}"
PKGREPO="${OMEGA_PKGREPO:-SoftwareLabsAG/omegaseed.io}"
KEYDIR="${OMEGA_KEYDIR:-/etc/omega-secure}"
WEBROOT="${OMEGA_WEBROOT:-/var/www/omegaseed.io}"
WORK="${OMEGA_WORK:-/var/lib/omega-update}"
PYTHON="${OMEGA_PYTHON:-/opt/omega-secure/venv/bin/python}"
MLDSA_VERIFY="${OMEGA_MLDSA_VERIFY:-/opt/omega-secure/mldsa-verify.py}"

DRY=0; SOURCE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --source)  SOURCE="${2:?--source braucht ein Verzeichnis}"; shift 2 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done

log()  { printf '%s  %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() { log "ABBRUCH: $*"; exit 1; }

# ---- Voraussetzungen --------------------------------------------------------
command -v minisign >/dev/null || fail "minisign fehlt (apt install minisign)"
command -v unzip    >/dev/null || fail "unzip fehlt"
command -v rsync    >/dev/null || fail "rsync fehlt"
[[ -f "$KEYDIR/omegaseed.pub"       ]] || fail "$KEYDIR/omegaseed.pub fehlt"
[[ -f "$KEYDIR/omegaseed-mldsa.pub" ]] || fail "$KEYDIR/omegaseed-mldsa.pub fehlt"
[[ -x "$PYTHON"                     ]] || fail "$PYTHON fehlt (siehe INSTALL.md)"
[[ -f "$MLDSA_VERIFY"               ]] || fail "$MLDSA_VERIFY fehlt"

mkdir -p "$WORK"
TMP="$(mktemp -d "$WORK/run.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# ---- 1. Welche Version ist installiert? ------------------------------------
INSTALLED="0.0.0"
if [[ -f "$WEBROOT/version.json" ]]; then
  INSTALLED="$("$PYTHON" -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' \
               "$WEBROOT/version.json" 2>/dev/null || echo "0.0.0")"
fi

# ---- 2. Welche Version kuendigt die Signaturseite an? ----------------------
if [[ -n "$SOURCE" ]]; then
  TAG="$(cat "$SOURCE/TAG")"
  cp "$SOURCE"/* "$TMP"/ 2>/dev/null || true
else
  command -v curl >/dev/null || fail "curl fehlt"
  META="$TMP/release.json"
  curl -fsSL --max-time 60 \
       -H "Accept: application/vnd.github+json" \
       "https://api.github.com/repos/$SIGREPO/releases/latest" -o "$META" \
    || fail "Signaturquelle nicht erreichbar ($SIGREPO)"
  TAG="$("$PYTHON" -c 'import json,sys;print(json.load(open(sys.argv[1]))["tag_name"])' "$META")"
fi

VERSION="${TAG#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail "unplausibler Tag: $TAG"

# ---- 3. Ist das ueberhaupt neuer? ------------------------------------------
newer() { [[ "$1" != "$2" ]] && [[ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -1)" == "$1" ]]; }
if ! newer "$VERSION" "$INSTALLED"; then
  log "nichts zu tun (installiert $INSTALLED, angeboten $VERSION)"
  exit 0
fi
log "neue Version angeboten: $VERSION (installiert: $INSTALLED)"

# ---- 4. Herunterladen — Signaturen und Paket aus getrennten Quellen --------
ZIP="omegaseedphrase-deploy-v${VERSION}.zip"
SIGFILES=("SHA256SUMS.txt" "SHA256SUMS.txt.minisig" "SHA256SUMS.txt.mldsa")
if [[ -z "$SOURCE" ]]; then
  SIGBASE="https://github.com/$SIGREPO/releases/download/$TAG"
  for f in "${SIGFILES[@]}"; do
    curl -fsSL --max-time 300 "$SIGBASE/$f" -o "$TMP/$f" \
      || fail "Signaturdatei nicht ladbar: $f  ($SIGREPO $TAG)"
  done
  log "Signaturen geladen von $SIGREPO $TAG"

  PKGBASE="https://github.com/$PKGREPO/releases/download/$TAG"
  curl -fsSL --max-time 300 "$PKGBASE/$ZIP" -o "$TMP/$ZIP" \
    || fail "Paket nicht ladbar: $ZIP  ($PKGREPO $TAG). Wurde das Paket-Release
        zu diesem Tag schon veroeffentlicht? Es muss VOR den Signaturen stehen."
  log "Paket geladen von $PKGREPO $TAG"
fi
for f in "${SIGFILES[@]}" "$ZIP"; do
  [[ -s "$TMP/$f" ]] || fail "Datei fehlt oder leer: $f"
done

# ---- 5. Signaturen pruefen — beide, gegen lokale Schluessel ----------------
minisign -Vqm "$TMP/SHA256SUMS.txt" -p "$KEYDIR/omegaseed.pub" >/dev/null \
  || fail "Ed25519-Signatur ungueltig"
log "Ed25519-Signatur gueltig"

"$PYTHON" "$MLDSA_VERIFY" "$KEYDIR/omegaseed-mldsa.pub" \
          "$TMP/SHA256SUMS.txt" "$TMP/SHA256SUMS.txt.mldsa" \
  || fail "ML-DSA-Signatur ungueltig"
log "ML-DSA-65-Signatur gueltig"

# ---- 6. Pruefsumme des Pakets gegen die signierte Liste --------------------
( cd "$TMP" && grep -F "  $ZIP" SHA256SUMS.txt | sha256sum -c --status - ) \
  || fail "Pruefsumme des Pakets passt nicht zur signierten Liste"
log "Paketpruefsumme stimmt"

# ---- 7. Auspacken und pruefen, was drin ist --------------------------------
unzip -qq "$TMP/$ZIP" -d "$TMP/x" || fail "Paket nicht entpackbar"
SITE="$TMP/x/omegaseedphrase-deploy/omegaseedphrase-web"
[[ -f "$SITE/index.html"   ]] || fail "index.html fehlt im Paket"
[[ -f "$SITE/version.json" ]] || fail "version.json fehlt im Paket"
INNER="$("$PYTHON" -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$SITE/version.json")"
[[ "$INNER" == "$VERSION" ]] || fail "Paket sagt Version $INNER, Release sagt $VERSION"
( cd "$SITE" && grep -Ev '^[[:space:]]*(#|$)' SHA256SUMS.txt \
    | sha256sum -c --quiet - ) || fail "Dateien im Paket weichen ab"
log "Paketinhalt geprueft (Version $INNER)"

if [[ $DRY -eq 1 ]]; then
  log "--dry-run: alles in Ordnung, nichts umgeschaltet"
  exit 0
fi

# ---- 8. Umschalten ----------------------------------------------------------
rsync -a --delete --exclude 'omegaseed*.pub' --exclude '*.minisig' --exclude '*.mldsa' \
      "$SITE"/ "$WEBROOT"/ || fail "Uebernahme fehlgeschlagen"
chown -R deploy:www-data "$WEBROOT" 2>/dev/null || true
log "Version $VERSION ist live"
