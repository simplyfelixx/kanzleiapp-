import { NextResponse } from "next/server";
import { COOKIE } from "@/lib/sitzung";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
