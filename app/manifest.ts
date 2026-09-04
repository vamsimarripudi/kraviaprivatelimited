import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kravia Private Limited",
    short_name: "Kravia",
    description: "Kravia builds software products, intelligent systems and digital infrastructure.",
    start_url: "/",
    display: "browser",
    background_color: "#f6f5f0",
    theme_color: "#183d32",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}