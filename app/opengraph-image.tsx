import { ImageResponse } from "next/og";

export const alt = "Kravia Private Limited — technology for the work that comes next.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#f6f5f0", color: "#101210", padding: "72px" }}>
      <div style={{ position: "absolute", right: "-88px", top: "-126px", width: "570px", height: "570px", borderRadius: "50%", border: "1px solid #b89a5a", opacity: 0.68 }} />
      <div style={{ position: "absolute", right: "28px", top: "-24px", width: "470px", height: "470px", borderRadius: "50%", border: "1px solid #183d32", opacity: 0.22 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: "18px", letterSpacing: "3px", fontWeight: 700 }}>
          <span style={{ display: "flex", width: "30px", height: "42px", borderLeft: "4px solid #183d32", borderTop: "4px solid #183d32", borderBottom: "4px solid #183d32" }} />
          KRAVIA PRIVATE LIMITED
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "880px" }}>
          <div style={{ fontSize: "76px", letterSpacing: "-4px", lineHeight: 1.01, fontWeight: 600 }}>Technology for the work that comes next.</div>
          <div style={{ marginTop: "27px", fontSize: "25px", lineHeight: 1.45, color: "#304139" }}>Software products, intelligent systems and digital infrastructure—built with clarity, responsibility and long-term intent.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "18px", letterSpacing: "2px", color: "#183d32" }}>
          <span style={{ width: "44px", height: "2px", background: "#b89a5a" }} /> INDIA · SOFTWARE · AI · INFRASTRUCTURE
        </div>
      </div>
    </div>,
    size,
  );
}