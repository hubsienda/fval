"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import type { Client, Employee, Order, OrderLine, Product } from "@/lib/types";

type SearchOption = {
  key: string;
  label: string;
  secondary?: string;
};

function SearchPicker({
  label,
  placeholder,
  options,
  valueLabel,
  onSelect
}: {
  label: string;
  placeholder: string;
  options: SearchOption[];
  valueLabel: string;
  onSelect: (key: string) => void;
}) {
  const [query, setQuery] = useState(valueLabel);
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return options.slice(0, 30);
    return options.filter(o =>
      (o.label + " " + (o.secondary ?? "")).toLocaleLowerCase("es").includes(needle)
    ).slice(0, 40);
  }, [query, options]);

  function choose(option: SearchOption) {
    setQuery(option.label);
    onSelect(option.key);
    setOpen(false);
  }

  return (
    <div className="field autocomplete">
      <label>{label}</label>
      <input
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={e => {
          setQuery(e.target.value);
          onSelect("");
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (
        <div className="autocomplete-results" role="listbox">
          {filtered.length ? filtered.map(option => (
            <button
              key={option.key}
              type="button"
              className="autocomplete-option"
              onMouseDown={e => e.preventDefault()}
              onClick={() => choose(option)}
            >
              <strong>{option.label}</strong>
              {option.secondary && <small>{option.secondary}</small>}
            </button>
          )) : <div className="autocomplete-option">Sin resultados</div>}
        </div>
      )}
    </div>
  );
}

function statusClass(status: string) {
  return "status status-" + status.replace(/\s+/g, "-");
}

function whatsappMessage(order: Order) {
  const lines = order.lineas.map(l => `${l.producto} — ${l.cantidad}`).join("\n");
  const [y,m,d] = order.fecha.split("-");
  return [
    "FRUKLAS — PEDIDO",
    "",
    "Pedido: " + order.id,
    "Fecha: " + (y && m && d ? `${d}/${m}/${y}` : order.fecha),
    "Estado: " + order.estado,
    "",
    "Cliente:",
    `${order.cliente.codigo} — ${order.cliente.nombre}`,
    "",
    "Empleado:",
    order.empleado.nombre,
    "",
    lines,
    "",
    "Comentarios:",
    order.comentarios || "—"
  ].join("\n");
}

function PrintableOrder({ order }: { order: Order }) {
  const [y,m,d] = order.fecha.split("-");
  return (
    <section className="print-only">
      <h1>FRUKLAS — PEDIDO</h1>
      <h2>{order.id}</h2>
      <p><strong>Fecha:</strong> {y && m && d ? `${d}/${m}/${y}` : order.fecha}</p>
      <p><strong>Estado:</strong> {order.estado}</p>
      <p><strong>Empleado:</strong> {order.empleado.nombre}</p>
      <p><strong>Cliente:</strong> {order.cliente.codigo} — {order.cliente.nombre}</p>
      <hr />
      {order.lineas.map((line, i) => <p key={i}><strong>{line.producto}</strong> — {line.cantidad}</p>)}
      <hr />
      <p><strong>Comentarios:</strong><br />{order.comentarios || "—"}</p>
    </section>
  );
}

export default function OrderForm({
  clients,
  products,
  employees,
  today
}: {
  clients: Client[];
  products: Product[];
  employees: Employee[];
  today: string;
}) {
  const [fecha, setFecha] = useState(today);
  const [employeeId, setEmployeeId] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [productName, setProductName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [comments, setComments] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Order | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const clientOptions = useMemo(() => clients.map(c => ({
    key: c.codigo || c.nombre,
    label: `${c.codigo} — ${c.nombre}`,
    secondary: [c.poblacion, c.pais].filter(Boolean).join(" · ")
  })), [clients]);

  const productOptions = useMemo(() => products.map((p, i) => ({
    key: p.nombre + "::" + i,
    label: p.nombre,
    secondary: p.notas
  })), [products]);

  const selectedClient = clients.find(c => (c.codigo || c.nombre) === clientCode);
  const selectedEmployee = employees.find(e => e.id === employeeId);

  function addLine() {
    setError("");
    const qty = Number(quantity.replace(",", "."));
    if (!productName) return setError("Selecciona un producto.");
    if (!Number.isFinite(qty) || qty <= 0) return setError("Introduce una cantidad válida.");
    const line = { producto: productName, cantidad: qty };
    setLines(current => {
      if (editing === null) return [...current, line];
      return current.map((x, i) => i === editing ? line : x);
    });
    setEditing(null);
    setProductName("");
    setQuantity("");
    setTimeout(() => {
      const productInput = document.querySelector<HTMLInputElement>('[data-product-picker="true"]');
      productInput?.focus();
    }, 0);
  }

  function editLine(index: number) {
    const line = lines[index];
    setProductName(line.producto);
    setQuantity(String(line.cantidad));
    setEditing(index);
    setTimeout(() => qtyRef.current?.focus(), 0);
  }

  function removeLine(index: number) {
    setLines(current => current.filter((_, i) => i !== index));
    if (editing === index) {
      setEditing(null);
      setProductName("");
      setQuantity("");
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!fecha) return setError("La fecha es obligatoria.");
    if (!selectedEmployee) return setError("Selecciona un empleado.");
    if (!selectedClient) return setError("Selecciona un cliente.");
    if (!lines.length) return setError("Añade al menos un producto.");

    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          empleado: selectedEmployee,
          cliente: selectedClient,
          lineas: lines,
          comentarios: comments,
          estado: "NUEVO"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el pedido.");
      setSaved(data.order);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el pedido.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFecha(today);
    setEmployeeId("");
    setClientCode("");
    setProductName("");
    setQuantity("");
    setLines([]);
    setComments("");
    setEditing(null);
    setSaved(null);
    setError("");
  }

  if (saved) {
    const msg = encodeURIComponent(whatsappMessage(saved));
    return (
      <>
        <PrintableOrder order={saved} />
        <section className="card no-print">
          <div className="success-note"><strong>Pedido guardado correctamente.</strong><br />Se han archivado JSON, PDF y CSV en Google Drive.</div>
          <h1 className="page-title">{saved.id}</h1>
          <div className={statusClass(saved.estado)}>{saved.estado}</div>
          <div className="order-summary">
            <div className="summary-row"><strong>Cliente</strong><span>{saved.cliente.codigo} — {saved.cliente.nombre}</span></div>
            <div className="summary-row"><strong>Empleado</strong><span>{saved.empleado.nombre}</span></div>
            <div className="summary-row"><strong>Productos</strong><span>{saved.lineas.length}</span></div>
          </div>
          <div className="actions">
            <button className="secondary" type="button" onClick={() => window.print()}>IMPRIMIR</button>
            <a className="secondary" href={`/api/orders/${saved.id}/file?type=pdf`}>DESCARGAR PDF</a>
            <a className="secondary" href={`/api/orders/${saved.id}/file?type=csv`}>DESCARGAR CSV</a>
            <a className="whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/34652388946?text=${msg}`}>ENVIAR A NAVE</a>
            <a className="whatsapp" target="_blank" rel="noreferrer" href={`https://wa.me/34690371977?text=${msg}`}>ENVIAR A PUESTO</a>
            <button className="primary" type="button" onClick={reset}>NUEVO PEDIDO</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <h1 className="page-title">Nueva venta</h1>
      <p className="lead">Crea el pedido, comunícalo y archívalo.</p>

      <div className="grid two">
        <div className="field">
          <label htmlFor="fecha">Fecha</label>
          <input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="empleado">Empleado</label>
          <select id="empleado" value={employeeId} onChange={e => setEmployeeId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {employees.map(e => <option key={e.id || e.nombre} value={e.id}>{e.nombre}{e.departamento ? " · " + e.departamento : ""}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <SearchPicker
          label="Cliente"
          placeholder="Buscar por código o nombre…"
          options={clientOptions}
          valueLabel={selectedClient ? `${selectedClient.codigo} — ${selectedClient.nombre}` : ""}
          onSelect={setClientCode}
        />
      </div>

      <h2 className="section-title">Productos</h2>
      <div className="product-entry">
        <div data-product-picker="true">
          <SearchPicker
            label="Producto"
            placeholder="Buscar producto…"
            options={productOptions}
            valueLabel={productName}
            onSelect={key => {
              const [name] = key.split("::");
              setProductName(name || "");
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="cantidad">Cantidad</label>
          <input
            ref={qtyRef}
            id="cantidad"
            inputMode="decimal"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLine(); } }}
            placeholder="0"
          />
        </div>
        <button className="primary" type="button" onClick={addLine}>{editing === null ? "AÑADIR" : "GUARDAR"}</button>
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        {lines.length ? lines.map((line, index) => (
          <div className="line-card" key={index}>
            <div className="line-main">
              <div className="line-product">{line.producto}</div>
              <div className="line-qty">Cantidad: {line.cantidad}</div>
            </div>
            <div className="line-actions">
              <button type="button" onClick={() => editLine(index)}>EDITAR</button>
              <button type="button" onClick={() => removeLine(index)}>ELIMINAR</button>
            </div>
          </div>
        )) : <div className="empty">Todavía no hay productos en el pedido.</div>}
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="comentarios">Comentarios</label>
        <textarea id="comentarios" value={comments} onChange={e => setComments(e.target.value)} placeholder="Instrucciones para el pedido…" />
      </div>

      <div style={{ marginTop: 16 }}>
        <span className="label">Estado</span>
        <div style={{ marginTop: 7 }} className={statusClass("NUEVO")}>NUEVO</div>
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      <div className="sticky-submit">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "GUARDANDO…" : "FINALIZAR PEDIDO"}
        </button>
      </div>
    </form>
  );
}
