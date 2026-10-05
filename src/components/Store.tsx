"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Gebiet } from "@/lib/data";

interface StoreState {
  erledigt: Set<string>; // Vorgänge und Eingangsdokumente, die bestätigt wurden
  erledigen: (ids: string[]) => void;
  /** gewählte Rechtsgebiete; leer = alle */
  gebiete: Gebiet[];
  /** Klick auf ein Gebiet schaltet es an/aus, „Alle“ setzt zurück */
  gebietUmschalten: (g: Gebiet | "Alle") => void;
  /** liegt dieses Gebiet in der aktuellen Auswahl? */
  imGebiet: (g: string) => boolean;
  toast: string | null;
  zeige: (msg: string) => void;
}

const Ctx = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const [gebiete, setGebiete] = useState<Gebiet[]>([]);
  // Auswahl merken (nur Komfort, pro Browser)
  useEffect(() => { try { const g = JSON.parse(localStorage.getItem("gebiete") ?? "[]"); if (Array.isArray(g)) setGebiete(g); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("gebiete", JSON.stringify(gebiete)); } catch {} }, [gebiete]);
  const gebietUmschalten = (g: Gebiet | "Alle") =>
    setGebiete((alt) => g === "Alle" ? [] : alt.includes(g) ? alt.filter((x) => x !== g) : [...alt, g]);
  const imGebiet = (g: string) => gebiete.length === 0 || gebiete.includes(g as Gebiet);
  const [toast, setToast] = useState<string | null>(null);
  const zeige = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  const erledigen = (ids: string[]) =>
    setErledigt((s) => new Set([...Array.from(s), ...ids]));
  return (
    <Ctx.Provider value={{ erledigt, erledigen, gebiete, gebietUmschalten, imGebiet, toast, zeige }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider fehlt");
  return c;
}
