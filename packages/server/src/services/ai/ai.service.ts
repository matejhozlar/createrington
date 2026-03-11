import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface AiCompletionOptions {
  /** System prompt that sets the AI's behavior */
  system?: string;
  /** The user message / prompt */
  prompt: string;
  /** Model to use (defaults to gpt-4o-mini) */
  model?: string;
  /** Sampling temperature 0-2 (defaults to 0.7) */
  temperature?: number;
  /** Max tokens in response (defaults to 1024) */
  maxTokens?: number;
  /** Optional conversation context (prior messages) */
  context?: ChatCompletionMessageParam[];
}

export class AiService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  /**
   * Generate a chat completion from a prompt.
   *
   * @returns The assistant's response text
   */
  async complete(options: AiCompletionOptions): Promise<string> {
    const {
      system,
      prompt,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1024,
      context = [],
    } = options;

    const messages: ChatCompletionMessageParam[] = [];

    if (system) {
      messages.push({ role: "system", content: system });
    }

    messages.push(...context);
    messages.push({ role: "user", content: prompt });

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned an empty response");
    }

    return content.trim();
  }

  /**
   * Expose the raw OpenAI client for advanced use cases.
   */
  get raw(): OpenAI {
    return this.client;
  }
}
