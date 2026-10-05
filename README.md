# Kanzlei-App – Prototyp

Klickbarer Prototyp der KI-Kanzleisoftware: **Mein Tag** und **Eingang**. Nur Beispieldaten, keine echte KI, Mail oder Speicherung.

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
| F4 | Eingang |
| ↑ / ↓ | Vorgang / Dokument wählen |
| Enter | Bestätigen |

- Oben lässt sich das Rechtsgebiet umschalten.
- Im Eingang können mehrere Dokumente ausgewählt und gesammelt bestätigt werden. Unklare Dokumente brauchen erst eine Akte.
- „?“ zeigt die Quelle eines Werts.

## Aufbau

- `src/lib/data.ts` – Beispieldaten und Typen
- `src/app/page.tsx` – Mein Tag
- `src/app/eingang/page.tsx` – Eingang
- `src/app/akte/[id]/page.tsx` – einfache Aktenansicht
- `src/components/` – Kopfleiste, Zustand, Tastatur
