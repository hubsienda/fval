import { NextResponse } from "next/server";
import { setSessionCookie, validPassphrase } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase : "";
    if (!validPassphrase(passphrase)) {
      return NextResponse.json({ error: "Clave de acceso incorrecta." }, { status: 401 });
    }
    await setSessionCookie();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
