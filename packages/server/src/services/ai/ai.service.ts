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

/**
 * AI Completion Service
 *
 * Thin wrapper around the OpenAI chat completions API:
 * - Sends single-turn and multi-turn prompts with optional system instructions
 * - Supports conversation context via prior message history
 * - Exposes the raw OpenAI client for advanced use cases
 *
 * NOTE: Constructed directly with an API key — not registered in the
 * service container. Consumers are responsible for instantiation.
 */
export class AiService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = defaultModel;
  }

  /**
   * Generates a chat completion from a prompt.
   *
   * Assembles the message array in order: system prompt (if provided),
   * optional prior context messages, then the user prompt. Throws if
   * the model returns an empty response.
   *
   * @param options - Completion options including prompt, model, temperature, and context
   * @returns The assistant's response text (trimmed)
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
