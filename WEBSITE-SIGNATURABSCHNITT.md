# Vorlage: Abschnitt „Signatur prüfen" für den Offline-Bereich

Fertig ausformuliert, deutsch und englisch. Kommt in `build_site.py`
(`DOWNLOAD_SECTION`) beziehungsweise `site_en.py` (`DOWNLOAD_SECTION`),
jeweils **nach** dem `</div>` des `grid2`, noch innerhalb von `.wrap`.

Danach: Version auf 1.3.0 heben, Changelog-Einträge ergänzen, bauen,
netzgetrennt signieren, Release anlegen. Der Server holt sich den Rest.

---

## Deutsch

```html
<div class="card" style="margin-top:22px">
  <h3><span class="num">3</span> Signatur prüfen</h3>
  <p class="small mut">Die Prüfsumme oben steht auf derselben Seite wie die Datei
    darüber. Wer diesen Server übernimmt, ändert beides — der Vergleich geht
    dann trotzdem auf. Deshalb ist jede Auslieferung zusätzlich signiert, mit
    Schlüsseln, die <b>nicht auf diesem Server erzeugt werden</b>.</p>

  <p class="small mut" style="margin-bottom:6px">Zwei Verfahren über dieselben Dateien:</p>
  <ul class="small mut" style="padding-left:18px;margin-top:0">
    <li><b>Ed25519</b> — <span class="mono">.minisig</span>, prüfbar mit
      <a href="https://jedisct1.github.io/minisign/" target="_blank" rel="noopener noreferrer">minisign</a></li>
    <li><b>ML-DSA-65</b> (FIPS 204, post-quantum) — <span class="mono">.mldsa</span>,
      prüfbar mit OpenSSL 3.5 oder neuer</li>
  </ul>
  <p class="small mut">Ed25519 ist heute schnell und breit prüfbar. ML-DSA trägt
    auch dann noch, wenn Ed25519 einem Quantenrechner nicht mehr standhält — und
    ein Seedphrase-Backup soll Jahrzehnte halten. Eine Fälschung müsste gegen
    beide bestehen.</p>

  <div class="row" style="margin:14px 0">
    <a class="btn primary" href="https://github.com/SoftwareLabsAG/omegaseed.io/releases"
       target="_blank" rel="noopener noreferrer">Releases und Signaturen</a>
    <a class="btn" href="https://github.com/Omega-Secure/omegaseed-release"
       target="_blank" rel="noopener noreferrer">Öffentliche Schlüssel</a>
    <a class="btn" href="omegaseed.pub">omegaseed.pub</a>
    <a class="btn" href="omegaseed-mldsa.pub">omegaseed-mldsa.pub</a>
  </div>

  <div class="chainBox">minisign -Vm SHA256SUMS.txt -p omegaseed.pub
openssl pkeyutl -verify -rawin -in SHA256SUMS.txt \
    -pubin -inkey omegaseed-mldsa.pub -sigfile SHA256SUMS.txt.mldsa
sha256sum -c SHA256SUMS.txt</div>

  <div class="note warn" style="margin-top:14px">
    <b>Hol dir den Schlüssel aus zwei Quellen und vergleiche sie.</b> Einmal von
    dieser Website, einmal aus dem Schlüssel-Repository. Ein Schlüssel, der nur
    dort liegt, wo auch die Datei liegt, sichert nichts ab — das ist genau der
    Grund, weshalb beides getrennt veröffentlicht wird.
  </div>
</div>
```

## Englisch

```html
<div class="card" style="margin-top:22px">
  <h3><span class="num">3</span> Verify the signature</h3>
  <p class="small mut">The checksum above sits on the same page as the file above
    it. Whoever takes over this server changes both — and the comparison still
    passes. That is why every release is additionally signed, with keys that are
    <b>not created on this server</b>.</p>

  <p class="small mut" style="margin-bottom:6px">Two schemes over the same files:</p>
  <ul class="small mut" style="padding-left:18px;margin-top:0">
    <li><b>Ed25519</b> — <span class="mono">.minisig</span>, verifiable with
      <a href="https://jedisct1.github.io/minisign/" target="_blank" rel="noopener noreferrer">minisign</a></li>
    <li><b>ML-DSA-65</b> (FIPS 204, post-quantum) — <span class="mono">.mldsa</span>,
      verifiable with OpenSSL 3.5 or newer</li>
  </ul>
  <p class="small mut">Ed25519 is fast and widely verifiable today. ML-DSA still
    holds once Ed25519 no longer withstands a quantum computer — and a seed
    phrase backup is meant to last decades. A forgery would have to pass both.</p>

  <div class="row" style="margin:14px 0">
    <a class="btn primary" href="https://github.com/SoftwareLabsAG/omegaseed.io/releases"
       target="_blank" rel="noopener noreferrer">Releases and signatures</a>
    <a class="btn" href="https://github.com/Omega-Secure/omegaseed-release"
       target="_blank" rel="noopener noreferrer">Public keys</a>
    <a class="btn" href="../omegaseed.pub">omegaseed.pub</a>
    <a class="btn" href="../omegaseed-mldsa.pub">omegaseed-mldsa.pub</a>
  </div>

  <div class="chainBox">minisign -Vm SHA256SUMS.txt -p omegaseed.pub
openssl pkeyutl -verify -rawin -in SHA256SUMS.txt \
    -pubin -inkey omegaseed-mldsa.pub -sigfile SHA256SUMS.txt.mldsa
sha256sum -c SHA256SUMS.txt</div>

  <div class="note warn" style="margin-top:14px">
    <b>Get the key from two sources and compare them.</b> Once from this website,
    once from the key repository. A key that only sits where the file sits
    secures nothing — which is exactly why the two are published separately.
  </div>
</div>
```

---

## Changelog-Eintrag 1.3.0

**Deutsch** — „Signaturen auf der Website erklärt."

- Neuer Abschnitt im Offline-Bereich: wie sich eine heruntergeladene Datei
  gegen die veröffentlichten Signaturen prüfen lässt, mit Verweis auf die
  Releases und auf das getrennte Schlüssel-Repository.
- Beide öffentlichen Schlüssel werden direkt von der Website ausgeliefert
  (`omegaseed.pub`, `omegaseed-mldsa.pub`), damit sie aus zwei unabhängigen
  Quellen verglichen werden können.
- Klargestellt, dass eine Prüfsumme auf derselben Seite wie die Datei nichts
  beweist — erst die Signatur gegen einen andernorts veröffentlichten Schlüssel.

**Englisch** — „Signatures explained on the website."

- New section in the offline area: how to check a downloaded file against the
  published signatures, linking to the releases and to the separate key
  repository.
- Both public keys are served directly from the website so they can be compared
  from two independent sources.
- Clarified that a checksum on the same page as the file proves nothing — only a
  signature against a key published elsewhere does.

---

## Was beim Einbau zu beachten ist

- Die Schlüsselpfade unterscheiden sich: deutsch `omegaseed.pub`, englisch
  `../omegaseed.pub` (die englischen Seiten liegen unter `/en/`).
- Die Schlüsseldateien müssen im Webroot liegen und dürfen beim Umschalten
  nicht gelöscht werden — `omega-update.sh` nimmt sie bereits per
  `--exclude 'omegaseed*.pub'` aus.
- `nginx` liefert `.pub`, `.minisig` und `.mldsa` seit v1.2.0 als `text/plain`
  aus; die Regel steht in der Serverkonfiguration.
- Die `chainBox` bricht auf schmalen Geräten um, die Befehle bleiben lesbar.
