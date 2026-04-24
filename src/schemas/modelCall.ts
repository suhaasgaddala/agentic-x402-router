import { z } from "zod";
import { MODEL_ALIASES } from "../providers/types.js";

export interface ModelCallSchemaOptions {
  maxInputChars: number;
  maxOutputTokens: number;
}

export const modelAliasSchema = z.enum(MODEL_ALIASES);

export const gatewayMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().trim().min(1, "content must not be empty")
});

export function createModelCallSchema(options: ModelCallSchemaOptions) {
  return z
    .object({
      model: modelAliasSchema.default("claude-sonnet"),
      messages: z.array(gatewayMessageSchema).min(1, "messages must contain at least one item"),
      max_tokens: z
        .number()
        .int()
        .min(1)
        .max(options.maxOutputTokens)
        .default(Math.min(1_000, options.maxOutputTokens)),
      temperature: z.number().min(0).max(1).default(0.2),
      metadata: z.record(z.unknown()).optional()
    })
    .strict()
    .superRefine((value, ctx) => {
      const totalChars = value.messages.reduce((sum, message) => sum + message.content.length, 0);
      if (totalChars > options.maxInputChars) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: options.maxInputChars,
          type: "string",
          inclusive: true,
          message: `total message content length must be <= ${options.maxInputChars} characters`,
          path: ["messages"]
        });
      }
    });
}

export type ParsedModelCallRequest = z.infer<ReturnType<typeof createModelCallSchema>>;
