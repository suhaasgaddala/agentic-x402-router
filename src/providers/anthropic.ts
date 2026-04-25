import Anthropic, { APIConnectionTimeoutError, APIUserAbortError } from "@anthropic-ai/sdk";
import type { Message, MessageParam, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import type { AppConfig } from "../config.js";
import { HttpError } from "../errors/httpError.js";
import { GATEWAY_SYSTEM_INSTRUCTION } from "../prompts/system.js";
import type { GatewayMessage, ModelAlias, ModelCallInput, ModelCallResult, ModelProvider } from "./types.js";

type AnthropicMessagesClient = {
  create(
    body: MessageCreateParamsNonStreaming,
    options?: { timeout?: number; signal?: AbortSignal; maxRetries?: number }
  ): Promise<Message>;
};

export interface AnthropicProviderOptions {
  apiKey: string;
  modelMap: AppConfig["anthropic"]["models"];
  timeoutMs: number;
  client?: AnthropicMessagesClient;
}

const CLAUDE_ALIASES: ModelAlias[] = ["claude-haiku", "claude-sonnet", "claude-opus"];

export function isClaudeAlias(model: ModelAlias): boolean {
  return CLAUDE_ALIASES.includes(model);
}

export function buildAnthropicSystemPrompt(messages: GatewayMessage[]): string {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  return [GATEWAY_SYSTEM_INSTRUCTION, ...systemMessages].join("\n\n");
}

export function toAnthropicMessages(messages: GatewayMessage[]): MessageParam[] {
  const conversationMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content
    }));

  return conversationMessages.length > 0
    ? conversationMessages
    : [{ role: "user", content: "Please respond to the system instructions." }];
}

export function extractAnthropicText(message: Message): string {
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export function shouldSendTemperature(model: string): boolean {
  return !/claude-(opus|sonnet|haiku)-4/.test(model);
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError) {
    return true;
  }

  return error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message));
}

export class AnthropicProvider implements ModelProvider {
  private readonly client: AnthropicMessagesClient;
  private readonly modelMap: AppConfig["anthropic"]["models"];
  private readonly timeoutMs: number;

  constructor(options: AnthropicProviderOptions) {
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        timeout: options.timeoutMs,
        maxRetries: 1
      }).messages;
    this.modelMap = options.modelMap;
    this.timeoutMs = options.timeoutMs;
  }

  canHandle(model: ModelAlias): boolean {
    return isClaudeAlias(model);
  }

  async call(input: ModelCallInput): Promise<ModelCallResult> {
    if (!this.canHandle(input.model)) {
      throw new HttpError({
        statusCode: 503,
        code: "PROVIDER_NOT_CONFIGURED",
        message: `Anthropic provider cannot handle model ${input.model}.`
      });
    }

    const model = this.modelMap[input.model as Exclude<ModelAlias, "mock-fast">];
    const requestBody: MessageCreateParamsNonStreaming = {
      model,
      max_tokens: input.maxTokens,
      messages: toAnthropicMessages(input.messages),
      system: buildAnthropicSystemPrompt(input.messages)
    };

    if (shouldSendTemperature(model)) {
      requestBody.temperature = input.temperature;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const message = await this.client.create(requestBody, {
        signal: controller.signal,
        timeout: this.timeoutMs,
        maxRetries: 1
      });
      const text = extractAnthropicText(message);

      return {
        provider: "anthropic",
        model: String(message.model || model),
        text,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens
        }
      };
    } catch (error) {
      if (isTimeoutError(error)) {
        throw new HttpError({
          statusCode: 504,
          code: "PROVIDER_TIMEOUT",
          message: "Model provider request timed out.",
          cause: error
        });
      }

      throw new HttpError({
        statusCode: 502,
        code: "PROVIDER_ERROR",
        message: "Model provider request failed.",
        cause: error
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
