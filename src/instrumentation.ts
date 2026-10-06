// Läuft einmal beim Start des Servers: automatische Datensicherung einplanen.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { automatikStarten } = await import("./lib/sicherung");
    automatikStarten();
  }
}
