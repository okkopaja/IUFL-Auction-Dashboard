import { z } from "zod";

export const iconsImportModeSchema = z.enum(["APPEND", "REPLACE"]);

const optionalNullableStringSchema = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

const iconsImportRowBaseSchema = z.object({
  rowKey: z.string().min(1).optional(),
  name: z.string(),
  teamName: z.string(),
  status: z.string(),
  imageUrl: optionalNullableStringSchema,
  points: optionalNullableStringSchema,
  importOrder: z.number().int().min(0),
});

export const iconsImportCheckRowSchema = iconsImportRowBaseSchema.extend({
  rowKey: z.string().min(1, "rowKey is required"),
});

export const iconsImportCheckPayloadSchema = z.object({
  mode: iconsImportModeSchema,
  headers: z.array(z.string()),
  rows: z.array(iconsImportCheckRowSchema).min(1),
});

export const iconsImportResolutionActionSchema = z.enum(["UPSERT", "SKIP"]);

export const iconsImportConflictResolutionSchema = z.object({
  rowKey: z.string().min(1),
  action: iconsImportResolutionActionSchema,
});

export const iconsImportWorkflowCommitPayloadSchema = z.object({
  mode: iconsImportModeSchema,
  checkId: z.string().min(1, "checkId is required"),
  checkFingerprint: z.string().min(8, "checkFingerprint is required"),
  rows: z.array(iconsImportCheckRowSchema).min(1),
  resolutions: z.array(iconsImportConflictResolutionSchema),
});

export type IconsImportCheckPayload = z.infer<
  typeof iconsImportCheckPayloadSchema
>;
export type IconsImportWorkflowCommitPayload = z.infer<
  typeof iconsImportWorkflowCommitPayloadSchema
>;
