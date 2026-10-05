"use client";
import { useEffect } from "react";

/** ↑/↓ wechselt die Auswahl, Enter bestätigt – nur wenn kein Textfeld aktiv ist. */
export function useListKeys(count: number, index: number, setIndex: (i: number) => void, onEnter: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setIndex(Math.min(count - 1, index + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setIndex(Math.max(0, index - 1)); }
      if (e.key === "Enter") { e.preventDefault(); onEnter(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [count, index, setIndex, onEnter]);
}
