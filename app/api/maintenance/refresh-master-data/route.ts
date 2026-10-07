import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  revalidateTag("fval-master-data");
  return NextResponse.json({ ok: true });
}
