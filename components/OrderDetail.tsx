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
function money(value: number | null) {
  return value == null ? "—" : value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}
function dateTimeEs(value?: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Madrid"
    }).format(new Date(value));
  } catch {
    return value;
  }
}
function message(order: Order) {
  return [
    "FRUKLAS — PEDIDO", "",
    "Pedido: " + order.id,
    "Fecha: " + dateEs(order.fecha),
    "Estado: " + order.estado, "",
    "Cliente:", `${order.cliente.codigo} — ${order.cliente.nombre}`, "",
    "Empleado:", order.empleado.nombre, "",
    ...order.lineas.map(l => {
      const base = `${l.producto} — ${l.cantidad} ${l.udm}`;
      return l.precio == null ? base : `${base} — ${l.precio.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/${l.udm}`;
    }),
    "", "Comentarios:", order.comentarios || "—"
  ].join("\n");
}

export default function OrderDetail({ initial }: { initial: Order }) {
  const [order, setOrder] = useState(initial);
  const [status, setStatus] = useState<OrderStatus>(initial.estado);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(initial.notaInterna ?? "");
  const [noteBusy, setNoteBusy] = useState(false);
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);

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

  async function saveNote() {
    setNoteBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notaInterna: note })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la nota interna.");
      setOrder(data.order);
      setNote(data.order.notaInterna ?? "");
      setEditingNote(false);
      setSaved("Nota interna actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota interna.");
    } finally {
      setNoteBusy(false);
    }
  }

  async function savePrice(index: number) {
    const parsed = priceValue.trim() === "" ? null : Number(priceValue.replace(",", "."));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError("Introduce un precio válido o déjalo en blanco.");
      return;
    }
    setPriceBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineIndex: index, precio: parsed })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo actualizar el precio.");
      setOrder(data.order);
      setEditingPrice(null);
      setPriceValue("");
      setSaved("Precio actualizado. JSON, PDF y CSV reflejan el nuevo precio.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el precio.");
    } finally {
      setPriceBusy(false);
    }
  }

  const encoded = encodeURIComponent(message(order));

  return (
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
            <div className="line-main">
              <div className="line-product">{line.producto}</div>
              <div className="line-qty"><strong>Cantidad:</strong> {line.cantidad}</div>
              <div className="line-qty"><strong>UdM:</strong> {line.udm}</div>
              <div className="line-qty"><strong>Precio:</strong> {money(line.precio)}</div>
            </div>
            <div className="no-print">
              {editingPrice === i ? (
                <div className="price-editor">
                  <div className="field">
                    <label htmlFor={`precio-linea-${i}`}>Precio €</label>
                    <input
                      id={`precio-linea-${i}`}
                      inputMode="decimal"
                      value={priceValue}
                      onChange={e => setPriceValue(e.target.value)}
                      placeholder="Vacío = sin precio"
                    />
                  </div>
                  <div className="line-actions">
                    <button type="button" disabled={priceBusy} onClick={() => savePrice(i)}>{priceBusy ? "GUARDANDO…" : "GUARDAR"}</button>
                    <button type="button" disabled={priceBusy} onClick={() => { setEditingPrice(null); setPriceValue(""); }}>CANCELAR</button>
                  </div>
                </div>
              ) : (
                <button className="secondary price-action" type="button" onClick={() => {
                  setEditingPrice(i);
                  setPriceValue(line.precio == null ? "" : String(line.precio));
                }}>
                  {line.precio == null ? "AÑADIR PRECIO" : "EDITAR PRECIO"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-title">Comentarios</h2>
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{order.comentarios || "—"}</p>

      <div className="no-print internal-note-panel">
        <h2 className="section-title">Nota Interna</h2>
        {!editingNote ? (
          <>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{order.notaInterna || "—"}</p>
            {order.notaInternaActualizada && <div className="meta">Actualizada: {dateTimeEs(order.notaInternaActualizada)}</div>}
            <button className="secondary" type="button" onClick={() => { setNote(order.notaInterna ?? ""); setEditingNote(true); }}>EDITAR NOTA</button>
          </>
        ) : (
          <div className="grid">
            <div className="field">
              <label htmlFor="editar-nota">Nota Interna</label>
              <textarea id="editar-nota" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <div className="actions">
              <button className="primary" type="button" disabled={noteBusy} onClick={saveNote}>{noteBusy ? "GUARDANDO…" : "GUARDAR NOTA"}</button>
              <button className="secondary" type="button" disabled={noteBusy} onClick={() => { setNote(order.notaInterna ?? ""); setEditingNote(false); }}>CANCELAR</button>
            </div>
          </div>
        )}
      </div>

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
  );
}
