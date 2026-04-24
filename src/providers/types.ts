export const MODEL_ALIASES = [
  "claude-haiku",
  "claude-sonnet",
  "claude-opus",
  "mock-fast"
] as const;

export type ModelAlias = (typeof MODEL_ALIASES)[number];
export type GatewayRole = "system" | "user" | "assistant";

export interface GatewayMessage {
  role: GatewayRole;
  content: string;
}

export interface ModelCallInput {
  requestId: string;
  model: ModelAlias;
  messages: GatewayMessage[];
  maxTokens: number;
  temperature: number;
  metadata?: Record<string, unknown>;
}

export interface ModelCallResult {
  provider: string;
  model: string;
  text: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
  };
  raw?: unknown;
}

export interface ModelProvider {
  canHandle(model: ModelAlias): boolean;
  call(input: ModelCallInput): Promise<ModelCallResult>;
}
