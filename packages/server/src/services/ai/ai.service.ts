import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface AiCompletionOptions {
  system?: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: ChatCompletionMessageParam[];
}

/**
 * Thin wrapper around the OpenAI chat completions API for single-turn and multi-turn
 * prompts with an optional system instruction and prior message context. Constructed
 * directly with an API key (not registered in the service container), so consumers
 * own the lifecycle. Exposes the raw OpenAI client for use cases `complete()` does
 * not cover.
 */
export class AiService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  /**
   * Chat completion built as [system?, ...context, user]; returns the trimmed assistant text.
   * Throws if the model returns an empty response.
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

  /** Returns the raw OpenAI client for advanced use cases not covered by `complete()` */
  get raw(): OpenAI {
    return this.client;
  }
}
