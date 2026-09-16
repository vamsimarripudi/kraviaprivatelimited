import { ImageResponse } from "next/og";

export const alt = "YUKTA — Clinic and hospital workflow platform by Kravia. In development.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function YuktaOpenGraphImage() {
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, background: "#101210", color: "#f6f5f0" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 22 }}><span>KRAVIA PRIVATE LIMITED</span><span>IN DEVELOPMENT</span></div><div style={{ display: "flex", flexDirection: "column", gap: 24 }}><span style={{ fontSize: 82, color: "#b89a5a" }}>YUKTA</span><span style={{ fontSize: 54, maxWidth: 900 }}>Coordinated workflows for clinics and hospitals.</span></div><span style={{ fontSize: 23 }}>A product by Kravia Private Limited</span></div>, size);
}
