import { ImageResponse } from "next/og";

export const alt = "Wema, un prof particulier IA par matière";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#f7f4ec",
        color: "#161512",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 20,
            background: "#ffc529",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          W
        </div>
        <div style={{ fontSize: 56, fontWeight: 700 }}>Wema</div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.1,
          maxWidth: 980,
        }}
      >
        Un prof particulier IA par matière. Il fait trouver, il ne donne pas la
        réponse.
      </div>
    </div>,
    size,
  );
}
