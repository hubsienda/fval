import "server-only";
import fs from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDrive } from "./google";
import type { Order, OrderDraft } from "./types";

const folderId = () => {
  const value = process.env.GOOGLE_PEDIDOS_FOLDER_ID;
  if (!value) throw new Error("GOOGLE_PEDIDOS_FOLDER_ID no configurado.");
  return value;
};

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
  const headers = ["pedido","fecha","estado","id_empleado","empleado","codigo_cliente","cliente","producto","cantidad","comentarios"];
  const rows = order.lineas.map(line => [
    order.id, order.fecha, order.estado, order.empleado.id, order.empleado.nombre,
    order.cliente.codigo, order.cliente.nombre, line.producto, line.cantidad, order.comentarios
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
  page.drawText("CANTIDAD", { x: 455, y, size: 10, font: bold });
  y -= 28;

  for (const line of order.lineas) {
    page.drawText(line.producto.slice(0, 62), { x: 55, y, size: 10.5, font: normal });
    page.drawText(String(line.cantidad), { x: 470, y, size: 10.5, font: normal });
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

async function exists(id: string) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderId())}' in parents and name='${q(id)}.json' and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  return Boolean(res.data.files?.length);
}

function orderIdNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `FVAL-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function generateOrderId() {
  for (let i=0;i<4;i++) {
    const id = orderIdNow();
    if (!(await exists(id))) return id;
    await new Promise(r => setTimeout(r, 1100));
  }
  throw new Error("No se pudo generar un identificador único de pedido.");
}

async function upload(name: string, mimeType: string, body: Buffer | string) {
  const drive = getDrive();
  const mediaBody = typeof body === "string" ? Readable.from([body]) : Readable.from(body);
  const res = await drive.files.create({
    requestBody: { name, parents: [folderId()], mimeType },
    media: { mimeType, body: mediaBody },
    fields: "id",
    supportsAllDrives: true
  });
  if (!res.data.id) throw new Error("Drive no devolvió el ID del archivo.");
  return res.data.id;
}

async function findFile(name: string) {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderId())}' in parents and name='${q(name)}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 2,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  return res.data.files?.[0]?.id ?? null;
}

async function replace(name: string, mimeType: string, body: Buffer | string) {
  const drive = getDrive();
  const id = await findFile(name);
  if (!id) return upload(name, mimeType, body);
  const mediaBody = typeof body === "string" ? Readable.from([body]) : Readable.from(body);
  await drive.files.update({ fileId: id, media: { mimeType, body: mediaBody }, supportsAllDrives: true });
  return id;
}

export async function saveOrder(draft: OrderDraft) {
  const id = await generateOrderId();
  const order: Order = { ...draft, id };
  const json = JSON.stringify(order, null, 2);
  const pdf = await orderPdf(order);
  const csv = orderCsv(order);
  const created: string[] = [];
  try {
    created.push(await upload(id + ".json", "application/json", json));
    created.push(await upload(id + ".pdf", "application/pdf", pdf));
    created.push(await upload(id + ".csv", "text/csv; charset=utf-8", csv));
    return order;
  } catch (error) {
    logDriveError("FVAL Google Drive order write failed", error);
    const drive = getDrive();
    await Promise.allSettled(created.map(fileId => drive.files.delete({ fileId, supportsAllDrives: true })));
    throw error;
  }
}

export async function listOrders(): Promise<Order[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderId())}' in parents and mimeType='application/json' and trashed=false`,
    fields: "files(id,name,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 200,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  const orders = await Promise.all((res.data.files ?? []).map(async f => {
    if (!f.id) return null;
    try {
      const data = await drive.files.get({ fileId: f.id, alt: "media", supportsAllDrives: true }, { responseType: "text" });
      return (typeof data.data === "string" ? JSON.parse(data.data) : data.data) as Order;
    } catch { return null; }
  }));
  return orders.filter((x): x is Order => Boolean(x));
}

export async function getOrder(id: string): Promise<Order | null> {
  const fileId = await findFile(id + ".json");
  if (!fileId) return null;
  const drive = getDrive();
  const data = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "text" });
  return (typeof data.data === "string" ? JSON.parse(data.data) : data.data) as Order;
}

export async function updateOrder(order: Order) {
  await replace(order.id + ".json", "application/json", JSON.stringify(order, null, 2));
  await replace(order.id + ".pdf", "application/pdf", await orderPdf(order));
  await replace(order.id + ".csv", "text/csv; charset=utf-8", orderCsv(order));
  return order;
}

export async function getOrderFile(id: string, type: "pdf" | "csv") {
  const fileId = await findFile(id + "." + type);
  if (!fileId) return null;
  const drive = getDrive();
  const data = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
  return Buffer.from(data.data as ArrayBuffer);
}

export async function diagnoseGoogle() {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${q(folderId())}' in parents and trashed=false`,
    fields: "files(id)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });
  return { driveReadable: Array.isArray(res.data.files) };
}
