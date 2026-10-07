"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshMasterDataButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/maintenance/refresh-master-data", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se han podido actualizar los datos.");
      setMessage("Datos actualizados.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se han podido actualizar los datos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="data-refresh no-print">
      <button className="secondary compact-action" type="button" disabled={busy} onClick={refresh}>
        {busy ? "ACTUALIZANDO…" : "ACTUALIZAR DATOS"}
      </button>
      {message && <span className="meta">{message}</span>}
    </div>
  );
}
