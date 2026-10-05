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
