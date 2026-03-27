import { z } from "zod";

export const importCommitRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  year: z.string().min(1, "Year is required"),
  whatsappNumber: z.string().min(1, "WhatsApp number is required"),
  stream: z.string().min(1, "Stream is required"),
  position1: z.string().min(1, "Primary position is required"),
  position2: z.string().nullable(),
  importOrder: z.number().int().min(0),
});

export const importCommitPayloadSchema = z.object({
  rows: z
    .array(importCommitRowSchema)
    .min(1, "At least one player row is required"),
});

export type ImportCommitRow = z.infer<typeof importCommitRowSchema>;
export type ImportCommitPayload = z.infer<typeof importCommitPayloadSchema>;
