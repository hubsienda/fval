"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Order, OrderStatus } from "@/lib/types";

function dateEs(iso: string) {
  const [y,m,d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function statusClass(status: string) {
  return "status status-" + status.replace(/\s+/g, "-");
}

export default function OrdersList({ orders, basePath = "/pedidos" }: { orders: Order[]; basePath?: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return orders.filter(order => {
      if (status && order.estado !== status) return false;
      if (!needle) return true;
      const haystack = [
        order.id,
        order.fecha,
        dateEs(order.fecha),
        order.cliente.codigo,
        order.cliente.nombre,
        order.empleado.nombre,
        order.estado
      ].join(" ").toLocaleLowerCase("es");
      return haystack.includes(needle);
    });
  }, [orders, query, status]);

  return (
    <>
      <div className="toolbar">
        <div className="field">
          <label htmlFor="buscar">Buscar pedido, cliente o fecha</label>
          <input id="buscar" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ej. 1681, JUAN PINA, 07/10/2026…" />
        </div>
        <div className="field">
          <label htmlFor="estado">Estado</label>
          <select id="estado" value={status} onChange={e => setStatus(e.target.value as OrderStatus | "")}>
            <option value="">Todos</option>
            <option value="NUEVO">NUEVO</option>
            <option value="EN PROCESO">EN PROCESO</option>
            <option value="LISTO">LISTO</option>
            <option value="ENTREGADO">ENTREGADO</option>
          </select>
        </div>
      </div>

      <div className="order-list">
        {filtered.length ? filtered.map(order => (
          <Link className="order-item" href={`${basePath}/${encodeURIComponent(order.id)}`} key={order.id}>
            <div>
              <div className="order-id">{order.id}</div>
              <div className="meta">{order.cliente.codigo} — {order.cliente.nombre}</div>
            </div>
            <div className="meta">
              <div>{dateEs(order.fecha)}</div>
              <div>{order.empleado.nombre}</div>
            </div>
            <div className={statusClass(order.estado)}>{order.estado}</div>
          </Link>
        )) : <div className="empty">No hay pedidos que coincidan con la búsqueda.</div>}
      </div>
    </>
  );
}
