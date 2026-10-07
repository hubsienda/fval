import { NextResponse } from "next/server";
import { Readable } from "stream";
import { isAuthenticated } from "@/lib/auth";
import { getClients, getDrive, getEmployees, getProducts } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });

  const result = {
    clientes: false,
    productos: false,
    empleados: false,
    pedidosFvalWritable: false
  };

  try {
    await getClients();
    result.clientes = true;
  } catch {}

  try {
    await getProducts();
    result.productos = true;
  } catch {}

  try {
    await getEmployees();
    result.empleados = true;
  } catch {}

  let testFileId = "";
  try {
    const folderId = process.env.GOOGLE_PEDIDOS_FOLDER_ID;
    if (!folderId) throw new Error("GOOGLE_PEDIDOS_FOLDER_ID no configurado.");
    const drive = getDrive();
    const created = await drive.files.create({
      requestBody: {
        name: ".fval-connection-test-" + Date.now() + ".txt",
        parents: [folderId],
        mimeType: "text/plain"
      },
      media: {
        mimeType: "text/plain",
        body: Readable.from(["FVAL connection test"])
      },
      fields: "id"
    });
    testFileId = created.data.id ?? "";
    result.pedidosFvalWritable = Boolean(testFileId);
    if (testFileId) await drive.files.delete({ fileId: testFileId });
  } catch (error) {
    if (testFileId) {
      try { await getDrive().files.delete({ fileId: testFileId }); } catch {}
    }
  }

  const ok = Object.values(result).every(Boolean);
  return NextResponse.json({ ok, checks: result }, { status: ok ? 200 : 503 });
}
