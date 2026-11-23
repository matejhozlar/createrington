export class InteractionError extends Error {
  constructor(
    public readonly title: string,
    public readonly description: string,
    options?: { cause?: unknown },
  ) {
    super(description, options);
    this.name = "InteractionError";
  }
}
