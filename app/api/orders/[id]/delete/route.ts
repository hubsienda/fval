import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteArchivedOrder } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { id } = await context.params;
  try {
    await deleteArchivedOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("FVAL deleteArchivedOrder:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se ha podido eliminar definitivamente el pedido." }, { status: 503 });
  }
}
