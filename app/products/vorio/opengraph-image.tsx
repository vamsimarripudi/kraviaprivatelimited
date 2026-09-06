import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VORIO - Field Service Dispatch and Execution Platform by Kravia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function VorioOpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#101210", color: "#f6f5f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, letterSpacing: "3px" }}><span>KRAVIA PRIVATE LIMITED</span><span>IN DEVELOPMENT</span></div>
      <div style={{ display: "flex", flexDirection: "column" }}><div style={{ fontSize: 80, letterSpacing: "-4px", color: "#b89a5a" }}>VORIO.</div><div style={{ marginTop: 14, fontSize: 54, letterSpacing: "-2px", maxWidth: 760 }}>Field-service dispatch and execution.</div></div>
      <div style={{ display: "flex", gap: 18, fontSize: 23, color: "#d8d9d1" }}><span>REQUEST</span><span>-&gt;</span><span>DISPATCH</span><span>-&gt;</span><span>EXECUTE</span></div>
    </div>,
    size,
  );
}
