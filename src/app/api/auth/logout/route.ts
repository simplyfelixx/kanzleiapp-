import { protokoll } from "@/lib/protokoll";
import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/sitzung";

export function POST() {
  protokoll({ kategorie: "anmeldung", aktion: "Abgemeldet" });
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
