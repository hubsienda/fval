export const ORDER_STATUSES = ["NUEVO", "EN PROCESO", "LISTO", "ENTREGADO"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Client = {
  codigo: string;
  nombre: string;
  direccion?: string;
  poblacion?: string;
  pais?: string;
  telefono?: string;
  email?: string;
};

export type Product = { id?: string; nombre: string; notas?: string };
export type Employee = { id: string; nombre: string; departamento?: string };
export type OrderLine = { producto: string; cantidad: number };

export type Order = {
  id: string;
  fecha: string;
  estado: OrderStatus;
  empleado: Employee;
  cliente: Client;
  lineas: OrderLine[];
  comentarios: string;
};

export type OrderDraft = Omit<Order, "id">;
