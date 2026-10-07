import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listOrders, saveOrder } from "@/lib/orders";
import { ORDER_STATUSES, ORDER_UDMS, type OrderDraft } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validDraft(value: unknown): value is OrderDraft {
  if (!value || typeof value !== "object") return false;
  const x = value as Partial<OrderDraft>;
  return Boolean(
    typeof x.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.fecha) &&
    x.empleado && typeof x.empleado.id === "string" && typeof x.empleado.nombre === "string" &&
    x.cliente && typeof x.cliente.codigo === "string" && typeof x.cliente.nombre === "string" &&
    Array.isArray(x.lineas) && x.lineas.length > 0 &&
    x.lineas.every(line => line &&
      typeof line.producto === "string" && line.producto.trim() &&
      typeof line.cantidad === "number" && Number.isFinite(line.cantidad) && line.cantidad > 0 &&
      ORDER_UDMS.includes(line.udm) &&
      (line.precio === null || (typeof line.precio === "number" && Number.isFinite(line.precio) && line.precio >= 0))
    ) &&
    typeof x.comentarios === "string" &&
    typeof x.notaInterna === "string" &&
    x.estado === "NUEVO" &&
    ORDER_STATUSES.includes(x.estado)
  );
}

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  try {
    return NextResponse.json({ orders: await listOrders() });
  } catch (error) {
    console.error("FVAL listOrders:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se han podido cargar los pedidos desde Google Drive." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  try {
    const body = await request.json();
    if (!validDraft(body)) return NextResponse.json({ error: "El pedido no es válido. Revisa los campos y las cantidades." }, { status: 400 });
    const order = await saveOrder(body);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("FVAL saveOrder:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se ha podido guardar el pedido en Google Drive. No se ha marcado como guardado." }, { status: 503 });
  }
}
