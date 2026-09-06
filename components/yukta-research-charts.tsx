"use client";

import { useState } from "react";
import { track } from "@vercel/analytics";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatResearchValue, type ResearchMetric } from "@/lib/products/yukta-research";
import styles from "./vorio-market-chart.module.css";

export function YuktaResearchCharts({ metrics }: { metrics: ResearchMetric[] }) {
  const [view, setView] = useState<"India" | "Global">("India");
  const market = metrics.filter(metric => metric.geography === view && metric.unit === "USD million");
  const facilities = metrics.filter(metric => metric.unit === "facilities");
  return <div className={styles.panel}>
    <div className={styles.toolbar}><div><span className={styles.kicker}>PRACTICE MANAGEMENT SYSTEMS</span><h3>{view} market: estimate to forecast</h3><p>USD millions · software and services · published endpoints only</p></div><div className={styles.switcher} role="group" aria-label="Market geography">{(["India", "Global"] as const).map(region => <button type="button" key={region} aria-pressed={view === region} onClick={() => { setView(region); track("yukta_chart_selected", { view: region }); }}>{region}</button>)}</div></div>
    <div className={styles.metrics}>{market.map(metric => <div key={metric.id}><span>{metric.period} · {metric.kind === "publisher_forecast" ? "Forecast" : "Estimate"}</span><strong>{formatResearchValue(metric)}</strong></div>)}</div>
    <div className={styles.plot} aria-label={`${view} practice management market endpoints`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={market} accessibilityLayer margin={{ top: 15, right: 10, bottom: 10, left: 12 }} barSize={64}>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis dataKey="period" axisLine={false} tickLine={false} tickMargin={12} /><YAxis width={58} domain={[0, "auto"]} tickFormatter={(value: number) => `$${value.toLocaleString("en-US")}`} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
        <Tooltip cursor={{ fill: "var(--mist)", opacity: .4 }} content={({ active, payload }) => { const metric = payload?.[0]?.payload as ResearchMetric | undefined; return active && metric ? <div className={styles.tooltip}><span>{metric.label}</span><strong>{formatResearchValue(metric)}</strong><small>{metric.kind === "publisher_forecast" ? "Publisher forecast, not a guarantee" : "Publisher estimate, not audited actuals"}</small></div> : null; }} />
        <Bar dataKey="value" name="USD millions" isAnimationActive={false} radius={[5, 5, 0, 0]}>{market.map(metric => <Cell key={metric.id} fill="var(--green)" fillOpacity={metric.kind === "publisher_forecast" ? .5 : 1} stroke="var(--green)" strokeDasharray={metric.kind === "publisher_forecast" ? "5 3" : undefined} />)}</Bar>
      </BarChart></ResponsiveContainer>
    </div>
    <p className={styles.summary}>Solid bar: publisher estimate. Dashed-outline bar: publisher forecast. No annual history or interpolation is implied. {view === "India" ? "Grand View Research, updated December 2025." : "Mordor Intelligence, updated July 2026."}</p>
    {facilities.length > 0 && <><div className={styles.toolbar}><div><span className={styles.kicker}>INDIA · INFRASTRUCTURE CONTEXT</span><h3>Where Scan and Register is used</h3><p>Participating facilities · 7 August 2026 · MoHFW / PIB</p></div></div><div className={styles.plot} style={{ height: 210 }}><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart data={facilities} layout="vertical" accessibilityLayer margin={{ top: 16, right: 24, bottom: 8, left: 0 }} barSize={28}><CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="3 5" /><XAxis type="number" domain={[0, 25000]} tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value / 1000}k`} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="label" width={108} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [Number(value).toLocaleString("en-US"), "Facilities"]} /><Bar dataKey="value" fill="var(--green)" radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div><p className={styles.summary}>A government infrastructure snapshot, not all Indian facilities or YUKTA customers. The reported public/private counts total 30,804; the release headline rounds to 30,800.</p></>}
  </div>;
}
