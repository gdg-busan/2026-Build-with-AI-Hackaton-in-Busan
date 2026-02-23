import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "GDG Busan - Build with AI 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0E1A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(0,255,136,0.08) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            display: "flex",
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #00FF88, #4DAFFF, #FF6B35)",
            display: "flex",
          }}
        />

        {/* GDG Logo text */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.3em",
            marginBottom: 16,
            display: "flex",
          }}
        >
          GDG BUSAN
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#00FF88",
            display: "flex",
            textAlign: "center",
          }}
        >
          Build with AI 2026
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#4DAFFF",
            marginTop: 20,
            display: "flex",
          }}
        >
          HACKATHON VOTE
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255,255,255,0.6)",
            marginTop: 32,
            display: "flex",
          }}
        >
          25팀의 AI 프로젝트 중 최고를 투표하세요!
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #FF6B35, #4DAFFF, #00FF88)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
