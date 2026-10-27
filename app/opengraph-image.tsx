import { ImageResponse } from "next/og";
import { CHURCH, addressLine } from "@/lib/church";
import { sealDataUri } from "@/lib/logo";
import { OG_IMAGE } from "@/lib/seo";

export const alt = OG_IMAGE.alt;
export const size = { width: OG_IMAGE.width, height: OG_IMAGE.height };
export const contentType = "image/png";

/** The share card Facebook, texts and search previews show. Flat navy with
 *  the church name — a photo would push the PNG past the size messaging
 *  apps will preview. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          color: "#fbf7ef",
          background: "radial-gradient(ellipse at 85% 10%, #4a1f33 0%, #13213a 60%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img only */}
        <img src={sealDataUri()} width={200} height={200} alt="" style={{ marginRight: 56 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 24, letterSpacing: 8, textTransform: "uppercase", opacity: 0.75 }}>Pittsgrove, New Jersey</div>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, marginTop: 18 }}>{CHURCH.name}</div>
          <div style={{ fontSize: 40, marginTop: 6, opacity: 0.9 }}>{CHURCH.place}</div>
          <div style={{ width: 90, height: 4, background: "#9b3341", marginTop: 34 }} />
          <div style={{ fontSize: 28, marginTop: 26, opacity: 0.85 }}>{addressLine()}</div>
        </div>
      </div>
    ),
    size,
  );
}
