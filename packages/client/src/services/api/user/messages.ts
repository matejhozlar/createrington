import type {
  SendMessageResponse,
  SendMessageBody,
} from "@createrington/shared/api";

/**
 * Message API endpoints
 * Endpoints for sending messages to Minecraft servers via Discord
 */
export const messagesApi = {
  /**
   * Send a message to a Minecraft server
   *
   * @param body - Message content and server ID
   * @param image - Optional image file to attach
   * @returns Message ID, server ID, and channel ID
   * @throws {Error} When the API request fails
   *
   * @example
   * // Send text message
   * const result = await messagesApi.send({
   *   serverId: 1,
   *   content: "Hello from the web!"
   * });
   * console.log(`Message sent: ${result.messageId}`);
   *
   * @example
   * // Send message with image
   * const file = document.querySelector('input[type="file"]').files[0];
   * const result = await messagesApi.send(
   *   { serverId: 1, content: "Check this out!" },
   *   file
   * );
   *
   * @example
   * // Send image only (no text)
   * const file = document.querySelector('input[type="file"]').files[0];
   * const result = await messagesApi.send({ serverId: 1 }, file);
   */
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

    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("No authentication token");
    }

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new Error(error.message || "Failed to send message");
    }

    const data: SendMessageResponse = await response.json();
    return data.data;
  },
};
