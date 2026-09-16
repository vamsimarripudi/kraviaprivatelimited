"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, LoaderCircle, RefreshCw, ServerCog, TriangleAlert } from "lucide-react";
import type { RuntimeColumn, RuntimeModuleSpec } from "@/lib/office/runtime-modules";

type JsonObject = Record<string, unknown>;
type RuntimeState =
  | { kind: "loading" }
  | { kind: "ready"; data: unknown }
  | { kind: "setup"; detail: string }
  | { kind: "error"; detail: string };

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valueAt(record: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => isObject(current) ? current[part] : undefined, record);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  if (typeof value === "string") return value.length > 90 ? `${value.slice(0, 87)}…` : value;
  return "Controlled data";
}

function DataTable({ rows, columns }: { rows: unknown[]; columns: readonly RuntimeColumn[] }) {
  return <div className="workspace-runtime-table-wrap">
    <table className="workspace-runtime-table">
      <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
      <tbody>
        {rows.length ? rows.slice(0, 100).map((row, index) => <tr key={isObject(row) && typeof row.id === "string" ? row.id : index}>
          {columns.map((column) => <td key={column.key}>{displayValue(valueAt(row, column.key))}</td>)}
        </tr>) : <tr><td colSpan={columns.length}><div className="workspace-runtime-empty">No canonical records in this module yet.</div></td></tr>}
      </tbody>
    </table>
    {rows.length > 100 ? <p className="workspace-runtime-limit">Showing the first 100 records. Use the module filters/API for larger controlled sets.</p> : null}
  </div>;
}

function ObjectMetrics({ data, keys }: { data: unknown; keys: readonly RuntimeColumn[] }) {
  return <div className="workspace-runtime-metrics">
    {keys.map((field) => <article key={field.key}><span>{field.label}</span><strong>{displayValue(valueAt(data, field.key))}</strong></article>)}
  </div>;
}

export function WorkspaceRuntimePanel({ title, spec }: { title: string; spec: RuntimeModuleSpec }) {
  const [state, setState] = useState<RuntimeState>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/office-runtime/${spec.path}`, { credentials: "same-origin", cache: "no-store" });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await response.json() : null;
      if (!response.ok) {
        const detail = isObject(payload) && typeof payload.detail === "string" ? payload.detail : "Canonical runtime request failed";
        setState(response.status === 503 ? { kind: "setup", detail } : { kind: "error", detail });
        return;
      }
      setState({ kind: "ready", data: payload });
    } catch {
      setState({ kind: "error", detail: "Canonical KRAVIA Office runtime could not be reached." });
    }
  }, [spec.path]);

  const refresh = useCallback(() => {
    setState({ kind: "loading" });
    void load();
  }, [load]);

  useEffect(() => { void load(); }, [load]);

  if (state.kind === "loading") {
    return <section className="workspace-runtime-panel workspace-runtime-state"><LoaderCircle className="spin" /><div><p className="eyebrow">CANONICAL RUNTIME</p><h2>Loading {title}</h2><p>Reading authorised records through the same-origin Office gateway.</p></div></section>;
  }

  if (state.kind === "setup") {
    return <section className="workspace-runtime-panel workspace-runtime-state"><ServerCog /><div><p className="eyebrow">RUNTIME ACTIVATION</p><h2>Backend connection required</h2><p>{state.detail}</p><small>The route, identity, MFA and gateway controls are active. No data is fabricated while the production FastAPI runtime is unconfigured.</small></div></section>;
  }

  if (state.kind === "error") {
    return <section className="workspace-runtime-panel workspace-runtime-state"><TriangleAlert /><div><p className="eyebrow">SOURCE UNAVAILABLE</p><h2>{title} could not be loaded</h2><p>{state.detail}</p><button type="button" className="workspace-runtime-refresh" onClick={refresh}><RefreshCw /> Retry</button></div></section>;
  }

  const data = state.data;
  const nestedRows = spec.nestedRowsKey && isObject(data) && Array.isArray(data[spec.nestedRowsKey]) ? data[spec.nestedRowsKey] as unknown[] : null;
  const directRows = Array.isArray(data) ? data : null;

  return <section className="workspace-runtime-panel">
    <div className="workspace-runtime-head"><div><p className="eyebrow">CANONICAL RUNTIME</p><h2>{title}</h2><p>{spec.note}</p></div><div className="workspace-runtime-live"><Database /><span>Live source</span></div></div>
    {spec.objectKeys?.length ? <ObjectMetrics data={data} keys={spec.objectKeys} /> : null}
    {spec.columns?.length && (nestedRows || directRows) ? <DataTable rows={nestedRows ?? directRows ?? []} columns={spec.columns} /> : null}
    {!spec.objectKeys?.length && !spec.columns?.length ? <div className="workspace-runtime-empty">Canonical runtime connected. This module uses its specialised operational workflow rather than a generic record table.</div> : null}
    <div className="workspace-runtime-foot"><span>Results are role-scoped and uncached.</span><button type="button" className="workspace-runtime-refresh" onClick={refresh}><RefreshCw /> Refresh</button></div>
  </section>;
}
