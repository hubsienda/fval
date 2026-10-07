import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { archiveOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { id } = await context.params;
  try {
    await archiveOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FVAL archiveOrder:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se ha podido archivar el pedido." }, { status: 503 });
  }
}
