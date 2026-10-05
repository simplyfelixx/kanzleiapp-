import { NextResponse } from "next/server";
import { kiLaden, kiStatus } from "@/lib/ki";

export const dynamic = "force-dynamic";

export async function GET() {
  const e = kiLaden();
  return NextResponse.json({ aktiv: e.aktiv, modell: e.modell, ...(await kiStatus(e)) });
}
