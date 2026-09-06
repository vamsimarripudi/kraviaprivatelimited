"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildForecastSeries, formatUsdBn, selectedGlobalMarketEstimate, selectedUsMarketEstimate, vorioMarketResearchReviewedAt } from "@/lib/products/vorio-market";
import styles from "./vorio-market-chart.module.css";

export function VorioMarketChart() {
  const [region, setRegion] = useState<"global" | "us">("global");
  const gradientId = useId().replace(/:/g, "");
  const estimate = region === "global" ? selectedGlobalMarketEstimate : selectedUsMarketEstimate;
  const data = buildForecastSeries(estimate);
  const ceiling = region === "global" ? 10 : 2.5;
  const growth = Math.round((estimate.forecastValueUsdBn / estimate.baseValueUsdBn - 1) * 100);
  return <div className={styles.panel}>
    <div className={styles.toolbar}>
      <div><span className={styles.kicker}>FIELD SERVICE MANAGEMENT</span><h3>{region === "global" ? "Global" : "United States"} market outlook</h3><p>2025–2030 · USD billions</p></div>
      <div className={styles.switcher} role="group" aria-label="Market geography">
        <button type="button" aria-pressed={region === "global"} onClick={() => setRegion("global")}>Global</button>
        <button type="button" aria-pressed={region === "us"} onClick={() => setRegion("us")}>United States</button>
      </div>
    </div>
    <div className={styles.metrics} aria-live="polite">
      <div><span>2025 estimate</span><strong>{formatUsdBn(estimate.baseValueUsdBn)}</strong></div>
      <div><span>2030 forecast</span><strong>{formatUsdBn(estimate.forecastValueUsdBn)}</strong></div>
      <div><span>Annual growth</span><strong>{estimate.cagr}<small>% CAGR</small></strong></div>
    </div>
    <figure className={styles.figure}>
      <figcaption className={styles.chartCaption}><span><i aria-hidden="true" />Market size forecast</span><span>Zero-based scale · USD B</span></figcaption>
      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data} margin={{ top: 16, right: 14, bottom: 8, left: 0 }} accessibilityLayer>
            <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--green)" stopOpacity={0.015} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
            <XAxis dataKey="year" axisLine={false} tickLine={false} minTickGap={16} tickMargin={14} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
            <YAxis domain={[0, ceiling]} ticks={region === "global" ? [0, 2.5, 5, 7.5, 10] : [0, 0.5, 1, 1.5, 2, 2.5]} width={44} axisLine={false} tickLine={false} tick={{ fill: "var(--ink-2)", fontSize: 12 }} tickFormatter={(value: number) => `$${value}`} />
            <Tooltip cursor={{ stroke: "var(--green)", strokeDasharray: "4 4" }} content={({ active, payload }) => {
              const point = payload?.[0]?.payload as (typeof data)[number] | undefined;
              return active && point ? <div className={styles.tooltip}><span>{point.year} forecast</span><strong>{formatUsdBn(point.valueUsdBn)}</strong><small>{point.derived ? "Calculated from published CAGR" : "Published report estimate"}</small></div> : null;
            }} />
            <Area type="linear" dataKey="valueUsdBn" name="Market size" stroke="var(--green)" strokeWidth={3} fill={`url(#${gradientId})`} dot={{ r: 4, fill: "var(--paper)", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 3, stroke: "var(--paper)" }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.summary}>{formatUsdBn(estimate.baseValueUsdBn)} in 2025 → {formatUsdBn(estimate.forecastValueUsdBn)} forecast for 2030. Intermediate years are calculated from the published {estimate.cagr}% CAGR.</p>
    </figure>
    <div className={styles.bottom}>
      <div className={styles.comparison}><span>Five-year projected change</span><strong>+{growth}%</strong><div className={styles.barRow}><span>2025</span><div><i style={{ width: `${estimate.baseValueUsdBn / estimate.forecastValueUsdBn * 100}%` }} /></div><span>100</span></div><div className={styles.barRow}><span>2030</span><div><i /></div><span>{100 + growth}</span></div><small>Index: 2025 = 100. Derived from published endpoints.</small></div>
      <div className={styles.source}><span className={styles.kicker}>SOURCE & METHODOLOGY</span><a href={estimate.url} target="_blank" rel="noreferrer">MarketsandMarkets ↗</a><p>Report: {estimate.publishedAt}. Forecasts describe the broader FSM category, not VORIO revenue or market share. Estimates vary across providers.</p><small>Research reviewed {vorioMarketResearchReviewedAt}</small></div>
    </div>
    <details className={styles.table}><summary>View forecast data and calculation method</summary><div><table><caption>{region === "global" ? "Global" : "US"} field service management market · USD billions</caption><thead><tr><th scope="col">Year</th><th scope="col">Value</th><th scope="col">Method</th></tr></thead><tbody>{data.map(point => <tr key={point.year}><td>{point.year}</td><td>{formatUsdBn(point.valueUsdBn)}</td><td>{point.derived ? "CAGR-derived" : "Published endpoint"}</td></tr>)}</tbody></table></div></details>
  </div>;
}
