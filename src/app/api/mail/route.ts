import { NextResponse } from "next/server";
import { mailListe } from "@/lib/mail";

export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(mailListe()); }
