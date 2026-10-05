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

## Login und Rollen

- Rollen: **Admin** (Benutzer, Einstellungen, Einrichtung), **Anwalt**, **ReFa**.
- Passwörter mit scrypt gehasht, mindestens 10 Zeichen; nach 5 Fehlversuchen 5 Minuten Sperre.
- Sitzung als signiertes Cookie (httpOnly, SameSite=strict, 12 h). Schlüssel aus `AUTH_SECRET` oder `daten/.geheim`.
- `src/middleware.ts` schützt alle Seiten und APIs; der Verlauf trägt das Kürzel des angemeldeten Benutzers.
- Deaktivierte Benutzer und Rollenwechsel wirken spätestens nach 30 Sekunden.
- Bei `next start` ohne HTTPS (nur lokal) `AUTH_HTTP=1` setzen, sonst wird das Cookie nicht gesendet.

## Abrechnung (RVG)

- Kostennote je Akte: Gegenstandswert aus den Schadenpositionen des Aktenkontos, Geschäftsgebühr Nr. 2300 (Standard 1,3), optional Einigungsgebühr Nr. 1000, Pauschale Nr. 7002, 19 % USt.
- Gebührentabelle § 13 RVG in der Fassung ab 01.06.2025 (`src/lib/rvg.ts`).
- PDF-Vorschau, beim Erstellen: PDF in der Akte, RA-Kosten im Aktenkonto, Rechnungsnummer JJJJ-NNN. Zahlung erfassen oder stornieren.

## Mail

- **Importieren:** Mails aus Outlook einfach in den Mailbereich ziehen (`.msg`) oder `.eml`-Dateien wählen. Doppelte Mails werden erkannt.
- **Abrufen:** per IMAP (Konto unter Einstellungen, Passwort verschlüsselt gespeichert). Outlook/Microsoft 365 folgt über Microsoft Graph.
- Jeder Anhang (PDF, Bild) wird sofort ausgewertet und als Karte unter der Mail angezeigt: Typ, Absender, Beträge, Zeichen, Frist, Kurz-Zusammenfassung, passende Akte. Dazu „Öffnen“ und „In Akte ablegen“ (Name nach Schema).
- Mailtext wird nur als Text angezeigt (kein HTML, keine externen Inhalte).

## Texterkennung (Scans)

Gescannte PDFs und Fotos haben keinen Text. Mit **Einstellungen → Texterkennung für Scans** werden sie mit einem lokalen Bildmodell gelesen (`ollama pull qwen2.5vl:7b`), bis 4 Seiten pro Dokument. Gilt für Eingang und Mail. Solche Werte sind mit „SCAN · OCR“ markiert und sollten besonders geprüft werden.

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
