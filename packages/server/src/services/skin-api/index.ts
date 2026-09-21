import { SkinApi } from "createrington-skin-api";
import config from "@/config";
import { SKIN_API_USER_AGENT } from "./constants";

export { MAX_QUALITY_RENDER, MAX_QUALITY_STYLED_RENDER } from "./quality";
export {
  renderStyledSkin,
  SKIN_RENDER_STYLES,
  type SkinRenderStyle,
  type StyledSkinRenderParams,
  type StyledSkinRenderStyle,
} from "./styled";

let client: SkinApi | null = null;

export function getSkinApiClient(): SkinApi {
  if (!client) {
    client = new SkinApi({
      baseUrl: config.skinApi.baseUrl,
      apiKey: config.skinApi.apiKey,
      userAgent: SKIN_API_USER_AGENT,
    });
  }
  return client;
}
