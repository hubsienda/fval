"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión.");
      router.replace("/pedido");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid">
      <div className="field">
        <label htmlFor="passphrase">Clave de acceso</label>
        <input
          id="passphrase"
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "Entrando…" : "ENTRAR"}
      </button>
    </form>
  );
}
