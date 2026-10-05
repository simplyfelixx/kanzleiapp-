"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "./Store";

const gebiete = ["Alle", "VR", "StR", "ArbR"] as const;
const gebietName: Record<string, string> = { Alle: "Alle", VR: "Verkehr", StR: "Straf", ArbR: "Arbeit" };

const hauptNav = [
  { href: "/", label: "Mein Tag", key: "F5" },
  { href: "/eingang", label: "Eingang", key: "F4" },
  { href: "/akten", label: "Akten" },
  { href: "/mail", label: "Mail" },
  { href: "/fristen", label: "Fristen", key: "F6" },
  { href: "/abrechnung", label: "Abrechnung" },
  { href: "/adressbuch", label: "Adressbuch" },
];
const mehrNav = [
  { href: "/akte/214%2F26", label: "Akte Müller (Beispiel)" },
  { href: "/phasen", label: "Phasen (Kanban)" },
  { href: "/vorlagen", label: "Vorlagen" },
  { href: "/portal-verwaltung", label: "Portal-Verwaltung" },
  { href: "/auswertungen", label: "Auswertungen" },
  { href: "/protokoll", label: "Protokoll" },
  { href: "/einstellungen", label: "Einstellungen" },
  { href: "/einrichtung", label: "Ersteinrichtung" },
  { href: "/benutzer", label: "Benutzer" },
];

export default function TopBar() {
  const path = usePathname();
  const router = useRouter();
  const { gebiete: gewaehlt, gebietUmschalten, toast } = useStore();
  const [mehr, setMehr] = useState(false);
  const [offenEingang, setOffenEingang] = useState(0);
  const [ich, setIch] = useState<{ name: string; kuerzel: string; rolle: string } | null>(null);
  useEffect(() => { if (path !== "/login" && path !== "/portal") fetch("/api/auth/ich").then((r) => (r.ok ? r.json() : null)).then(setIch).catch(() => {}); }, [path]);
  const abmelden = async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };
  // Zähler für den Eingang neu laden, wenn sich die Seite ändert oder etwas bestätigt wurde
  useEffect(() => { if (path === "/login" || path === "/portal") return; fetch("/api/eingang").then((r) => r.json()).then((d) => setOffenEingang(Array.isArray(d) ? d.length : 0)).catch(() => {}); }, [path, toast]);

  // F2 Suche (später), F3 Fallaufnahme, F4 Eingang, F5 Mein Tag
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F3") { e.preventDefault(); router.push("/fallaufnahme"); }
      if (e.key === "F4") { e.preventDefault(); router.push("/eingang"); }
      if (e.key === "F5") { e.preventDefault(); router.push("/"); }
      if (e.key === "F6") { e.preventDefault(); router.push("/fristen"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);
  useEffect(() => setMehr(false), [path]);

  if (path === "/login" || path === "/portal" || path.startsWith("/p/")) return null;

  // Mandantenportal und Ersteinrichtung haben keine Kanzlei-Leiste
  if (path.startsWith("/mandantenportal") || path.startsWith("/einrichtung")) {
    return (
      <div style={{ padding: "6px 12px", fontSize: 13.5, background: "#16191d", color: "#fff", display: "flex", gap: 12 }}>
        <span>Vorschau</span><Link href="/" style={{ color: "#c9d3ea" }}>← zurück zur Kanzlei-Ansicht</Link>
      </div>
    );
  }

  const aktiv = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <div className="top">
      <div className="brand">Kanzlei Nord</div>
      <div className="seg">
        {gebiete.map((g) => (
          <span key={g} className={(g === "Alle" ? gewaehlt.length === 0 : gewaehlt.includes(g)) ? "on" : ""}
            title={g === "Alle" ? "Alle Rechtsgebiete" : "Klick: hinzufügen/entfernen"} onClick={() => gebietUmschalten(g)}>{gebietName[g]}</span>
        ))}
      </div>
      <nav className="nav">
        {hauptNav.map((n) => (
          <Link key={n.href} href={n.href} className={aktiv(n.href) ? "on" : ""}>
            {n.label}
            {n.href === "/eingang" && offenEingang > 0 && <b> {offenEingang}</b>}
          </Link>
        ))}
        <span style={{ position: "relative", display: "flex" }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setMehr(!mehr); }} className={mehrNav.some((n) => aktiv(n.href)) ? "on" : ""}>Mehr ▾</a>
          {mehr && (
            <div style={{ position: "absolute", top: 30, left: 0, background: "#fff", border: "1px solid #c9ccd1", borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,.14)", padding: "4px 0", zIndex: 50, minWidth: 220 }}>
              {mehrNav.filter((n) => ich?.rolle === "admin" || !["/benutzer", "/einstellungen", "/einrichtung"].includes(n.href) && (ich?.rolle === "anwalt" || n.href !== "/protokoll")).map((n) => (
                <Link key={n.href} href={n.href} style={{ display: "block", padding: "7px 14px", textDecoration: "none", color: "#16191d", borderBottom: 0 }}>{n.label}</Link>
              ))}
            </div>
          )}
        </span>
      </nav>
      <div style={{ flex: 1 }} />
      <Link href="/fallaufnahme" style={{ fontSize: 13.5, textDecoration: "none", border: "1px dashed #b9bec4", borderRadius: 4, padding: "5px 10px", color: "#16191d" }}>+ Fallaufnahme <span className="k">F3</span></Link>
      <div className="search" style={{ width: 220 }}><span>Suchen …</span><span className="k">F2</span></div>
      <div className="avatar" title={ich ? `${ich.name} · ${ich.rolle} – klicken zum Abmelden` : ""} onClick={abmelden} style={{ cursor: "pointer" }}>{ich?.kuerzel ?? "…"}</div>
    </div>
  );
}
