import "server-only";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDrive } from "./google";
import {
  ORDER_UDMS,
  type Order,
  type OrderDraft,
  type OrderIndexEntry,
  type OrderLine,
  type OrderUdm
} from "./types";

type OrderLocation = "active" | "archived";

const INDEX_NAME = "pedidos-index.json";

const requiredFolder = (name: "GOOGLE_PEDIDOS_ACTIVOS_FOLDER_ID" | "GOOGLE_PEDIDOS_ARCHIVADOS_FOLDER_ID") => {
  const value = process.env[name];
  if (!value) throw new Error(name + " no configurado.");
  return value;
};

const activeFolderId = () => requiredFolder("GOOGLE_PEDIDOS_ACTIVOS_FOLDER_ID");
const archivedFolderId = () => requiredFolder("GOOGLE_PEDIDOS_ARCHIVADOS_FOLDER_ID");
const folderFor = (location: OrderLocation) => location === "active" ? activeFolderId() : archivedFolderId();

const q = (value: string) => value.replace(/'/g, "\\'");

type DriveErrorShape = {
  message?: string;
  code?: number | string;
  response?: {
    status?: number;
    data?: {
      error?: {
        code?: number | string;
        message?: string;
        errors?: Array<{ reason?: string; message?: string }>;
      };
    };
  };
};

function logDriveError(context: string, error: unknown) {
  const e = (error && typeof error === "object" ? error : {}) as DriveErrorShape;
  const googleError = e.response?.data?.error;
  console.error(context, {
    message: googleError?.message ?? e.message ?? "Unknown Google Drive error",
    httpStatus: e.response?.status,
    code: googleError?.code ?? e.code,
    reason: googleError?.errors?.[0]?.reason
  });
}

function displayDate(iso: string) {
  const [y,m,d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function csvCell(value: unknown) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function orderCsv(order: Order) {
  const headers = ["pedido","fecha","estado","id_empleado","empleado","codigo_cliente","cliente","producto","cantidad","udm","precio_eur","comentarios"];
  const rows = order.lineas.map(line => [
    order.id, order.fecha, order.estado, order.empleado.id, order.empleado.nombre,
    order.cliente.codigo, order.cliente.nombre, line.producto, line.cantidad, line.udm, line.precio ?? "", order.comentarios
  ]);
  return "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function orderPdf(order: Order) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 790;

  try {
    const logoBytes = await fs.readFile(path.join(process.cwd(), "public", "logo", "logo.png"));
    const logo = await pdf.embedPng(logoBytes);
    const dims = logo.scaleToFit(150, 55);
    page.drawImage(logo, { x: 45, y: y - dims.height + 12, width: dims.width, height: dims.height });
  } catch {}

  page.drawText("PEDIDO", { x: 390, y, size: 19, font: bold });
  y -= 32;
  page.drawText(order.id, { x: 390, y, size: 10.5, font: normal });
  y -= 42;

  const drawPair = (label: string, value: string) => {
    page.drawText(label, { x: 45, y, size: 10.5, font: bold });
    page.drawText(value, { x: 135, y, size: 10.5, font: normal });
    y -= 20;
  };

  drawPair("Fecha:", displayDate(order.fecha));
  drawPair("Estado:", order.estado);
  drawPair("Empleado:", order.empleado.nombre + (order.empleado.departamento ? " · " + order.empleado.departamento : ""));
  y -= 8;
  page.drawText("Cliente", { x: 45, y, size: 11, font: bold });
  y -= 18;
  page.drawText(`${order.cliente.codigo} — ${order.cliente.nombre}`, { x: 45, y, size: 11, font: normal });
  y -= 34;

  page.drawRectangle({ x: 45, y: y - 8, width: 505, height: 26, color: rgb(0.94,0.94,0.94) });
  page.drawText("PRODUCTO", { x: 55, y, size: 10, font: bold });
  page.drawText("CANT.", { x: 365, y, size: 10, font: bold });
  page.drawText("UdM", { x: 425, y, size: 10, font: bold });
  page.drawText("PRECIO €", { x: 475, y, size: 10, font: bold });
  y -= 28;

  for (const line of order.lineas) {
    page.drawText(line.producto.slice(0, 45), { x: 55, y, size: 10.5, font: normal });
    page.drawText(String(line.cantidad), { x: 372, y, size: 10.5, font: normal });
    page.drawText(line.udm, { x: 425, y, size: 10.5, font: normal });
    page.drawText(line.precio == null ? "—" : line.precio.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), { x: 482, y, size: 10.5, font: normal });
    y -= 21;
  }

  y -= 16;
  page.drawText("Comentarios", { x: 45, y, size: 11, font: bold });
  y -= 18;
  const words = order.comentarios.trim().split(/\s+/).filter(Boolean);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (candidate.length > 90) { lines.push(line); line = word; } else line = candidate;
  }
  if (line) lines.push(line);
  if (!lines.length) lines.push("—");
  for (const text of lines.slice(0, 12)) {
    page.drawText(text, { x: 45, y, size: 10.5, font: normal });
    y -= 17;
  }

  page.drawText("FRUKLAS · FVAL", { x: 45, y: 35, size: 8.5, font: normal });
  return Buffer.from(await pdf.save());
}

async function listNamedFile(folderId: string, name: string) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderId)}' in parents and name='${q(name)}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 2,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  return res.data.files?.[0] ?? null;
}

async function upload(folderId: string, name: string, mimeType: string, body: Buffer | string) {
  const drive = getDrive();
  const mediaBody = typeof body === "string" ? Readable.from([body]) : Readable.from(body);
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId], mimeType },
    media: { mimeType, body: mediaBody },
    fields: "id",
    supportsAllDrives: true
  });
  if (!res.data.id) throw new Error("Drive no devolvió el ID del archivo.");
  return res.data.id;
}

async function findFile(location: OrderLocation, name: string) {
  const file = await listNamedFile(folderFor(location), name);
  return file?.id ?? null;
}

async function writeFileById(fileId: string, mimeType: string, body: Buffer | string) {
  const mediaBody = typeof body === "string" ? Readable.from([body]) : Readable.from(body);
  await getDrive().files.update({
    fileId,
    media: { mimeType, body: mediaBody },
    supportsAllDrives: true
  });
}

async function replace(location: OrderLocation, name: string, mimeType: string, body: Buffer | string) {
  const id = await findFile(location, name);
  if (!id) return upload(folderFor(location), name, mimeType, body);
  await writeFileById(id, mimeType, body);
  return id;
}

function normaliseOrder(raw: Order): Order {
  return {
    ...raw,
    lineas: (raw.lineas ?? []).map((line) => {
      const candidate = line as Partial<OrderLine> & { producto: string; cantidad: number };
      const udm: OrderUdm = candidate.udm && ORDER_UDMS.includes(candidate.udm as OrderUdm) ? candidate.udm as OrderUdm : "Box";
      const precio = typeof candidate.precio === "number" && Number.isFinite(candidate.precio) && candidate.precio >= 0 ? candidate.precio : null;
      return { producto: candidate.producto, cantidad: candidate.cantidad, udm, precio };
    }),
    notaInterna: typeof raw.notaInterna === "string" ? raw.notaInterna : "",
    notaInternaActualizada: typeof raw.notaInternaActualizada === "string" ? raw.notaInternaActualizada : undefined,
    actualizado: typeof raw.actualizado === "string" ? raw.actualizado : undefined
  };
}

function indexEntry(order: Order): OrderIndexEntry {
  return {
    id: order.id,
    fecha: order.fecha,
    cliente: order.cliente.nombre,
    codigoCliente: order.cliente.codigo,
    empleado: order.empleado.nombre,
    estado: order.estado,
    actualizado: order.actualizado
  };
}

function validIndexEntry(value: unknown): value is OrderIndexEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<OrderIndexEntry>;
  return Boolean(
    typeof entry.id === "string" &&
    typeof entry.fecha === "string" &&
    typeof entry.cliente === "string" &&
    typeof entry.codigoCliente === "string" &&
    typeof entry.empleado === "string" &&
    typeof entry.estado === "string"
  );
}

async function readIndexExisting(location: OrderLocation) {
  const file = await listNamedFile(folderFor(location), INDEX_NAME);
  if (!file?.id) return null;
  const data = await getDrive().files.get(
    { fileId: file.id, alt: "media", supportsAllDrives: true },
    { responseType: "text" }
  );
  const parsed = typeof data.data === "string" ? JSON.parse(data.data) : data.data;
  if (!Array.isArray(parsed)) throw new Error("El índice de pedidos no es válido.");
  return {
    fileId: file.id,
    entries: parsed.filter(validIndexEntry) as OrderIndexEntry[]
  };
}

async function writeIndex(location: OrderLocation, entries: OrderIndexEntry[], fileId?: string) {
  const body = JSON.stringify(entries, null, 2);
  if (fileId) {
    await writeFileById(fileId, "application/json", body);
    return fileId;
  }
  return upload(folderFor(location), INDEX_NAME, "application/json", body);
}

async function scanOrdersForIndex(location: OrderLocation): Promise<OrderIndexEntry[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderFor(location))}' in parents and mimeType='application/json' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 1000,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const orderFiles = (res.data.files ?? []).filter(file => file.id && file.name && file.name !== INDEX_NAME);
  const entries = await Promise.all(orderFiles.map(async file => {
    try {
      const data = await drive.files.get(
        { fileId: file.id!, alt: "media", supportsAllDrives: true },
        { responseType: "text" }
      );
      const order = normaliseOrder((typeof data.data === "string" ? JSON.parse(data.data) : data.data) as Order);
      return indexEntry(order);
    } catch {
      return null;
    }
  }));

  return entries.filter((entry): entry is OrderIndexEntry => Boolean(entry));
}

export async function rebuildOrderIndex(location: OrderLocation) {
  const entries = await scanOrdersForIndex(location);
  const existing = await listNamedFile(folderFor(location), INDEX_NAME);
  await writeIndex(location, entries, existing?.id ?? undefined);
  return entries;
}

async function readIndex(location: OrderLocation): Promise<OrderIndexEntry[]> {
  const existing = await readIndexExisting(location);
  if (existing) return existing.entries;
  return rebuildOrderIndex(location);
}

async function mutateIndex(
  location: OrderLocation,
  mutate: (entries: OrderIndexEntry[]) => OrderIndexEntry[]
) {
  const existing = await readIndexExisting(location);
  if (!existing) {
    await rebuildOrderIndex(location);
    const rebuilt = await readIndexExisting(location);
    if (!rebuilt) throw new Error("No se ha podido crear el índice de pedidos.");
    const entries = mutate(rebuilt.entries);
    await writeIndex(location, entries, rebuilt.fileId);
    return;
  }
  await writeIndex(location, mutate(existing.entries), existing.fileId);
}

async function syncIndexEntry(location: OrderLocation, order: Order) {
  try {
    await mutateIndex(location, entries => {
      const next = entries.filter(entry => entry.id !== order.id);
      next.unshift(indexEntry(order));
      return next;
    });
  } catch (error) {
    logDriveError("FVAL order index update failed", error);
    await rebuildOrderIndex(location);
  }
}

async function removeIndexEntry(location: OrderLocation, id: string) {
  try {
    await mutateIndex(location, entries => entries.filter(entry => entry.id !== id));
  } catch (error) {
    logDriveError("FVAL order index removal failed", error);
    await rebuildOrderIndex(location);
  }
}

async function exists(id: string) {
  return Boolean(await listNamedFile(activeFolderId(), id + ".json"));
}

function orderIdNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `FVAL-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
}

export async function generateOrderId() {
  for (let i=0;i<4;i++) {
    const id = orderIdNow();
    if (!(await exists(id))) return id;
    await new Promise(r => setTimeout(r, 1100));
  }
  throw new Error("No se pudo generar un identificador único de pedido.");
}

async function getOrderFrom(location: OrderLocation, id: string): Promise<Order | null> {
  const fileId = await findFile(location, id + ".json");
  if (!fileId) return null;
  const data = await getDrive().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "text" }
  );
  return normaliseOrder((typeof data.data === "string" ? JSON.parse(data.data) : data.data) as Order);
}

export async function saveOrder(draft: OrderDraft) {
  const id = await generateOrderId();
  const order: Order = { ...draft, id };
  const files = [
    { name: id + ".json", mimeType: "application/json", body: JSON.stringify(order, null, 2) },
    { name: id + ".pdf", mimeType: "application/pdf", body: await orderPdf(order) },
    { name: id + ".csv", mimeType: "text/csv; charset=utf-8", body: orderCsv(order) }
  ];
  const results = await Promise.allSettled(
    files.map(file => upload(activeFolderId(), file.name, file.mimeType, file.body))
  );
  const created = results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map(result => result.value);

  if (results.some(result => result.status === "rejected")) {
    await Promise.allSettled(created.map(fileId => getDrive().files.delete({ fileId, supportsAllDrives: true })));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    logDriveError("FVAL Google Drive order write failed", failure?.reason);
    throw failure?.reason ?? new Error("No se han podido crear todos los archivos del pedido.");
  }

  try {
    await syncIndexEntry("active", order);
    return order;
  } catch (error) {
    await Promise.allSettled(created.map(fileId => getDrive().files.delete({ fileId, supportsAllDrives: true })));
    try { await rebuildOrderIndex("active"); } catch {}
    throw error;
  }
}

export const listOrders = () => readIndex("active");
export const listArchivedOrders = () => readIndex("archived");
export const getOrder = (id: string) => getOrderFrom("active", id);
export const getArchivedOrder = (id: string) => getOrderFrom("archived", id);

async function findOperationalFiles(location: OrderLocation, id: string) {
  const names = [id + ".json", id + ".pdf", id + ".csv"];
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderFor(location))}' in parents and trashed=false and (name='${q(names[0])}' or name='${q(names[1])}' or name='${q(names[2])}')`,
    fields: "files(id,name)",
    pageSize: 3,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  const byName = new Map((res.data.files ?? []).filter(file => file.id && file.name).map(file => [file.name!, file.id!]));
  return { names, byName };
}

export async function updateOrder(order: Order) {
  const updated: Order = { ...order, actualizado: new Date().toISOString() };
  const { names, byName } = await findOperationalFiles("active", updated.id);
  const payloads = [
    { name: names[0], mimeType: "application/json", body: JSON.stringify(updated, null, 2) },
    { name: names[1], mimeType: "application/pdf", body: await orderPdf(updated) },
    { name: names[2], mimeType: "text/csv; charset=utf-8", body: orderCsv(updated) }
  ];

  await Promise.all(payloads.map(async payload => {
    const fileId = byName.get(payload.name);
    if (fileId) return writeFileById(fileId, payload.mimeType, payload.body);
    return upload(activeFolderId(), payload.name, payload.mimeType, payload.body);
  }));

  await syncIndexEntry("active", updated);
  return updated;
}

export async function updateInternalNote(order: Order, notaInterna: string) {
  const updated: Order = {
    ...order,
    notaInterna,
    notaInternaActualizada: new Date().toISOString()
  };
  await replace("active", updated.id + ".json", "application/json", JSON.stringify(updated, null, 2));
  return updated;
}

export async function getOrderFile(id: string, type: "pdf" | "csv") {
  let fileId = await findFile("active", id + "." + type);
  if (!fileId) fileId = await findFile("archived", id + "." + type);
  if (!fileId) return null;
  const data = await getDrive().files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(data.data as ArrayBuffer);
}

async function getCompleteOrderFiles(location: OrderLocation, id: string) {
  const { names, byName } = await findOperationalFiles(location, id);
  if (names.some(name => !byName.has(name))) {
    throw new Error("El pedido no tiene completos los archivos JSON, PDF y CSV.");
  }
  return names.map(name => ({ id: byName.get(name)!, name }));
}

async function moveOrder(id: string, source: OrderLocation, destination: OrderLocation) {
  const order = await getOrderFrom(source, id);
  if (!order) throw new Error("Pedido no encontrado.");

  const files = await getCompleteOrderFiles(source, id);
  const drive = getDrive();
  const results = await Promise.allSettled(files.map(file => drive.files.update({
    fileId: file.id,
    addParents: folderFor(destination),
    removeParents: folderFor(source),
    fields: "id,parents",
    supportsAllDrives: true
  })));

  const moved = files.filter((_, index) => results[index].status === "fulfilled");
  if (results.some(result => result.status === "rejected")) {
    await Promise.allSettled(moved.map(file => drive.files.update({
      fileId: file.id,
      addParents: folderFor(source),
      removeParents: folderFor(destination),
      fields: "id,parents",
      supportsAllDrives: true
    })));
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    logDriveError("FVAL Google Drive order move failed", failure?.reason);
    throw failure?.reason ?? new Error("No se han podido mover todos los archivos del pedido.");
  }

  try {
    await removeIndexEntry(source, id);
    await syncIndexEntry(destination, order);
  } catch (error) {
    try {
      await Promise.all([rebuildOrderIndex(source), rebuildOrderIndex(destination)]);
    } catch {}
    throw error;
  }
}

export async function archiveOrder(id: string) {
  await moveOrder(id, "active", "archived");
}

export async function restoreOrder(id: string) {
  await moveOrder(id, "archived", "active");
}

export async function deleteArchivedOrder(id: string) {
  const files = await getCompleteOrderFiles("archived", id);
  const results = await Promise.allSettled(
    files.map(file => getDrive().files.delete({ fileId: file.id, supportsAllDrives: true }))
  );
  if (results.some(result => result.status === "rejected")) {
    try { await rebuildOrderIndex("archived"); } catch {}
    throw new Error("No se han podido eliminar todos los archivos del pedido archivado.");
  }
  await removeIndexEntry("archived", id);
}

export async function diagnoseFolderWrite(folderId: string, label: string) {
  const drive = getDrive();
  let testFileId = "";
  try {
    const created = await drive.files.create({
      requestBody: {
        name: `.fval-${label}-test-${Date.now()}.txt`,
        parents: [folderId],
        mimeType: "text/plain"
      },
      media: { mimeType: "text/plain", body: Readable.from(["FVAL connection test"]) },
      fields: "id",
      supportsAllDrives: true
    });
    testFileId = created.data.id ?? "";
    if (!testFileId) return false;
    await drive.files.delete({ fileId: testFileId, supportsAllDrives: true });
    return true;
  } catch {
    if (testFileId) {
      try { await drive.files.delete({ fileId: testFileId, supportsAllDrives: true }); } catch {}
    }
    return false;
  }
}

export const getActiveFolderId = activeFolderId;
export const getArchivedFolderId = archivedFolderId;
