"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "./Store";
import { eingang } from "@/lib/data";

const gebiete = ["Alle", "VR", "StR", "ArbR"] as const;
const gebietName: Record<string, string> = { Alle: "Alle", VR: "Verkehr", StR: "Straf", ArbR: "Arbeit" };

export default function TopBar() {
  const path = usePathname();
  const router = useRouter();
  const { gebiet, setGebiet, erledigt } = useStore();
  const offenEingang = eingang.filter((e) => !erledigt.has(e.id)).length;

  // F-Tasten: F4 Eingang, F5 Mein Tag
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F4") { e.preventDefault(); router.push("/eingang"); }
      if (e.key === "F5") { e.preventDefault(); router.push("/"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  return (
    <div className="top">
      <div className="brand">Kanzlei Nord</div>
      <div className="seg">
        {gebiete.map((g) => (
          <span key={g} className={gebiet === g ? "on" : ""} onClick={() => setGebiet(g)}>{gebietName[g]}</span>
        ))}
      </div>
      <nav className="nav">
        <Link href="/" className={path === "/" ? "on" : ""}>Mein Tag <span className="k">F5</span></Link>
        <Link href="/eingang" className={path === "/eingang" ? "on" : ""}>Eingang {offenEingang > 0 && <b>{offenEingang}</b>} <span className="k">F4</span></Link>
      </nav>
      <div style={{ flex: 1 }} />
      <div className="search"><span>Suchen oder Befehl …</span><span className="k">F2</span></div>
      <div className="avatar">FK</div>
    </div>
  );
}
