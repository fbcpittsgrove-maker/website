import { ImageResponse } from "next/og";
import { sealDataUri } from "@/lib/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhones and iPads, which ignore SVG icons. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f4ec" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
        <img src={sealDataUri()} width={156} height={156} alt="" />
      </div>
    ),
    size,
  );
}
