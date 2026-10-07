import "server-only";
import { google } from "googleapis";
import { unstable_cache } from "next/cache";
import type { Client, Employee, Product } from "./types";

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(name + " no configurado.");
  return value;
}

function auth() {
  const privateKey = required("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: {
      project_id: required("GOOGLE_PROJECT_ID"),
      client_email: required("GOOGLE_CLIENT_EMAIL"),
      private_key: privateKey
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive"
    ]
  });
}

export const getSheets = () => google.sheets({ version: "v4", auth: auth() });
export const getDrive = () => google.drive({ version: "v3", auth: auth() });

function norm(s: unknown) {
  return String(s ?? "").trim();
}

function headerKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

async function readRows(sheetId: string) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: "A:Z" });
  const values = (res.data.values ?? []) as string[][];
  if (!values.length) return { headers: [] as string[], rows: [] as string[][] };
  return { headers: values[0].map(headerKey), rows: values.slice(1) };
}

function cell(headers: string[], row: string[], names: string[]) {
  for (const name of names) {
    const idx = headers.indexOf(headerKey(name));
    if (idx >= 0 && norm(row[idx])) return norm(row[idx]);
  }
  return "";
}

async function fetchClients(): Promise<Client[]> {
  const { headers, rows } = await readRows(required("GOOGLE_CLIENTES_SHEET_ID"));
  return rows.map(row => ({
    codigo: cell(headers, row, ["CODIGO", "CÓDIGO"]),
    nombre: cell(headers, row, ["NOMBRE"]),
    direccion: cell(headers, row, ["DIRECCION", "DIRECCIÓN"]),
    poblacion: cell(headers, row, ["POBLACION", "POBLACIÓN"]),
    pais: cell(headers, row, ["PAIS", "PAÍS"]),
    telefono: cell(headers, row, ["TLF", "TELEFONO", "TELÉFONO"]),
    email: cell(headers, row, ["EMAIL"])
  })).filter(x => x.codigo || x.nombre);
}

async function fetchProducts(): Promise<Product[]> {
  const { headers, rows } = await readRows(required("GOOGLE_PRODUCTOS_SHEET_ID"));
  const idIdx = headers.findIndex(h => h === "ID PRODUCTO" || h === "ID");
  const notesIdx = headers.findIndex(h => h === "NOTAS");
  const nameIdx = headers.findIndex(h => h === "NOMBRE PRODUCTO" || h === "PRODUCTO" || h === "NOMBRE");

  return rows.map(row => {
    let nombre = nameIdx >= 0 ? norm(row[nameIdx]) : "";
    if (!nombre) {
      for (let i = 0; i < row.length; i++) {
        if (i === idIdx || i === notesIdx) continue;
        const value = norm(row[i]);
        if (value) { nombre = value; break; }
      }
    }
    return { id: idIdx >= 0 ? norm(row[idIdx]) : "", nombre, notas: notesIdx >= 0 ? norm(row[notesIdx]) : "" };
  }).filter(x => x.nombre);
}

async function fetchEmployees(): Promise<Employee[]> {
  const { headers, rows } = await readRows(required("GOOGLE_EMPLEADOS_SHEET_ID"));
  return rows.map(row => ({
    id: cell(headers, row, ["ID EMPLEADO", "ID"]),
    nombre: cell(headers, row, ["EMPLEADO", "NOMBRE"]),
    departamento: cell(headers, row, ["DEPARTAMENTO"])
  })).filter(x => x.id || x.nombre);
}


export const getClients = unstable_cache(fetchClients, ["fval-clients"], {
  revalidate: 300,
  tags: ["fval-master-data"]
});

export const getProducts = unstable_cache(fetchProducts, ["fval-products"], {
  revalidate: 300,
  tags: ["fval-master-data"]
});

export const getEmployees = unstable_cache(fetchEmployees, ["fval-employees"], {
  revalidate: 300,
  tags: ["fval-master-data"]
});
