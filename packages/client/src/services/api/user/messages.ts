import type {
  SendMessageResponse,
  SendMessageBody,
} from "@createrington/shared/api";
import { api } from "../client";

/**
 * Message API endpoints
 * Endpoints for sending messages to Minecraft servers via Discord
 */
export const messagesApi = {
  async send(
    body: SendMessageBody,
    image?: File,
  ): Promise<SendMessageResponse["data"]> {
    const formData = new FormData();
    formData.append("serverId", body.serverId.toString());

    if (body.content) {
      formData.append("content", body.content);
    }

    if (image) {
      formData.append("image", image);
    }

    const data = await api
      .getClient()
      .post("/api/messages", { body: formData })
      .json<SendMessageResponse>();

    return data.data;
  },
};
