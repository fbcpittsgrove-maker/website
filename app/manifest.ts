import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Faith Baptist Church of Pittsgrove",
    short_name: "FBC Pittsgrove",
    description: "Faith Baptist Church of Pittsgrove — Elmer, New Jersey.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#2f4a6d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
