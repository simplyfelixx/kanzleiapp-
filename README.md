# Kanzlei-App – Prototyp

Klickbarer Prototyp der KI-Kanzleisoftware. **Mein Tag** und **Eingang** sind interaktiv, alle weiteren Seiten (Akte, Mail, Fristen, Abrechnung, Adressbuch, Vorlagen, Einstellungen, Mandantenportal …) sind als Ansichten eingebaut und über die Kopfleiste bzw. „Mehr“ erreichbar. **Akten werden jetzt gespeichert** (lokale SQLite-Datenbank `daten/kanzlei.db`, wird beim ersten Start mit Beispieldaten angelegt). Mein Tag, Eingang, Fristen/Wiedervorlagen und der Verlauf jeder Akte laufen über die Datenbank: Bestätigen wirkt direkt auf die Akte (Aktenkonto, Wiedervorlage, Phase, Verlauf). **PDF-Upload:** Dokumente in den Eingang (oder direkt in eine Akte) ziehen – Typ, Absender, Beträge, Fristen und passende Akte werden erkannt (regelbasiert), Dateiname nach Schema `JJJJ-MM-TT_Typ_Absender`. Dateien liegen in `daten/dokumente/`. **Schreiben:** In jeder Akte „✉ Schreiben erstellen“ – Vorlage wählen, Text wird aus der Akte befüllt (fehlende Angaben rot markiert), als PDF mit Briefkopf, Logo und Signatur erzeugt, in der Akte abgelegt, Wiedervorlage gesetzt. Vorlagen unter „Mehr → Vorlagen“, Briefkopf/Logo unter „Einstellungen“. Noch keine echte KI und kein Mailversand.

Zum Zurücksetzen auf die Beispieldaten einfach den Ordner `daten/` löschen.

## Starten

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
npm run dev
```

Dann im Browser öffnen: http://localhost:3000

Beim ersten Start wird der erste Admin angelegt. Weitere Konten unter „Mehr → Benutzer“.

## Als Programm (Windows)

```bash
npm run desktop               # baut die App, legt „Kanzlei“ im Startmenü und auf dem Desktop an
npm run desktop -- --autostart  # zusätzlich beim Windows-Start öffnen
npm run desktop:beenden       # Hintergrund-Server stoppen
```

Ein Klick auf „Kanzlei“ startet den Server unsichtbar im Hintergrund (falls er nicht schon läuft) und öffnet ein eigenes App-Fenster (Microsoft Edge im App-Modus, ohne Adressleiste). Server-Log: `daten/server.log`. Nach einem `git pull` erneut `npm run desktop` ausführen.

## Als echte Windows-Anwendung (.exe)

Auf dem Windows-PC im Projektordner:

```bash
npm install
npm run exe        # erzeugt dist/Kanzlei-Setup-<Version>.exe
```

Den Installer ausführen → „Kanzlei“ im Startmenü und auf dem Desktop. Die App startet ihren Server selbst (nur auf diesem PC erreichbar, freier Port) und beendet ihn beim Schließen – auch wenn sie hart beendet wird.

- **Daten** liegen außerhalb des Programms: `%APPDATA%\Kanzlei\daten` (Menü *Datei → Datenordner öffnen*). Updates und Deinstallation lassen sie unangetastet. Anderer Ort: Umgebungsvariable `KANZLEI_DATEN`.
- **Umzug von `npm run desktop`:** App schließen, den Inhalt des bisherigen Ordners `daten\` (inkl. der versteckten Datei `.geheim`, sonst sind gespeicherte Mail-Passwörter/Anmeldungen nicht mehr lesbar) nach `%APPDATA%\Kanzlei\daten` kopieren. Alternativ: Datensicherung zurückspielen und Mail-Passwort/Outlook-Anmeldung neu eintragen.
- Der Bau muss **unter Windows** laufen (plattformabhängige Module). Kein Compiler nötig.
- Der Bau prüft am Ende, dass keine Datenbank, Dokumente oder Schlüssel ins Paket gelangt sind, und bricht sonst ab.
- Der Installer ist nicht signiert: Windows SmartScreen zeigt beim ersten Start „Unbekannter Herausgeber“ → *Weitere Informationen → Trotzdem ausführen*.
- `npm run exe:ordner` baut nur den entpackten Ordner (`dist\win-unpacked\Kanzlei.exe`) zum Ausprobieren.

## Login und Rollen

- Rollen: **Admin** (Benutzer, Einstellungen, Einrichtung), **Anwalt**, **ReFa**.
- Passwörter mit scrypt gehasht, mindestens 10 Zeichen; nach 5 Fehlversuchen 5 Minuten Sperre.
- Sitzung als signiertes Cookie (httpOnly, SameSite=strict, 12 h). Schlüssel aus `AUTH_SECRET` oder `daten/.geheim`.
- `src/middleware.ts` schützt alle Seiten und APIs; der Verlauf trägt das Kürzel des angemeldeten Benutzers.
- Deaktivierte Benutzer und Rollenwechsel wirken spätestens nach 30 Sekunden.
- Bei `next start` ohne HTTPS (nur lokal) `AUTH_HTTP=1` setzen, sonst wird das Cookie nicht gesendet.

## Abrechnung (RVG)

- Kostennote je Akte: Gegenstandswert aus den Schadenpositionen des Aktenkontos, Geschäftsgebühr Nr. 2300 (Standard 1,3), optional Einigungsgebühr Nr. 1000, Pauschale Nr. 7002, 19 % USt.
- Gebührentabelle § 13 RVG: Fassung ab 01.06.2025 und Fassung 2021 (Aufträge bis 31.05.2025). Vorschlag nach Anlagedatum der Akte, umstellbar (`src/lib/rvg.ts`).
- **Nachliquidation:** Gibt es schon Kostennoten zur Akte, werden die angehakten mit ihrem Nettobetrag angerechnet (z. B. nach erhöhtem Gegenstandswert).
- PDF-Vorschau, beim Erstellen: PDF in der Akte, RA-Kosten im Aktenkonto, Rechnungsnummer JJJJ-NNN. Zahlung erfassen oder stornieren.

## Mail

- **Importieren:** Mails aus Outlook einfach in den Mailbereich ziehen (`.msg`) oder `.eml`-Dateien wählen. Doppelte Mails werden erkannt.
- **Abrufen:** per IMAP (Konto unter Einstellungen, Passwort verschlüsselt gespeichert) oder über Outlook/Microsoft 365 (siehe unten).
- Jeder Anhang (PDF, Bild) wird sofort ausgewertet und als Karte unter der Mail angezeigt: Typ, Absender, Beträge, Zeichen, Frist, Kurz-Zusammenfassung, passende Akte. Dazu „Öffnen“ und „In Akte ablegen“ (Name nach Schema).
- Mailtext wird nur als Text angezeigt (kein HTML, keine externen Inhalte).
- **Senden:** „Neue Mail“, „↩ Antworten“ oder in der Akte „@ Mail senden“. Empfänger aus den Beteiligten, Anhänge aus den Dokumenten der Akte, Signatur aus den Einstellungen. Gesendet wird nur nach Klick und Rückfrage (Strg+Enter). Die Mail steht danach in der Liste und im Verlauf der Akte. SMTP unter Einstellungen → Mailkonto (Port 587/465, „Verbindung testen“).

## Outlook / Microsoft 365 (Microsoft Graph)

Abrufen und Senden direkt über das Outlook-Konto. Anmeldung per Gerätecode, die App speichert kein Passwort, nur ein verschlüsseltes Anmelde-Token.

**Einmalig einrichten (Admin des Microsoft-365-Kontos):**
1. https://entra.microsoft.com → *Anwendungen → App-Registrierungen → Neue Registrierung*. Name z. B. „Kanzlei-App“, Kontotyp *Nur Konten in diesem Organisationsverzeichnis*. Keine Umleitungs-URI.
2. *Authentifizierung → Öffentliche Clientflows zulassen: Ja* → Speichern.
3. *API-Berechtigungen → Microsoft Graph → Delegiert*: `Mail.Read`, `Mail.Send`, `User.Read`, `offline_access` → *Administratorzustimmung erteilen*.
4. Aus der *Übersicht* die **Anwendungs-ID (Client-ID)** und die **Verzeichnis-ID (Mandant)** kopieren.

**In der App:** Einstellungen → Outlook / Microsoft 365 → IDs eintragen → Speichern → „Bei Microsoft anmelden“ → Code unter microsoft.com/devicelogin eingeben → „Outlook statt IMAP/SMTP verwenden“ anhaken.

- Abruf: neueste 25 Mails aus dem Posteingang, nur lesend (nichts wird als gelesen markiert). Schon vorhandene werden übersprungen.
- Senden: über das Konto, die Mail liegt danach auch in Outlook unter „Gesendete Elemente“. Anhänge zusammen bis 2,8 MB.
- Ist Outlook gewählt und die Anmeldung abgelaufen, kommt eine Fehlermeldung – es wird **nicht** still über IMAP/SMTP gesendet.

## Texterkennung (Scans)

Gescannte PDFs und Fotos haben keinen Text. Mit **Einstellungen → Texterkennung für Scans** werden sie mit einem lokalen Bildmodell gelesen (`ollama pull qwen2.5vl:7b`), bis 4 Seiten pro Dokument. Gilt für Eingang und Mail. Solche Werte sind mit „SCAN · OCR“ markiert und sollten besonders geprüft werden.

## Datensicherung

Unter **Einstellungen → Datensicherung**: Zielordner (anderes Laufwerk, NAS, USB), Passwort, Anzahl behalten. Täglich automatisch (Prüfung beim Start und stündlich) oder „Jetzt sichern“. Die `.kzb`-Datei enthält Datenbank und Dokumente, verschlüsselt mit AES-256-GCM (Schlüssel per scrypt aus dem Passwort). Wiederherstellen ersetzt alle Daten; vorher wird der aktuelle Stand gesichert.

## Protokoll

Unter „Mehr → Protokoll“ (Admin und Anwalt): Anmeldungen, geöffnete Akten und Dokumente, Bestätigungen, Fristen, KI-Nutzung, Benutzer- und Einstellungsänderungen.
- Die Einträge lassen sich nicht ändern oder löschen (Datenbank-Trigger). Jede Zeile ist per SHA-256 mit der vorherigen verkettet, die Seite prüft die Kette.
- Filter nach Zeitraum, Benutzer, Bereich, Akte und Freitext. CSV-Export.
- Inhalte (Texte, KI-Ein- und Ausgaben) werden nicht protokolliert, nur wer was wann getan hat.

## KI (lokal, Ollama)

1. [Ollama](https://ollama.com) installieren, dann `ollama pull qwen2.5:7b` (ab 16 GB RAM besser `qwen2.5:14b`).
2. In der App unter **Einstellungen → KI (lokal)** einschalten.

- Nur Adressen im lokalen Netz sind erlaubt, es gehen keine Daten ins Internet.
- Vor jeder Anfrage werden Namen, Telefon, E-Mail, IBAN, Kennzeichen und Adressen durch Platzhalter ersetzt (`src/lib/anonym.ts`) und danach wieder eingesetzt.
- **Fallaufnahme:** „Mit KI auswerten“ (Alt+K). KI-Werte haben einen Strich links, beim Überfahren erscheint die Belegstelle („woher?“).
- **Eingang:** Die KI bestimmt Typ, Absender und eine Kurz-Zusammenfassung. Beträge und Fristen bleiben regelbasiert.
- Ohne KI oder bei Fehlern läuft weiter die regelbasierte Erkennung.

## Bedienung

| Taste | Aktion |
|---|---|
| F5 | Mein Tag |
| F3 | Fallaufnahme (Freitext → neue Akte) |
| Strg+Enter | Akte aus Fallaufnahme anlegen |
| F4 | Eingang |
| F6 | Fristen & Wiedervorlagen |
| ↑ / ↓ | Vorgang / Dokument wählen |
| Enter | Bestätigen |

- Oben lässt sich das Rechtsgebiet umschalten.
- Im Eingang können mehrere Dokumente ausgewählt und gesammelt bestätigt werden. Unklare Dokumente brauchen erst eine Akte.
- „?“ zeigt die Quelle eines Werts.

## Aufbau

- `src/lib/db.ts` – Datenbank (Akten, Beteiligte, Aktenkonto, Falldaten)
- `src/app/api/akten/` – Schnittstelle zum Lesen und Speichern
- `src/app/akten`, `src/app/akte/[id]` – Aktenliste und Akte (bearbeitbar)
- `src/lib/dokerkennung.ts` – Dokumenterkennung (Typ, Beträge, Zuordnung)
- `src/app/api/upload`, `src/app/api/dokumente` – Upload und Dateiablage
- `src/lib/data.ts` – Beispieldaten und Typen
- `src/app/page.tsx` – Mein Tag
- `src/app/eingang/page.tsx` – Eingang
- `src/app/*/page.tsx` – alle weiteren Seiten
- `src/designs/` – aus den Entwürfen übernommene Ansichten (werden nach und nach durch echte Logik ersetzt)
- `src/components/` – Kopfleiste, Zustand, Tastatur
