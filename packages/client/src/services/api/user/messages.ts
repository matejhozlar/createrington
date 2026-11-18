import type {
  SendMessageResponse,
  SendMessageBody,
} from "@createrington/shared/api";
import { api } from "../client";

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

    const data = await api.post<SendMessageResponse>(
      "api/messages",
      undefined,
      { body: formData },
    );

    return data.data;
  },
};
