"use client";

import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";

function dateEs(iso: string) {
  const [y,m,d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}
function statusClass(status: string) {
  return "status status-" + status.replace(/\s+/g, "-");
}
function message(order: Order) {
  return [
    "FRUKLAS — PEDIDO",
    "",
    "Pedido: " + order.id,
    "Fecha: " + dateEs(order.fecha),
    "Estado: " + order.estado,
    "",
    "Cliente:",
    `${order.cliente.codigo} — ${order.cliente.nombre}`,
    "",
    "Empleado:",
    order.empleado.nombre,
    "",
    ...order.lineas.map(l => `${l.producto} — ${l.cantidad}`),
    "",
    "Comentarios:",
    order.comentarios || "—"
  ].join("\n");
}

export default function OrderDetail({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  const [status, setStatus] = useState<OrderStatus>(initial.estado);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function updateStatus() {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el estado.");
      setOrder(data.order);
      setSaved("Estado actualizado. JSON, PDF y CSV reflejan el nuevo estado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
    } finally {
      setBusy(false);
    }
  }

  const encoded = encodeURIComponent(message(order));

  return (
    <>
      <section className="card">
        <div className="no-print">
          <div className={statusClass(order.estado)}>{order.estado}</div>
        </div>
        <h1 className="page-title" style={{ marginTop: 10 }}>{order.id}</h1>

        <div className="order-summary">
          <div className="summary-row"><strong>Fecha</strong><span>{dateEs(order.fecha)}</span></div>
          <div className="summary-row"><strong>Empleado</strong><span>{order.empleado.nombre}{order.empleado.departamento ? " · " + order.empleado.departamento : ""}</span></div>
          <div className="summary-row"><strong>Cliente</strong><span>{order.cliente.codigo} — {order.cliente.nombre}</span></div>
        </div>

        <h2 className="section-title">Productos</h2>
        <div className="grid">
          {order.lineas.map((line, i) => (
            <div className="line-card" key={i}>
              <div className="line-product">{line.producto}</div>
              <div><strong>Cantidad:</strong> {line.cantidad}</div>
            </div>
          ))}
        </div>

        <h2 className="section-title">Comentarios</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{order.comentarios || "—"}</p>

        <div className="no-print">
          <hr className="sep" />
          <div className="grid two">
            <div className="field">
              <label htmlFor="cambiar-estado">Estado</label>
              <select id="cambiar-estado" value={status} onChange={e => setStatus(e.target.value as OrderStatus)}>
                <option value="NUEVO">NUEVO</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="LISTO">LISTO</option>
                <option value="ENTREGADO">ENTREGADO</option>
              </select>
            </div>
            <div className="field" style={{ alignSelf: "end" }}>
              <button className="primary" type="button" disabled={busy || status === order.estado} onClick={updateStatus}>
                {busy ? "ACTUALIZANDO…" : "ACTUALIZAR ESTADO"}
              </button>
            </div>
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          {saved && <div className="success-note">{saved}</div>}

          <hr className="sep" />
          <div className="actions">
            <button className="secondary" type="button" onClick={() => window.print()}>IMPRIMIR</button>
            <a className="secondary" href={`/api/orders/${order.id}/file?type=pdf`}>DESCARGAR PDF</a>
            <a className="secondary" href={`/api/orders/${order.id}/file?type=csv`}>DESCARGAR CSV</a>
            <a className="whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/34652388946?text=${encoded}`}>ENVIAR A NAVE</a>
            <a className="whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/34690371977?text=${encoded}`}>ENVIAR A PUESTO</a>
          </div>
        </div>
      </section>
    </>
  );
}
