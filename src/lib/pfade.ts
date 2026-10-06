// Ort der Daten (Datenbank, Dokumente, Logs). Standard: Ordner „daten“ im Programmordner.
// Die Windows-Anwendung (.exe) setzt KANZLEI_DATEN auf einen Ordner außerhalb des Programms,
// damit Updates und Neuinstallationen die Daten nicht berühren.
import path from "path";
export const DATEN = process.env.KANZLEI_DATEN ? path.resolve(process.env.KANZLEI_DATEN) : path.join(process.cwd(), "daten");
