import React from "react";
import { Img, staticFile } from "remotion";
import { theme } from "../theme";

type BrowserFrameProps = {
  src: string;
  url?: string;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
};

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  src,
  url = "createrington.com",
  width,
  height,
  style,
}) => {
  const chromeHeight = 40;
  return (
    <div
      style={{
        width: width ?? "100%",
        height: height ?? "100%",
        borderRadius: 16,
        overflow: "hidden",
        background: theme.card,
        border: `1px solid ${theme.border}`,
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.55), 0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: chromeHeight,
          background: "rgba(0,0,0,0.55)",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
        <div
          style={{
            flex: 1,
            marginLeft: 16,
            padding: "6px 14px",
            borderRadius: 6,
            background: "rgba(255,255,255,0.06)",
            color: theme.mutedForeground,
            fontSize: 13,
            fontFamily: theme.fontMono,
            maxWidth: 360,
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", background: theme.card }}>
        <Img
          src={staticFile(src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "left top",
          }}
        />
      </div>
    </div>
  );
};
