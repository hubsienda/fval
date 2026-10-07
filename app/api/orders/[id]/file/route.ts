import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getOrderFile } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  const { id } = await context.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  if (type !== "pdf" && type !== "csv") return NextResponse.json({ error: "Tipo de archivo no válido." }, { status: 400 });
  try {
    const file = await getOrderFile(id, type);
    if (!file) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    const contentType = type === "pdf" ? "application/pdf" : "text/csv; charset=utf-8";
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${id}.${type}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    console.error("FVAL getOrderFile:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "No se ha podido descargar el archivo." }, { status: 503 });
  }
}
