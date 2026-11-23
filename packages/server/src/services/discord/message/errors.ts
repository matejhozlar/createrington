export class ChannelUnavailableError extends Error {
  constructor(
    readonly channelId: string,
    options?: { cause?: unknown },
  ) {
    super(`Channel ${channelId} is gone or the bot cannot post in it`, options);
    this.name = "ChannelUnavailableError";
  }
}

export class MessageGoneError extends Error {
  constructor(
    readonly channelId: string,
    readonly messageId: string,
    options?: { cause?: unknown },
  ) {
    super(
      `Message ${messageId} in channel ${channelId} no longer exists`,
      options,
    );
    this.name = "MessageGoneError";
  }
}

export function isMessageGone(
  error: unknown,
): error is MessageGoneError | ChannelUnavailableError {
  return (
    error instanceof MessageGoneError ||
    error instanceof ChannelUnavailableError
  );
}
