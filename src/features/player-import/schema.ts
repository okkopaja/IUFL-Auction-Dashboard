import { z } from "zod";

export const importModeSchema = z.enum(["APPEND", "REPLACE"]);

const optionalNullableStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const importResolutionActionSchema = z.enum([
  "INSERT",
  "UPDATE",
  "SKIP",
]);

const importRowBaseSchema = z.object({
  rowKey: z.string().min(1).optional(),
  name: z.string(),
  year: z.string(),
  whatsappNumber: optionalNullableStringSchema,
  stream: z.string(),
  position1: z.string(),
  position2: optionalNullableStringSchema,
  imageUrl: optionalNullableStringSchema,
  importOrder: z.number().int().min(0),
});

export const importCommitRowSchema = importRowBaseSchema.extend({
  name: z.string().min(1, "Name is required"),
  year: z.string().min(1, "Year is required"),
  stream: z.string().min(1, "Stream is required"),
  position1: z.string().min(1, "Primary position is required"),
});

export const importCommitPayloadSchema = z.object({
  rows: z
    .array(importCommitRowSchema)
    .min(1, "At least one player row is required"),
});

export const importCheckRowSchema = importRowBaseSchema.extend({
  rowKey: z.string().min(1, "Row key is required"),
});

export const importCheckPayloadSchema = z.object({
  mode: importModeSchema,
  headers: z.array(z.string()),
  rows: z.array(importCheckRowSchema).min(1),
});

export const importConflictResolutionSchema = z.object({
  rowKey: z.string().min(1),
  action: importResolutionActionSchema,
});

export const importWorkflowCommitPayloadSchema = z.object({
  mode: importModeSchema,
  checkId: z.string().min(1, "checkId is required"),
  checkFingerprint: z.string().min(8, "checkFingerprint is required"),
  rows: z.array(importCheckRowSchema).min(1),
  resolutions: z.array(importConflictResolutionSchema),
});

export type ImportCommitRow = z.infer<typeof importCommitRowSchema>;
export type ImportCommitPayload = z.infer<typeof importCommitPayloadSchema>;
export type ImportCheckPayload = z.infer<typeof importCheckPayloadSchema>;
export type ImportWorkflowCommitPayload = z.infer<
  typeof importWorkflowCommitPayloadSchema
>;
