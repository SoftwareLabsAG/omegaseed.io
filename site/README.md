# OmegaSeedphrase — Produktionspaket

**Version 1.3.1 · 09.09.2026 · omegaseed.io**

Statische Website, kein Backend, keine Build-Kette. Ordner auf den Webserver legen, fertig.

```
index.html                              Tool + Startdialoge + Offline-Bereich (deutsch)
impressum.html                          § 5 ECG, § 14 UGB, §§ 24/25 MedienG
datenschutz.html                        DSGVO-Information
agb.html                                Nutzungsbedingungen
changelog.html                          Versionsverlauf
version.json                            maschinenlesbar: Version + Pruefsummen
en/index.html                           dasselbe Tool auf Englisch
en/legal-notice.html                    Impressum, englisch
en/privacy.html                         Datenschutzerklaerung, englisch
en/terms.html                           Nutzungsbedingungen, englisch
en/changelog.html                       Versionsverlauf, englisch
assets/style.css                        gesamtes Layout, hell und dunkel
assets/app.js                           Tool-Logik + Dialoge (deutsch)
assets/app.en.js                        Tool-Logik + Dialoge (englisch)
assets/bip39-en.js                      BIP39-Wortliste (2048 Woerter), gemeinsam
assets/fonts/poppins-{400,500,600,700}.woff2
assets/img/omega-wordmark.png, omega-icon.png
download/omegaseedphrase-offline.html     Einzeldatei Air-Gap, deutsch
download/omegaseedphrase-offline-en.html  Einzeldatei Air-Gap, englisch
SHA256SUMS.txt                          Pruefsummen aller Dateien
```

---

## Zwei Sprachen

Deutsch liegt im Wurzelverzeichnis, Englisch unter `/en/`. Der Umschalter im Seitenkopf fuehrt
immer auf die **entsprechende** Seite, nicht auf die Startseite: `datenschutz.html` wechselt nach
`en/privacy.html` und zurueck. Jede Seite traegt `hreflang`-Angaben fuer de, en und x-default;
x-default zeigt auf die deutsche Fassung.

**Rechtlich maßgeblich ist die deutsche Fassung.** Die Pflichtangaben nach § 5 ECG, § 14 UGB,
§§ 24/25 MedienG und Art 12 ff DSGVO werden durch die deutschen Seiten erfuellt. Auf jeder
englischen Rechtsseite steht ein Kasten, der das sagt und auf das deutsche Original verlinkt.
Wenn Sie eine der deutschen Rechtsseiten aendern, muss die englische mitgezogen werden —
sonst steht dort etwas anderes als im verbindlichen Text.

Die Stylesheets sind gemeinsam, die Programmdatei nicht: `app.js` und `app.en.js` unterscheiden
sich nur in den Textbausteinen. Beide entstehen aus derselben Quelle
(`dp01-light/index.html` bzw. `dp01-en/index.html`, erzeugt durch `translate_en.py`).

---

## Navigation

Es gibt **eine** Navigation, auf jeder Breite: eine flache Kopfleiste mit zentrierter Wortmarke und
links ein runder Knopf, der das Menue als Karte aufklappt — Aufbau wie auf `omdp39.io`. Die alte
Linkleiste im Kopf ist entfallen; Darstellung, Sprache und Version sind in die Karte gewandert.

Die Karte wird **zur Laufzeit** aus der Seite gebaut — Abschnitte aus der Kopfnavigation,
Rechtslinks aus dem Fuss. Deshalb gibt es genau eine Umsetzung fuer beide Sprachen, alle Seiten und
die Offline-Dateien; letztere haben keinen Fuss und zeigen darum nur die Abschnitte und keine
Sprachwahl. Der Code steht in `mobilenav.py` und landet beim Build in `assets/app.js`,
`assets/app.en.js`, in den Rechtsseiten und in beiden Offline-Dateien.

Eine bewusste Abweichung von der Vorlage: der Knopf sitzt **in** der Leiste, nicht frei darunter.
Frei schwebend liegt er beim Scrollen dauerhaft ueber dem Text — auf den Rechtsseiten mit langen
Absaetzen stoert das.

Drei Fallstricke, die hier absichtlich vermieden sind:

- **Kein `overflow-x:hidden` auf `html`/`body`.** Das macht das Wurzelelement zum Scrollcontainer,
  und die klebende Kopfleiste hoert auf zu kleben. Verwendet wird `overflow-x:clip` auf `body` —
  schneidet ab, ohne einen Scrollcontainer zu erzeugen.
- **Keine waagrecht scrollenden Tabellen** in den Rechtstexten. Vier Spalten sind auf 390 px
  unlesbar, und dass man wischen kann, sieht niemand. Jede Zeile wird stattdessen zur Karte; die
  Spaltenbezeichnung kommt aus `data-l` und ist damit in beiden Sprachen richtig.
- **Keine Kurzschreibweise fuer `.hero`-Polsterung.** `.hero` sitzt auf demselben Element wie
  `.wrap`; ein `padding: a b c` loescht dessen seitliche Polsterung. Genau daher stand der Hero
  bisher 24 px weiter links als jeder Abschnitt darunter.

---

## Helle und dunkle Darstellung

Ohne eigene Wahl richtet sich die Seite nach `prefers-color-scheme`, folgt also der
Systemeinstellung. Der Umschalter im Seitenkopf setzt sie fest und legt dafuer den Eintrag
`omegaseedphrase.theme` im lokalen Speicher ab — in der Datenschutzerklaerung unter Punkt 5
aufgefuehrt.

Getauscht werden nur Farbvariablen. **Die Platte bleibt in beiden Fassungen gleich:** helles Titan
mit dunklen Kanaelen, so wie das Bauteil aussieht. Eine invertierte Platte waere huebsch und
irrefuehrend zugleich.

---

## Bezeichnungen

- **OmegaSeedphrase** — das Hardware-Produkt aus Metall.
- **omegaseed.io** — diese Website, die produktbegleitende Informations- und Hilfsanwendung.
- **OMDP39** — ein technischer Standard. Referenz ist durchgehend `www.omdp39.io`; die dortige
  Spezifikation geht dieser Website im Zweifel vor.
- **BIP39** — offener Standard BIP-0039, die englische Wortliste wird unveraendert eingebunden.

Die Trennung ist in Impressum (Punkt 4 und 5), Nutzungsbedingungen (Punkt 1 und 8), im Hero und
im Seitenfuss durchgezogen. Die Nutzungsbedingungen regeln ausdruecklich **nur das Tool**, nicht
den Erwerb der Hardware.

---

## Angaben — vollstaendig

**Es sind keine Platzhalter enthalten.**

| Feld | Wert |
|---|---|
| Geschaeftsfuehrung | Alexander Loebner |
| E-Mail | dennis@cundw.io |
| Firmenbuch | FN 664113 m, Landesgericht Salzburg |
| UID | ATU82626106 |
| Kammer | WKOe, WK Salzburg, Sparte Handel |
| Gewerbebehoerde | Magistrat der Stadt Salzburg |
| OeNACE 2025 | 46.50-0 Grosshandel mit Geraeten der IKT (seit 09.10.2025) |
| Unternehmensgegenstand | Grosshandel mit Geraeten der Informations- und Kommunikationstechnik |
| Streitschlichtung | nimmt nicht teil |
| Datenschutzbeauftragter | nicht bestellt (Art 37 DSGVO nicht einschlaegig) |
| Hosting | DigitalOcean, Logfiles 14 Tage |
| Domain | GoDaddy |

Die **GISA-Zahl** ist bewusst nicht aufgefuehrt: § 5 ECG verlangt sie nicht. Pflicht sind
Kammerzugehoerigkeit, anwendbare gewerberechtliche Vorschriften samt Zugang und Aufsichtsbehoerde
— alle drei sind enthalten.

Ebenfalls bewusst weggelassen: die **Rechenzentrums-Region** in der Datenschutzerklaerung. Sie ist
rechtlich nicht gefordert; verlangt sind Empfaenger, Drittlandbezug und Garantien, und die stehen
vollstaendig unter Punkt 9.

---

## Schreibweisen R und Q

OMDP39 gibt an der 24. Alphabetstelle ein **R** aus, die Plaettchen tragen dort ein **Q**. Beide
bezeichnen den Wert 23. Das Tool nimmt beide an und bildet `R` fuer die Bestueckung auf `Q` ab;
angezeigt wird, wie viele Zeichen betroffen waren. Der 33-Woerter-Rechner gibt beide Schreibweisen
aus. Beim Ruecklesen gilt umgekehrt: ein `Q` auf der Platte ist im OMDP39-Werkzeug ein `R`.

Die Abbildung steckt in `assets/app.js` in einer Konstante:

```js
const ALIAS = {R:'Q'};   // OMDP39-Schreibweise -> Plaettchen
```

---

## Hosting bei DigitalOcean

**EU-Region waehlen** — Frankfurt (FRA1) oder Amsterdam (AMS3). Dann bleiben die Server-Logfiles
physisch im EWR.

**Uebermittlungsgrundlage** steht in Punkt 9 der Datenschutzerklaerung: DigitalOcean ist nach dem
EU-U.S. Data Privacy Framework zertifiziert und bezieht ergaenzend die Standardvertragsklauseln
ueber die DPA ein. Einmal jaehrlich pruefen, ob die Zertifizierung noch aktiv gelistet ist.

---

## Versionierung

Schema `HAUPT.NEBEN.KORREKTUR`:

- **HAUPT** — Umrechnung oder Zeichensatz aendern sich. Eine mit einer frueheren Hauptversion
  bestueckte Platte laesst sich dann nicht mehr identisch nachrechnen.
- **NEBEN** — neue Funktionen oder Inhalte, Rechenweg unveraendert.
- **KORREKTUR** — Fehlerbehebungen, Text und Darstellung.

Der Changelog auf der Website fuehrt nur veroeffentlichte Versionen.

Die Version steht an fuenf Stellen und wird beim Build ueberall gleichzeitig gesetzt:
Seitenkopf, Seitenfuss, Changelog, Offline-Datei und `version.json`. Der Dateiname des
Auslieferungspakets und der Name, unter dem die Offline-Datei gespeichert wird, tragen sie
ebenfalls.

---

## Serverkonfiguration

Die getestete nginx-Konfiguration liegt im Deploy-Paket unter `nginx/omegaseed.io.conf`.

```nginx
add_header Content-Security-Policy "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
add_header X-Content-Type-Options    "nosniff"     always;
add_header X-Frame-Options           "DENY"        always;
add_header Referrer-Policy           "no-referrer" always;
```

`unsafe-inline` ist bei script-src und style-src noetig: Die Seite verwendet Inline-Handler und
`style`-Attribute. Ohne diese Angabe bleiben Dialoge und Wizard funktionslos — gegen die echte
Seite getestet. Entscheidend bleibt scharf: `default-src 'none'` und `connect-src 'none'`
verhindern jede Netzwerkverbindung der Seite.

Logrotation auf **14 Tage** — die Datenschutzerklaerung nennt diese Frist verbindlich.

---

## Rechtlicher Vorbehalt

Die Texte sind nach oesterreichischem Recht aufgebaut und decken die Pflichtangaben ab. Sie
ersetzen **keine anwaltliche Pruefung**. Ein Rechtsanwalt sollte vor allem die
Haftungsbeschraenkung, die Aussage zur Nichterbringung konzessionspflichtiger
Finanzdienstleistungen (MiCAR) und die markenrechtliche Klarstellung freigeben.

Die EU-Plattform zur Online-Streitbeilegung wurde am 20.07.2025 abgeschaltet; ein Link darauf
waere heute irrefuehrend. Die Texte verweisen auf das oesterreichische AStG.

---

## Pruefen nach dem Deployment

- [ ] Logrotation auf 14 Tage konfiguriert
- [ ] Impressum, Datenschutz, AGB und Changelog ohne Umweg erreichbar
- [ ] Offline-Datei laedt, Pruefsumme stimmt mit `SHA256SUMS.txt` und `version.json`
- [ ] Ein Testcode mit `R` ergibt `Q` auf der Platte
- [ ] Entwicklerwerkzeuge, Reiter Netzwerk: beim Seitenaufruf keine Anfrage an eine fremde Domain
- [ ] `http://omegaseed.io` leitet mit 301 auf HTTPS um
- [ ] `curl -s https://omegaseed.io/version.json` zeigt die erwartete Version
