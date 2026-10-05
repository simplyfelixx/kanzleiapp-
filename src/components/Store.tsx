"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { Gebiet } from "@/lib/data";

interface StoreState {
  erledigt: Set<string>; // Vorgänge und Eingangsdokumente, die bestätigt wurden
  erledigen: (ids: string[]) => void;
  gebiet: Gebiet | "Alle";
  setGebiet: (g: Gebiet | "Alle") => void;
  toast: string | null;
  zeige: (msg: string) => void;
}

const Ctx = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const [gebiet, setGebiet] = useState<Gebiet | "Alle">("Alle");
  const [toast, setToast] = useState<string | null>(null);
  const zeige = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };
  const erledigen = (ids: string[]) =>
    setErledigt((s) => new Set([...Array.from(s), ...ids]));
  return (
    <Ctx.Provider value={{ erledigt, erledigen, gebiet, setGebiet, toast, zeige }}>
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
