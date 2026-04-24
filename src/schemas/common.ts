import { z } from "zod";

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional()
  })
});

export const successEnvelopeSchema = z.object({
  ok: z.literal(true)
});
