import { NextResponse } from "next/server";

export function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ name: "kz_portal", value: "", path: "/", maxAge: 0 });
  return res;
}
