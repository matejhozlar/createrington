import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
Config.setCodec("h264");
Config.setPixelFormat("yuv444p");
