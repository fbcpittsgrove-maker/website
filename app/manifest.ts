import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Faith Baptist Church of Pittsgrove",
    short_name: "FBC Pittsgrove",
    description: "Faith Baptist Church of Pittsgrove — Elmer, New Jersey.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f4ec",
    theme_color: "#1c2b55",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
