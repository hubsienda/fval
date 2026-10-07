import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getOrder, updateInternalNote, updateOrder } from "@/lib/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { id } = await context.params;
  try {
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error) {
    console.error("FVAL getOrder:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se ha podido leer el pedido." }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });

    if (typeof body?.notaInterna === "string" && body?.estado === undefined) {
      const updated = await updateInternalNote(order, body.notaInterna);
      return NextResponse.json({ order: updated });
    }

    const estado = body?.estado as OrderStatus;
    if (!ORDER_STATUSES.includes(estado)) return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    const updated = await updateOrder({ ...order, estado });
    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("FVAL updateOrder:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se ha podido actualizar el estado del pedido." }, { status: 503 });
  }
}
