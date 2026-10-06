"use client";
import { useEffect, useState } from "react";
import PortalView from "@/components/PortalView";
import type { PortalAnsicht } from "@/lib/portal";

export default function Portal() {
  const [a, setA] = useState<PortalAnsicht | null>(null);
  const [fehler, setFehler] = useState("");
  useEffect(() => {
    fetch("/api/portal/stand").then(async (r) => { const j = await r.json(); if (r.ok) setA(j); else setFehler(j.fehler); }).catch(() => setFehler("Keine Verbindung"));
  }, []);
  if (fehler) return (
    <div style={{ maxWidth: 420, margin: "15vh auto", padding: 16, textAlign: "center", fontSize: 16 }}>
      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Link nicht gültig</div>
      <div style={{ color: "#6b7178" }}>Der Link ist abgelaufen oder wurde ersetzt. Bitte fragen Sie in der Kanzlei nach einem neuen Link.</div>
    </div>
  );
  if (!a) return <div className="empty">Lade …</div>;
  return (
    <div style={{ background: "#f5f6f8", minHeight: "100vh", overflow: "auto" }}>
      <PortalView a={a} />
      <div style={{ textAlign: "center", paddingBottom: 24 }}>
        <a href="#" style={{ fontSize: 13.5, color: "#6b7178" }} onClick={async (e) => { e.preventDefault(); await fetch("/api/portal/abmelden", { method: "POST" }); setFehler("Abgemeldet"); }}>Abmelden</a>
      </div>
    </div>
  );
}
