import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getClients, getEmployees, getProducts } from "@/lib/google";
import { diagnoseFolderWrite, getActiveFolderId, getArchivedFolderId } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const result = {
    clientes: false,
    productos: false,
    empleados: false,
    pedidosActivosWritable: false,
    pedidosArchivadosWritable: false
  };

  try { await getClients(); result.clientes = true; } catch {}
  try { await getProducts(); result.productos = true; } catch {}
  try { await getEmployees(); result.empleados = true; } catch {}
  try { result.pedidosActivosWritable = await diagnoseFolderWrite(getActiveFolderId(), "activos"); } catch {}
  try { result.pedidosArchivadosWritable = await diagnoseFolderWrite(getArchivedFolderId(), "archivados"); } catch {}

  const ok = Object.values(result).every(Boolean);
  return NextResponse.json({ ok, checks: result }, { status: ok ? 200 : 503 });
}
