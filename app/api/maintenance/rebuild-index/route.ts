import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { rebuildOrderIndex } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const location = body?.location;

    if (location === "active") {
      const active = await rebuildOrderIndex("active");
      return NextResponse.json({ ok: true, active: active.length });
    }

    if (location === "archived") {
      const archived = await rebuildOrderIndex("archived");
      return NextResponse.json({ ok: true, archived: archived.length });
    }

    const [active, archived] = await Promise.all([
      rebuildOrderIndex("active"),
      rebuildOrderIndex("archived")
    ]);
    return NextResponse.json({ ok: true, active: active.length, archived: archived.length });
  } catch (error) {
    console.error("FVAL rebuildOrderIndex:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se ha podido reconstruir el índice de pedidos." }, { status: 503 });
  }
}
