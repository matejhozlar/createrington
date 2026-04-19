import React from "react";
import { Composition } from "remotion";
import { Video } from "./Video";
import { FPS, TOTAL_DURATION } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CreateringtonPromo"
        component={Video}
        durationInFrames={TOTAL_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ audio: false }}
      />
    </>
  );
};
