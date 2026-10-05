# Kanzlei-App – Prototyp

Klickbarer Prototyp der KI-Kanzleisoftware. **Mein Tag** und **Eingang** sind interaktiv, alle weiteren Seiten (Akte, Mail, Fristen, Abrechnung, Adressbuch, Vorlagen, Einstellungen, Mandantenportal …) sind als Ansichten eingebaut und über die Kopfleiste bzw. „Mehr“ erreichbar. **Akten werden jetzt gespeichert** (lokale SQLite-Datenbank `daten/kanzlei.db`, wird beim ersten Start mit Beispieldaten angelegt). Noch keine echte KI und kein Mailversand.

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
| F3 | Fallaufnahme |
| F4 | Eingang |
| ↑ / ↓ | Vorgang / Dokument wählen |
| Enter | Bestätigen |

- Oben lässt sich das Rechtsgebiet umschalten.
- Im Eingang können mehrere Dokumente ausgewählt und gesammelt bestätigt werden. Unklare Dokumente brauchen erst eine Akte.
- „?“ zeigt die Quelle eines Werts.

## Aufbau

- `src/lib/db.ts` – Datenbank (Akten, Beteiligte, Aktenkonto, Falldaten)
- `src/app/api/akten/` – Schnittstelle zum Lesen und Speichern
- `src/app/akten`, `src/app/akte/[id]` – Aktenliste und Akte (bearbeitbar)
- `src/lib/data.ts` – Beispieldaten und Typen
- `src/app/page.tsx` – Mein Tag
- `src/app/eingang/page.tsx` – Eingang
- `src/app/*/page.tsx` – alle weiteren Seiten
- `src/designs/` – aus den Entwürfen übernommene Ansichten (werden nach und nach durch echte Logik ersetzt)
- `src/components/` – Kopfleiste, Zustand, Tastatur
