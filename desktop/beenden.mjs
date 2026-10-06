// Beendet den Hintergrund-Server der Kanzlei-App (Port 3000).
import { execSync } from "child_process";
const PORT = process.env.KANZLEI_PORT || "3000";
try {
  if (process.platform === "win32") {
    const zeilen = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${PORT}`, { encoding: "utf8" });
    const pids = new Set(zeilen.split(/\r?\n/).map((z) => z.trim().split(/\s+/).pop()).filter((x) => x && /^\d+$/.test(x) && x !== "0"));
    for (const pid of pids) execSync(`taskkill /PID ${pid} /T /F`);
    console.log(pids.size ? "Kanzlei-Server beendet" : "Server lief nicht");
  } else {
    execSync(`fuser -k ${PORT}/tcp || true`);
  }
} catch { console.log("Server lief nicht"); }
